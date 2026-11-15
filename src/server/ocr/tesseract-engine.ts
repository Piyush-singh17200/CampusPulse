import "server-only";

import path from "node:path";

import engData from "@tesseract.js-data/eng";
import { createWorker } from "tesseract.js";

import type { OcrWord } from "@/server/ocr/extract";

export type OcrEngineResult = {
  text: string;
  words: OcrWord[];
  confidence: number | null;
};

export type OcrEngine = (image: Buffer) => Promise<OcrEngineResult>;

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
export const recognizePosterImage: OcrEngine = async (image) => {
  const worker = await createWorker(engData.code, 1, {
    langPath: engData.langPath,
    gzip: engData.gzip,
    cachePath: path.join(process.cwd(), ".data", "ocr-cache"),
    logger: () => undefined,
    errorHandler: () => undefined,
  });

  try {
    const result = await worker.recognize(image, {}, { text: true, blocks: true });
    return {
      text: result.data.text ?? "",
      words: flattenWords(result.data.blocks),
      confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : null,
    };
  } finally {
    await worker.terminate();
  }
};
