import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ClubSection } from "@/features/landing/components/club-section";
import { CollegeSection } from "@/features/landing/components/college-section";
import { CtaSection } from "@/features/landing/components/cta-section";
import { DiscoverySection } from "@/features/landing/components/discovery-section";
import { HeroSection } from "@/features/landing/components/hero-section";
import { PlatformSection } from "@/features/landing/components/platform-section";
import { ProblemSection } from "@/features/landing/components/problem-section";
import { StudentSection } from "@/features/landing/components/student-section";
import { WorkflowSection } from "@/features/landing/components/workflow-section";

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main-content">
        <HeroSection />
        <DiscoverySection />
        <ProblemSection />
        <PlatformSection />
        <WorkflowSection />
        <StudentSection />
        <ClubSection />
        <CollegeSection />
        <CtaSection />
      </main>

      <SiteFooter />
    </div>
  );
}
