/**
 * Runs once when the Next.js server process starts. Importing the server env
 * module here makes configuration failures explicit instead of surfacing later
 * during a request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./config/env");
  }
}
