"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Keyboard, ScanLine, Search, X } from "lucide-react";
import { findPackageByPackageNumber, findPackageByQrToken } from "@/lib/packages/service";
import { packageErrorMessage, packageNumberSchema, qrTokenSchema, type PackageRecord } from "@/lib/packages/types";
import { decodeQrImage } from "@/lib/packages/qr";
import { PackageCard } from "./package-card";
import { CameraPreview } from "./camera-preview";

export function ScanPackage() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PackageRecord | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const operation = useRef(0);
  const inFlight = useRef(false);
  const focusManual = useRef(false);
  useEffect(() => () => { operation.current++; }, []);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
    else if (focusManual.current && !busy) { input.current?.focus(); focusManual.current = false; }
  }, [result, busy]);

  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const cameraError = useCallback((message: string) => { setCameraOpen(false); setError(message); }, []);

  const lookup = useCallback(async (mode: "qr" | "number", value: string) => {
    if (inFlight.current) return;
    setCameraOpen(false);
    setResult(null);
    setError("");
    const parsed = (mode === "qr" ? qrTokenSchema : packageNumberSchema).safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    inFlight.current = true;
    const id = ++operation.current;
    setBusy(true);
    try {
      const record = await (mode === "qr" ? findPackageByQrToken(parsed.data) : findPackageByPackageNumber(parsed.data));
      if (id !== operation.current) return;
      if (record) setResult(record);
      else setError("לא נמצאה חבילה. בדקו את התווית או את המספר. חבילות הדגמה שנוצרו זמינות רק בדפדפן שבו נוצרו.");
    } catch (cause) { if (id === operation.current) setError(packageErrorMessage(cause)); }
    finally { if (id === operation.current) { inFlight.current = false; setBusy(false); } }
  }, []);
  const decoded = useCallback((token: string) => { void lookup("qr", token); }, [lookup]);

  function openCamera() {
    setResult(null); setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("הגישה למצלמה אינה נתמכת כאן. פתחו את היישום באמצעות HTTPS או localhost, או העלו תמונת QR / הזינו מספר חבילה.");
      return;
    }
    setCameraOpen(true);
  }

  async function upload(file: File | undefined) {
    if (!file || inFlight.current) return;
    closeCamera(); setError(""); setResult(null); setBusy(true); inFlight.current = true;
    const id = ++operation.current;
    let token: string;
    try { token = await decodeQrImage(file); }
    catch (cause) {
      if (id === operation.current) { setError(cause instanceof Error ? cause.message : "לא ניתן לפענח את התמונה. נסו שוב."); setBusy(false); inFlight.current = false; }
      return;
    }
    if (id !== operation.current) return;
    inFlight.current = false;
    setBusy(false);
    await lookup("qr", token);
  }

  return (
    <div className="package-stack">
      <div className="scan-grid">
        <section className="panel scan-panel" aria-labelledby="camera-title">
          <div className="panel-heading"><div><span className="eyebrow">01 / סריקת תווית</span><h2 id="camera-title">איתור חבילה באמצעות קוד QR</h2></div><ScanLine aria-hidden="true" /></div>
          {cameraOpen ? <CameraPreview onDecoded={decoded} onError={cameraError} onClose={closeCamera} /> :
            <div className="camera-placeholder"><ScanLine aria-hidden="true" /><strong>מוכנים לסריקה</strong><p>הרשאת גישה למצלמה תתבקש רק בעת פתיחתה. לא מתבצעת הקלטה.</p></div>}
          <div className="package-actions">
            {cameraOpen ? <button className="button secondary" onClick={closeCamera}><X aria-hidden="true" /> סגירת המצלמה</button> :
              <button className="button primary" onClick={openCamera} disabled={busy}><Camera aria-hidden="true" /> פתיחת המצלמה</button>}
            <label className={`button secondary upload-button ${busy ? "is-disabled" : ""}`}>
              <ImageUp aria-hidden="true" /> העלאת תמונת QR
              <input aria-label="העלאת תמונת QR" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
            </label>
          </div>
          <p className="package-help">PNG, JPEG או WebP · עד 10 מגה־בייט. ניתן להעלות תווית שהורדתם ממחולל הקודים במכשיר זה.</p>
        </section>
        <section className="panel manual-panel" aria-labelledby="manual-title">
          <div className="panel-heading"><div><span className="eyebrow">02 / הזנת מספר</span><h2 id="manual-title">אפשר גם בלי מצלמה</h2></div><Keyboard aria-hidden="true" /></div>
          <p className="package-help">הזינו את המספר בן שש הספרות המודפס על תווית החבילה.</p>
          <form noValidate onSubmit={(event) => { event.preventDefault(); void lookup("number", number); }}>
            <label className="package-field">מספר חבילה<input ref={input} value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="למשל 100001" maxLength={30} disabled={busy} /></label>
            <button className="button primary full" type="submit" disabled={busy}><Search aria-hidden="true" /> {busy ? "מחפשים…" : "חיפוש"}</button>
          </form>
          <div className="demo-tip"><strong>נסו חבילה לדוגמה</strong><p>הזינו <bdi>100001</bdi> לציוד מחשוב שנמצא בהעברה, או <bdi>100006</bdi> לחבילה שדווחה בה תקלה.</p></div>
        </section>
      </div>
      <div aria-live="polite" aria-atomic="true">{busy && <p className="package-notice">קוראים את התווית ומחפשים את החבילה…</p>}</div>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      {result && <section className="package-stack"><h2 ref={resultHeading} tabIndex={-1} className="result-heading">החבילה נמצאה</h2><PackageCard record={result} />
        <div className="package-actions"><button className="button primary" disabled={busy} onClick={openCamera}><Camera aria-hidden="true" /> סריקת חבילה נוספת</button><button className="button secondary" disabled={busy} onClick={() => { focusManual.current = true; setResult(null); setError(""); setNumber(""); }}>הזנת מספר נוסף</button></div>
      </section>}
    </div>
  );
}
