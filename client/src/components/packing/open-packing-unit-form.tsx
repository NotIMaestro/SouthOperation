"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { PackingUnit } from "@/lib/server-api";

import { packingUnitTypeLabels } from "./labels";

const unitTypes = Object.keys(packingUnitTypeLabels) as PackingUnit["unitType"][];

export function OpenPackingUnitForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [unitType, setUnitType] = useState<PackingUnit["unitType"]>("professional_carton");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/rooms/${roomId}/packing-units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitType }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "פתיחת יחידת האריזה נכשלה.");
        return;
      }
      router.push(`/packing/${roomId}/${payload.data.id}`);
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>פתיחת יחידת אריזה</h2>
      <p className="hint">בחרו סוג יחידת אריזה כדי להתחיל.</p>
      <div className="field">
        <label htmlFor="unit-type">סוג יחידת אריזה</label>
        <select
          id="unit-type"
          onChange={(event) => setUnitType(event.target.value as PackingUnit["unitType"])}
          value={unitType}
        >
          {unitTypes.map((type) => (
            <option key={type} value={type}>
              {packingUnitTypeLabels[type]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="inline-error">{error}</p>}
      <div className="form-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "פותח יחידה..." : "פתיחת יחידת אריזה"}
        </button>
      </div>
    </form>
  );
}
