"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** Native modal supplies focus containment, inert background and Escape support. */
export function PickupDialog({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose(): void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected) {
        if (previous instanceof HTMLButtonElement && previous.disabled) previous.closest("main")?.focus();
        else previous.focus();
      }
    };
  }, []);
  // Lookup replaces the focused input/upload control while the dialog stays open.
  useEffect(() => { dialog.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [title]);
  return <dialog ref={dialog} className="pickup-dialog package-page" dir="rtl" lang="he" aria-labelledby={titleId} tabIndex={-1}
    aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex='0']"))
        .filter((control) => !control.closest("details:not([open])") || control.tagName === "SUMMARY");
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <div className="pickup-dialog-heading"><h2 id={titleId}>{title}</h2>
      <button type="button" className="button secondary" onClick={onClose} disabled={busy}>ביטול</button>
    </div>
    {children}
  </dialog>;
}
