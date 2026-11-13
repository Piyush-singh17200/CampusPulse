import "server-only";

import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { DomainError } from "@/server/errors";

/**
 * Poster storage is deliberately small and server-only. Callers never pass a
 * filesystem path: they pass a generated key that must match the strict asset
 * key format below. The local adapter is suitable for development and
 * self-hosted single-instance deployments only; see docs/poster-storage.md.
 */
export interface PosterStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const POSTER_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), ".data", "posters");

export function isPosterStorageKey(value: string): boolean {
  return POSTER_KEY_PATTERN.test(value);
}

function storageError(): DomainError {
  return new DomainError(
    "STORAGE_ERROR",
    "The poster file could not be processed. Please try again.",
    500,
  );
}

function resolveKey(root: string, key: string): string {
  if (!isPosterStorageKey(key)) {
    throw storageError();
  }

  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const resolved = path.resolve(/* turbopackIgnore: true */ resolvedRoot, key);

  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw storageError();
  }

  return resolved;
}

function resolveTemporaryPath(root: string): string {
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const resolved = path.resolve(
    /* turbopackIgnore: true */ resolvedRoot,
    `.upload-${randomUUID()}.tmp`,
  );

  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw storageError();
  }

  return resolved;
}

export function createLocalPosterStorage(root = DEFAULT_STORAGE_ROOT): PosterStorage {
  const storageRoot = path.resolve(/* turbopackIgnore: true */ root);

  return {
    async put(key, data) {
      const finalPath = resolveKey(storageRoot, key);
      const temporaryPath = resolveTemporaryPath(storageRoot);

      try {
        await mkdir(/* turbopackIgnore: true */ storageRoot, { recursive: true });
        await access(/* turbopackIgnore: true */ finalPath).then(
          () => {
            throw storageError();
          },
          (error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") {
              throw storageError();
            }
          },
        );

        await writeFile(/* turbopackIgnore: true */ temporaryPath, data, {
          flag: "wx",
          mode: 0o600,
        });
        await rename(/* turbopackIgnore: true */ temporaryPath, finalPath);
      } catch (error) {
        await unlink(/* turbopackIgnore: true */ temporaryPath).catch(() => undefined);
        if (error instanceof DomainError) {
          throw error;
        }
        throw storageError();
      }
    },

    async get(key) {
      const finalPath = resolveKey(storageRoot, key);

      try {
        return await readFile(/* turbopackIgnore: true */ finalPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw storageError();
      }
    },

    async delete(key) {
      const finalPath = resolveKey(storageRoot, key);

      try {
        await unlink(/* turbopackIgnore: true */ finalPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return;
        }
        throw storageError();
      }
    },
  };
}

let cachedStorage: PosterStorage | null = null;
let cachedRoot: string | null = null;

/**
 * The adapter is selected at call time so tests and deployments can set
 * POSTER_STORAGE_DIR without importing a second storage implementation.
 */
export function getPosterStorage(): PosterStorage {
  const root = process.env.POSTER_STORAGE_DIR?.trim() || DEFAULT_STORAGE_ROOT;

  if (!cachedStorage || cachedRoot !== root) {
    cachedStorage = createLocalPosterStorage(root);
    cachedRoot = root;
  }

  return cachedStorage;
}
