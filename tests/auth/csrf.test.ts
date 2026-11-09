import { describe, expect, it } from "vitest";

import { isTrustedFetchSite, isTrustedOrigin } from "@/server/auth/csrf";

const allowed = ["http://localhost:3000", "https://campuspulse.example"];

describe("origin and CSRF validation", () => {
  it("accepts an exact configured origin", () => {
    expect(isTrustedOrigin("http://localhost:3000", allowed)).toBe(true);
    expect(isTrustedOrigin("https://campuspulse.example", allowed)).toBe(true);
  });

  it("normalizes trailing slashes but not host or scheme changes", () => {
    expect(isTrustedOrigin("http://localhost:3000/", allowed)).toBe(true);
    expect(isTrustedOrigin("http://localhost:3001", allowed)).toBe(false);
    expect(isTrustedOrigin("https://localhost:3000", allowed)).toBe(false);
    expect(isTrustedOrigin("http://campuspulse.example", allowed)).toBe(false);
  });

  it("rejects missing, malformed, null, and lookalike origins", () => {
    expect(isTrustedOrigin(null, allowed)).toBe(false);
    expect(isTrustedOrigin("", allowed)).toBe(false);
    expect(isTrustedOrigin("not a url", allowed)).toBe(false);
    expect(isTrustedOrigin("null", allowed)).toBe(false);
    expect(isTrustedOrigin("http://localhost:3000.attacker.test", allowed)).toBe(false);
    expect(isTrustedOrigin("http://attacker.test/http://localhost:3000", allowed)).toBe(false);
  });

  it("accepts same-origin and user-initiated navigations only", () => {
    expect(isTrustedFetchSite(null)).toBe(true);
    expect(isTrustedFetchSite("same-origin")).toBe(true);
    expect(isTrustedFetchSite("none")).toBe(true);
    expect(isTrustedFetchSite("same-site")).toBe(false);
    expect(isTrustedFetchSite("cross-site")).toBe(false);
  });
});
