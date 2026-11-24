/**
 * Shared OCR limits. Kept separate from the Tesseract adapter so importing the
 * service graph does not load the worker, WASM, or language data at build time.
 *
 * Configured to 12 seconds so OCR operations abort and clean up gracefully
 * before serverless execution cutoffs (e.g. Vercel Hobby 15s function ceiling).
 */
export const OCR_DEFAULT_TIMEOUT_MS = 12_000;
