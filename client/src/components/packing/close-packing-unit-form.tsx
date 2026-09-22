"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ClosePackingUnitForm({
  roomId,
  packingUnitId,
}: {
  roomId: string;
  packingUnitId: string;
}) {
  const router = useRouter();
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/packing-units/${packingUnitId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationBuilding: building,
          destinationFloor: floor || undefined,
          destinationRoom: room,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "סיום האריזה נכשל.");
        return;
      }
      router.push(`/packing/${roomId}`);
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>סיום אריזה ויעד</h2>
      <p className="hint">הזינו את יעד היחידה בבסיס החדש כדי לסגור את האריזה.</p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="destination-building">בניין</label>
          <input
            id="destination-building"
            onChange={(event) => setBuilding(event.target.value)}
            required
            value={building}
          />
        </div>
        <div className="field">
          <label htmlFor="destination-floor">קומה</label>
          <input id="destination-floor" onChange={(event) => setFloor(event.target.value)} value={floor} />
        </div>
        <div className="field">
          <label htmlFor="destination-room">חדר</label>
          <input id="destination-room" onChange={(event) => setRoom(event.target.value)} required value={room} />
        </div>
      </div>
      {error && <p className="inline-error">{error}</p>}
      <div className="form-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "שומר..." : "סיום אריזה"}
        </button>
      </div>
    </form>
  );
}
