import { FileClock } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { listAuditLog, type AuditEvent } from "@/lib/server-api";

const actionLabels: Record<string, string> = {
  "group.created": "יצירת קבוצה",
  "group.archived": "מחיקת קבוצה",
  "membership.assigned": "שיוך משתמש לקבוצה",
  "membership.removed": "הסרת משתמש מקבוצה",
  "room.created": "יצירת חדר",
  "room.updated": "עריכת חדר",
  "room.archived": "מחיקת חדר",
  "room.status_updated": "עדכון מצב מיפוי",
  "room_packing.paused": "השהיית אריזה בחדר",
  "room_packing.closed": "סיום אריזה בחדר",
  "mapping_report.created": "מיפוי פריט",
  "mapping_report.archived": "מחיקת פריט ממופה",
  "packing_unit.created": "פתיחת יחידת אריזה",
  "packing_unit.items_set": "סימון פריטים ביחידה",
  "packing_unit.closed": "סגירת יחידת אריזה",
  "packing_unit.archived": "ביטול יחידת אריזה",
  "packing_unit.assigned_transport": "שיוך יחידה להובלה",
  "transport.created": "יצירת הובלה",
  "transport.status_updated": "עדכון מצב הובלה",
  "transport.archived": "מחיקת הובלה",
  "catalog.item_type_created": "הוספת סוג פריט לקטלוג",
  "catalog.category_created": "הוספת קטגוריה לקטלוג",
  "catalog.subcategory_created": "הוספת תת־קטגוריה לקטלוג",
  "catalog.subcategory_archived": "הסרת תת־קטגוריה מהקטלוג",
};

const valueLabels: Record<string, string> = {
  unstarted: "טרם מופה",
  in_progress: "במיפוי",
  completed: "מופה",
  waiting: "ממתין לאיסוף",
  transit: "בדרך",
  arrived: "הגיע",
  manager: "מנהל",
  commander: "מפקד",
  operator: "מפעיל",
  professional_carton: "קרטון מקצועי",
  personal_carton: "קרטון אישי",
  pallet: "משטח",
  dolav: "דולב",
  bulk: "תפזורת",
};

function describe(event: AuditEvent) {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const label = (value: unknown) => valueLabels[String(value)] ?? String(value);
  const parts: string[] = [];
  if (metadata.from && metadata.to) parts.push(`${label(metadata.from)} ← ${label(metadata.to)}`);
  if (metadata.transportNumber) parts.push(`הובלה ${metadata.transportNumber}`);
  if (metadata.unitNumber) parts.push(`יחידה ${metadata.unitNumber}`);
  if (metadata.unitType) parts.push(label(metadata.unitType));
  if (metadata.quantity) parts.push(`כמות ${metadata.quantity}`);
  if (metadata.itemCount) parts.push(`${metadata.itemCount} פריטים`);
  if (metadata.role) parts.push(label(metadata.role));
  if (metadata.name) parts.push(String(metadata.name));
  return parts.join(" · ");
}

const formatTime = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Jerusalem",
});

export default async function AuditPage() {
  const eventsResult = await listAuditLog();

  return (
    <main className="page-shell">
      <PageHeader title="יומן ביקורת" description="תיעוד בלתי־משתנה של פעולות ושינויי הרשאה · 200 האירועים האחרונים" />
      {!eventsResult.ok ? (
        <EmptyState icon={FileClock} title="שגיאה בטעינת היומן" description={eventsResult.message} />
      ) : eventsResult.data.length === 0 ? (
        <EmptyState icon={FileClock} title="אין אירועים להצגה" description="אירועי ביקורת יופיעו כאן לאחר פעולות במערכת." />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>מועד</th><th>פעולה</th><th>פרטים</th><th>משתמש</th><th>קבוצה</th></tr>
            </thead>
            <tbody>
              {eventsResult.data.map((event) => (
                <tr key={event.id}>
                  <td className="num">{formatTime.format(event.occurredAt)}</td>
                  <td>{actionLabels[event.action] ?? event.action}</td>
                  <td className="muted">{describe(event)}</td>
                  <td>{event.actorName ?? "מערכת"}</td>
                  <td className="muted">{event.groupName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
