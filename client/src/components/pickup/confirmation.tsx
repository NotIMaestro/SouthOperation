import { packingUnitTypeLabels } from "@/components/packing/labels";
import type { CollectionPackage } from "@/lib/pickup/types";

type UnitSummary = Pick<CollectionPackage, "unitType" | "roomName">;
export const unitDescription = (unit: UnitSummary) => `${packingUnitTypeLabels[unit.unitType]} מחדר ${unit.roomName}`;
export const unitDestination = (unit: Pick<CollectionPackage, "destinationBuilding" | "destinationFloor" | "destinationRoom">) =>
  [unit.destinationBuilding, unit.destinationFloor && `קומה ${unit.destinationFloor}`, unit.destinationRoom && `חדר ${unit.destinationRoom}`].filter(Boolean).join(", ");

export function PackageConfirmation({ packages, busy, onConfirm }: {
  packages: CollectionPackage[]; busy: boolean; onConfirm(): void;
}) {
  const single = packages.length === 1;
  return <>
    <p className="package-help">בדקו את תכולת החבילות לפני האישור.</p>
    <div className="pickup-review">
      {packages.map((item) => <section key={item.id} className="pickup-product-group" aria-label={`חבילה ${item.unitNumber}`}>
        <h3>{unitDescription(item)}</h3><p>מספר יחידת אריזה: <bdi>{item.unitNumber}</bdi></p>
        <p className="package-help">הובלה <bdi>{item.transportNumber}</bdi> · יעד: {unitDestination(item)}</p>
        <h4>הפריטים הצפויים בחבילה:</h4>
        <ul>{item.items.map((product) => <li key={product.id}><span>{product.name}</span><strong>כמות: {product.quantity}</strong></li>)}</ul>
      </section>)}
    </div>
    <p className="package-notice pickup-statement">{single
      ? "בלחיצה על אישור אני מאשר שהחבילה וכל הפריטים המפורטים הגיעו במלואם וללא נזק."
      : "בלחיצה על אישור אני מאשר שכל החבילות והפריטים המפורטים לעיל הגיעו במלואם וללא נזק."}</p>
    <button type="button" className="button primary pickup-final" disabled={busy} onClick={onConfirm}>
      {busy ? "שומרים את האישור…" : single ? "אישור קבלת החבילה" : "אישור קבלת החבילות"}
    </button>
    {busy && <p role="status">אישור קבלת החבילות מתבצע…</p>}
  </>;
}
