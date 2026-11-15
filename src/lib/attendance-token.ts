import { createHash, randomBytes } from "node:crypto";

export const ATTENDANCE_QR_PREFIX = "campuspulse-attendance:v1:";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AttendanceToken = {
  token: string;
  payload: string;
  tokenHash: string;
};

export function attendanceTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function attendanceQrPayload(token: string): string {
  return `${ATTENDANCE_QR_PREFIX}${token}`;
}

/**
 * Accepts either the complete QR payload or the bare token. The scanner and
 * manual entry field both use this parser so the server remains authoritative.
 */
export function parseAttendanceToken(value: string): string | null {
  const trimmed = value.trim();
  const token = trimmed.startsWith(ATTENDANCE_QR_PREFIX)
    ? trimmed.slice(ATTENDANCE_QR_PREFIX.length)
    : trimmed;

  return TOKEN_PATTERN.test(token) ? token : null;
}

export function createAttendanceToken(): AttendanceToken {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    payload: attendanceQrPayload(token),
    tokenHash: attendanceTokenHash(token),
  };
}
