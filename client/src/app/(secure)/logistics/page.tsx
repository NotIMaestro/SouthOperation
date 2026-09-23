import { Waypoints } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { listGroupOverviews } from "@/lib/server-api";

export default async function LogisticsPage() {
  const result = await listGroupOverviews();

  if (!result.ok || result.data.length === 0) {
    return (
      <main className="page-shell">
        <PageHeader title="הצגת לוגיסטיקה" description="תמונת מצב של תהליכי הלוגיסטיקה והמשימות הפעילות" />
        <EmptyState
          icon={Waypoints}
          title={result.ok ? "אין קבוצות להצגה" : "שגיאה בטעינת הנתונים"}
          description={result.ok ? "קבוצות שתשויכו אליהן יופיעו כאן." : result.message}
        />
      </main>
    );
  }

  const rows = result.data.map(({ group, overview }) => ({
    group,
    cells: [
      overview.rooms.unstarted,
      overview.rooms.in_progress,
      overview.rooms.completed,
      overview.packingUnits.awaiting_packing + overview.packingUnits.packing_in_progress,
      overview.packingUnits.closed,
      overview.closedUnassignedUnits,
      overview.transports.waiting,
      overview.transports.transit,
      overview.transports.arrived,
    ],
  }));
  const totals = rows[0].cells.map((_, index) => rows.reduce((total, row) => total + row.cells[index], 0));

  return (
    <main className="page-shell">
      <PageHeader title="הצגת לוגיסטיקה" description="תמונת מצב של כל שלבי ההעברה, לפי קבוצה" />
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th rowSpan={2}>קבוצה</th>
              <th colSpan={3}>חדרים</th>
              <th colSpan={3}>יחידות אריזה</th>
              <th colSpan={3}>הובלות</th>
            </tr>
            <tr>
              <th>טרם מופו</th><th>במיפוי</th><th>ממופים</th>
              <th>פתוחות</th><th>סגורות</th><th>ללא הובלה</th>
              <th>ממתינות</th><th>בדרך</th><th>הגיעו</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, cells }) => (
              <tr key={group.id}>
                <td><Link href={`/rooms?groupId=${group.id}`}>{group.name}</Link><div className="muted">{group.groupCode}</div></td>
                {cells.map((value, index) => <td className="num" key={index}>{value}</td>)}
              </tr>
            ))}
            {rows.length > 1 && (
              <tr>
                <td><strong>סה&quot;כ</strong></td>
                {totals.map((value, index) => <td className="num" key={index}><strong>{value}</strong></td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
