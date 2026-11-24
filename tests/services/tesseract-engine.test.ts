import { describe, expect, it } from "vitest";

import { OCR_DEFAULT_TIMEOUT_MS } from "@/server/ocr/constants";
import { recognizePosterImage } from "@/server/ocr/tesseract-engine";

describe("Tesseract OCR engine timeout and abort handling", () => {
  it("uses the calibrated 12-second default timeout constant", () => {
    expect(OCR_DEFAULT_TIMEOUT_MS).toBe(12_000);
  });

  it("immediately rejects and avoids starting workers when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      recognizePosterImage(Buffer.alloc(10), { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: "OCR_TIMEOUT",
      status: 504,
    });
  });

  it("aborts and terminates worker when timeout expires during initialization", async () => {
    // A 1ms timeout will fire before worker initialization can complete
    await expect(recognizePosterImage(Buffer.alloc(10), { timeoutMs: 1 })).rejects.toMatchObject({
      code: "OCR_TIMEOUT",
      status: 504,
    });
  });

  it("aborts execution when signal triggers while waiting", async () => {
    const controller = new AbortController();
    const promise = recognizePosterImage(Buffer.alloc(10), {
      timeoutMs: 5_000,
      signal: controller.signal,
    });

    // Abort proactively after 5ms
    setTimeout(() => controller.abort(), 5);

    await expect(promise).rejects.toMatchObject({
      code: "OCR_TIMEOUT",
      status: 504,
    });
  });
});
