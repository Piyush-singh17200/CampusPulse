export type DomainErrorCode =
  | "TENANT_ISOLATION"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "EVENT_NOT_OPEN"
  | "REGISTRATION_CLOSED"
  | "REGISTRATION_NOT_OPEN"
  | "EVENT_FULL"
  | "ALREADY_REGISTERED"
  | "NOT_REGISTERED"
  | "ACTOR_NOT_AUTHORIZED"
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_EXISTS"
  | "INVALID_RESET_TOKEN"
  | "INVALID_ORIGIN"
  | "RATE_LIMITED"
  | "CONFLICT";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

export class TenantIsolationError extends DomainError {
  constructor() {
    super("TENANT_ISOLATION", "The requested record does not belong to this college.", 404);
    this.name = "TenantIsolationError";
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(message: string) {
    super("INVALID_TRANSITION", message, 409);
    this.name = "InvalidTransitionError";
  }
}

export class InvalidInputError extends DomainError {
  constructor(message: string) {
    super("INVALID_INPUT", message, 422);
    this.name = "InvalidInputError";
  }
}

export class ActorNotAuthorizedError extends DomainError {
  constructor(message = "The authenticated actor is not authorized for this action.") {
    super("ACTOR_NOT_AUTHORIZED", message, 403);
    this.name = "ActorNotAuthorizedError";
  }
}

export class AuthenticationRequiredError extends DomainError {
  constructor(message = "Authentication is required for this action.") {
    super("AUTHENTICATION_REQUIRED", message, 401);
    this.name = "AuthenticationRequiredError";
  }
}

export class AccountAlreadyExistsError extends DomainError {
  constructor(message = "An account with these details already exists.") {
    super("ACCOUNT_EXISTS", message, 409);
    this.name = "AccountAlreadyExistsError";
  }
}

export class InvalidResetTokenError extends DomainError {
  constructor(message = "This password reset link is invalid or has expired.") {
    super("INVALID_RESET_TOKEN", message, 400);
    this.name = "InvalidResetTokenError";
  }
}

export class OriginValidationError extends DomainError {
  constructor(message = "The request origin could not be verified.") {
    super("INVALID_ORIGIN", message, 403);
    this.name = "OriginValidationError";
  }
}

export class RateLimitedError extends DomainError {
  readonly retryAfterSeconds: number;

  constructor(
    retryAfterSeconds: number,
    message = "Too many attempts. Please wait and try again.",
  ) {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
