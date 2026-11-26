"use client";

import { Building2, Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createCollegeAction } from "@/features/dashboards/actions";
import { ActionMessage } from "@/features/dashboards/components/action-form";
import { initialDashboardActionState } from "@/features/dashboards/types";

export function CreateCollegeModal() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createCollegeAction,
    initialDashboardActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      const timer = setTimeout(() => {
        setOpen(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2"
      >
        <Plus aria-hidden="true" className="size-4" />
        Create college
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
            onClick={() => !pending && setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-college-title"
            className="relative w-full max-w-lg rounded-2xl border border-line bg-paper p-6 shadow-float motion-safe:animate-[dashboard-slide-in_180ms_ease-out]"
          >
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-lg bg-sage text-ink">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h2 id="create-college-title" className="text-base font-bold text-ink">
                    Create college tenant
                  </h2>
                  <p className="text-xs text-muted">Provision a new campus organization</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                disabled={pending}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>

            <form ref={formRef} action={formAction} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                  College name *
                </label>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="e.g. Lovely Professional University"
                  className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Slug *
                  </label>
                  <input
                    name="slug"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="e.g. lpu"
                    className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                  />
                  <p className="mt-1 text-[11px] text-muted">Lowercase letters, numbers, hyphens</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Short name
                  </label>
                  <input
                    name="shortName"
                    maxLength={48}
                    placeholder="e.g. LPU"
                    className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Primary email domain
                  </label>
                  <input
                    name="primaryDomain"
                    maxLength={255}
                    placeholder="e.g. lpu.in"
                    className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                  />
                  <p className="mt-1 text-[11px] text-muted">For student domain matching</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Timezone
                  </label>
                  <input
                    name="timezone"
                    defaultValue="Asia/Kolkata"
                    placeholder="Asia/Kolkata"
                    className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
                  />
                </div>
              </div>

              <ActionMessage state={state} />

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={pending}>
                  {pending ? "Creating tenant…" : "Create college"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
