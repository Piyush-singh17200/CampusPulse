import { auth } from "@/server/auth/auth";

export const appOrigin = "http://localhost:3000";

export async function signInWithPassword(email: string, password: string): Promise<Response> {
  return auth.handler(
    new Request(`${appOrigin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: appOrigin,
      },
      body: JSON.stringify({ email, password }),
    }),
  );
}

export function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Expected a session cookie.");
  }

  return setCookie.split(";")[0] ?? "";
}

export async function getSessionFromCookie(cookie: string) {
  return auth.api.getSession({
    headers: new Headers({ cookie }),
    query: { disableCookieCache: true },
  });
}

export async function signOutWithCookie(cookie: string): Promise<void> {
  await auth.api.signOut({ headers: new Headers({ cookie }) });
}
