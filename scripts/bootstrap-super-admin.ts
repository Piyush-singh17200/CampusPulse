import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm-super-admin");
const emailArgument = args.find((argument) => !argument.startsWith("--"));

if (!confirmed) {
  console.error(
    "Refusing to promote an account. Re-run with: npm run auth:bootstrap-super-admin -- <email> --confirm-super-admin",
  );
  process.exit(1);
}

if (!emailArgument) {
  console.error(
    "An existing account email is required: npm run auth:bootstrap-super-admin -- <email> --confirm-super-admin",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const { bootstrapSuperAdmin } = await import("../src/server/auth/super-admin");
const { prisma } = await import("../src/server/db/client");

try {
  const result = await bootstrapSuperAdmin(emailArgument);

  if (!result.changed) {
    console.log(`Account ${result.email} is already a super administrator. No changes made.`);
  } else {
    console.log(
      `Promoted ${result.email} from ${result.previousRole} to SUPER_ADMIN. Revoked ${result.revokedSessionCount} session(s).`,
    );
  }
} catch (error) {
  console.error(
    `Super-admin bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
