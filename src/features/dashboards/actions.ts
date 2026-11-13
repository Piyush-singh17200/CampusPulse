"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DomainError, InvalidInputError } from "@/server/errors";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { POSTER_MAX_BYTES, validatePosterImage } from "@/server/posters/image";
import { markAttendance } from "@/services/attendance";
import { changeCollegeStatus, updateCollegeSettings } from "@/services/colleges";
import { decideClub, updateClubProfile } from "@/services/clubs";
import { createEventDraft, transitionEvent, updateEvent } from "@/services/events";
import { markAllNotificationsRead, markNotificationRead } from "@/services/notifications";
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

function success(message: string): DashboardActionState {
  return { status: "success", message };
}

export async function saveEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
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
    const user = await actor();
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
    const user = await actor();
    const eventId = field(formData, "eventId");
    await registerForEvent(user, { eventId });
    revalidatePath("/student");
    revalidatePath("/student/discover");
    revalidatePath(`/student/events/${eventId}`);
    revalidatePath("/student/registrations");
    revalidatePath("/student/calendar");
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
    const user = await actor();
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
    throw new InvalidInputError("Posters must be 5 MB or smaller.");
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
    const user = await actor();
    const clubId = field(formData, "clubId");
    const poster = await readPosterFile(formData);

    if (poster) {
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
    const user = await actor();
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
    const user = await actor();
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
    const user = await actor();
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

export async function transitionEventAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
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

export async function decideClubAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
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
    const user = await actor();
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
    const user = await actor();
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

export async function changeUserRoleAction(
  _previous: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const user = await actor();
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
    const user = await actor();
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
    const user = await actor();
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
    const user = await actor();
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
