"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Hash, ScanLine, Upload } from "lucide-react";
import { CameraPreview } from "@/components/packages/camera-preview";
import { decodeLabelImage } from "@/lib/packages/barcode";
import { packageErrorMessage, packageNumberSchema } from "@/lib/packages/types";
import { getCurrentUser } from "@/lib/pickup/current-user";
import { collectionService } from "@/lib/pickup/service";
import { COLLECTION_CHANGED, CONFIRMATIONS_KEY, scannedValueSchema, type CollectionPackage, type CollectionSnapshot } from "@/lib/pickup/types";
import { PickupDialog } from "./dialog";
import { PackageConfirmation } from "./confirmation";

const user = getCurrentUser();
const date = (value: string) => new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value));
type Mode = "manual" | "scan" | "confirm" | null;

export function PickupPage() {
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
      const next = await collectionService.getPackagesForUser(user.id);
      if (version !== fetchVersion.current) return;
      setState(next); setLoaded(true);
      setSelection((ids) => ids.filter((id) => next.pending.some((item) => item.id === id)));
    } catch (cause) { if (version === fetchVersion.current) { setError(packageErrorMessage(cause)); setLoaded(false); } }
    finally { if (version === fetchVersion.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const changed = () => { if (!inFlight.current) void refresh(); };
    const stored = (event: StorageEvent) => { if (event.key === CONFIRMATIONS_KEY || event.key === null || event.key === "south-operation.demo-packages.v1") changed(); };
    window.addEventListener(COLLECTION_CHANGED, changed);
    window.addEventListener("storage", stored);
    return () => {
      clearTimeout(initial); invalidateRequests();
      window.removeEventListener(COLLECTION_CHANGED, changed);
      window.removeEventListener("storage", stored);
    };
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
      const decoded = typeof value === "string" ? value : await decodeLabelImage(value);
      const parsed = (method === "manual" ? packageNumberSchema : scannedValueSchema).parse(decoded);
      const item = method === "manual"
        ? await collectionService.findPackageForUserByPackageNumber(user.id, parsed)
        : await collectionService.findPackageForUserByScannedValue(user.id, parsed);
      if (version !== operation.current) return;
      if (!item) setError(method === "manual" ? "לא נמצאה חבילה זמינה לאישור במספר שהוזן." : "לא נמצאה חבילה מתאימה לקוד שנסרק.");
      else if (item.status === "CONFIRMED_RECEIVED") setError("החבילה כבר אושרה בעבר.");
      else { setReview([item]); setMode("confirm"); }
    } catch (cause) {
      if (version === operation.current) setError(value instanceof File && cause instanceof Error && !("issues" in cause) ? cause.message : packageErrorMessage(cause));
    } finally { if (version === operation.current) { inFlight.current = false; setBusy(false); } }
  }, []);
  const decoded = useCallback((value: string) => { void lookup(value, "scan"); }, [lookup]);
  async function confirm() {
    if (inFlight.current || !review.length) return;
    inFlight.current = true; const version = ++operation.current;
    ++fetchVersion.current;
    setBusy(true); setError("");
    try {
      const next = await collectionService.confirmPackagesForUser(user.id, review.map((item) => item.id));
      if (version !== operation.current) return;
      setState(next); setSelection([]); setMode(null); setReview([]);
      setNotice(review.length === 1 ? "קבלת החבילה אושרה בהצלחה." : `קבלת ${review.length} חבילות אושרה בהצלחה.`);
    } catch (cause) { if (version === operation.current) setError(packageErrorMessage(cause)); }
    finally { if (version === operation.current) { inFlight.current = false; setBusy(false); } }
  }
  return <div className="package-stack pickup-content">
    <div aria-live="polite">{notice && <p className="package-notice success">{notice}</p>}</div>
    {!mode && error && <div className="package-notice error" role="alert">{error}
      {!loaded && <button className="button secondary" onClick={() => { setError(""); setLoading(true); void refresh(); }}>ניסיון נוסף</button>}
    </div>}
    <section className="panel" aria-labelledby="pickup-pending-title" aria-busy={loading}>
      <div className="panel-heading"><div><span className="eyebrow">בדיקה ואישור</span>
        <h2 id="pickup-pending-title">חבילות שממתינות לאישור <span className="pickup-count">{loaded ? state.pending.length : "—"}</span></h2>
        <p>סמנו חבילות כדי לבדוק את הפריטים שהתקבלו.</p></div><ScanLine aria-hidden="true" /></div>
      {loading ? <p role="status">טוענים חבילות שממתינות לאישור…</p> : loaded && <>
        {!state.pending.length && <p className="pickup-empty">אין כרגע חבילות שממתינות לאישור.</p>}
        <div className="pickup-list">{state.pending.map((item) => <label key={item.id} className={`pickup-row ${selection.includes(item.id) ? "is-selected" : ""}`}>
          <input type="checkbox" checked={selection.includes(item.id)} aria-label={`בחירת חבילה ${item.packageNumber}: ${item.description}`}
            onChange={(event) => setSelection((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />
          <span className="pickup-description"><strong>{item.description}</strong><small>הגיעה ל{item.destination}</small></span>
          <span className="pickup-number"><small>מספר חבילה</small><bdi>{item.packageNumber}</bdi></span>
        </label>)}</div>
      </>}
      <div className="pickup-selection"><p aria-live="polite">נבחרו {picked.length} חבילות</p>
        <button className="button primary" disabled={!loaded || !picked.length || loading} onClick={() => { setReview(picked); open("confirm"); }}>אישור החבילות שנבחרו</button></div>
    </section>
    <section className="panel pickup-confirmed" aria-labelledby="pickup-confirmed-title" aria-busy={loading}>
      <div className="panel-heading"><div><h2 id="pickup-confirmed-title">חבילות מאושרות <span className="pickup-count">{loaded ? state.confirmed.length : "—"}</span></h2>
        <p>חבילות שבדקתם ואישרתם שהתקבלו במלואן.</p></div><CheckCircle2 aria-hidden="true" /></div>
      {loading ? <p role="status">טוענים חבילות מאושרות…</p> : loaded && <>
        {!state.confirmed.length && <p className="pickup-empty">עדיין לא אישרת חבילות.</p>}
        <div className="pickup-list">{state.confirmed.map((item) => <article key={item.id} className="pickup-confirmed-row" aria-label={`חבילה מאושרת ${item.packageNumber}`}>
          <div><strong>{item.description}</strong><small>מספר חבילה: <bdi>{item.packageNumber}</bdi></small></div>
          <div><span className="package-badge"><CheckCircle2 size={14} aria-hidden="true" /> התקבלה ואושרה</span>
            {item.confirmedAt && <time dateTime={item.confirmedAt}>{date(item.confirmedAt)}</time>}</div>
        </article>)}</div>
      </>}
    </section>
    <div className="pickup-bottom" aria-label="דרכים נוספות לאישור חבילה">
      <button className="button primary" disabled={!loaded || loading} onClick={() => open("scan")}><ScanLine aria-hidden="true" />סריקת קוד לאישור חבילה</button>
      <button className="button secondary" disabled={!loaded || loading} onClick={() => open("manual")}><Hash aria-hidden="true" />אישור חבילה לפי מספר</button>
    </div>
    {mode && <PickupDialog title={mode === "confirm" ? review.length === 1 ? "אישור קבלת חבילה" : "אישור קבלת חבילות" : mode === "manual" ? "אישור חבילה לפי מספר" : "סריקת קוד לאישור חבילה"}
      busy={mode === "confirm" && busy} onClose={close}>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      {mode === "confirm" && <PackageConfirmation packages={review} busy={busy} onConfirm={() => void confirm()} />}
      {mode === "manual" && <form onSubmit={(event) => { event.preventDefault(); void lookup(number, "manual"); }}>
        <label className="package-field">מספר חבילה ייחודי<input value={number} onChange={(event) => setNumber(event.target.value)} dir="ltr" inputMode="numeric" autoComplete="off" maxLength={40} disabled={busy} aria-describedby="pickup-number-help" /></label>
        <p id="pickup-number-help" className="package-help">הזינו את שש הספרות שמופיעות על תווית החבילה.</p>
        <button type="submit" className="button primary" disabled={busy}>{busy ? "מחפשים חבילה…" : "המשך לאישור"}</button>
      </form>}
      {mode === "scan" && <>
        <p className="package-help">סרקו קוד QR או ברקוד מתווית החבילה. הסריקה פותחת את פרטי החבילה לבדיקה לפני האישור.</p>
        {camera && <CameraPreview collection onDecoded={decoded} onError={cameraError} onClose={stopCamera} />}
        <div className="package-actions">
          {!camera && <button className="button primary" disabled={busy} onClick={() => { setError(""); setCamera(true); }}>הפעלת המצלמה</button>}
          <label className={`button secondary upload-button ${busy ? "is-disabled" : ""}`}><Upload aria-hidden="true" />העלאת תמונת קוד
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="העלאת תמונת קוד" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void lookup(file, "scan"); }} />
          </label>
          <button className="button secondary" disabled={busy} onClick={() => { setCamera(false); setError(""); setMode("manual"); }}>הזנת מספר חבילה</button>
        </div>
      </>}
      {busy && mode !== "confirm" && <p role="status">מאתרים את החבילה…</p>}
    </PickupDialog>}
  </div>;
}
