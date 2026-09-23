import { deliveryDate, displayDeliveryDate, type DeliveryDetails } from "@/lib/transports/types";

export function DeliveryConfirmation({ deliveries, saving, onConfirm }: {
  deliveries: DeliveryDetails[]; saving: boolean; onConfirm(): void;
}) {
  return <>
    <div className="pickup-review">
      {deliveries.map((delivery) => <section className="pickup-product-group delivery-review-group" key={delivery.id} aria-label={`הובלה ${delivery.id}`}>
        <h3>{delivery.title}</h3>
        <p>מספר זיהוי הובלה: <bdi>{delivery.id}</bdi></p>
        <p>תאריך מסירה: <bdi>{displayDeliveryDate(deliveryDate(delivery))}</bdi></p>
        <h4>חבילות בהובלה:</h4>
        <ol className="delivery-packages">{delivery.packages.map((pack) => <li key={pack.id}>
          <strong>{pack.description}</strong>
          <p>מספר זיהוי חבילה: <bdi>{pack.packageNumber}</bdi></p>
          <p>{pack.products.reduce((count, product) => count + product.quantity, 0)} פריטים · {pack.products.length} סוגי מוצרים</p>
          <details><summary>פירוט מוצרים וכמויות בחבילה <bdi>{pack.packageNumber}</bdi></summary>
            <ul>{pack.products.map((product) => <li key={product.id}><span>{product.name}</span><strong>כמות: {product.quantity}</strong></li>)}</ul>
          </details>
        </li>)}</ol>
      </section>)}
    </div>
    <p className="package-notice pickup-statement">בלחיצה על אישור אני מאשר שכל ההובלות והחבילות המפורטות לעיל התקבלו ביעד.</p>
    <button className="button primary pickup-final" disabled={saving} onClick={onConfirm}>{saving ? "מאשרים את קבלת ההובלות…" : "אישור קבלת ההובלות"}</button>
    {saving && <p role="status">שומרים את אישור קבלת ההובלות…</p>}
  </>;
}
