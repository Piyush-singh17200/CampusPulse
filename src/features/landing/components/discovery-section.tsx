import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { DiscoveryPreview } from "@/features/landing/components/discovery-preview";

export function DiscoverySection() {
  return (
    <section
      id="preview"
      className="relative border-b border-line bg-paper-dim/55 py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="Discovery preview"
            title={
              <>
                A feed with a point of view,
                <span className="italic text-forest"> not an endless scroll.</span>
              </>
            }
            description="CampusPulse shows students what matters now: the event, the people behind it, and the context needed to decide. Try the interactive sample below, then sign in for the live campus feed."
          />
          <div className="shrink-0 border-l border-line-strong pl-5 lg:mb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
              Preview note
            </p>
            <p className="mt-2 max-w-[15rem] text-xs leading-5 text-muted">
              The feed, filters, and detail dialog are interactive. Live registrations, saved
              events, and notifications are part of the authenticated student workspace.
            </p>
          </div>
        </div>

        <div className="mt-10 lg:mt-12">
          <DiscoveryPreview />
        </div>
      </Container>
    </section>
  );
}
