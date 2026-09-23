"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Hash, ScanLine, Upload } from "lucide-react";
import { CameraPreview } from "@/components/packing/camera-preview";
import { collectionService } from "@/lib/pickup/service";
import { PickupServiceError, pickupErrorMessage, unitNumberSchema, type CollectionPackage, type CollectionSnapshot } from "@/lib/pickup/types";
import { decodeQrImage, parsePackingUnitQrValue } from "@/lib/qr";
import { PickupDialog } from "./dialog";
import { PackageConfirmation, unitDescription, unitDestination } from "./confirmation";
import { SelectionRow } from "./selection-row";

const isUnitQr = (value: string) => parsePackingUnitQrValue(value) !== null;
const date = (value: string) => new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value));
type Mode = "manual" | "scan" | "confirm" | null;

export function PickupPage({ groupId }: { groupId: string }) {
  const [state, setState] = useState<CollectionSnapshot>({ pending: [], confirmed: [] });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [review, setReview] = useState<CollectionPackage[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [camera, setCamera] = useState(false);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const operation = useRef(0);
  const fetchVersion = useRef(0);
  const picked = state.pending.filter((item) => selection.includes(item.id));
  const invalidateRequests = useCallback(() => { ++operation.current; ++fetchVersion.current; }, []);

  const refresh = useCallback(async () => {
    const version = ++fetchVersion.current;
    try {
      const next = await collectionService.getPackages(groupId);
      if (version !== fetchVersion.current) return;
      setState(next); setLoaded(true);
      setSelection((ids) => ids.filter((id) => next.pending.some((item) => item.id === id)));
    } catch (cause) { if (version === fetchVersion.current) { setError(pickupErrorMessage(cause)); setLoaded(false); } }
    finally { if (version === fetchVersion.current) setLoading(false); }
  }, [groupId]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    return () => { clearTimeout(initial); invalidateRequests(); };
  }, [refresh, invalidateRequests]);
  const close = useCallback(() => {
    ++operation.current; inFlight.current = false;
    setMode(null); setCamera(false); setBusy(false); setError("");
  }, []);
  function open(next: Mode) {
    setError(""); setNotice(""); setNumber(""); setMode(next); setCamera(next === "scan");
  }
  const stopCamera = useCallback(() => setCamera(false), []);
  const cameraError = useCallback((message: string) => { setCamera(false); setError(message); }, []);

  // One path for camera, image and manual lookup; identifying never confirms.
  const lookup = useCallback(async (value: string | File, method: "scan" | "manual") => {
    if (inFlight.current) return;
    inFlight.current = true; const version = ++operation.current;
    setBusy(true); setCamera(false); setError(""); setNotice("");
    try {
      const decoded = typeof value === "string" ? value : await decodeQrImage(value);
      let match: (item: CollectionPackage) => boolean;
      if (method === "manual") {
        const unitNumber = unitNumberSchema.parse(decoded);
        match = (item) => item.unitNumber === unitNumber;
      } else {
        const unitId = parsePackingUnitQrValue(decoded);
        if (!unitId) throw new PickupServiceError("הקוד אינו תקין. סרקו קוד QR מתווית יחידת האריזה.");
        match = (item) => item.id === unitId;
      }
      const { pending, confirmed } = await collectionService.getPackages(groupId);
      if (version !== operation.current) return;
      const item = pending.find(match);
      if (item) { setReview([item]); setMode("confirm"); }
      else if (confirmed.some(match)) setError("החבילה כבר אושרה בעבר.");
      else setError(method === "manual" ? "לא נמצאה חבילה זמינה לאישור במספר שהוזן." : "לא נמצאה חבילה מתאימה לקוד שנסרק.");
    } catch (cause) {
      if (version === operation.current) setError(value instanceof File && cause instanceof Error && !("issues" in cause) && !(cause instanceof PickupServiceError) ? cause.message : pickupErrorMessage(cause));
    } finally { if (version === operation.current) { inFlight.current = false; setBusy(false); } }
  }, [groupId]);
  const decoded = useCallback((value: string) => { void lookup(value, "scan"); }, [lookup]);
  async function confirm() {
    if (inFlight.current || !review.length) return;
    inFlight.current = true; const version = ++operation.current;
    ++fetchVersion.current;
    setBusy(true); setError("");
    try {
      const next = await collectionService.confirmPackages(groupId, review.map((item) => item.id));
      if (version !== operation.current) return;
      setState(next); setSelection([]); setMode(null); setReview([]);
      setNotice(review.length === 1 ? "קבלת החבילה אושרה בהצלחה." : `קבלת ${review.length} חבילות אושרה בהצלחה.`);
    } catch (cause) { if (version === operation.current) setError(pickupErrorMessage(cause)); }
    finally { if (version === operation.current) { inFlight.current = false; setBusy(false); } }
  }
  return <div className="package-stack pickup-content">
    <div aria-live="polite">{notice && <p className="package-notice success">{notice}</p>}</div>
    {!mode && error && <div className="package-notice error" role="alert">{error}
      {!loaded && <button className="button secondary" onClick={() => { setError(""); setLoading(true); void refresh(); }}>ניסיון נוסף</button>}
    </div>}
    <div className="pickup-top-actions" aria-label="אפשרויות אישור חבילה">
      <p className="pickup-action-hint">בחרו דרך לאיתור החבילה ולאישור הקבלה שלה.</p>
      <div className="pickup-bottom">
        <button className="button primary" disabled={!loaded || loading} onClick={() => open("scan")}><ScanLine aria-hidden="true" />סריקת קוד לאישור חבילה</button>
        <button className="button secondary" disabled={!loaded || loading} onClick={() => open("manual")}><Hash aria-hidden="true" />אישור חבילה לפי מספר</button>
      </div>
    </div>
    <section className="panel" aria-labelledby="pickup-pending-title" aria-busy={loading}>
      <div className="panel-heading"><div><span className="eyebrow">בדיקה ואישור</span>
        <h2 id="pickup-pending-title">חבילות שממתינות לאישור <span className="pickup-count">{loaded ? state.pending.length : "—"}</span></h2>
        <p>סמנו חבילות כדי לבדוק את הפריטים שהתקבלו.</p></div><ScanLine aria-hidden="true" /></div>
      {loading ? <p role="status">טוענים חבילות שממתינות לאישור…</p> : loaded && <>
        {!state.pending.length && <p className="pickup-empty">אין כרגע חבילות שממתינות לאישור.</p>}
        <div className="pickup-list">{state.pending.map((item) => <SelectionRow key={item.id} checked={selection.includes(item.id)}
          label={`בחירת חבילה ${item.unitNumber}: ${unitDescription(item)}`} identifier={item.unitNumber ?? ""} identifierLabel="מספר יחידה"
          onChange={(checked) => setSelection((ids) => checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))}>
          <strong>{unitDescription(item)}</strong><small>הגיעה ל{unitDestination(item)}</small>
        </SelectionRow>)}</div>
      </>}
      <div className="pickup-selection"><p aria-live="polite">נבחרו {picked.length} חבילות</p>
        <button className="button primary" disabled={!loaded || !picked.length || loading} onClick={() => { setReview(picked); open("confirm"); }}>אישור החבילות שנבחרו</button></div>
    </section>
    <section className="panel pickup-confirmed" aria-labelledby="pickup-confirmed-title" aria-busy={loading}>
      <div className="panel-heading"><div><h2 id="pickup-confirmed-title">חבילות מאושרות <span className="pickup-count">{loaded ? state.confirmed.length : "—"}</span></h2>
        <p>חבילות שבדקתם ואישרתם שהתקבלו במלואן.</p></div><CheckCircle2 aria-hidden="true" /></div>
      {loading ? <p role="status">טוענים חבילות מאושרות…</p> : loaded && <>
        {!state.confirmed.length && <p className="pickup-empty">עדיין לא אישרת חבילות.</p>}
        <div className="pickup-list">{state.confirmed.map((item) => <article key={item.id} className="pickup-confirmed-row" aria-label={`חבילה מאושרת ${item.unitNumber}`}>
          <div><strong>{unitDescription(item)}</strong><small>מספר יחידה: <bdi>{item.unitNumber}</bdi></small></div>
          <div><span className="package-badge"><CheckCircle2 size={14} aria-hidden="true" /> התקבלה ואושרה</span>
            {item.collectedAt && <time dateTime={item.collectedAt}>{date(item.collectedAt)}</time>}</div>
        </article>)}</div>
      </>}
    </section>
    {mode && <PickupDialog title={mode === "confirm" ? review.length === 1 ? "אישור קבלת חבילה" : "אישור קבלת חבילות" : mode === "manual" ? "אישור חבילה לפי מספר" : "סריקת קוד לאישור חבילה"}
      busy={mode === "confirm" && busy} onClose={close}>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      {mode === "confirm" && <PackageConfirmation packages={review} busy={busy} onConfirm={() => void confirm()} />}
      {mode === "manual" && <form onSubmit={(event) => { event.preventDefault(); void lookup(number, "manual"); }}>
        <label className="package-field">מספר יחידת אריזה<input value={number} onChange={(event) => setNumber(event.target.value)} dir="ltr" inputMode="numeric" autoComplete="off" maxLength={40} disabled={busy} aria-describedby="pickup-number-help" /></label>
        <p id="pickup-number-help" className="package-help">הזינו את מספר יחידת האריזה שמופיע על התווית, למשל 00012.</p>
        <button type="submit" className="button primary" disabled={busy}>{busy ? "מחפשים חבילה…" : "המשך לאישור"}</button>
      </form>}
      {mode === "scan" && <>
        <p className="package-help">סרקו את קוד ה־QR שעל תווית יחידת האריזה. הסריקה פותחת את פרטי החבילה לבדיקה לפני האישור.</p>
        {camera && <CameraPreview isValid={isUnitQr} onDecoded={decoded} onError={cameraError} onClose={stopCamera} />}
        <div className="package-actions">
          {!camera && <button className="button primary" disabled={busy} onClick={() => { setError(""); setCamera(true); }}>הפעלת המצלמה</button>}
          <label className={`button secondary upload-button ${busy ? "is-disabled" : ""}`}><Upload aria-hidden="true" />העלאת תמונת קוד
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="העלאת תמונת קוד" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void lookup(file, "scan"); }} />
          </label>
          <button className="button secondary" disabled={busy} onClick={() => { setCamera(false); setError(""); setMode("manual"); }}>הזנת מספר יחידה</button>
        </div>
      </>}
      {busy && mode !== "confirm" && <p role="status">מאתרים את החבילה…</p>}
    </PickupDialog>}
  </div>;
}
