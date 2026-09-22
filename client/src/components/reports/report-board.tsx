"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ClipboardCheck, Plus, Search } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Modal } from "@/components/modal";
import { reportStatusLabels } from "@/components/packing/labels";
import { StatusBadge } from "@/components/packing/status-badge";
import type { ItemCatalogEntry, MappingReport, RoomListItem } from "@/lib/server-api";

export function ReportBoard({
  groupId,
  reports,
  rooms,
  catalog,
}: {
  groupId: string;
  reports: MappingReport[];
  rooms: RoomListItem[];
  catalog: ItemCatalogEntry[];
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [itemTypeId, setItemTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [hasSerial, setHasSerial] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");

  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  const subcategoryLabelById = new Map(
    catalog.map((entry) => [entry.subcategoryId, `${entry.itemTypeName} / ${entry.categoryName} / ${entry.subcategoryName}`]),
  );

  const itemTypeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of catalog) seen.set(entry.itemTypeId, entry.itemTypeName);
    return [...seen.entries()];
  }, [catalog]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of catalog) {
      if (entry.itemTypeId === itemTypeId) seen.set(entry.categoryId, entry.categoryName);
    }
    return [...seen.entries()];
  }, [catalog, itemTypeId]);

  const subcategoryOptions = useMemo(
    () => catalog.filter((entry) => entry.categoryId === categoryId),
    [catalog, categoryId],
  );

  const catalogMatches = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .filter((entry) => `${entry.itemTypeName} ${entry.categoryName} ${entry.subcategoryName}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [catalog, catalogSearch]);

  function pickCatalogMatch(entry: ItemCatalogEntry) {
    setItemTypeId(entry.itemTypeId);
    setCategoryId(entry.categoryId);
    setSubcategoryId(entry.subcategoryId);
    setCatalogSearch("");
  }

  function resetForm() {
    setItemTypeId("");
    setCategoryId("");
    setSubcategoryId("");
    setHasSerial(false);
    setError("");
    setCatalogSearch("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subcategoryId) {
      setError("יש לבחור סוג פריט, קטגוריה ותת־קטגוריה.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const quantity = Number(formData.get("quantity") ?? 1);
    const serialNumber = String(formData.get("serialNumber") ?? "").trim();

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/mapping-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          roomId: String(formData.get("roomId") ?? ""),
          subcategoryId,
          quantity,
          serialNumber: serialNumber || undefined,
          notes: String(formData.get("notes") ?? "").trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "יצירת הדוח נכשלה.");
        return;
      }
      setIsCreateOpen(false);
      resetForm();
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="transport-toolbar">
        <div>
          <h2>פריטים שמופו</h2>
          <p className="panel-heading p">כל פריט שמדווח כאן זמין מיד לאריזה</p>
        </div>
        <button className="button primary" onClick={() => setIsCreateOpen(true)} type="button">
          <Plus aria-hidden="true" /> דוח חדש
        </button>
      </div>

      {reports.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="אין דוחות להצגה" description="דוחות עבור הקבוצה שנבחרה יופיעו כאן." />
      ) : (
        <div className="card-list">
          {reports.map((report) => {
            const statusInfo = reportStatusLabels[report.status];
            return (
              <div className="entity-card" key={report.id}>
                <div>
                  <p className="entity-card-title">
                    {subcategoryLabelById.get(report.subcategoryId) ?? "פריט"} · {roomNameById.get(report.roomId) ?? report.roomId}
                  </p>
                  <p className="entity-card-meta">
                    כמות: {report.quantity}
                    {report.serialNumber ? ` · מס' סידורי: ${report.serialNumber}` : ""}
                  </p>
                </div>
                <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
              </div>
            );
          })}
        </div>
      )}

      {isCreateOpen && (
        <Modal
          eyebrow={<><ClipboardCheck aria-hidden="true" /> דוח מיפוי חדש</>}
          onClose={() => { setIsCreateOpen(false); resetForm(); }}
          title="דיווח על פריט"
          titleId="new-report-title"
        >
            <form className="transport-form" onSubmit={handleSubmit}>
              <label>חדר<select defaultValue="" name="roomId" required>
                <option disabled value="">בחירת חדר</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select></label>
              <label>כמות<input defaultValue={1} min={1} name="quantity" required type="number" disabled={hasSerial} /></label>
              <div className="transport-form-wide catalog-search">
                <label>חיפוש מהיר בקטלוג<span className="catalog-search-input">
                  <Search aria-hidden="true" />
                  <input
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    placeholder="הקלידו שם פריט, קטגוריה או תת־קטגוריה"
                    value={catalogSearch}
                  />
                </span></label>
                {catalogMatches.length > 0 && (
                  <ul className="catalog-search-results">
                    {catalogMatches.map((entry) => (
                      <li key={entry.subcategoryId}>
                        <button onClick={() => pickCatalogMatch(entry)} type="button">
                          {entry.itemTypeName} / {entry.categoryName} / {entry.subcategoryName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label>סוג פריט<select onChange={(event) => { setItemTypeId(event.target.value); setCategoryId(""); setSubcategoryId(""); }} value={itemTypeId}>
                <option value="">בחירת סוג פריט</option>
                {itemTypeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select></label>
              <label>קטגוריה<select disabled={!itemTypeId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} value={categoryId}>
                <option value="">בחירת קטגוריה</option>
                {categoryOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select></label>
              <label className="transport-form-wide">תת־קטגוריה<select disabled={!categoryId} onChange={(event) => setSubcategoryId(event.target.value)} value={subcategoryId}>
                <option value="">בחירת תת־קטגוריה</option>
                {subcategoryOptions.map((entry) => <option key={entry.subcategoryId} value={entry.subcategoryId}>{entry.subcategoryName}</option>)}
              </select></label>
              <label>
                <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input checked={hasSerial} onChange={(event) => setHasSerial(event.target.checked)} type="checkbox" />
                  פריט עם מספר סידורי
                </span>
              </label>
              {hasSerial && <label>מס&apos; סידורי<input name="serialNumber" placeholder="לדוגמה: SN-12345" required={hasSerial} /></label>}
              <label className="transport-form-wide">הערות<textarea name="notes" placeholder="פרטים נוספים (לא חובה)" rows={2} /></label>
              {error && <p className="transport-form-error" role="alert">{error}</p>}
              <div className="transport-form-actions">
                <button className="button secondary" onClick={() => { setIsCreateOpen(false); resetForm(); }} type="button">ביטול</button>
                <button className="button primary" disabled={pending} type="submit"><Plus aria-hidden="true" /> {pending ? "יוצר..." : "יצירת דוח"}</button>
              </div>
            </form>
        </Modal>
      )}
    </>
  );
}
