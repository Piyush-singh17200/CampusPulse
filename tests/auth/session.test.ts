import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/client";
import { auth } from "@/server/auth/auth";
import { loadActorContext } from "@/server/auth/actor";
import { registerStudent } from "@/server/auth/registration";
import { resetDatabase } from "@tests/helpers/db";
import { createCollege } from "@tests/helpers/factories";

const appOrigin = "http://localhost:3000";
const password = "CampusPulse!2026";

beforeEach(async () => {
  await resetDatabase();
});

async function createRegisteredStudent(email = "session@example.test") {
  const college = await createCollege();
  const result = await registerStudent({
    name: "Session Student",
    email,
    password,
    collegeId: college.id,
  });

  return { college, user: result.user };
}

async function signIn(email: string, candidatePassword = password): Promise<Response> {
  return auth.handler(
    new Request(`${appOrigin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: appOrigin,
      },
      body: JSON.stringify({ email, password: candidatePassword }),
    }),
  );
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Expected a session cookie.");
  }

  return setCookie.split(";")[0] ?? "";
}

describe("database-backed sessions", () => {
  it("signs in, verifies the session, and signs out server-side", async () => {
    const { user } = await createRegisteredStudent();

    const response = await signIn(user.email);
    expect(response.status).toBe(200);

    const cookie = sessionCookie(response);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
      query: { disableCookieCache: true },
    });

    expect(session?.user.id).toBe(user.id);
    expect(session?.session.id).toBeTruthy();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    await auth.api.signOut({ headers: new Headers({ cookie }) });

    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      }),
    ).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects a wrong password without creating a session", async () => {
    const { user } = await createRegisteredStudent("wrong-password@example.test");

    const response = await signIn(user.email, "WrongPassword!2026");

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("does not treat an expired session as authenticated", async () => {
    const { user } = await createRegisteredStudent("expired@example.test");
    const cookie = sessionCookie(await signIn(user.email));
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });

    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      }),
    ).toBeNull();
  });

  it("loads a fresh actor context and refuses disabled accounts", async () => {
    const { user } = await createRegisteredStudent("disabled@example.test");
    const cookie = sessionCookie(await signIn(user.email));

    expect(await loadActorContext(user.id)).toMatchObject({
      id: user.id,
      role: "STUDENT",
      status: "ACTIVE",
    });

    await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });

    expect(await loadActorContext(user.id)).toBeNull();

    // Better Auth may still see the database session; the application's actor
    // loader is the authorization boundary that denies the disabled account.
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
      query: { disableCookieCache: true },
    });
    expect(session?.user.id).toBe(user.id);
  });

  it("rejects a session cookie for a deleted session", async () => {
    const { user } = await createRegisteredStudent("deleted-session@example.test");
    const cookie = sessionCookie(await signIn(user.email));

    await prisma.session.deleteMany({ where: { userId: user.id } });

    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      }),
    ).toBeNull();
  });
});
