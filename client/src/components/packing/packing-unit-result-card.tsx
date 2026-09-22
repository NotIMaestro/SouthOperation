import { PackageCheck, Truck } from "lucide-react";

import { packingUnitStatusLabels, packingUnitTypeLabels, transportStatusLabels } from "./labels";
import { StatusBadge } from "./status-badge";

export type PackingUnitLookupResult = {
  id: string;
  unitType: keyof typeof packingUnitTypeLabels;
  status: keyof typeof packingUnitStatusLabels;
  unitNumber: string | null;
  roomName: string;
  groupName: string;
  destinationBuilding: string | null;
  destinationFloor: string | null;
  destinationRoom: string | null;
  transportNumber: string | null;
  transportStatus: keyof typeof transportStatusLabels | null;
};

export function PackingUnitResultCard({ unit }: { unit: PackingUnitLookupResult }) {
  const statusInfo = packingUnitStatusLabels[unit.status];

  return (
    <article className="panel package-card" aria-label={`יחידת אריזה ${unit.unitNumber ?? unit.id}`}>
      <div className="package-card-heading">
        <div>
          <span className="eyebrow"><PackageCheck aria-hidden="true" /> פרטי יחידת אריזה</span>
          <h2>{unit.unitNumber ? `יחידה ${unit.unitNumber}` : "יחידת אריזה"}</h2>
        </div>
        <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
      </div>
      <p className="package-description">{packingUnitTypeLabels[unit.unitType]}</p>
      <dl className="package-details">
        <div><dt>קבוצה</dt><dd>{unit.groupName}</dd></div>
        <div><dt>חדר מקור</dt><dd>{unit.roomName}</dd></div>
        {unit.destinationBuilding && (
          <div>
            <dt>יעד</dt>
            <dd>
              {unit.destinationBuilding}
              {unit.destinationFloor ? ` · קומה ${unit.destinationFloor}` : ""}
              {unit.destinationRoom ? ` · חדר ${unit.destinationRoom}` : ""}
            </dd>
          </div>
        )}
      </dl>
      <h3><Truck aria-hidden="true" /> הובלה</h3>
      {unit.transportNumber && unit.transportStatus ? (
        <p>
          {unit.transportNumber} · <StatusBadge label={transportStatusLabels[unit.transportStatus].label} tone={transportStatusLabels[unit.transportStatus].tone} />
        </p>
      ) : (
        <p className="hint">היחידה טרם שויכה להובלה.</p>
      )}
    </article>
  );
}
