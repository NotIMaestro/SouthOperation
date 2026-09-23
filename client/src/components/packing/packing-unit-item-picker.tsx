"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Search } from "lucide-react";

import type { PackableItem } from "@/lib/server-api";

type SelectionState = Record<string, { checked: boolean; quantity: number }>;

export function PackingUnitItemPicker({
  packingUnitId,
  items,
  addItemAction,
}: {
  packingUnitId: string;
  items: PackableItem[];
  addItemAction?: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectionState>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredItems = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.itemTypeName, item.categoryName, item.subcategoryName, item.serialNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [items, filter]);

  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => item.remainingQuantity <= 0 || selected[item.mappingReportId]?.checked);

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const item of filteredItems) {
        if (item.remainingQuantity <= 0) continue;
        next[item.mappingReportId] = allFilteredSelected
          ? { checked: false, quantity: next[item.mappingReportId]?.quantity ?? 1 }
          : { checked: true, quantity: item.remainingQuantity };
      }
      return next;
    });
  }

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
    return (
      <div className="form-card">
        <h2>בחירת פריטים לאריזה</h2>
        <p className="hint">לא נמצאו פריטים ממופים וממתינים לאריזה בחדר זה.</p>
        {addItemAction && <div className="form-actions">{addItemAction}</div>}
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>בחירת פריטים לאריזה</h2>
      <p className="hint">סמנו את הפריטים שנארזו ביחידה זו וציינו כמות.</p>
      <div className="item-picker-toolbar">
        <span className="catalog-search-input">
          <Search aria-hidden="true" />
          <input
            aria-label="סינון פריטים"
            onChange={(event) => setFilter(event.target.value)}
            placeholder="סינון לפי שם, קטגוריה או מס' סידורי"
            value={filter}
          />
        </span>
        <button className="button secondary" onClick={toggleSelectAll} type="button">
          {allFilteredSelected ? "נקה בחירה" : "בחר הכל"}
        </button>
        {addItemAction}
      </div>
      {filteredItems.length === 0 && <p className="hint">לא נמצאו פריטים תואמים לחיפוש.</p>}
      <div className="item-picker">
        {filteredItems.map((item) => {
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
