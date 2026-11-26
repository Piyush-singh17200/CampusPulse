import { connection } from "next/server";

import { LandingPage } from "@/features/landing/components/landing-page";
import { getCurrentUser } from "@/server/auth/session";

export default async function Home() {
  await connection();
  const user = await getCurrentUser();

  return (
    <LandingPage
      user={
        user
          ? {
              name: user.name,
              role: user.role,
            }
          : null
      }
    />
  );
}
