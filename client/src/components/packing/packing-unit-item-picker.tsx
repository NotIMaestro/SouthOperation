"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { PackableItem } from "@/lib/server-api";

type SelectionState = Record<string, { checked: boolean; quantity: number }>;

export function PackingUnitItemPicker({
  packingUnitId,
  items,
}: {
  packingUnitId: string;
  items: PackableItem[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectionState>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(reportId: string, remaining: number) {
    setSelected((prev) => {
      const current = prev[reportId];
      return {
        ...prev,
        [reportId]: current?.checked
          ? { checked: false, quantity: current.quantity }
          : { checked: true, quantity: current?.quantity || Math.min(1, remaining) },
      };
    });
  }

  function setQuantity(reportId: string, quantity: number) {
    setSelected((prev) => ({ ...prev, [reportId]: { checked: true, quantity } }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const chosen = Object.entries(selected)
      .filter(([, value]) => value.checked && value.quantity > 0)
      .map(([mappingReportId, value]) => ({ mappingReportId, quantity: value.quantity }));

    if (chosen.length === 0) {
      setError("יש לבחור לפחות פריט אחד.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/packing-units/${packingUnitId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chosen }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "שמירת הפריטים נכשלה.");
        return;
      }
      setSelected({});
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return <p className="hint">לא נמצאו פריטים ממופים וממתינים לאריזה בחדר זה.</p>;
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>בחירת פריטים לאריזה</h2>
      <p className="hint">סמנו את הפריטים שנארזו ביחידה זו וציינו כמות.</p>
      <div className="item-picker">
        {items.map((item) => {
          const state = selected[item.mappingReportId];
          const disabled = item.remainingQuantity <= 0;
          return (
            <label className="item-picker-row" key={item.mappingReportId}>
              <input
                checked={Boolean(state?.checked)}
                disabled={disabled}
                onChange={() => toggle(item.mappingReportId, item.remainingQuantity)}
                type="checkbox"
              />
              <span>
                <span className="item-picker-name">
                  {[item.itemTypeName, item.categoryName, item.subcategoryName].filter(Boolean).join(" / ")}
                </span>
                <small className="item-picker-meta">
                  {item.serialNumber ? `מס' סידורי: ${item.serialNumber} · ` : ""}
                  נותרו לאריזה: {item.remainingQuantity} מתוך {item.quantity}
                </small>
              </span>
              <input
                disabled={!state?.checked || disabled}
                max={item.remainingQuantity}
                min={1}
                onChange={(event) => setQuantity(item.mappingReportId, Number(event.target.value))}
                type="number"
                value={state?.quantity ?? ""}
              />
            </label>
          );
        })}
      </div>
      {error && <p className="inline-error">{error}</p>}
      <div className="form-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "שומר..." : "שמירת פריטים"}
        </button>
      </div>
    </form>
  );
}
