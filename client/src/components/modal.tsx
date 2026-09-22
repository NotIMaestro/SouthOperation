"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  titleId,
  eyebrow,
  title,
  onClose,
  children,
}: {
  titleId: string;
  eyebrow: React.ReactNode;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="transport-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section aria-labelledby={titleId} aria-modal="true" className="transport-modal" role="dialog">
        <div className="transport-modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button aria-label="סגירת החלונית" className="icon-button" onClick={onClose} type="button">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
