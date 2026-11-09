import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { AuthActionState } from "@/features/auth/types";

export function FormMessage({ state }: { state: AuthActionState }) {
  if (!state.message) {
    return null;
  }

  const isError = state.status === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3.5 py-3 text-[13px] leading-5",
        isError
          ? "border-danger/20 bg-danger/5 text-danger"
          : "border-forest/20 bg-forest-soft/50 text-forest",
      )}
    >
      {state.message}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
