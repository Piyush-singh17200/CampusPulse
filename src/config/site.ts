import { publicEnv } from "@/config/public-env";
import type { NavItem } from "@/types";

export const siteConfig = {
  name: "CampusPulse",
  tagline: "Discover what's happening on campus.",
  description:
    "CampusPulse brings campus events, clubs, and administrators into one clear, moderated discovery layer — so students find the right events and campuses see the whole picture.",
  url: publicEnv.NEXT_PUBLIC_APP_URL,
  nav: [
    { label: "Product", href: "#platform" },
    { label: "Discovery", href: "#preview" },
    { label: "For students", href: "#students" },
    { label: "For clubs", href: "#clubs" },
    { label: "For colleges", href: "#colleges" },
  ] satisfies NavItem[],
  footerNav: {
    product: [
      { label: "Platform", href: "#platform" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Discovery preview", href: "#preview" },
    ],
    audiences: [
      { label: "For students", href: "#students" },
      { label: "For clubs", href: "#clubs" },
      { label: "For colleges", href: "#colleges" },
    ],
  },
} as const;
