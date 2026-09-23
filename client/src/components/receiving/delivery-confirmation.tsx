import { unitDescription } from "@/components/pickup/confirmation";
import { deliveryDate, displayDeliveryDate, type Delivery } from "@/lib/transports/types";

export const deliveryTitle = (delivery: Delivery) => `${delivery.sourceCity}, ${delivery.sourceUnit} ← ${delivery.destinationCity}, ${delivery.destinationUnit}`;

export function DeliveryConfirmation({ deliveries, saving, onConfirm }: {
  deliveries: Delivery[]; saving: boolean; onConfirm(): void;
}) {
  return <>
    <div className="pickup-review">
      {deliveries.map((delivery) => <section className="pickup-product-group delivery-review-group" key={delivery.id} aria-label={`הובלה ${delivery.transportNumber}`}>
        <h3>{deliveryTitle(delivery)}</h3>
        <p>מספר זיהוי הובלה: <bdi>{delivery.transportNumber}</bdi></p>
        <p>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(delivery))}</bdi></p>
        {delivery.packageSummary && <p>{delivery.packageSummary}</p>}
        <h4>יחידות אריזה בהובלה ({delivery.units.length} מתוך {delivery.packageCount} חבילות):</h4>
        {!delivery.units.length && <p className="package-help">לא שויכו יחידות אריזה להובלה זו.</p>}
        <ol className="delivery-packages">{delivery.units.map((unit) => <li key={unit.id}>
          <strong>{unitDescription(unit)}</strong>
          <p>מספר יחידת אריזה: <bdi>{unit.unitNumber}</bdi></p>
          <p>{unit.items.reduce((count, item) => count + item.quantity, 0)} פריטים · {unit.items.length} סוגי פריטים</p>
          <details><summary>פירוט פריטים וכמויות ביחידה <bdi>{unit.unitNumber}</bdi></summary>
            <ul>{unit.items.map((item) => <li key={item.id}><span>{item.name}</span><strong>כמות: {item.quantity}</strong></li>)}</ul>
          </details>
        </li>)}</ol>
      </section>)}
    </div>
    <p className="package-notice pickup-statement">בלחיצה על אישור אני מאשר שכל ההובלות והחבילות המפורטות לעיל התקבלו ביעד.</p>
    <button className="button primary pickup-final" disabled={saving} onClick={onConfirm}>{saving ? "מאשרים את קבלת ההובלות…" : "אישור קבלת ההובלות"}</button>
    {saving && <p role="status">שומרים את אישור קבלת ההובלות…</p>}
  </>;
}
