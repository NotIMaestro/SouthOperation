import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { unitDescription } from "@/components/pickup/confirmation";
import { deliveryDate, displayDeliveryDate, type ArrivedItem, type Delivery, type ReceiptIssue } from "@/lib/transports/types";

export const deliveryTitle = (delivery: Delivery) => `${delivery.sourceCity}, ${delivery.sourceUnit} ← ${delivery.destinationCity}, ${delivery.destinationUnit}`;

type IssueDraft = { damaged: string; missing: string; note: string };
const emptyDraft: IssueDraft = { damaged: "", missing: "", note: "" };
const count = (value: string) => (value === "" ? 0 : Number(value));
const draftError = (draft: IssueDraft, item: ArrivedItem) => {
  const damaged = count(draft.damaged), missing = count(draft.missing);
  if (![damaged, missing].every((value) => Number.isInteger(value) && value >= 0)) return "יש להזין מספר שלם וחיובי.";
  if (damaged + missing > item.quantity) return `סך הפריטים הפגומים והחסרים לא יכול לעלות על ${item.quantity}.`;
  return "";
};

/** Turns the per-item drafts into the issues sent with the confirmation. */
function toIssues(drafts: Record<string, IssueDraft>): ReceiptIssue[] {
  return Object.entries(drafts).flatMap(([packingUnitItemId, draft]) => {
    const note = draft.note.trim() || undefined;
    return (["damaged", "missing"] as const)
      .filter((issueType) => count(draft[issueType]) > 0)
      .map((issueType) => ({ packingUnitItemId, issueType, quantity: count(draft[issueType]), note }));
  });
}

function ItemIssueEditor({ item, draft, onChange }: { item: ArrivedItem; draft: IssueDraft; onChange(draft: IssueDraft): void }) {
  const error = draftError(draft, item);
  return <div className="receipt-issue-editor">
    <label className="package-field">כמות פגומה<input type="number" inputMode="numeric" min={0} max={item.quantity} value={draft.damaged}
      onChange={(event) => onChange({ ...draft, damaged: event.currentTarget.value })} /></label>
    <label className="package-field">כמות חסרה<input type="number" inputMode="numeric" min={0} max={item.quantity} value={draft.missing}
      onChange={(event) => onChange({ ...draft, missing: event.currentTarget.value })} /></label>
    <label className="package-field receipt-issue-note">הערה (לא חובה)<input type="text" maxLength={500} value={draft.note} placeholder="לדוגמה: מסך סדוק"
      onChange={(event) => onChange({ ...draft, note: event.currentTarget.value })} /></label>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}

export function DeliveryConfirmation({ deliveries, saving, onConfirm }: {
  deliveries: Delivery[]; saving: boolean; onConfirm(issues: ReceiptIssue[]): void;
}) {
  const [drafts, setDrafts] = useState<Record<string, IssueDraft>>({});
  const items = deliveries.flatMap((delivery) => delivery.units.flatMap((unit) => unit.items));
  const invalid = Object.entries(drafts).some(([id, draft]) => {
    const item = items.find((entry) => entry.id === id);
    return !item || !!draftError(draft, item);
  });
  const issues = invalid ? [] : toIssues(drafts);
  const damagedTotal = issues.filter((issue) => issue.issueType === "damaged").reduce((total, issue) => total + issue.quantity, 0);
  const missingTotal = issues.filter((issue) => issue.issueType === "missing").reduce((total, issue) => total + issue.quantity, 0);
  function toggle(id: string) {
    setDrafts((current) => {
      const next = { ...current };
      if (id in next) delete next[id]; else next[id] = { ...emptyDraft };
      return next;
    });
  }

  return <>
    <div className="pickup-review">
      {deliveries.map((delivery) => <section className="pickup-product-group delivery-review-group" key={delivery.id} aria-label={`הובלה ${delivery.transportNumber}`}>
        <h3>{deliveryTitle(delivery)}</h3>
        <p>מספר זיהוי הובלה: <bdi>{delivery.transportNumber}</bdi></p>
        <p>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(delivery))}</bdi></p>
        {delivery.packageSummary && <p>{delivery.packageSummary}</p>}
        <h4>יחידות אריזה בהובלה ({delivery.units.length} מתוך {delivery.packageCount} חבילות):</h4>
        {!delivery.units.length && <p className="package-help">לא שויכו יחידות אריזה להובלה זו.</p>}
        <ol className="delivery-packages">{delivery.units.map((unit) => <li key={unit.id}>
          <strong>{unitDescription(unit)}</strong>
          <p>מספר יחידת אריזה: <bdi>{unit.unitNumber}</bdi></p>
          <p>{unit.items.reduce((total, item) => total + item.quantity, 0)} פריטים · {unit.items.length} סוגי פריטים</p>
          <details><summary>פירוט פריטים וכמויות ביחידה <bdi>{unit.unitNumber}</bdi></summary>
            <ul>{unit.items.map((item) => <li key={item.id} className="receipt-item">
              <div className="receipt-item-row"><span>{item.name}</span><strong>כמות: {item.quantity}</strong>
                <button type="button" className="button secondary receipt-issue-toggle" aria-expanded={item.id in drafts} disabled={saving}
                  aria-label={`${item.id in drafts ? "ביטול דיווח" : "דיווח נזק או חוסר"}: ${item.name}`} onClick={() => toggle(item.id)}>
                  {item.id in drafts ? "ביטול דיווח" : "דיווח נזק / חוסר"}
                </button></div>
              {item.id in drafts && <ItemIssueEditor item={item} draft={drafts[item.id]} onChange={(draft) => setDrafts((current) => ({ ...current, [item.id]: draft }))} />}
            </li>)}</ul>
          </details>
        </li>)}</ol>
      </section>)}
    </div>
    {(damagedTotal > 0 || missingTotal > 0) && <p className="package-notice receipt-issue-summary"><AlertTriangle size={16} aria-hidden="true" /> ידווחו {damagedTotal} פריטים פגומים ו־{missingTotal} פריטים חסרים.</p>}
    <p className="package-notice pickup-statement">{damagedTotal > 0 || missingTotal > 0
      ? "בלחיצה על אישור אני מאשר שההובלות התקבלו ביעד, למעט הפריטים הפגומים והחסרים שדווחו."
      : "בלחיצה על אישור אני מאשר שכל ההובלות והחבילות המפורטות לעיל התקבלו ביעד."}</p>
    <button className="button primary pickup-final" disabled={saving || invalid} onClick={() => onConfirm(issues)}>{saving ? "מאשרים את קבלת ההובלות…" : "אישור קבלת ההובלות"}</button>
    {saving && <p role="status">שומרים את אישור קבלת ההובלות…</p>}
  </>;
}
