import { NextRequest, NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * A nonce cannot authorize style attributes. Production therefore allows only
 * the exact framework-owned inline styles via attribute hashes instead of
 * enabling `'unsafe-inline'` globally:
 * - `display:none` used by the Next.js route announcer/overlay plumbing;
 * - `color:transparent` emitted by `next/image`.
 */
const allowedInlineStyleHashes = [
  "'sha256-aqNNdDLnnrDOnTNdkJpYlAxKVJtLt9CtFLklmInuUAE='", // display:none
  "'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='", // color:transparent
].join(" ");

/**
 * Generates a per-request nonce and a nonce-based CSP.
 *
 * Nonce-based CSP requires dynamic rendering. The landing page opts into
 * dynamic rendering explicitly so the nonce is available during SSR.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const directives = [
    "default-src 'self'",
    `script-src ${
      isDevelopment
        ? "'self' 'unsafe-eval' 'unsafe-inline'"
        : `'self' 'nonce-${nonce}' 'strict-dynamic'`
    }`,
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    ...(isDevelopment ? [] : [`style-src-attr 'unsafe-hashes' ${allowedInlineStyleHashes}`]),
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? " ws: wss: http: https:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  const contentSecurityPolicy = directives.join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
