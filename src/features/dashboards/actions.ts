"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DomainError, InvalidInputError } from "@/server/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { RATE_LIMITS, enforceRateLimit, type RateLimitPolicy } from "@/server/auth/rate-limit";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { POSTER_MAX_BYTES, validatePosterImage } from "@/server/posters/image";
import {
  correctAttendance,
  issueAttendanceQr,
  markAttendance,
  scanAttendance,
} from "@/services/attendance";
import { moderateFeedback, submitFeedback, updateFeedback } from "@/services/feedback";
import { changeCollegeStatus, createCollege, updateCollegeSettings } from "@/services/colleges";
import { decideClub, updateClubProfile } from "@/services/clubs";
import { reviewDuplicate } from "@/services/duplicate-events";
import { createEventDraft, transitionEvent, updateEvent } from "@/services/events";
import {
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/services/notifications";
import { applyPosterOcrReview, processPosterOcr } from "@/services/poster-ocr";
import { removeEventPoster, uploadEventPoster } from "@/services/posters";
import { cancelRegistration, registerForEvent } from "@/services/registrations";
import { saveEvent, unsaveEvent } from "@/services/saved-events";
import { updateStudentProfile } from "@/services/student-profile";
import { changeUserStatus } from "@/services/user-status";
import { changeUserRole } from "@/services/users";
import type { DashboardActionState } from "@/features/dashboards/types";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function nullableField(formData: FormData, key: string): string | null {
  const value = field(formData, key).trim();
  return value ? value : null;
}

function numberOrNull(formData: FormData, key: string): number | null {
  const value = field(formData, key).trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolField(formData: FormData, key: string): boolean {
  return ["on", "true", "1"].includes(field(formData, key).toLowerCase());
}

function errorState(error: unknown): DashboardActionState {
  if (error instanceof DomainError) {
    return { status: "error", message: error.message };
  }

  console.error(`Dashboard action failed: ${error instanceof Error ? error.name : "unknown"}`);
  return { status: "error", message: "Something went wrong. Please try again." };
}

async function actor() {
  await assertSameOrigin();
  return requireAuthenticatedUser();
}

/**
 * Authenticates the caller and applies a PostgreSQL-backed per-user budget for
 * an expensive or abuse-prone operation. Enforcement lives at the action
 * boundary so the underlying services remain deterministic for direct tests.
 */
async function limitedActor(policy: RateLimitPolicy) {
  const user = await actor();
  await enforceRateLimit(policy, user.id);
  return user;
}

function success(message: string): DashboardActionState {
  return { status: "success", message };
}

export async function saveEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.registrationWriteUser);
    const eventId = field(formData, "eventId");
    await saveEvent(user, { eventId });
    revalidatePath("/student");
    revalidatePath("/student/discover");
    revalidatePath(`/student/events/${eventId}`);
    revalidatePath("/student/saved");
    return success("Event saved to your shortlist.");
  } catch (error) {
    return errorState(error);
  }
}

export async function unsaveEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.registrationWriteUser);
    const eventId = field(formData, "eventId");
    await unsaveEvent(user, { eventId });
    revalidatePath("/student");
    revalidatePath("/student/discover");
    revalidatePath(`/student/events/${eventId}`);
    revalidatePath("/student/saved");
    return success("Event removed from your shortlist.");
  } catch (error) {
    return errorState(error);
  }
}

export async function registerForEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.registrationWriteUser);
    const eventId = field(formData, "eventId");
    const result = await registerForEvent(user, { eventId });
    revalidatePath("/student");
    revalidatePath("/student/discover");
    revalidatePath(`/student/events/${eventId}`);
    revalidatePath("/student/registrations");
    revalidatePath("/student/calendar");

    const conflicts = result.scheduleConflicts ?? [];
    if (conflicts.length) {
      const first = conflicts[0];
      return success(
        `Your registration is confirmed. Schedule warning: this overlaps with "${first.title}"${
          conflicts.length > 1 ? ` and ${conflicts.length - 1} other event(s)` : ""
        }. Your place is still reserved.`,
      );
    }

    return success("Your registration is confirmed.");
  } catch (error) {
    return errorState(error);
  }
}

export async function cancelRegistrationAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.registrationWriteUser);
    const eventId = field(formData, "eventId");
    await cancelRegistration(user, { eventId });
    revalidatePath("/student");
    revalidatePath("/student/registrations");
    revalidatePath(`/student/events/${eventId}`);
    revalidatePath("/student/calendar");
    return success("Your registration was cancelled.");
  } catch (error) {
    return errorState(error);
  }
}

export async function markNotificationReadAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
    await markNotificationRead(user, { notificationId: field(formData, "notificationId") });
    revalidatePath("/student/notifications");
    revalidatePath("/student");
    return success("Notification marked as read.");
  } catch (error) {
    return errorState(error);
  }
}

