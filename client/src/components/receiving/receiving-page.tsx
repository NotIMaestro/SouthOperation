"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import { PickupDialog } from "@/components/pickup/dialog";
import { SelectionRow } from "@/components/pickup/selection-row";
import { receivingService } from "@/lib/transports/service";
import {
  TransportServiceError, deliveryDate, deliveryIssueTotals, displayDeliveryDate,
  emptyDeliveryFilters, filterSchema, transportErrorMessage, type Delivery, type DeliveryFilters, type FilteredReceiving, type ReceiptIssue,
} from "@/lib/transports/types";
import { DeliveryConfirmation, deliveryTitle } from "./delivery-confirmation";

const confirmationDate = (value: string) => new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value));
const issueLabels = { damaged: "פגום", missing: "חסר" } as const;
function IssueList({ delivery }: { delivery: Delivery }) {
  const rows = delivery.units.flatMap((unit) => unit.items.flatMap((item) => item.issues.map((issue) => ({ unit, item, issue }))));
  if (!rows.length) return null;
  return <details className="receipt-issue-list"><summary>פריטים פגומים וחסרים ({rows.length})</summary>
    <ul>{rows.map(({ unit, item, issue }) => <li key={`${item.id}-${issue.issueType}`}>
      <span>{item.name} · יחידה <bdi>{unit.unitNumber}</bdi></span>
      <strong>{issueLabels[issue.issueType]}: {issue.quantity} מתוך {item.quantity}</strong>
      {issue.note && <small>{issue.note}</small>}
    </li>)}</ul>
  </details>;
}
export function ReceivingPage({ groupId }: { groupId: string }) {
  const [state, setState] = useState<FilteredReceiving>({ pending: [], confirmed: [], pendingTotal: 0 });
  const [draft, setDraft] = useState(emptyDeliveryFilters);
  const [filters, setFilters] = useState(emptyDeliveryFilters);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [details, setDetails] = useState<Delivery[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState("");
  const mutation = useRef(false);
  const listVersion = useRef(0);
  const detailVersion = useRef(0);
  const picked = state.pending.filter((entry) => selected.includes(entry.id));
  const invalidate = useCallback(() => { ++listVersion.current; ++detailVersion.current; }, []);
  const refresh = useCallback(async (search: DeliveryFilters) => {
    const version = ++listVersion.current;
    setLoading(true); setError("");
    try {
      const result = await receivingService.search(groupId, search);
      if (version !== listVersion.current) return;
      setState(result); setLoaded(true);
      setSelected((ids) => ids.filter((id) => result.pending.some((entry) => entry.id === id)));
    } catch (cause) { if (version === listVersion.current) { setError(transportErrorMessage(cause)); setLoaded(false); setSelected([]); } }
    finally { if (version === listVersion.current) setLoading(false); }
  }, [groupId]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(filters), 0);
    return () => { clearTimeout(initial); invalidate(); };
  }, [filters, refresh, invalidate]);
  function search() {
    try { const next = filterSchema.parse(draft); setLoading(true); setNotice(""); setFilters(next); }
    catch (cause) { setError(transportErrorMessage(cause)); }
  }
  function clear() { setDraft({ ...emptyDeliveryFilters }); setFilters({ ...emptyDeliveryFilters }); setLoading(true); setNotice(""); }
  function close() { if (mutation.current) return; ++detailVersion.current; setReviewIds([]); setDetails(null); setModalError(""); setDetailLoading(false); }
  // Re-reads the deliveries so the review reflects what is confirmable right now.
  async function review(ids: string[]) {
    const version = ++detailVersion.current;
    setReviewIds(ids); setDetails(null); setModalError(""); setDetailLoading(true); setNotice("");
    try {
      const { pending } = await receivingService.search(groupId, emptyDeliveryFilters);
      if (version !== detailVersion.current) return;
      const result = ids.map((id) => pending.find((entry) => entry.id === id));
      if (result.some((entry) => !entry)) throw new TransportServiceError("אחת ההובלות כבר אושרה או אינה זמינה לאישור. רעננו את הרשימה.");
      setDetails(result as Delivery[]);
    } catch (cause) { if (version === detailVersion.current) setModalError(transportErrorMessage(cause)); }
    finally { if (version === detailVersion.current) setDetailLoading(false); }
  }
  async function confirm(issues: ReceiptIssue[]) {
    if (mutation.current || !details?.length) return;
    mutation.current = true; const version = ++detailVersion.current; ++listVersion.current;
    setSaving(true); setModalError("");
    try {
      const result = await receivingService.confirm(groupId, details.map((entry) => entry.id), filters, issues);
      if (version !== detailVersion.current) return;
      setState(result); setSelected([]); setReviewIds([]); setDetails(null);
      setNotice((details.length === 1 ? "ההובלה אושרה בהצלחה." : "ההובלות אושרו בהצלחה.") + (issues.length ? " הפריטים הפגומים והחסרים נרשמו." : ""));
    } catch (cause) { if (version === detailVersion.current) setModalError(transportErrorMessage(cause)); }
    finally { if (version === detailVersion.current) { mutation.current = false; setSaving(false); } }
  }
  return <div className="package-stack delivery-receiving">
    <div aria-live="polite">{notice && <p className="package-notice success">{notice}</p>}</div>
    {error && <div className="package-notice error" role="alert">{error} <button className="button secondary" onClick={() => void refresh(filters)}>ניסיון נוסף</button></div>}
    <section className="panel" aria-labelledby="pending-deliveries-title" aria-busy={loading}>
      <div className="panel-heading"><div><span className="eyebrow">בדיקת הובלות ביעד</span>
        <h2 id="pending-deliveries-title">הובלות ממתינות <span className="pickup-count">{loaded ? state.pending.length : "—"}</span></h2>
        <p>בחרו הובלות ובדקו את יחידות האריזה המשויכות אליהן לפני האישור.</p></div><Truck aria-hidden="true" /></div>
      <form className="delivery-filters" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <label className="package-field">תאריך מסירה<input type="date" value={draft.date} onInput={(event) => { const date = event.currentTarget.value; setDraft((value) => ({ ...value, date })); }} /></label>
        <label className="package-field">מספר זיהוי הובלה<input type="search" dir="ltr" maxLength={40} placeholder="TR-025" value={draft.deliveryNumber} onChange={(event) => { const deliveryNumber = event.currentTarget.value; setDraft((value) => ({ ...value, deliveryNumber })); }} /></label>
        <label className="package-field">מספר יחידת אריזה<input type="search" dir="ltr" maxLength={40} placeholder="00012" value={draft.packageNumber} onChange={(event) => { const packageNumber = event.currentTarget.value; setDraft((value) => ({ ...value, packageNumber })); }} /></label>
        <div className="package-actions"><button className="button primary" type="submit" disabled={loading}>חיפוש</button><button className="button secondary" type="button" onClick={clear}>ניקוי סינון</button></div>
      </form>
      <p className="package-help">אפשר להזין חלק ממספר הזיהוי. כל תנאי החיפוש מופעלים יחד, על ההובלות הממתינות בלבד.</p>
      {loading ? <p role="status">טוענים הובלות ממתינות…</p> : loaded && <>
        {!state.pending.length && <p className="pickup-empty">{state.pendingTotal ? "לא נמצאו הובלות שתואמות לסינון שנבחר." : "אין כרגע הובלות שממתינות לאישור."}</p>}
        <div className="pickup-list">{state.pending.map((entry) => <SelectionRow key={entry.id} checked={selected.includes(entry.id)} label={`בחירת הובלה ${entry.transportNumber}: ${deliveryTitle(entry)}`}
          identifier={entry.transportNumber} identifierLabel="מספר זיהוי הובלה" onChange={(checked) => setSelected((ids) => checked ? [...ids, entry.id] : ids.filter((id) => id !== entry.id))}>
          <strong>{deliveryTitle(entry)}</strong><small>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(entry))}</bdi> · {entry.packageCount} חבילות</small>
        </SelectionRow>)}</div>
      </>}
      <div className="pickup-selection"><p aria-live="polite">נבחרו {picked.length} הובלות</p><button className="button primary" disabled={loading || !loaded || !picked.length} onClick={() => void review(picked.map((entry) => entry.id))}>אישור ההובלות שנבחרו</button></div>
    </section>
    <section className="panel pickup-confirmed" aria-labelledby="confirmed-deliveries-title" aria-busy={!loaded && loading}>
      <div className="panel-heading"><div><h2 id="confirmed-deliveries-title">הובלות מאושרות <span className="pickup-count">{loaded ? state.confirmed.length : "—"}</span></h2>
        <p>הובלות שקבלתן ביעד כבר אושרה.</p></div><CheckCircle2 aria-hidden="true" /></div>
      {!loaded && loading ? <p role="status">טוענים הובלות מאושרות…</p> : loaded && <>
        {!state.confirmed.length && <p className="pickup-empty">עדיין לא אושרו הובלות.</p>}
        <div className="pickup-list">{state.confirmed.map((entry) => <article key={entry.id} className="pickup-confirmed-row" aria-label={`הובלה מאושרת ${entry.transportNumber}`}>
          <div><strong>{deliveryTitle(entry)}</strong><small>מספר זיהוי הובלה: <bdi>{entry.transportNumber}</bdi></small><small>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(entry))}</bdi> · {entry.packageCount} חבילות</small>
            <IssueList delivery={entry} /></div>
          <div>{(() => {
            const { damaged, missing } = deliveryIssueTotals(entry);
            return damaged || missing
              ? <span className="package-badge receipt-issue-badge"><AlertTriangle size={14} aria-hidden="true" /> התקבלה עם {[damaged && `${damaged} פגומים`, missing && `${missing} חסרים`].filter(Boolean).join(" · ")}</span>
              : <span className="package-badge"><CheckCircle2 size={14} aria-hidden="true" /> התקבלה ואושרה</span>;
          })()}
            {entry.receivedAt && <time dateTime={entry.receivedAt}>אושרה ב־{confirmationDate(entry.receivedAt)}</time>}</div>
        </article>)}</div>
      </>}
    </section>
    {!!reviewIds.length && <PickupDialog title="אישור קבלת הובלות" busy={saving} onClose={close}>
      {modalError && <p className="package-notice error" role="alert">{modalError}</p>}
      {detailLoading && <p role="status">טוענים את פרטי ההובלות והחבילות…</p>}
      {!detailLoading && !details && <button className="button secondary" onClick={() => void review(reviewIds)}>ניסיון נוסף לטעינת הפרטים</button>}
      {details && <DeliveryConfirmation deliveries={details} saving={saving} onConfirm={(issues) => void confirm(issues)} />}
    </PickupDialog>}
  </div>;
}
