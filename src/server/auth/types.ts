import type {
  ClubMembershipRole,
  MembershipStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/enums";

export type ActorMembership = {
  clubId: string;
  role: ClubMembershipRole;
  status: MembershipStatus;
};

/**
 * The trusted actor context used by services and authorization helpers.
 *
 * This object must be built from a verified server session (or a trusted
 * server-side bootstrap/test helper), never from a request body.
 */
export type AuthenticatedActor = {
  id: string;
  collegeId: string | null;
  role: UserRole;
  status: UserStatus;
  deletedAt: Date | null;
  clubMemberships: ActorMembership[];
};

export type AuthenticatedUser = AuthenticatedActor & {
  name: string;
  email: string;
  sessionId: string;
  sessionExpiresAt: Date;
};

export type RequestAuditContext = {
  ipHash?: string;
  userAgent?: string;
};
