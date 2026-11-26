"use client";

import { useActionState } from "react";
import { Laptop, Smartphone, Globe, Shield, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { revokeSessionAction } from "@/features/auth/actions";
import type { AuthActionState } from "@/features/auth/types";
import { formatDateTime } from "@/lib/format";

export type SessionItem = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

const initialState: AuthActionState = {
  status: "idle",
};

function parseDevice(ua: string | null): { name: string; icon: typeof Laptop } {
  if (!ua) return { name: "Web Browser", icon: Globe };
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    return { name: "Mobile Device", icon: Smartphone };
  }
  return { name: "Desktop Browser", icon: Laptop };
}

function SessionRow({ session }: { session: SessionItem }) {
  const [state, formAction, pending] = useActionState(revokeSessionAction, initialState);
  const device = parseDevice(session.userAgent);
  const DeviceIcon = device.icon;

  if (session.isCurrent) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5 last:border-b-0">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md border border-line bg-paper-dim p-2 text-ink">
            <DeviceIcon className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">{device.name}</p>
              <span className="rounded-full bg-forest-soft/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-forest">
                This device
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Started {formatDateTime(session.createdAt)} · Expires{" "}
              {formatDateTime(session.expiresAt)}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-forest">Active now</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-line bg-paper-dim p-2 text-ink">
          <DeviceIcon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{device.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            Started {formatDateTime(session.createdAt)} · Expires{" "}
            {formatDateTime(session.expiresAt)}
          </p>
          {state.message ? (
            <p
              className={`mt-1 flex items-center gap-1 text-xs ${
                state.status === "success" ? "text-forest" : "text-signal-dark"
              }`}
            >
              {state.status === "success" ? (
                <CheckCircle2 className="size-3" aria-hidden="true" />
              ) : (
                <AlertCircle className="size-3" aria-hidden="true" />
              )}
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
      <form action={formAction}>
        <input type="hidden" name="sessionId" value={session.id} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <Trash2 className="size-3 text-signal" aria-hidden="true" />
          {pending ? "Revoking…" : "Revoke"}
        </Button>
      </form>
    </div>
  );
}

export function ActiveSessionsCard({ sessions }: { sessions: SessionItem[] }) {
  return (
    <div className="space-y-2">
      <div className="divide-y divide-line">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 pt-2 text-xs text-muted">
        <Shield className="size-4 text-forest" aria-hidden="true" />
        <span>Revoking a session immediately invalidates that device on its next request.</span>
      </div>
    </div>
  );
}
