"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Keyboard, ScanLine, Search, X } from "lucide-react";

import { decodeQrImage, parsePackingUnitQrValue } from "@/lib/qr";
import { PackingUnitResultCard, type PackingUnitLookupResult } from "./packing-unit-result-card";
import { CameraPreview } from "./camera-preview";

async function fetchUnit(url: string): Promise<PackingUnitLookupResult | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "החיפוש נכשל.");
  return payload.data as PackingUnitLookupResult;
}

export function ScanPackingUnit() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PackingUnitLookupResult | null>(null);
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
    let url: string;
    if (mode === "qr") {
      const id = parsePackingUnitQrValue(value);
      if (!id) { setError("קוד ה־QR שנסרק אינו תווית יחידת אריזה תקינה."); return; }
      url = `/api/v1/packing-units/${id}`;
    } else {
      if (!/^[0-9]{1,5}$/.test(value.trim())) { setError("יש להזין מספר יחידת אריזה תקין (עד 5 ספרות)."); return; }
      url = `/api/v1/packing-units/lookup?unitNumber=${encodeURIComponent(value.trim())}`;
    }
    inFlight.current = true;
    const id = ++operation.current;
    setBusy(true);
    try {
      const unit = await fetchUnit(url);
      if (id !== operation.current) return;
      if (unit) setResult(unit);
      else setError("לא נמצאה יחידת אריזה. בדקו את התווית או את המספר.");
    } catch (cause) { if (id === operation.current) setError(cause instanceof Error ? cause.message : "החיפוש נכשל."); }
    finally { if (id === operation.current) { inFlight.current = false; setBusy(false); } }
  }, []);
  const decoded = useCallback((value: string) => { void lookup("qr", value); }, [lookup]);

  function openCamera() {
    setResult(null); setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("הגישה למצלמה אינה נתמכת כאן. פתחו את היישום באמצעות HTTPS או localhost, או העלו תמונת QR / הזינו מספר יחידה.");
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
          <div className="panel-heading"><div><span className="eyebrow">01 / סריקת תווית</span><h2 id="camera-title">איתור יחידת אריזה באמצעות קוד QR</h2></div><ScanLine aria-hidden="true" /></div>
          {cameraOpen ? <CameraPreview onDecoded={decoded} onError={cameraError} onClose={closeCamera} isValid={(value) => parsePackingUnitQrValue(value) !== null} /> :
            <div className="camera-placeholder"><ScanLine aria-hidden="true" /><strong>מוכנים לסריקה</strong><p>הרשאת גישה למצלמה תתבקש רק בעת פתיחתה. לא מתבצעת הקלטה.</p></div>}
          <div className="package-actions">
            {cameraOpen ? <button className="button secondary" onClick={closeCamera}><X aria-hidden="true" /> סגירת המצלמה</button> :
              <button className="button primary" onClick={openCamera} disabled={busy}><Camera aria-hidden="true" /> פתיחת המצלמה</button>}
            <label className={`button secondary upload-button ${busy ? "is-disabled" : ""}`}>
              <ImageUp aria-hidden="true" /> העלאת תמונת QR
              <input aria-label="העלאת תמונת QR" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
            </label>
          </div>
          <p className="package-help">PNG, JPEG או WebP · עד 10 מגה־בייט.</p>
        </section>
        <section className="panel manual-panel" aria-labelledby="manual-title">
          <div className="panel-heading"><div><span className="eyebrow">02 / הזנת מספר</span><h2 id="manual-title">אפשר גם בלי מצלמה</h2></div><Keyboard aria-hidden="true" /></div>
          <p className="package-help">הזינו את מספר יחידת האריזה המודפס על התווית.</p>
          <form noValidate onSubmit={(event) => { event.preventDefault(); void lookup("number", number); }}>
            <label className="package-field">מספר יחידת אריזה<input ref={input} value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="למשל 00007" maxLength={5} disabled={busy} /></label>
            <button className="button primary full" type="submit" disabled={busy}><Search aria-hidden="true" /> {busy ? "מחפשים…" : "חיפוש"}</button>
          </form>
        </section>
      </div>
      <div aria-live="polite" aria-atomic="true">{busy && <p className="package-notice">קוראים את התווית ומחפשים את היחידה…</p>}</div>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      {result && <section className="package-stack"><h2 ref={resultHeading} tabIndex={-1} className="result-heading">היחידה נמצאה</h2><PackingUnitResultCard unit={result} />
        <div className="package-actions"><button className="button primary" disabled={busy} onClick={openCamera}><Camera aria-hidden="true" /> סריקת יחידה נוספת</button><button className="button secondary" disabled={busy} onClick={() => { focusManual.current = true; setResult(null); setError(""); setNumber(""); }}>הזנת מספר נוסף</button></div>
      </section>}
    </div>
  );
}
