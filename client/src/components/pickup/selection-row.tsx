import type { ReactNode } from "react";

/** Shared RTL receipt row: right checkbox, center content, left identifier. */
export function SelectionRow({ checked, label, identifier, identifierLabel, children, onChange }: {
  checked: boolean; label: string; identifier: string; identifierLabel: string; children: ReactNode; onChange(checked: boolean): void;
}) {
  return <label className={`pickup-row ${checked ? "is-selected" : ""}`}>
    <input type="checkbox" checked={checked} aria-label={label} onChange={(event) => onChange(event.target.checked)} />
    <span className="pickup-description">{children}</span>
    <span className="pickup-number"><small>{identifierLabel}</small><bdi>{identifier}</bdi></span>
  </label>;
}
