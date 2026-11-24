/**
 * Shared OCR limits. Kept separate from the Tesseract adapter so importing the
 * service graph does not load the worker, WASM, or language data at build time.
 */
export const OCR_DEFAULT_TIMEOUT_MS = 60_000;
