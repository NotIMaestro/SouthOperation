"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, PackageOpen } from "lucide-react";

import type { Transport } from "@/lib/server-api";

export function ReceivingList({ transports }: { transports: Transport[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function confirmReceived(transportId: string) {
    setPendingId(transportId);
    setError("");
    try {
      const response = await fetch(`/api/v1/transports/${transportId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "arrived" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "אישור הקבלה נכשל.");
        return;
      }
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="card-list">
      {error && <p className="inline-error">{error}</p>}
      {transports.map((transport) => (
        <div className="entity-card" key={transport.id}>
          <div>
            <p className="entity-card-title">{transport.transportNumber} · {transport.destinationCity}, {transport.destinationUnit}</p>
            <p className="entity-card-meta">
              <MapPin aria-hidden="true" /> ממקור: {transport.sourceCity}, {transport.sourceUnit} · {transport.packageCount} חבילות
              {transport.vehicleType ? ` · ${transport.vehicleType} ${transport.vehicleNumber ?? ""}` : ""}
            </p>
          </div>
          <div className="entity-card-side">
            <button className="button primary" disabled={pendingId === transport.id} onClick={() => void confirmReceived(transport.id)} type="button">
              <PackageOpen aria-hidden="true" /> {pendingId === transport.id ? "מאשר..." : "אישור קבלה"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
