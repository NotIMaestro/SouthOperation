"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Truck } from "lucide-react";
import { PickupDialog } from "@/components/pickup/dialog";
import { SelectionRow } from "@/components/pickup/selection-row";
import { getCurrentUser } from "@/lib/pickup/current-user";
import { transportService } from "@/lib/transports/service";
import {
  TRANSPORTS_CHANGED, TRANSPORTS_KEY, TransportServiceError, deliveryDate, displayDeliveryDate,
  emptyDeliveryFilters, filterSchema, transportErrorMessage, type DeliveryDetails, type DeliveryFilters, type ReceivingSnapshot,
} from "@/lib/transports/types";
import { DeliveryConfirmation } from "./delivery-confirmation";

const user = getCurrentUser();
const confirmationDate = (value: string) => new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value));
export function ReceivingPage() {
  const [state, setState] = useState<ReceivingSnapshot>({ pending: [], confirmed: [], pendingTotal: 0 });
  const [draft, setDraft] = useState(emptyDeliveryFilters);
  const [filters, setFilters] = useState(emptyDeliveryFilters);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [details, setDetails] = useState<DeliveryDetails[] | null>(null);
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
      const result = await transportService.searchDeliveriesForUser(user.id, search);
      if (version !== listVersion.current) return;
      setState(result); setLoaded(true);
      setSelected((ids) => ids.filter((id) => result.pending.some((entry) => entry.id === id)));
    } catch (cause) { if (version === listVersion.current) { setError(transportErrorMessage(cause)); setLoaded(false); setSelected([]); } }
    finally { if (version === listVersion.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(filters), 0);
    const changed = () => { if (!mutation.current) void refresh(filters); };
    const stored = (event: StorageEvent) => { if (event.key === TRANSPORTS_KEY || event.key === "south-operation.demo-packages.v1" || event.key === null) changed(); };
    window.addEventListener(TRANSPORTS_CHANGED, changed); window.addEventListener("storage", stored);
    return () => { clearTimeout(initial); invalidate(); window.removeEventListener(TRANSPORTS_CHANGED, changed); window.removeEventListener("storage", stored); };
  }, [filters, refresh, invalidate]);
  function search() {
    try { const next = filterSchema.parse(draft); setLoading(true); setNotice(""); setFilters(next); }
    catch (cause) { setError(transportErrorMessage(cause)); }
  }
  function clear() { setDraft({ ...emptyDeliveryFilters }); setFilters({ ...emptyDeliveryFilters }); setLoading(true); setNotice(""); }
  function close() { if (mutation.current) return; ++detailVersion.current; setReviewIds([]); setDetails(null); setModalError(""); setDetailLoading(false); }
  async function review(ids: string[]) {
    const version = ++detailVersion.current;
    setReviewIds(ids); setDetails(null); setModalError(""); setDetailLoading(true); setNotice("");
    try {
      const result = await Promise.all(ids.map((id) => transportService.getDeliveryWithPackages(user.id, id)));
      if (version !== detailVersion.current) return;
      if (result.some((entry) => entry.receiptStatus !== "AWAITING_RECEIPT_CONFIRMATION")) throw new TransportServiceError("אחת ההובלות כבר אושרה או אינה זמינה לאישור. רעננו את הרשימה.");
      setDetails(result);
    } catch (cause) { if (version === detailVersion.current) setModalError(transportErrorMessage(cause)); }
    finally { if (version === detailVersion.current) setDetailLoading(false); }
  }
  async function confirm() {
    if (mutation.current || !details?.length) return;
    mutation.current = true; const version = ++detailVersion.current; ++listVersion.current;
    setSaving(true); setModalError("");
    try {
      const result = await transportService.confirmDeliveriesForUser(user.id, details.map((entry) => entry.id), filters);
      if (version !== detailVersion.current) return;
      setState(result); setSelected([]); setReviewIds([]); setDetails(null);
      setNotice(details.length === 1 ? "ההובלה אושרה בהצלחה." : "ההובלות אושרו בהצלחה.");
    } catch (cause) { if (version === detailVersion.current) setModalError(transportErrorMessage(cause)); }
    finally { if (version === detailVersion.current) { mutation.current = false; setSaving(false); } }
  }
  return <div className="package-stack delivery-receiving">
    <div aria-live="polite">{notice && <p className="package-notice success">{notice}</p>}</div>
    {error && <div className="package-notice error" role="alert">{error} <button className="button secondary" onClick={() => void refresh(filters)}>ניסיון נוסף</button></div>}
    <section className="panel" aria-labelledby="pending-deliveries-title" aria-busy={loading}>
      <div className="panel-heading"><div><span className="eyebrow">בדיקת הובלות ביעד</span>
        <h2 id="pending-deliveries-title">הובלות ממתינות <span className="pickup-count">{loaded ? state.pending.length : "—"}</span></h2>
        <p>בחרו הובלות ובדקו את החבילות המשויכות אליהן לפני האישור.</p></div><Truck aria-hidden="true" /></div>
      <form className="delivery-filters" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <label className="package-field">תאריך מסירה<input type="date" value={draft.date} onInput={(event) => { const date = event.currentTarget.value; setDraft((value) => ({ ...value, date })); }} /></label>
        <label className="package-field">מספר זיהוי הובלה<input type="search" dir="ltr" maxLength={40} placeholder="TR-025" value={draft.deliveryNumber} onChange={(event) => { const deliveryNumber = event.currentTarget.value; setDraft((value) => ({ ...value, deliveryNumber })); }} /></label>
        <label className="package-field">מספר זיהוי חבילה<input type="search" dir="ltr" maxLength={40} placeholder="100001" value={draft.packageNumber} onChange={(event) => { const packageNumber = event.currentTarget.value; setDraft((value) => ({ ...value, packageNumber })); }} /></label>
        <div className="package-actions"><button className="button primary" type="submit" disabled={loading}>חיפוש</button><button className="button secondary" type="button" onClick={clear}>ניקוי סינון</button></div>
      </form>
      <p className="package-help">אפשר להזין חלק ממספר הזיהוי. כל תנאי החיפוש מופעלים יחד, על ההובלות הממתינות בלבד.</p>
      {loading ? <p role="status">טוענים הובלות ממתינות…</p> : loaded && <>
        {!state.pending.length && <p className="pickup-empty">{state.pendingTotal ? "לא נמצאו הובלות שתואמות לסינון שנבחר." : "אין כרגע הובלות שממתינות לאישור."}</p>}
        <div className="pickup-list">{state.pending.map((entry) => <SelectionRow key={entry.id} checked={selected.includes(entry.id)} label={`בחירת הובלה ${entry.id}: ${entry.title}`}
          identifier={entry.id} identifierLabel="מספר זיהוי הובלה" onChange={(checked) => setSelected((ids) => checked ? [...ids, entry.id] : ids.filter((id) => id !== entry.id))}>
          <strong>{entry.title}</strong><small>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(entry))}</bdi> · {entry.packageCount} חבילות</small>
        </SelectionRow>)}</div>
      </>}
      <div className="pickup-selection"><p aria-live="polite">נבחרו {picked.length} הובלות</p><button className="button primary" disabled={loading || !loaded || !picked.length} onClick={() => void review(picked.map((entry) => entry.id))}>אישור ההובלות שנבחרו</button></div>
    </section>
    <section className="panel pickup-confirmed" aria-labelledby="confirmed-deliveries-title" aria-busy={!loaded && loading}>
      <div className="panel-heading"><div><h2 id="confirmed-deliveries-title">הובלות מאושרות <span className="pickup-count">{loaded ? state.confirmed.length : "—"}</span></h2>
        <p>הובלות שקבלתן ביעד כבר אושרה.</p></div><CheckCircle2 aria-hidden="true" /></div>
      {!loaded && loading ? <p role="status">טוענים הובלות מאושרות…</p> : loaded && <>
        {!state.confirmed.length && <p className="pickup-empty">עדיין לא אושרו הובלות.</p>}
        <div className="pickup-list">{state.confirmed.map((entry) => <article key={entry.id} className="pickup-confirmed-row" aria-label={`הובלה מאושרת ${entry.id}`}>
          <div><strong>{entry.title}</strong><small>מספר זיהוי הובלה: <bdi>{entry.id}</bdi></small><small>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(entry))}</bdi> · {entry.packageCount} חבילות</small></div>
          <div><span className="package-badge"><CheckCircle2 size={14} aria-hidden="true" /> התקבלה ואושרה</span>
            {entry.confirmedAt && <time dateTime={entry.confirmedAt}>אושרה ב־{confirmationDate(entry.confirmedAt)}</time>}</div>
        </article>)}</div>
      </>}
    </section>
    {!!reviewIds.length && <PickupDialog title="אישור קבלת הובלות" busy={saving} onClose={close}>
      {modalError && <p className="package-notice error" role="alert">{modalError}</p>}
      {detailLoading && <p role="status">טוענים את פרטי ההובלות והחבילות…</p>}
      {!detailLoading && !details && <button className="button secondary" onClick={() => void review(reviewIds)}>ניסיון נוסף לטעינת הפרטים</button>}
      {details && <DeliveryConfirmation deliveries={details} saving={saving} onConfirm={() => void confirm()} />}
    </PickupDialog>}
  </div>;
}
