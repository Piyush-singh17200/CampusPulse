import { describe, expect, it } from "vitest";

import { InvalidInputError } from "@/server/errors";
import { POSTER_MAX_BYTES, validatePosterImage } from "@/server/posters/image";
import { pngWithDimensions, validJpeg, validPng, validWebp } from "@tests/helpers/images";

function expectInvalid(input: Uint8Array, message?: RegExp) {
  expect(() => validatePosterImage(input)).toThrow(InvalidInputError);

  if (message) {
    expect(() => validatePosterImage(input)).toThrow(message);
  }
}

describe("poster content validation", () => {
  it("accepts a real PNG and derives its dimensions from content", () => {
    const result = validatePosterImage(validPng());

    expect(result).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      width: 8,
      height: 6,
    });
    expect(result.byteSize).toBe(validPng().byteLength);
  });

  it("accepts a real JPEG", () => {
    expect(validatePosterImage(validJpeg())).toMatchObject({
      mimeType: "image/jpeg",
      extension: "jpg",
      width: 8,
      height: 6,
    });
  });

  it("accepts a real WebP", () => {
    expect(validatePosterImage(validWebp())).toMatchObject({
      mimeType: "image/webp",
      extension: "webp",
      width: 8,
      height: 6,
    });
  });

  it("rejects SVG regardless of an image-looking filename or MIME type", () => {
    expectInvalid(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>',
      ),
      /SVG and other file types/,
    );
  });

  it("rejects executable content", () => {
    expectInvalid(Buffer.from("MZ\x90\x00\x03\x00\x00\x00PE\x00\x00"));
  });

  it("rejects unsupported image formats such as GIF", () => {
    expectInvalid(Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;"));
  });

  it("rejects an empty file", () => {
    expectInvalid(Buffer.alloc(0), /empty/);
  });

  it("rejects a file larger than 5 MB before parsing", () => {
    const oversized = Buffer.alloc(POSTER_MAX_BYTES + 1);
    validPng().copy(oversized, 0);

    expectInvalid(oversized, /5 MB/);
  });

  it("rejects a PNG with a broken chunk checksum", () => {
    const png = Buffer.from(validPng());
    png[29] ^= 0xff;

    expectInvalid(png, /PNG file is malformed/);
  });

  it("rejects a truncated PNG", () => {
    expectInvalid(validPng().subarray(0, validPng().byteLength - 8), /PNG file is malformed/);
  });

  it("rejects a truncated JPEG", () => {
    expectInvalid(validJpeg().subarray(0, validJpeg().byteLength - 8), /JPEG file is malformed/);
  });

  it("rejects a WebP with an invalid RIFF length", () => {
    const webp = Buffer.from(validWebp());
    webp.writeUInt32LE(webp.length, 4);

    expectInvalid(webp, /WebP file is malformed/);
  });

  it("rejects images with dimensions over the safe limit", () => {
    expectInvalid(pngWithDimensions(12_001, 1), /dimensions/);
  });

  it("accepts a large but allowed image", () => {
    expect(validatePosterImage(pngWithDimensions(12_000, 1))).toMatchObject({
      width: 12_000,
      height: 1,
    });
  });
});
