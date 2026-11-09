import { connection } from "next/server";

import { LandingPage } from "@/features/landing/components/landing-page";

export default async function Home() {
  // The nonce-based CSP requires dynamic rendering so a fresh nonce can be
  // generated for each request.
  await connection();

  return <LandingPage />;
}
