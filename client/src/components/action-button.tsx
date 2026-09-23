"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { callApi } from "@/lib/api-client";

/**
 * Fires one API call then refreshes (or navigates to `redirectTo`). With `confirmLabel`, the first
 * click only arms the button and a second click within the same render confirms — no browser dialog.
 */
export function ActionButton({
  url,
  method = "POST",
  body,
  children,
  pendingLabel = "מבצע...",
  confirmLabel,
  variant = "secondary",
  redirectTo,
}: {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  children: ReactNode;
  pendingLabel?: string;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirmLabel && !armed) {
      setArmed(true);
      setError(null);
      return;
    }
    setPending(true);
    setError(null);
    const result = await callApi(url, { method, body });
    setPending(false);
    setArmed(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <span className="action-button">
      <button
        className={`button compact ${armed ? "danger" : variant}`}
        disabled={pending}
        onBlur={() => setArmed(false)}
        onClick={(event) => {
          // Cards are sometimes links; an action inside one must not navigate.
          event.preventDefault();
          event.stopPropagation();
          void run();
        }}
        type="button"
      >
        {pending ? pendingLabel : armed ? confirmLabel : children}
      </button>
      {error && <small className="inline-error" role="alert">{error}</small>}
    </span>
  );
}
