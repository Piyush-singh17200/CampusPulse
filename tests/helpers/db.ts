import { prisma } from "@/server/db/client";

const TABLES = [
  "sessions",
  "accounts",
  "verifications",
  "password_reset_tokens",
  "rate_limit_entries",
  "auth_audit_events",
  "event_duplicates",
  "event_feedback",
  "attendance_credentials",
  "notification_preferences",
  "poster_ocr_fields",
  "event_posters",
  "event_registrations",
  "saved_events",
  "event_categories",
  "event_interests",
  "events",
  "notifications",
  "student_interests",
  "club_memberships",
  "clubs",
  "categories",
  "student_profiles",
  "audit_logs",
  "users",
  "interests",
  "colleges",
] as const;

/**
 * Destructive test helper. It checks the live connection's database name before
 * truncating anything, so a misconfigured TEST_DATABASE_URL cannot erase the
 * development database.
 */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to reset the database outside NODE_ENV=test.");
  }

  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `;

  if (rows[0]?.current_database !== "campuspulse_test") {
    throw new Error(
      `Refusing to truncate a non-test database (${rows[0]?.current_database ?? "unknown"}).`,
    );
  }

  const tableList = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

export async function disconnectTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}
