"use client";

import { MapPin, PackageOpen } from "lucide-react";

import type { Transport } from "@/lib/server-api";

export function ReceivingList({ transports }: { transports: Transport[] }) {
  return (
    <div className="card-list">
      {transports.map((transport) => (
        <div className="entity-card" key={transport.id}>
          <div>
            <p className="entity-card-title">{transport.transportNumber} · {transport.destinationCity}, {transport.destinationUnit}</p>
            <p className="entity-card-meta">
              <MapPin aria-hidden="true" /> ממקור: {transport.sourceCity}, {transport.sourceUnit} · {transport.packageCount} חבילות
              {transport.vehicleType ? ` · ${transport.vehicleType} ${transport.vehicleNumber ?? ""}` : ""}
            </p>
          </div>
          <div className="entity-card-side"><PackageOpen aria-hidden="true" /><span>הגיע ליעד</span></div>
        </div>
      ))}
    </div>
  );
}
