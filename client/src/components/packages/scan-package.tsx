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
      else setError("No package found. Check the label or number. Generated demo packages are available only in the browser where they were created.");
    } catch (cause) { if (id === operation.current) setError(packageErrorMessage(cause)); }
    finally { if (id === operation.current) { inFlight.current = false; setBusy(false); } }
  }, []);
  const decoded = useCallback((token: string) => { void lookup("qr", token); }, [lookup]);

  function openCamera() {
    setResult(null); setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported here. Open this app on HTTPS or localhost, or upload a QR image / enter a package number.");
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
      if (id === operation.current) { setError(cause instanceof Error ? cause.message : "Could not decode the image. Please retry."); setBusy(false); inFlight.current = false; }
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
          <div className="panel-heading"><div><span className="eyebrow">01 / SCAN A LABEL</span><h2 id="camera-title">Find it with a QR code</h2></div><ScanLine aria-hidden="true" /></div>
          {cameraOpen ? <CameraPreview onDecoded={decoded} onError={cameraError} onClose={closeCamera} /> :
            <div className="camera-placeholder"><ScanLine aria-hidden="true" /><strong>Ready when you are</strong><p>Camera permission is requested only when you open the camera. Nothing is recorded.</p></div>}
          <div className="package-actions">
            {cameraOpen ? <button className="button secondary" onClick={closeCamera}><X aria-hidden="true" /> Close Camera</button> :
              <button className="button primary" onClick={openCamera} disabled={busy}><Camera aria-hidden="true" /> Open Camera</button>}
            <label className={`button secondary upload-button ${busy ? "is-disabled" : ""}`}>
              <ImageUp aria-hidden="true" /> Upload QR Image
              <input aria-label="Upload QR Image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
            </label>
          </div>
          <p className="package-help">PNG, JPEG or WebP · up to 10 MB. You can upload a label downloaded from the generator on this device.</p>
        </section>
        <section className="panel manual-panel" aria-labelledby="manual-title">
          <div className="panel-heading"><div><span className="eyebrow">02 / ENTER A NUMBER</span><h2 id="manual-title">No camera? No problem.</h2></div><Keyboard aria-hidden="true" /></div>
          <p className="package-help">Use the six-digit number printed on the package label.</p>
          <form noValidate onSubmit={(event) => { event.preventDefault(); void lookup("number", number); }}>
            <label className="package-field">Package number<input ref={input} value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="e.g. 100001" maxLength={30} disabled={busy} /></label>
            <button className="button primary full" type="submit" disabled={busy}><Search aria-hidden="true" /> {busy ? "Searching…" : "Search"}</button>
          </form>
          <div className="demo-tip"><strong>Try a sample package</strong><p>Enter <bdi>100001</bdi> for computer equipment in transit, or <bdi>100006</bdi> for a package with an issue.</p></div>
        </section>
      </div>
      <div aria-live="polite" aria-atomic="true">{busy && <p className="package-notice">Reading the label and looking up the package…</p>}</div>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      {result && <section className="package-stack"><h2 ref={resultHeading} tabIndex={-1} className="result-heading">Package found</h2><PackageCard record={result} />
        <div className="package-actions"><button className="button primary" disabled={busy} onClick={openCamera}><Camera aria-hidden="true" /> Scan Another Package</button><button className="button secondary" disabled={busy} onClick={() => { focusManual.current = true; setResult(null); setError(""); setNumber(""); }}>Enter Another Number</button></div>
      </section>}
    </div>
  );
}
