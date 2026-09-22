"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Download, PackagePlus, Printer, QrCode, RotateCcw } from "lucide-react";
import { generatePackage, getAllPackages, resetGeneratedPackages } from "@/lib/packages/service";
import { packageErrorMessage, packageStatuses, statusLabels, type PackageDraft, type PackageRecord } from "@/lib/packages/types";
import { generateQrPng } from "@/lib/packages/qr";
import { PackageCard } from "./package-card";

const defaultDraft: PackageDraft = {
  description: "ציוד מחשוב לדוגמה", origin: "מחסן ענבר הבדיוני", destination: "מרכז אחו הבדיוני",
  responsiblePerson: "אחראי לדוגמה א", status: "CREATED", contents: ["מסך לדוגמה", "מקלדת לדוגמה"],
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
    catch { if (id === sequence.current) setError("החבילה נשמרה, אך לא ניתן להציג את תווית ה־QR שלה. בחרו בה שוב כדי לנסות מחדש."); }
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
      setNotice("חבילת ההדגמה נשמרה בדפדפן זה. הורידו את התווית והעלו אותה בעמוד סריקת חבילה.");
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
      setNotice("חבילות ההדגמה שנוצרו בדפדפן אופסו. כל 10 החבילות המקוריות נשמרו ללא שינוי.");
    } catch (cause) { if (id === sequence.current) setError(packageErrorMessage(cause)); }
    finally { actionBusy.current = false; if (id === sequence.current) setBusy(false); }
  }

  async function copy(value: string, label: string) {
    setError(""); setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Unavailable");
      await navigator.clipboard.writeText(value); setNotice(`${label} הועתק ללוח.`);
    } catch { setError(`לא ניתן להעתיק את ${label}. סמנו את הטקסט המוצג והעתיקו אותו ידנית.`); }
  }

  function download() {
    setError("");
    try {
      if (!png || !selected) throw new Error("No label");
      const link = document.createElement("a");
      link.href = png; link.download = `package-${selected.packageNumber}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      setNotice("הורדת קובץ PNG התבקשה. אם ההורדה נחסמה, אפשרו הורדות או שמרו את תמונת ה־QR דרך הדפדפן.");
    } catch { setError("לא ניתן להתחיל בהורדה. נסו לשמור את תמונת ה־QR המוצגת."); }
  }

  function print() {
    setError("");
    try {
      if (!labelImage.current?.complete || !labelImage.current.naturalWidth || typeof window.print !== "function") throw new Error("Not ready");
      window.print();
      setNotice("פתיחת חלון ההדפסה התבקשה. אם הוא לא נפתח, השתמשו בפקודת ההדפסה בדפדפן. רק תווית החבילה תודפס.");
    } catch { setError("לא ניתן לפתוח את חלון ההדפסה. הורידו את קובץ ה־PNG והדפיסו אותו מהמכשיר."); }
  }

  return (
    <div className="package-stack">
      <p className="package-notice">להדגמה בלבד · יש להשתמש במידע בדיוני. החבילות שנוצרו נשמרות בדפדפן זה ואינן משותפות עם מכשירים או משתמשים אחרים.</p>
      <div className="generator-grid">
        <section className="panel" aria-labelledby="generator-title">
          <div className="panel-heading"><div><span className="eyebrow">יצירת חבילת הדגמה</span><h2 id="generator-title">תווית לכל חבילה</h2></div><PackagePlus aria-hidden="true" /></div>
          <form className="package-form" noValidate onSubmit={(event) => { event.preventDefault(); void create(); }}>
            {([['description', 'תיאור'], ['origin', 'מוצא'], ['destination', 'יעד'], ['responsiblePerson', 'אחראי החבילה']] as const).map(([key, label]) =>
              <label className="package-field" key={key}>{label}<input required maxLength={160} value={draft[key]} disabled={busy} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
            <label className="package-field">מצב<select value={draft.status} disabled={busy} onChange={(event) => setDraft({ ...draft, status: event.target.value as PackageDraft["status"] })}>{packageStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label className="package-field">תכולה (פריט אחד בכל שורה)<textarea required rows={3} maxLength={4800} value={contents} disabled={busy} onChange={(event) => setContents(event.target.value)} /></label>
            <button className="button primary full" disabled={busy} type="submit"><PackagePlus aria-hidden="true" /> {busy ? "נא להמתין…" : "יצירת חבילת הדגמה"}</button>
          </form>
        </section>
        <section className="panel qr-preview-panel" aria-label="תצוגה מקדימה של תווית QR">
          {selected ? <>
            <div className="print-label">
              <span className="eyebrow">חבילה בדיונית · תווית להדגמה</span>
              <h2>חבילה <bdi>{selected.packageNumber}</bdi></h2>
              {png ? <>
                {/* Generated local data URL; image optimization is not applicable. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={labelImage} className="package-qr-image" src={png} width={320} height={320} alt={`קוד QR לחבילה ${selected.packageNumber}`} />
              </> : <p role="status">{busy ? "יוצרים תווית QR…" : "התווית אינה זמינה. בחרו שוב בחבילה בהמשך כדי לנסות מחדש."}</p>}
              <code className="qr-value">{selected.qrToken}</code>
              <p>{selected.description}</p>
            </div>
            <dl className="label-identifiers"><dt>מזהה פנימי</dt><dd><bdi dir="ltr">{selected.id}</bdi></dd></dl>
            <div className="package-actions">
              <button className="button primary" disabled={busy || !png} onClick={download}><Download aria-hidden="true" /> הורדת PNG</button>
              <button className="button secondary" disabled={busy || !png} onClick={print}><Printer aria-hidden="true" /> הדפסת תווית</button>
              <button className="button secondary" disabled={busy} onClick={() => void copy(selected.qrToken, "מזהה QR")}><Copy aria-hidden="true" /> העתקת מזהה QR</button>
              <button className="button secondary" disabled={busy} onClick={() => void copy(selected.packageNumber, "מספר חבילה")}><Copy aria-hidden="true" /> העתקת מספר חבילה</button>
            </div>
          </> : <div className="camera-placeholder"><QrCode aria-hidden="true" /><strong>התווית הבאה שלכם מתחילה כאן</strong><p>צרו חבילה בדיונית או בחרו חבילה לדוגמה בהמשך. קוד ה־QR יכיל רק את המזהה הייחודי שלה.</p></div>}
        </section>
      </div>
      {error && <p className="package-notice error" role="alert">{error}</p>}
      <div aria-live="polite" aria-atomic="true">{notice && <p className="package-notice success">{notice}</p>}</div>
      {selected && <PackageCard record={selected} />}
      <section className="panel package-stack" aria-labelledby="saved-title">
        <div className="panel-heading"><div><h2 id="saved-title">חבילות הדגמה זמינות</h2><p>{packages.length} חבילות · חבילות מקוריות לדוגמה וחבילות שנוצרו בדפדפן</p></div><button className="button secondary" disabled={busy} onClick={() => { setBusy(true); void refresh(); }}>רענון הרשימה</button></div>
        <label className="package-field">בחירת חבילה להצגת קוד QR<select disabled={busy} value={selected?.id ?? ""} onChange={(event) => { const record = packages.find((p) => p.id === event.target.value); if (record) void showLabel(record); }}><option value="" disabled>בחרו חבילת הדגמה</option>{packages.map((record) => <option key={record.id} value={record.id}>{record.packageNumber} · {record.description}</option>)}</select></label>
        <div className="demo-reset"><p>האיפוס מוחק רק חבילות הדגמה שנוצרו בדפדפן זה. החבילות המקוריות לדוגמה נשמרות.</p>
          {confirmReset ? <div className="package-actions"><span>לאפס את החבילות שנוצרו בדפדפן?</span><button className="button secondary" disabled={busy} onClick={() => void reset()}>אישור האיפוס</button><button className="button secondary" disabled={busy} onClick={() => setConfirmReset(false)}>ביטול</button></div> : <button className="button secondary" disabled={busy} onClick={() => setConfirmReset(true)}><RotateCcw aria-hidden="true" /> איפוס חבילות שנוצרו בדפדפן</button>}
        </div>
      </section>
    </div>
  );
}
