"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, Truck } from "lucide-react";

import { toPackingUnitQrValue, toQrPng } from "@/lib/qr";
import { transportStatusLabels } from "./labels";

export function PackingUnitQr({
  packingUnitId,
  unitNumber,
  currentTransport,
  waitingTransports,
}: {
  packingUnitId: string;
  unitNumber: string;
  currentTransport: { transportNumber: string; status: "waiting" | "transit" | "arrived" } | null;
  waitingTransports: { id: string; transportNumber: string }[];
}) {
  const router = useRouter();
  const [png, setPng] = useState("");
  const [error, setError] = useState("");
  const labelImage = useRef<HTMLImageElement>(null);
  const [selectedTransportId, setSelectedTransportId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    let cancelled = false;
    toQrPng(toPackingUnitQrValue(packingUnitId))
      .then((data) => { if (!cancelled) setPng(data); })
      .catch(() => { if (!cancelled) setError("לא ניתן ליצור את קוד ה־QR."); });
    return () => { cancelled = true; };
  }, [packingUnitId]);

  function download() {
    if (!png) return;
    const link = document.createElement("a");
    link.href = png;
    link.download = `packing-unit-${unitNumber}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function print() {
    if (!labelImage.current?.complete || typeof window.print !== "function") return;
    window.print();
  }

  async function assignTransport() {
    if (!selectedTransportId) return;
    setAssigning(true);
    setAssignError("");
    try {
      const response = await fetch(`/api/v1/packing-units/${packingUnitId}/transport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transportId: selectedTransportId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setAssignError(payload?.error?.message ?? "השיוך נכשל.");
        return;
      }
      router.refresh();
    } catch {
      setAssignError("לא ניתן להתחבר לשרת.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="form-card">
      <h2>תווית QR ליחידת אריזה {unitNumber}</h2>
      <p className="hint">סרקו תווית זו בעמוד סריקת יחידת אריזה כדי לאתר את היחידה מהר בכל שלב.</p>
      {error && <p className="inline-error">{error}</p>}
      {png && (
        <div className="print-label">
          {/* Generated local data URL; image optimization is not applicable. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={labelImage} className="package-qr-image" src={png} width={240} height={240} alt={`קוד QR ליחידת אריזה ${unitNumber}`} />
        </div>
      )}
      <div className="package-actions">
        <button className="button primary" disabled={!png} onClick={download} type="button"><Download aria-hidden="true" /> הורדת PNG</button>
        <button className="button secondary" disabled={!png} onClick={print} type="button"><Printer aria-hidden="true" /> הדפסת תווית</button>
      </div>

      <hr className="form-card-divider" />

      {currentTransport ? (
        <p>
          <Truck aria-hidden="true" /> משויכת להובלה <strong>{currentTransport.transportNumber}</strong> ·{" "}
          {transportStatusLabels[currentTransport.status].label}
        </p>
      ) : waitingTransports.length === 0 ? (
        <p className="hint">אין הובלות הממתינות לאיסוף בקבוצה זו כרגע לשיוך יחידה זו.</p>
      ) : (
        <div className="field-row">
          <div className="field">
            <label htmlFor="transport-select">שיוך להובלה</label>
            <select id="transport-select" onChange={(event) => setSelectedTransportId(event.target.value)} value={selectedTransportId}>
              <option value="">בחירת הובלה</option>
              {waitingTransports.map((transport) => (
                <option key={transport.id} value={transport.id}>{transport.transportNumber}</option>
              ))}
            </select>
          </div>
          <button className="button primary" disabled={!selectedTransportId || assigning} onClick={assignTransport} type="button">
            {assigning ? "משייך..." : "שיוך"}
          </button>
        </div>
      )}
      {assignError && <p className="inline-error">{assignError}</p>}
    </div>
  );
}
