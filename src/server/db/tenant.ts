import { z } from "zod";

import { InvalidInputError, TenantIsolationError } from "@/server/errors";

const tenantContextSchema = z.object({
  collegeId: z.string().uuid("A valid collegeId is required for tenant-scoped access."),
});

export type TenantContext = z.infer<typeof tenantContextSchema>;

export function createTenantContext(input: { collegeId?: string | null }): TenantContext {
  const parsed = tenantContextSchema.safeParse(input);

  if (!parsed.success) {
    throw new InvalidInputError(
      parsed.error.issues.map((issue) => issue.message).join("; ") ||
        "A tenant context is required.",
    );
  }

  return parsed.data;
}

/**
 * Defence in depth: services always scope queries by collegeId, and this helper
 * catches accidental mixing of two tenants' records in one operation.
 */
export function assertSameTenant(context: TenantContext, entityCollegeId: string): void {
  if (context.collegeId !== entityCollegeId) {
    throw new TenantIsolationError();
  }
}

export function tenantWhere(context: TenantContext) {
  return { collegeId: context.collegeId };
}
