"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, PackagePlus, Printer, QrCode, RotateCcw } from "lucide-react";
import { generatePackage, getAllPackages, resetGeneratedPackages } from "@/lib/packages/service";
import { packageErrorMessage, packageStatuses, statusLabels, type PackageDraft, type PackageRecord } from "@/lib/packages/types";
import { generateQrPng } from "@/lib/packages/qr";
import { PackageCard } from "./package-card";

const defaultDraft: PackageDraft = {
  description: "Demo computer equipment", origin: "Fictional Amber Depot", destination: "Fictional Meadow Hub",
  responsiblePerson: "Demo Keeper A", status: "CREATED", contents: ["Sample monitor", "Sample keyboard"],
};

export function QrGenerator() {
  const [draft, setDraft] = useState(defaultDraft);
  const [contents, setContents] = useState(defaultDraft.contents.join("\n"));
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [selected, setSelected] = useState<PackageRecord | null>(null);
  const [png, setPng] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const labelImage = useRef<HTMLImageElement>(null);
  const sequence = useRef(0);
  const actionBusy = useRef(false);

  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    try {
      const records = await getAllPackages();
      if (id === sequence.current) { setPackages(records); setError(""); }
    } catch (cause) { if (id === sequence.current) setError(packageErrorMessage(cause)); }
    finally { if (id === sequence.current) setBusy(false); }
  }, []);
  useEffect(() => {
    const lifecycle = sequence;
    const id = ++lifecycle.current;
    getAllPackages().then((records) => {
      if (id === lifecycle.current) setPackages(records);
    }).catch((cause: unknown) => {
      if (id === lifecycle.current) setError(packageErrorMessage(cause));
    }).finally(() => {
      if (id === lifecycle.current) setBusy(false);
    });
    return () => { lifecycle.current++; };
  }, []);

  async function showLabel(record: PackageRecord) {
    const id = ++sequence.current;
    setBusy(true); setPng(""); setSelected(record); setError("");
    try { const data = await generateQrPng(record.qrToken); if (id === sequence.current) setPng(data); }
    catch { if (id === sequence.current) setError("The package exists, but its QR label could not be rendered. Select it again to retry."); }
    finally { if (id === sequence.current) setBusy(false); }
  }

  async function create() {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError(""); setNotice("");
    const id = ++sequence.current;
    try {
      const record = await generatePackage({ ...draft, contents: contents.split("\n").map((item) => item.trim()).filter(Boolean) });
      if (id !== sequence.current) return;
      const records = await getAllPackages();
      if (id !== sequence.current) return;
      setPackages(records);
      setNotice("Demo package saved in this browser. Download the label, then upload it on Scan Package.");
      await showLabel(record);
    } catch (cause) { if (id === sequence.current) { setError(packageErrorMessage(cause)); setBusy(false); } }
    finally { actionBusy.current = false; }
  }

  async function reset() {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError(""); setNotice("");
    const id = ++sequence.current;
    try {
      await resetGeneratedPackages();
      if (id !== sequence.current) return;
      setSelected(null); setPng(""); setConfirmReset(false);
      const records = await getAllPackages();
      if (id !== sequence.current) return;
      setPackages(records);
      setNotice("Locally generated demo packages were reset. All 10 original sample packages are unchanged.");
    } catch (cause) { if (id === sequence.current) setError(packageErrorMessage(cause)); }
    finally { actionBusy.current = false; if (id === sequence.current) setBusy(false); }
  }

  async function copy(value: string, label: string) {
    setError(""); setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Unavailable");
      await navigator.clipboard.writeText(value); setNotice(`${label} copied.`);
    } catch { setError(`Could not copy ${label.toLowerCase()}. Select the visible text and copy it manually.`); }
  }

  function download() {
    setError("");
    try {
      if (!png || !selected) throw new Error("No label");
      const link = document.createElement("a");
      link.href = png; link.download = `package-${selected.packageNumber}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setNotice("PNG download requested. If it is blocked, allow downloads or save the QR image using your browser.");
    } catch { setError("Could not start the download. Try saving the displayed QR image instead."); }
  }

  function print() {
    setError("");
    try {
      if (!labelImage.current?.complete || !labelImage.current.naturalWidth || typeof window.print !== "function") throw new Error("Not ready");
      window.print();
      setNotice("Print dialog requested. If it did not open, use your browser’s Print command. Only the package label is printed.");
    } catch { setError("Could not open printing. Download the PNG and print it from your device."); }
  }

  return (
    <div className="package-stack">
      <p className="package-notice">Demo only · Use fictional information. Generated packages stay in this browser and are not shared with other devices or users.</p>
      <div className="generator-grid">
        <section className="panel" aria-labelledby="generator-title">
          <div className="panel-heading"><div><span className="eyebrow">CREATE A DEMO PACKAGE</span><h2 id="generator-title">A label for every package</h2></div><PackagePlus aria-hidden="true" /></div>
          <form className="package-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
            {([['description', 'Description'], ['origin', 'Origin'], ['destination', 'Destination'], ['responsiblePerson', 'Responsible person']] as const).map(([key, label]) =>
              <label className="package-field" key={key}>{label}<input required maxLength={160} value={draft[key]} disabled={busy} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
            <label className="package-field">Status<select value={draft.status} disabled={busy} onChange={(event) => setDraft({ ...draft, status: event.target.value as PackageDraft["status"] })}>{packageStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label className="package-field">Contents (one item per line)<textarea required rows={3} maxLength={4800} value={contents} disabled={busy} onChange={(event) => setContents(event.target.value)} /></label>
            <button className="button primary full" disabled={busy} type="submit"><PackagePlus aria-hidden="true" /> {busy ? "Please wait…" : "Generate Mock Package"}</button>
          </form>
        </section>
        <section className="panel qr-preview-panel" aria-label="QR label preview">
          {selected ? <>
            <div className="print-label">
              <span className="eyebrow">FICTIONAL PACKAGE · DEMO LABEL</span>
              <h2>Package <bdi>{selected.packageNumber}</bdi></h2>
              {png ? <>
                {/* Generated local data URL; image optimization is not applicable. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={labelImage} className="package-qr-image" src={png} width={320} height={320} alt={`QR code for package ${selected.packageNumber}`} />
              </> : <p role="status">{busy ? "Rendering QR label…" : "Label unavailable. Select this package below to retry."}</p>}
              <code className="qr-value">{selected.qrToken}</code>
              <p>{selected.description}</p>
            </div>
            <dl className="label-identifiers"><dt>Internal ID</dt><dd>{selected.id}</dd></dl>
            <div className="package-actions">
              <button className="button primary" disabled={busy || !png} onClick={download}><Download aria-hidden="true" /> Download PNG</button>
              <button className="button secondary" disabled={busy || !png} onClick={print}><Printer aria-hidden="true" /> Print Label</button>
              <button className="button secondary" disabled={busy} onClick={() => void copy(selected.qrToken, "QR token")}><Copy aria-hidden="true" /> Copy Token</button>
              <button className="button secondary" disabled={busy} onClick={() => void copy(selected.packageNumber, "Package number")}><Copy aria-hidden="true" /> Copy Number</button>
            </div>
          </> : <div className="camera-placeholder"><QrCode aria-hidden="true" /><strong>Your next label starts here</strong><p>Generate a fictional package or choose a sample below. Its QR will contain only the unique token.</p></div>}
        </section>
      </div>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      <div aria-live="polite" aria-atomic="true">{notice && <p className="package-notice success">{notice}</p>}</div>
      {selected && <PackageCard record={selected} />}
      <section className="panel package-stack" aria-labelledby="saved-title">
        <div className="panel-heading"><div><h2 id="saved-title">Available demo packages</h2><p>{packages.length} packages · original samples and locally generated records</p></div><button className="button secondary" disabled={busy} onClick={() => { setBusy(true); void refresh(); }}>Refresh List</button></div>
        <label className="package-field">Choose a package to render its QR<select disabled={busy} value={selected?.id ?? ""} onChange={(event) => { const record = packages.find((p) => p.id === event.target.value); if (record) void showLabel(record); }}><option value="" disabled>Select a demo package</option>{packages.map((record) => <option key={record.id} value={record.id}>{record.packageNumber} · {record.description}</option>)}</select></label>
        <div className="demo-reset"><p>Reset removes only generated demo records in this browser. The original JSON samples are preserved.</p>
          {confirmReset ? <div className="package-actions"><span>Reset locally generated packages?</span><button className="button secondary" disabled={busy} onClick={() => void reset()}>Confirm Reset</button><button className="button secondary" disabled={busy} onClick={() => setConfirmReset(false)}>Cancel</button></div> : <button className="button secondary" disabled={busy} onClick={() => setConfirmReset(true)}><RotateCcw aria-hidden="true" /> Reset Locally Generated Packages</button>}
        </div>
      </section>
    </div>
  );
}
