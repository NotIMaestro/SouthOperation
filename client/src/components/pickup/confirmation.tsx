import type { CollectionPackage } from "@/lib/pickup/types";

export function PackageConfirmation({ packages, busy, onConfirm }: {
  packages: CollectionPackage[]; busy: boolean; onConfirm(): void;
}) {
  const single = packages.length === 1;
  return <>
    <p className="package-help">בדקו את תכולת החבילות לפני האישור.</p>
    <div className="pickup-review">
      {packages.map((item) => <section key={item.id} className="pickup-product-group" aria-label={`חבילה ${item.packageNumber}`}>
        <h3>{item.description}</h3><p>מספר חבילה: <bdi>{item.packageNumber}</bdi></p>
        <p className="package-help">{item.origin} ← {item.destination}</p>
        <h4>הפריטים הצפויים בחבילה:</h4>
        <ul>{item.products.map((product) => <li key={product.id}><span>{product.name}</span><strong>כמות: {product.quantity}</strong></li>)}</ul>
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