export async function markAllNotificationsReadAction(
  _previous: DashboardActionState,
  _formData: FormData,
): Promise<DashboardActionState> {
  void _previous;
  void _formData;

  try {
    const user = await actor();
    await markAllNotificationsRead(user);
    revalidatePath("/student/notifications");
    revalidatePath("/student");
    return success("All notifications marked as read.");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateStudentProfileAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
    await updateStudentProfile(user, {
      name: field(formData, "name"),
      rollNumber: nullableField(formData, "rollNumber"),
      department: nullableField(formData, "department"),
      graduationYear: numberOrNull(formData, "graduationYear"),
      bio: nullableField(formData, "bio"),
      interestIds: formData.getAll("interestIds").map(String).filter(Boolean),
    });
    revalidatePath("/student/profile");
    revalidatePath("/student");
    return success("Your profile was updated.");
  } catch (error) {
    return errorState(error);
  }
}

function eventInput(formData: FormData) {
  return {
    title: field(formData, "title"),
    summary: nullableField(formData, "summary"),
    description: nullableField(formData, "description"),
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    registrationOpensAt: nullableField(formData, "registrationOpensAt"),
    registrationDeadline: nullableField(formData, "registrationDeadline"),
    venueName: field(formData, "venueName"),
    venueAddress: nullableField(formData, "venueAddress"),
    isOnline: boolField(formData, "isOnline"),
    onlineUrl: nullableField(formData, "onlineUrl"),
    capacity: numberOrNull(formData, "capacity"),
    categoryIds: formData.getAll("categoryIds").map(String).filter(Boolean),
    interestIds: formData.getAll("interestIds").map(String).filter(Boolean),
  };
}

async function readPosterFile(
  formData: FormData,
): Promise<{ bytes: Uint8Array; altText: string | null } | null> {
  const value = formData.get("poster");

  if (!value || typeof value === "string" || value.size === 0) {
    return null;
  }

  if (value.size > POSTER_MAX_BYTES) {
    throw new InvalidInputError("Posters must be 4.2 MB or smaller.");
  }

  return {
    bytes: new Uint8Array(await value.arrayBuffer()),
    altText: nullableField(formData, "posterAltText"),
  };
}

export async function createEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  let created: { id: string; clubId: string } | null = null;
  let posterUploadFailed = false;

  try {
    const user = await limitedActor(RATE_LIMITS.eventWriteUser);
    const clubId = field(formData, "clubId");
    const poster = await readPosterFile(formData);

    if (poster) {
      await enforceRateLimit(RATE_LIMITS.posterUploadUser, user.id);
      // Validate before creating the draft so an invalid file does not leave a
      // new event behind.
      validatePosterImage(poster.bytes);
    }

    created = await createEventDraft(user, { clubId, ...eventInput(formData) });

    if (poster) {
      try {
        await uploadEventPoster(user, { eventId: created.id, ...poster });
      } catch (error) {
        posterUploadFailed = true;
        console.error(
          `Poster upload after event creation failed: ${
            error instanceof Error ? error.name : "unknown"
          }`,
        );
      }
    }
  } catch (error) {
    return errorState(error);
  }

  if (!created) {
    return errorState(new Error("Event creation did not return an event."));
  }

  revalidatePath("/club");
  revalidatePath("/club/events");
  revalidatePath(`/club/events/${created.id}`);
  revalidatePath(`/club/events/${created.id}/edit`);

  if (posterUploadFailed) {
    redirect(`/club/events/${created.id}/edit?club=${created.clubId}&posterError=1`);
  }

  redirect(`/club/events/${created.id}?club=${created.clubId}`);
}

export async function uploadPosterAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.posterUploadUser);
    const eventId = field(formData, "eventId");
    const poster = await readPosterFile(formData);

    if (!poster) {
      return { status: "error", message: "Choose a poster image to upload." };
    }

    await uploadEventPoster(user, { eventId, ...poster });

    revalidatePath("/club");
    revalidatePath("/club/events");
    revalidatePath(`/club/events/${eventId}`);
    revalidatePath(`/club/events/${eventId}/edit`);
    revalidatePath("/college/events");
    revalidatePath(`/college/events/${eventId}`);
    revalidatePath("/college/approvals");
    revalidatePath("/student");
    revalidatePath("/student/discover");
    revalidatePath(`/student/events/${eventId}`);

    return success("Poster uploaded.");
  } catch (error) {
    return errorState(error);
  }
}

