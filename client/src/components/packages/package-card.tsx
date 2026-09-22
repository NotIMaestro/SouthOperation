import { PackageCheck } from "lucide-react";
import { statusLabels, type PackageRecord } from "@/lib/packages/types";

function date(value: string) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export function PackageCard({ record }: { record: PackageRecord }) {
  return (
    <article className="panel package-card" aria-label={`חבילה ${record.packageNumber}`}>
      <div className="package-card-heading">
        <div><span className="eyebrow"><PackageCheck aria-hidden="true" /> פרטי החבילה</span><h2>חבילה <bdi>{record.packageNumber}</bdi></h2></div>
        <span className={`package-badge status-${record.status.toLowerCase()}`}>{statusLabels[record.status]}</span>
      </div>
      <p className="package-description">{record.description}</p>
      <dl className="package-details">
        <div><dt>מוצא</dt><dd>{record.origin}</dd></div>
        <div><dt>יעד</dt><dd>{record.destination}</dd></div>
        <div><dt>אחראי החבילה</dt><dd>{record.responsiblePerson}</dd></div>
        <div><dt>מספר חבילה</dt><dd><bdi>{record.packageNumber}</bdi></dd></div>
        <div><dt>תאריך יצירה (UTC)</dt><dd><time dateTime={record.createdAt}>{date(record.createdAt)}</time></dd></div>
        <div><dt>עדכון אחרון (UTC)</dt><dd><time dateTime={record.updatedAt}>{date(record.updatedAt)}</time></dd></div>
      </dl>
      <h3>תכולה</h3><ul>{record.contents.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </article>
  );
}
