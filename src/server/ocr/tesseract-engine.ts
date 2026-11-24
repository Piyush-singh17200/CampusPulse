import "server-only";

import path from "node:path";

import engData from "@tesseract.js-data/eng";
import { createWorker } from "tesseract.js";

import { DomainError } from "@/server/errors";
import { OCR_DEFAULT_TIMEOUT_MS } from "@/server/ocr/constants";
import type { OcrWord } from "@/server/ocr/extract";

export type OcrEngineResult = {
  text: string;
  words: OcrWord[];
  confidence: number | null;
};

export type OcrEngineOptions = {
  /** Hard deadline for recognition. The worker is terminated when it expires. */
  timeoutMs?: number;
};

export type OcrEngine = (image: Buffer, options?: OcrEngineOptions) => Promise<OcrEngineResult>;

function flattenWords(
  blocks: Array<{
    paragraphs: Array<{
      lines: Array<{
        words: Array<{ text: string; confidence: number }>;
      }>;
    }>;
  }> | null,
): OcrWord[] {
  if (!blocks) {
    return [];
  }

  return blocks.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) =>
        line.words
          .filter((word) => word.text.trim())
          .map((word) => ({
            text: word.text,
            confidence: Number.isFinite(word.confidence) ? word.confidence : null,
          })),
      ),
    ),
  );
}

/**
 * Runs the bundled English Tesseract model. The traineddata package is a local
 * dependency, so OCR does not call a cloud service or download a model at
 * runtime. A worker is created and terminated per request to keep failures
 * isolated; see docs/event-intelligence.md for operational limits.
 */
export const recognizePosterImage: OcrEngine = async (image, options = {}) => {
  const timeoutMs = options.timeoutMs ?? OCR_DEFAULT_TIMEOUT_MS;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  // The deadline starts before worker creation. Both worker download/startup
  // and recognition are covered, so a stuck initialization cannot leave a
  // request or a PROCESSING claim behind indefinitely.
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new DomainError(
          "OCR_TIMEOUT",
          "Poster analysis took too long. Try a smaller or clearer image.",
          504,
        ),
      );
    }, timeoutMs);
  });

  try {
    const workerPromise = createWorker(engData.code, 1, {
      langPath: engData.langPath,
      gzip: engData.gzip,
      cachePath: path.join(process.cwd(), ".data", "ocr-cache"),
      logger: () => undefined,
      errorHandler: () => undefined,
    });

    // If the deadline wins while createWorker is still starting, terminate the
    // late worker as soon as it appears instead of leaking it.
    workerPromise
      .then((created) => {
        if (finished) {
          void created.terminate().catch(() => undefined);
        }
      })
      .catch(() => undefined);

    worker = await Promise.race([workerPromise, deadline]);
    const result = await Promise.race([
      worker.recognize(image, {}, { text: true, blocks: true }),
      deadline,
    ]);

    return {
      text: result.data.text ?? "",
      words: flattenWords(result.data.blocks),
      confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : null,
    };
  } finally {
    finished = true;

    if (timer) {
      clearTimeout(timer);
    }

    // A timeout must terminate the worker rather than leave it consuming CPU.
    await worker?.terminate().catch(() => undefined);
  }
};