export async function removePosterAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.posterUploadUser);
    const eventId = field(formData, "eventId");
    const result = await removeEventPoster(user, { eventId });

    revalidatePath("/club");
    revalidatePath("/club/events");
    revalidatePath(`/club/events/${eventId}`);
    revalidatePath(`/club/events/${eventId}/edit`);
    revalidatePath("/college/events");
    revalidatePath(`/college/events/${eventId}`);
    revalidatePath("/college/approvals");
    revalidatePath("/student");
    revalidatePath("/student/discover");
    revalidatePath(`/student/events/${eventId}`);

    return success(result.removed ? "Poster removed." : "There is no poster to remove.");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.eventWriteUser);
    const eventId = field(formData, "eventId");
    await updateEvent(user, { eventId, ...eventInput(formData) });
    revalidatePath("/club");
    revalidatePath("/club/events");
    revalidatePath(`/club/events/${eventId}`);
    return success("Event details saved.");
  } catch (error) {
    return errorState(error);
  }
}

export async function runPosterOcrAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.posterOcrUser);
    const eventId = field(formData, "eventId");
    const result = await processPosterOcr(user, { posterId: field(formData, "posterId") });

    revalidatePath(`/club/events/${eventId}/edit`);

    if (result.status === "FAILED") {
      return { status: "error", message: result.error ?? "The poster could not be processed." };
    }
    if (result.status === "PROCESSING" || result.status === "PENDING") {
      return success("OCR is already running. Refresh the page in a moment to review it.");
    }

    return success("Poster details extracted. Review each suggestion before applying it.");
  } catch (error) {
    return errorState(error);
  }
}

export async function applyPosterOcrAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.eventWriteUser);
    const eventId = field(formData, "eventId");
    const payload = field(formData, "payload");

    let decisions: unknown;
    try {
      decisions = JSON.parse(payload);
    } catch {
      throw new InvalidInputError("The OCR review payload is not valid.");
    }

    await applyPosterOcrReview(user, {
      posterId: field(formData, "posterId"),
      eventId,
      decisions,
    });

    revalidatePath(`/club/events/${eventId}`);
    revalidatePath(`/club/events/${eventId}/edit`);
    revalidatePath("/club/events");
    revalidatePath("/college/events");
    revalidatePath(`/college/events/${eventId}`);
    revalidatePath("/student");
    revalidatePath(`/student/events/${eventId}`);

    return success("OCR review saved. Check the event details before submitting.");
  } catch (error) {
    return errorState(error);
  }
}

export async function transitionEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.eventWriteUser);
    const eventId = field(formData, "eventId");
    await transitionEvent(user, {
      eventId,
      to: field(formData, "to"),
      reason: nullableField(formData, "reason") ?? undefined,
    });
    revalidatePath("/club");
    revalidatePath("/club/events");
    revalidatePath(`/club/events/${eventId}`);
    revalidatePath("/college");
    revalidatePath("/college/approvals");
    revalidatePath("/college/events");
    revalidatePath(`/college/events/${eventId}`);
    return success("Event status updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function reviewDuplicateAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.eventWriteUser);
    await reviewDuplicate(user, {
      duplicateId: field(formData, "duplicateId"),
      decision: field(formData, "decision"),
    });
    revalidatePath("/college");
    revalidatePath("/college/approvals");
    revalidatePath("/college/events");
    const eventId = field(formData, "eventId");
    if (eventId) {
      revalidatePath(`/college/events/${eventId}`);
    }
    return success(
      field(formData, "decision") === "CONFIRM"
        ? "Duplicate confirmed. Both event records were left unchanged."
        : "Duplicate suggestion dismissed.",
    );
  } catch (error) {
    return errorState(error);
  }
}

export async function decideClubAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await decideClub(user, {
      clubId: field(formData, "clubId"),
      decision: field(formData, "decision"),
      reason: nullableField(formData, "reason") ?? undefined,
    });
    revalidatePath("/college");
    revalidatePath("/college/approvals");
    revalidatePath("/college/clubs");
    return success("Club decision recorded.");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateClubProfileAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await updateClubProfile(user, {
      clubId: field(formData, "clubId"),
      name: field(formData, "name"),
      description: nullableField(formData, "description"),
    });
    revalidatePath("/club");
    revalidatePath("/club/settings");
    return success("Club profile updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function markAttendanceAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.attendanceWriteUser);
    await markAttendance(user, {
      registrationId: field(formData, "registrationId"),
      status: field(formData, "status"),
    });
    revalidatePath("/club/attendance");
    revalidatePath("/club/analytics");
    return success("Attendance recorded.");
  } catch (error) {
    return errorState(error);
  }
}

export async function issueAttendanceQrAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.attendanceWriteUser);
    const registrationId = field(formData, "registrationId");
    const issued = await issueAttendanceQr(user, registrationId);
    revalidatePath("/student/registrations");
    revalidatePath(`/student/registrations/${registrationId}/attendance`);

    return {
      status: "success",
      message: "Attendance QR generated. It is valid for this event's check-in window.",
      data: {
        qr: {
          qrDataUrl: issued.qrDataUrl,
          payload: issued.payload,
          expiresAt: issued.expiresAt.toISOString(),
        },
      },
    };
  } catch (error) {
    return errorState(error);
  }
}

