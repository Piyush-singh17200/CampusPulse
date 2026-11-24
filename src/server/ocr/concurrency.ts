import "server-only";

import { RateLimitedError } from "@/server/errors";

/**
 * Tesseract runs inside the Node process and is CPU- and memory-intensive.
 * Bound how many poster analyses can execute at once so a burst of uploads
 * cannot exhaust a small application instance.
 *
 * This is a per-process guard. Horizontal deployments still need per-instance
 * CPU limits and, for a durable queue, a dedicated worker architecture.
 */
export const OCR_MAX_CONCURRENT = 2;
export const OCR_MAX_QUEUED = 8;
export const OCR_QUEUE_WAIT_MS = 20_000;

type Waiter = {
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let active = 0;
const waiters: Waiter[] = [];

function releaseOnce(): () => void {
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    const next = waiters.shift();

    if (next) {
      clearTimeout(next.timer);
      next.resolve(releaseOnce());
      return;
    }

    active = Math.max(0, active - 1);
  };
}

/**
 * Reserves an OCR execution slot. The caller must invoke the returned release
 * function exactly once; it is safe to call more than once.
 */
export function acquireOcrSlot(): Promise<() => void> {
  if (active < OCR_MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve(releaseOnce());
  }

  if (waiters.length >= OCR_MAX_QUEUED) {
    return Promise.reject(
      new RateLimitedError(
        Math.ceil(OCR_QUEUE_WAIT_MS / 1_000),
        "Poster analysis is busy right now. Wait a moment and try again.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const index = waiters.indexOf(waiter);

        if (index >= 0) {
          waiters.splice(index, 1);
        }

        reject(
          new RateLimitedError(
            Math.ceil(OCR_QUEUE_WAIT_MS / 1_000),
            "Poster analysis is busy right now. Wait a moment and try again.",
          ),
        );
      }, OCR_QUEUE_WAIT_MS),
    };

    waiters.push(waiter);
  });
}

/** Test and operations visibility only. */
export function getOcrConcurrencySnapshot(): { active: number; queued: number } {
  return { active, queued: waiters.length };
}
