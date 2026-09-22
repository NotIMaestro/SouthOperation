"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RoomPackingControls({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"close" | "pause" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "close" | "pause") {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/v1/rooms/${roomId}/packing/${action}`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "הפעולה נכשלה.");
        return;
      }
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="form-card">
      <h2>סיום שלב האריזה בחדר</h2>
      <p className="hint">
        ניתן להשהות את האריזה זמנית או לסמן שהאריזה בחדר הושלמה, לאחר סגירת כל יחידות האריזה הפתוחות.
      </p>
      {error && <p className="inline-error">{error}</p>}
      <div className="form-actions">
        <button className="button secondary" disabled={pending !== null} onClick={() => act("pause")} type="button">
          {pending === "pause" ? "משהה..." : "הפסקה זמנית"}
        </button>
        <button className="button primary" disabled={pending !== null} onClick={() => act("close")} type="button">
          {pending === "close" ? "מסיים..." : "סיום אריזה בחדר"}
        </button>
      </div>
    </div>
  );
}
