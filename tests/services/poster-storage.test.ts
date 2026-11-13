import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DomainError } from "@/server/errors";
import { createLocalPosterStorage, isPosterStorageKey } from "@/server/storage/poster-storage";

const temporaryRoots: string[] = [];

async function createRoot(): Promise<string> {
  const parent = path.join(process.cwd(), "tests", ".tmp");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, "poster-storage-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("local poster storage", () => {
  it("accepts only generated UUID asset keys", () => {
    expect(isPosterStorageKey(`${randomUUID()}.png`)).toBe(true);
    expect(isPosterStorageKey(`${randomUUID()}.jpg`)).toBe(true);
    expect(isPosterStorageKey(`${randomUUID()}.webp`)).toBe(true);

    expect(isPosterStorageKey("../escape.png")).toBe(false);
    expect(isPosterStorageKey(`nested/${randomUUID()}.png`)).toBe(false);
    expect(isPosterStorageKey(`${randomUUID()}.svg`)).toBe(false);
    expect(isPosterStorageKey(`${randomUUID()}.png.tmp`)).toBe(false);
    expect(isPosterStorageKey(`C:\\temp\\${randomUUID()}.png`)).toBe(false);
  });

  it("writes, reads, and deletes an asset without exposing a path", async () => {
    const storage = createLocalPosterStorage(await createRoot());
    const key = `${randomUUID()}.png`;
    const data = Buffer.from("poster bytes");

    await storage.put(key, data);

    await expect(storage.get(key)).resolves.toEqual(data);
    await storage.delete(key);
    await expect(storage.get(key)).resolves.toBeNull();
    await storage.delete(key);
  });

  it("rejects a duplicate key instead of overwriting an existing asset", async () => {
    const root = await createRoot();
    const storage = createLocalPosterStorage(root);
    const key = `${randomUUID()}.png`;

    await storage.put(key, Buffer.from("first"));

    await expect(storage.put(key, Buffer.from("second"))).rejects.toBeInstanceOf(DomainError);
    await expect(storage.get(key)).resolves.toEqual(Buffer.from("first"));

    const entries = await readdir(root);
    expect(entries).toEqual([key]);
  });

  it("rejects path traversal for every operation", async () => {
    const storage = createLocalPosterStorage(await createRoot());
    const key = "../escape.png";

    await expect(storage.put(key, Buffer.from("x"))).rejects.toBeInstanceOf(DomainError);
    await expect(storage.get(key)).rejects.toBeInstanceOf(DomainError);
    await expect(storage.delete(key)).rejects.toBeInstanceOf(DomainError);
  });

  it("returns null for a missing asset without creating files", async () => {
    const root = await createRoot();
    const storage = createLocalPosterStorage(root);

    await expect(storage.get(`${randomUUID()}.png`)).resolves.toBeNull();

    const entries = await readdir(root);
    expect(entries).toEqual([]);
  });
});
