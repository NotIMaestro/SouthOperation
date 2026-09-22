"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { collectionService } from "@/lib/pickup/service";
import { packageErrorMessage } from "@/lib/packages/types";

export function PickupDemoControls() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function reset() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try { await collectionService.resetConfirmations(); setArmed(false); setMessage("אישורי האיסוף שנוספו בדפדפן אופסו. נתוני ההדגמה המקוריים נשמרו."); }
    catch (error) { setMessage(packageErrorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="panel pickup-demo" aria-labelledby="pickup-demo-title">
    <h2 id="pickup-demo-title">הדגמת איסוף חבילות</h2>
    <p>משתמש הדגמה א יכול לאשר את חבילות <bdi>100001–100005</bdi>. חבילות <bdi>100006–100007</bdi> כבר אושרו.
      חבילות אחרות אינן זמינות לו. חבילות חדשות שייווצרו במחולל ימתינו גם הן לאישור שלו, עם יחידה אחת מכל פריט.</p>
    <p>הפיקו כאן תווית QR ואז סרקו אותה במסך האיסוף או העלו את תמונתה. ברקוד ההדגמה הוא מסוג <bdi>Code 128</bdi>,
      וערכו מורכב מ־<bdi>729000</bdi>, מספר החבילה והספרה <bdi>0</bdi> (לדוגמה <bdi>7290001000010</bdi>).</p>
    <div className="package-actions"><Link href="/pickup" className="button secondary">מעבר לאיסוף חבילות</Link>
      {process.env.NODE_ENV === "development" && (!armed ? <button className="button secondary" onClick={() => setArmed(true)}>איפוס אישורי איסוף להדגמה</button> : <>
        <p>לאפס את האישורים שנוספו בדפדפן?</p>
        <button className="button secondary" disabled={busy} onClick={() => setArmed(false)}>ביטול</button>
        <button className="button primary" disabled={busy} onClick={() => void reset()}>{busy ? "מאפסים…" : "אישור איפוס האישורים"}</button>
      </>)}
    </div><p role="status">{message}</p>
  </section>;
}
