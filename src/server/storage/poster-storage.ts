import "server-only";

import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/config/env";
import { DomainError } from "@/server/errors";

import { isPosterStorageKey, posterStorageError } from "./poster-key";
import { createS3PosterStorage } from "./s3-poster-storage";

export { isPosterStorageKey } from "./poster-key";

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

const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), ".data", "posters");

function storageError(): DomainError {
  return posterStorageError();
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
let cachedStorageKey: string | null = null;

/**
 * The adapter is selected at call time so tests and deployments can choose the
 * local driver or a durable S3-compatible bucket without importing a second
 * storage implementation. `POSTER_STORAGE_DIR` remains readable from the raw
 * environment so tests can isolate a filesystem root per case.
 */
export function getPosterStorage(): PosterStorage {
  if (env.POSTER_STORAGE_DRIVER === "s3") {
    const selectionKey = [
      "s3",
      env.S3_ENDPOINT,
      env.S3_REGION,
      env.S3_BUCKET,
      env.S3_ACCESS_KEY_ID,
      env.S3_SECRET_ACCESS_KEY,
      env.S3_SESSION_TOKEN ?? "",
      env.S3_FORCE_PATH_STYLE ? "path" : "virtual",
      env.S3_PREFIX ?? "",
    ].join("|");

    if (!cachedStorage || cachedStorageKey !== selectionKey) {
      cachedStorage = createS3PosterStorage({
        endpoint: env.S3_ENDPOINT!,
        region: env.S3_REGION!,
        bucket: env.S3_BUCKET!,
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        sessionToken: env.S3_SESSION_TOKEN,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        prefix: env.S3_PREFIX,
      });
      cachedStorageKey = selectionKey;
    }

    return cachedStorage;
  }

  const root =
    env.POSTER_STORAGE_DIR?.trim() ||
    process.env.POSTER_STORAGE_DIR?.trim() ||
    DEFAULT_STORAGE_ROOT;

  if (!cachedStorage || cachedStorageKey !== root) {
    cachedStorage = createLocalPosterStorage(root);
    cachedStorageKey = root;
  }

  return cachedStorage;
}
