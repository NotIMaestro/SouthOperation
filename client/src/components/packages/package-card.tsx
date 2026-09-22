import { PackageCheck } from "lucide-react";
import { statusLabels, type PackageRecord } from "@/lib/packages/types";

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export function PackageCard({ record }: { record: PackageRecord }) {
  return (
    <article className="panel package-card" aria-label={`Package ${record.packageNumber}`}>
      <div className="package-card-heading">
        <div><span className="eyebrow"><PackageCheck aria-hidden="true" /> PACKAGE DETAILS</span><h2>Package <bdi>{record.packageNumber}</bdi></h2></div>
        <span className={`package-badge status-${record.status.toLowerCase()}`}>{statusLabels[record.status]}</span>
      </div>
      <p className="package-description">{record.description}</p>
      <dl className="package-details">
        <div><dt>Origin</dt><dd>{record.origin}</dd></div>
        <div><dt>Destination</dt><dd>{record.destination}</dd></div>
        <div><dt>Responsible person</dt><dd>{record.responsiblePerson}</dd></div>
        <div><dt>Package number</dt><dd><bdi>{record.packageNumber}</bdi></dd></div>
        <div><dt>Created (UTC)</dt><dd><time dateTime={record.createdAt}>{date(record.createdAt)}</time></dd></div>
        <div><dt>Last updated (UTC)</dt><dd><time dateTime={record.updatedAt}>{date(record.updatedAt)}</time></dd></div>
      </dl>
      <h3>Contents</h3><ul>{record.contents.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </article>
  );
}
