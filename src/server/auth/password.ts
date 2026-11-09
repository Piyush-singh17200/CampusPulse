import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * OWASP-recommended Argon2id starting point. The values are deliberately kept
 * in one place so tests and production use the same cost parameters.
 */
const ARGON2_OPTIONS = {
  // @node-rs/argon2 exposes Algorithm as an ambient const enum, which cannot be
  // referenced under isolatedModules. Argon2id is the library's value 2.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Performs the same expensive work as a real password check without revealing
 * whether an account exists. Used only for inactive/unknown account paths.
 */
export async function burnPasswordHash(password: string): Promise<void> {
  await hash(password, ARGON2_OPTIONS);
}
