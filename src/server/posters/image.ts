import "server-only";

import { POSTER_MAX_BYTES } from "@/lib/poster";
import { InvalidInputError } from "@/server/errors";

export { POSTER_MAX_BYTES };
export const POSTER_MAX_DIMENSION = 12_000;
export const POSTER_MAX_PIXELS = 40_000_000;

export type PosterMimeType = "image/jpeg" | "image/png" | "image/webp";
export type PosterExtension = "jpg" | "png" | "webp";

export type ValidatedPosterImage = {
  mimeType: PosterMimeType;
  extension: PosterExtension;
  width: number;
  height: number;
  byteSize: number;
};

function invalid(message = "Upload a valid JPEG, PNG, or WebP image."): never {
  throw new InvalidInputError(message);
}

function pngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function jpegSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function webpSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function parsePng(buffer: Buffer): Pick<ValidatedPosterImage, "width" | "height"> {
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawEnd = false;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (length > buffer.length - offset - 12 || dataEnd + 4 > buffer.length) {
      invalid("The PNG file is malformed.");
    }

    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(buffer.subarray(offset + 4, dataEnd));

    if (expectedCrc !== actualCrc) {
      invalid("The PNG file is malformed.");
    }

    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) {
        invalid("The PNG file is malformed.");
      }

      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);

      if (width === 0 || height === 0) {
        invalid("The PNG file is malformed.");
      }

      sawHeader = true;
    }

    if (type === "IEND") {
      if (length !== 0) {
        invalid("The PNG file is malformed.");
      }

      sawEnd = true;
      offset = dataEnd + 4;
      break;
    }

    offset = dataEnd + 4;
  }

  if (!sawHeader || !sawEnd || offset !== buffer.length) {
    invalid("The PNG file is malformed.");
  }

  return { width, height };
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function parseJpeg(buffer: Buffer): Pick<ValidatedPosterImage, "width" | "height"> {
  let offset = 2;
  let width = 0;
  let height = 0;
  let sawFrame = false;
  let sawScan = false;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      invalid("The JPEG file is malformed.");
    }

    while (buffer[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= buffer.length) {
      invalid("The JPEG file is malformed.");
    }

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9) {
      invalid("The JPEG file is malformed.");
    }

    if (marker === 0xda) {
      if (!sawFrame) {
        invalid("The JPEG file is malformed.");
      }

      sawScan = true;
      break;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }

    if (offset + 2 > buffer.length) {
      invalid("The JPEG file is malformed.");
    }

    const length = buffer.readUInt16BE(offset);

    if (length < 2 || offset + length > buffer.length) {
      invalid("The JPEG file is malformed.");
    }

    if (isJpegStartOfFrame(marker)) {
      if (length < 7) {
        invalid("The JPEG file is malformed.");
      }

      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);

      if (width === 0 || height === 0) {
        invalid("The JPEG file is malformed.");
      }

      sawFrame = true;
    }

    offset += length;
  }

  if (!sawFrame || !sawScan) {
    invalid("The JPEG file is malformed.");
  }

  if (
    buffer.length < 2 ||
    buffer[buffer.length - 2] !== 0xff ||
    buffer[buffer.length - 1] !== 0xd9
  ) {
    invalid("The JPEG file is malformed.");
  }

  return { width, height };
}

function parseWebp(buffer: Buffer): Pick<ValidatedPosterImage, "width" | "height"> {
  if (buffer.length < 20) {
    invalid("The WebP file is malformed.");
  }

  const riffSize = buffer.readUInt32LE(4);

  if (riffSize + 8 !== buffer.length) {
    invalid("The WebP file is malformed.");
  }

  const fourCc = buffer.toString("ascii", 12, 16);
  const chunkSize = buffer.readUInt32LE(16);
  const dataStart = 20;

  if (chunkSize > buffer.length - dataStart) {
    invalid("The WebP file is malformed.");
  }

  if (fourCc === "VP8X") {
    if (chunkSize < 10) {
      invalid("The WebP file is malformed.");
    }

    return {
      width: 1 + buffer.readUIntLE(dataStart + 4, 3),
      height: 1 + buffer.readUIntLE(dataStart + 7, 3),
    };
  }

  if (fourCc === "VP8 ") {
    if (
      chunkSize < 10 ||
      buffer[dataStart + 3] !== 0x9d ||
      buffer[dataStart + 4] !== 0x01 ||
      buffer[dataStart + 5] !== 0x2a
    ) {
      invalid("The WebP file is malformed.");
    }

    return {
      width: buffer.readUInt16LE(dataStart + 6) & 0x3fff,
      height: buffer.readUInt16LE(dataStart + 8) & 0x3fff,
    };
  }

  if (fourCc === "VP8L") {
    if (chunkSize < 5 || buffer[dataStart] !== 0x2f) {
      invalid("The WebP file is malformed.");
    }

    const b1 = buffer[dataStart + 1];
    const b2 = buffer[dataStart + 2];
    const b3 = buffer[dataStart + 3];
    const b4 = buffer[dataStart + 4];

    return {
      width: 1 + (b1 | ((b2 & 0x3f) << 8)),
      height: 1 + (((b2 & 0xc0) >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
    };
  }

  invalid("The WebP file is malformed.");
}

function assertDimensions(width: number, height: number): void {
  if (
    width <= 0 ||
    height <= 0 ||
    width > POSTER_MAX_DIMENSION ||
    height > POSTER_MAX_DIMENSION ||
    width * height > POSTER_MAX_PIXELS
  ) {
    invalid("The poster dimensions are too large or invalid.");
  }
}

/**
 * Validates the actual file content instead of trusting the browser-supplied
 * MIME type or filename. SVG, HTML, executables, and malformed containers are
 * rejected before a byte reaches storage.
 */
export function validatePosterImage(input: Uint8Array): ValidatedPosterImage {
  if (input.byteLength === 0) {
    invalid("The poster file is empty.");
  }

  if (input.byteLength > POSTER_MAX_BYTES) {
    invalid("Posters must be 4.2 MB or smaller.");
  }

  const buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  let mimeType: PosterMimeType;
  let extension: PosterExtension;
  let dimensions: Pick<ValidatedPosterImage, "width" | "height">;

  if (pngSignature(buffer)) {
    mimeType = "image/png";
    extension = "png";
    dimensions = parsePng(buffer);
  } else if (jpegSignature(buffer)) {
    mimeType = "image/jpeg";
    extension = "jpg";
    dimensions = parseJpeg(buffer);
  } else if (webpSignature(buffer)) {
    mimeType = "image/webp";
    extension = "webp";
    dimensions = parseWebp(buffer);
  } else {
    invalid("Upload a JPEG, PNG, or WebP image. SVG and other file types are not accepted.");
  }

  assertDimensions(dimensions.width, dimensions.height);

  return {
    mimeType,
    extension,
    width: dimensions.width,
    height: dimensions.height,
    byteSize: buffer.byteLength,
  };
}

export function extensionForMimeType(mimeType: string): PosterExtension | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}
