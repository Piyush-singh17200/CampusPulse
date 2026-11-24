import { describe, expect, it } from "vitest";

import { signAwsRequest } from "@/server/storage/s3-poster-storage";

const EMPTY_PAYLOAD_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("AWS Signature Version 4", () => {
  it("signs temporary-credential session tokens", () => {
    const url = new URL("https://examplebucket.s3.amazonaws.com/test.txt");

    const headers = signAwsRequest({
      method: "GET",
      url,
      headers: { host: url.host },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      region: "us-east-1",
      service: "s3",
      accessKeyId: "ASIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      sessionToken: "temporary-session-token",
      date: new Date("2013-05-24T00:00:00.000Z"),
    });

    expect(headers["x-amz-security-token"]).toBe("temporary-session-token");
    expect(headers.Authorization).toContain("x-amz-security-token");
    expect(headers.Authorization).not.toContain("temporary-session-token");
  });

  it("matches the published S3 GET Object test vector", () => {
    const url = new URL("https://examplebucket.s3.amazonaws.com/test.txt");

    const headers = signAwsRequest({
      method: "GET",
      url,
      headers: {
        host: url.host,
        range: "bytes=0-9",
      },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      region: "us-east-1",
      service: "s3",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      date: new Date("2013-05-24T00:00:00.000Z"),
    });

    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
    expect(headers["x-amz-content-sha256"]).toBe(EMPTY_PAYLOAD_SHA256);
    expect(headers.Authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request," +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date," +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("includes signed conditional headers used to prevent overwrites", () => {
    const url = new URL("https://bucket.example.test/prefix/asset.png");

    const headers = signAwsRequest({
      method: "PUT",
      url,
      headers: {
        host: url.host,
        "if-none-match": "*",
      },
      payloadHash: EMPTY_PAYLOAD_SHA256,
      region: "eu-central-1",
      service: "s3",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      date: new Date("2026-01-02T03:04:05.000Z"),
    });

    expect(headers.Authorization).toContain("SignedHeaders=host;if-none-match;");
    expect(headers.Authorization).toContain("/20260102/eu-central-1/s3/aws4_request");
    expect(headers.Authorization).not.toContain("test-secret-key");
  });
});
