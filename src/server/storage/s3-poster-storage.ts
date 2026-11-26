import "server-only";

import { createHash, createHmac } from "node:crypto";

import { isPosterStorageKey, posterStorageError } from "./poster-key";
import type { PosterStorage } from "./poster-storage";

const EMPTY_PAYLOAD_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const REQUEST_TIMEOUT_MS = 15_000;

export type S3PosterStorageConfig = {
  /** Base endpoint, for example `https://s3.eu-central-1.amazonaws.com` or a MinIO URL. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional token for temporary AWS/STS, web-identity, or role credentials. */
  sessionToken?: string;
  /** Path-style URLs are required by MinIO and are the safest default. */
  forcePathStyle?: boolean;
  /** Optional key prefix inside the bucket. */
  prefix?: string;
};

export type AwsSignInput = {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  date?: Date;
};

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * Signs an AWS Signature Version 4 request. Exported so the canonical request
 * and signing-key derivation can be verified against the published AWS test
 * vector without network access.
 */
export function signAwsRequest(input: AwsSignInput): Record<string, string> {
  const now = input.date ?? new Date();
  const timestamp = amzDate(now);
  const dateStamp = timestamp.slice(0, 8);
  const headers: Record<string, string> = {
    ...input.headers,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": timestamp,
    ...(input.sessionToken ? { "x-amz-security-token": input.sessionToken } : {}),
  };

  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      value.trim().replace(/\s+/g, " "),
    ]),
  );

  const signedHeaderNames = Object.keys(normalized).sort();
  const canonicalHeaders = signedHeaderNames.map((key) => `${key}:${normalized[key]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalQuery = [...input.url.searchParams.entries()]
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .sort()
    .join("&");

  const canonicalRequest = [
    input.method.toUpperCase(),
    input.url.pathname || "/",
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const dateKey = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, input.region);
  const serviceKey = hmac(regionKey, input.service);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return {
    ...normalized,
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`,
  };
}

function normalizePrefix(prefix: string | undefined): string {
  const value = (prefix ?? "").trim().replace(/^\/+|\/+$/g, "");

  if (!value) {
    return "";
  }

  if (!/^[a-zA-Z0-9._/-]+$/.test(value) || value.split("/").includes("..")) {
    throw posterStorageError();
  }

  return `${value}/`;
}

function objectUrl(
  config: S3PosterStorageConfig,
  prefix: string,
  key: string,
): { url: URL; objectKey: string } {
  if (!isPosterStorageKey(key)) {
    throw posterStorageError();
  }

  const objectKey = `${prefix}${key}`;
  const encodedKey = objectKey.split("/").map(encodeRfc3986).join("/");
  const endpoint = new URL(config.endpoint);
  const basePath = endpoint.pathname.replace(/\/+$/g, "");
  const forcePathStyle = config.forcePathStyle ?? true;

  if (forcePathStyle) {
    return {
      url: new URL(
        `${endpoint.protocol}//${endpoint.host}${basePath}/${encodeRfc3986(config.bucket)}/${encodedKey}`,
      ),
      objectKey,
    };
  }

  return {
    url: new URL(
      `${endpoint.protocol}//${config.bucket}.${endpoint.host}${basePath}/${encodedKey}`,
    ),
    objectKey,
  };
}

function contentTypeForKey(key: string): string {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/**
 * S3-compatible poster storage. It implements the existing `PosterStorage`
 * contract with the platform `fetch` API and a dependency-free SigV4 signer.
 * The adapter is intentionally limited to put/get/delete; lifecycle rules,
 * versioning, and encryption are bucket configuration, not application logic.
 */
export function createS3PosterStorage(config: S3PosterStorageConfig): PosterStorage {
  const prefix = normalizePrefix(config.prefix);

  async function request(
    method: "PUT" | "GET" | "DELETE",
    key: string,
    body?: Uint8Array,
  ): Promise<Response> {
    const { url } = objectUrl(config, prefix, key);
    const payloadHash = body ? sha256Hex(body) : EMPTY_PAYLOAD_SHA256;
    const headers = signAwsRequest({
      method,
      url,
      headers: {
        host: url.host,
        ...(method === "PUT"
          ? {
              "content-type": contentTypeForKey(key),
              "if-none-match": "*",
            }
          : {}),
      },
      payloadHash,
      region: config.region,
      service: "s3",
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    });

    try {
      return await fetch(url, {
        method,
        headers,
        body: body ? Buffer.from(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw posterStorageError();
    }
  }

  return {
    async put(key, data) {
      const response = await request("PUT", key, data);

      if (!response.ok) {
        throw posterStorageError();
      }
    },

    async get(key) {
      const response = await request("GET", key);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw posterStorageError();
      }

      try {
        return Buffer.from(await response.arrayBuffer());
      } catch {
        throw posterStorageError();
      }
    },

    async delete(key) {
      const response = await request("DELETE", key);

      if (response.status === 404) {
        return;
      }

      if (!response.ok) {
        throw posterStorageError();
      }
    },
  };
}
