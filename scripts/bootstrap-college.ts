import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { z } from "zod";

/**
 * First-run operational bootstrap for a new deployment.
 *
 * The public registration flow requires an active college, and the platform
 * dashboard intentionally does not expose tenant creation. This CLI creates
 * the first tenant so an operator can register the initial account and then
 * promote it with `auth:bootstrap-super-admin`.
 *
 * It is deliberately explicit: confirmation flag required, validated input,
 * duplicate slug/domain refusal, and no password or user creation.
 */

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm-college-bootstrap");

function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

if (!confirmed) {
  console.error(
    'Refusing to create a college. Re-run with: npm run college:bootstrap -- --confirm-college-bootstrap --name "..." --slug "..."',
  );
  process.exit(1);
}

const inputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  shortName: z.string().trim().min(1).max(48).optional(),
  primaryDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .regex(
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/,
      "Enter a bare domain such as college.example.edu.",
    )
    .optional(),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
});

const parsed = inputSchema.safeParse({
  name: argument("--name"),
  slug: argument("--slug"),
  shortName: argument("--short-name"),
  primaryDomain: argument("--domain"),
  timezone: argument("--timezone") ?? "Asia/Kolkata",
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join(" ");
  console.error(`Invalid college bootstrap input. ${details}`);
  process.exit(1);
}

const data = parsed.data;

try {
  new Intl.DateTimeFormat("en-US", { timeZone: data.timezone }).format(new Date());
} catch {
  console.error(`Invalid timezone "${data.timezone}".`);
  process.exit(1);
}

const { prisma } = await import("../src/server/db/client");

try {
  const existing = await prisma.college.findFirst({
    where: {
      OR: [
        { slug: data.slug },
        ...(data.primaryDomain ? [{ primaryDomain: data.primaryDomain }] : []),
      ],
    },
    select: { id: true, name: true, slug: true, primaryDomain: true },
  });

  if (existing) {
    console.error(
      `A college already uses that slug or domain: ${existing.name} (${existing.slug}). No changes made.`,
    );
    process.exitCode = 1;
  } else {
    const college = await prisma.college.create({
      data: {
        name: data.name,
        slug: data.slug,
        shortName: data.shortName,
        primaryDomain: data.primaryDomain,
        timezone: data.timezone,
        status: "ACTIVE",
      },
      select: { id: true, name: true, slug: true, primaryDomain: true, timezone: true },
    });

    console.log(
      `Created college ${college.name} (${college.slug}) with id ${college.id}. Timezone: ${college.timezone}.`,
    );
    if (college.primaryDomain) {
      console.log(`Primary domain: ${college.primaryDomain}.`);
    }
    console.log(
      "Next: register the initial account through /register, then run npm run auth:bootstrap-super-admin -- <email> --confirm-super-admin.",
    );
  }
} catch (error) {
  console.error(
    `College bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
