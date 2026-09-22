"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, MapPin, Truck } from "lucide-react";

import type { Transport } from "@/lib/server-api";
import { getRemembered, setRemembered } from "@/lib/remembered-values";

export function PickupList({ transports }: { transports: Transport[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function open(transportId: string) {
    setOpenId(transportId);
    setVehicleType(getRemembered("transport:vehicleType"));
    setVehicleNumber(getRemembered("transport:vehicleNumber"));
    setError("");
  }

  async function confirmPickup(transportId: string) {
    if (!vehicleType.trim() || !vehicleNumber.trim()) {
      setError("כדי לאשר איסוף יש למלא סוג רכב ומספר רכב.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/transports/${transportId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "transit", vehicleType: vehicleType.trim(), vehicleNumber: vehicleNumber.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "אישור האיסוף נכשל.");
        return;
      }
      setRemembered("transport:vehicleType", vehicleType.trim());
      setRemembered("transport:vehicleNumber", vehicleNumber.trim());
      setOpenId(null);
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card-list">
      {transports.map((transport) => (
        <div className="entity-card" key={transport.id}>
          <div>
            <p className="entity-card-title">{transport.transportNumber} · {transport.sourceCity}, {transport.sourceUnit}</p>
            <p className="entity-card-meta">
              <MapPin aria-hidden="true" /> יעד: {transport.destinationCity}, {transport.destinationUnit} ·{" "}
              <CalendarDays aria-hidden="true" /> {transport.packageCount} חבילות · יצר: {transport.createdByName}
            </p>
            {openId === transport.id && (
              <div className="field-row" style={{ marginTop: "0.75rem" }}>
                <div className="field">
                  <label htmlFor={`vehicle-type-${transport.id}`}>סוג כלי תחבורה</label>
                  <select id={`vehicle-type-${transport.id}`} onChange={(event) => setVehicleType(event.target.value)} value={vehicleType}>
                    <option value="">בחירת סוג רכב</option>
                    <option value="משאית">משאית</option>
                    <option value="רכב פרטי">רכב פרטי</option>
                    <option value="טנדר">טנדר</option>
                    <option value="אחר">אחר</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`vehicle-number-${transport.id}`}>מספר רכב</label>
                  <input id={`vehicle-number-${transport.id}`} onChange={(event) => setVehicleNumber(event.target.value)} placeholder="לדוגמה: 58-123-45" value={vehicleNumber} />
                </div>
                {error && <p className="inline-error">{error}</p>}
              </div>
            )}
          </div>
          <div className="entity-card-side">
            {openId === transport.id ? (
              <>
                <button className="button secondary" onClick={() => setOpenId(null)} type="button">ביטול</button>
                <button className="button primary" disabled={pending} onClick={() => void confirmPickup(transport.id)} type="button">
                  {pending ? "מאשר..." : "אישור איסוף"}
                </button>
              </>
            ) : (
              <button className="button primary" onClick={() => open(transport.id)} type="button">
                <Truck aria-hidden="true" /> אישור איסוף
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