/**
 * Direct server action used by the scanner after a QR decode or manual code
 * submission. The scanner never supplies a student identity; the server derives
 * it from the credential and the authenticated organizer.
 */
export async function scanAttendanceAction(formData: FormData): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.attendanceScanUser);
    const result = await scanAttendance(user, {
      eventId: field(formData, "eventId"),
      token: field(formData, "token"),
    });
    revalidatePath("/club/attendance");
    revalidatePath("/club/analytics");
    revalidatePath("/student/registrations");

    return {
      status: "success",
      message: `${result.studentName} checked in successfully.`,
      data: {
        scan: {
          studentName: result.studentName,
          rollNumber: result.rollNumber,
          eventTitle: result.eventTitle,
          checkedInAt: result.checkedInAt.toISOString(),
        },
      },
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function correctAttendanceAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.attendanceWriteUser);
    await correctAttendance(user, {
      registrationId: field(formData, "registrationId"),
      status: field(formData, "status"),
      reason: field(formData, "reason"),
    });
    revalidatePath("/club/attendance");
    revalidatePath("/club/analytics");
    revalidatePath("/college/analytics");
    revalidatePath("/student/registrations");
    return success("Attendance correction recorded.");
  } catch (error) {
    return errorState(error);
  }
}

export async function submitFeedbackAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.feedbackWriteUser);
    await submitFeedback(user, {
      eventId: field(formData, "eventId"),
      rating: field(formData, "rating"),
      comment: nullableField(formData, "comment"),
    });
    revalidatePath("/student/feedback");
    revalidatePath("/club/feedback");
    revalidatePath("/college/analytics");
    return success("Thank you. Your feedback was submitted.");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateFeedbackAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.feedbackWriteUser);
    await updateFeedback(user, {
      eventId: field(formData, "eventId"),
      rating: field(formData, "rating"),
      comment: nullableField(formData, "comment"),
    });
    revalidatePath("/student/feedback");
    revalidatePath("/club/feedback");
    revalidatePath("/college/analytics");
    return success("Your feedback was updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function moderateFeedbackAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await moderateFeedback(user, {
      feedbackId: field(formData, "feedbackId"),
      decision: field(formData, "decision"),
      reason: field(formData, "reason"),
    });
    revalidatePath("/college/feedback");
    revalidatePath("/college/analytics");
    revalidatePath("/club/feedback");
    revalidatePath("/student/feedback");
    return success("Feedback moderation decision recorded.");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateNotificationPreferencesAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
    await updateNotificationPreferences(user, {
      registrationUpdates: boolField(formData, "registrationUpdates"),
      attendanceUpdates: boolField(formData, "attendanceUpdates"),
      feedbackUpdates: boolField(formData, "feedbackUpdates"),
    });
    revalidatePath("/student/notifications");
    return success("Notification preferences saved.");
  } catch (error) {
    return errorState(error);
  }
}

export async function changeUserRoleAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await changeUserRole(user, {
      targetUserId: field(formData, "targetUserId"),
      role: field(formData, "role"),
    });
    revalidatePath("/college/users");
    revalidatePath("/platform/users");
    return success("User role updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function changeUserStatusAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await changeUserStatus(user, {
      targetUserId: field(formData, "targetUserId"),
      status: field(formData, "status"),
    });
    revalidatePath("/college/users");
    revalidatePath("/platform/users");
    return success("User status updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateCollegeSettingsAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await updateCollegeSettings(user, {
      name: field(formData, "name"),
      shortName: nullableField(formData, "shortName"),
      timezone: field(formData, "timezone"),
    });
    revalidatePath("/college/settings");
    revalidatePath("/college");
    return success("College settings updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function changeCollegeStatusAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    await changeCollegeStatus(user, {
      collegeId: field(formData, "collegeId"),
      status: field(formData, "status"),
    });
    revalidatePath("/platform");
    revalidatePath("/platform/colleges");
    revalidatePath(`/platform/colleges/${field(formData, "collegeId")}`);
    return success("College status updated.");
  } catch (error) {
    return errorState(error);
  }
}

export async function createCollegeAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await limitedActor(RATE_LIMITS.adminWriteUser);
    const college = await createCollege(user, {
      name: field(formData, "name"),
      slug: field(formData, "slug"),
      shortName: nullableField(formData, "shortName"),
      primaryDomain: nullableField(formData, "primaryDomain"),
      timezone: field(formData, "timezone") || "Asia/Kolkata",
    });
    revalidatePath("/platform");
    revalidatePath("/platform/colleges");
    return success(`College "${college.name}" created successfully.`);
  } catch (error) {
    return errorState(error);
  }
}
