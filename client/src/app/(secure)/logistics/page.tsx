import { Waypoints } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { GroupPicker } from "@/components/group-picker";
import { PageHeader } from "@/components/page-header";
import { resolveActiveGroup } from "@/lib/active-group";
import { getGroupOverview } from "@/lib/server-api";

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;
  const active = await resolveActiveGroup(requestedGroupId);

  if (active.kind !== "active") {
    return (
      <main className="page-shell">
        <PageHeader title="הצגת לוגיסטיקה" description="בחרו קבוצה כדי להציג את תמונת המצב הלוגיסטית שלה" />
        <GroupPicker basePath="/logistics" result={active} />
      </main>
    );
  }

  const { group } = active;
  const result = await getGroupOverview(group.id);

  if (!result.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="הצגת לוגיסטיקה" description={`${group.name} · תמונת מצב של כל שלבי ההעברה`} />
        <EmptyState icon={Waypoints} title="שגיאה בטעינת הנתונים" description={result.message} />
      </main>
    );
  }

  const overview = result.data;
  const cells = [
    overview.rooms.unstarted,
    overview.rooms.in_progress,
    overview.rooms.completed,
    overview.packingUnits.awaiting_packing + overview.packingUnits.packing_in_progress,
    overview.packingUnits.closed,
    overview.closedUnassignedUnits,
    overview.transports.waiting,
    overview.transports.transit,
    overview.transports.arrived,
  ];

  return (
    <main className="page-shell">
      <PageHeader title="הצגת לוגיסטיקה" description={`${group.name} · תמונת מצב של כל שלבי ההעברה`} />
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
            <tr>
              <td><Link href={`/rooms?groupId=${group.id}`}>{group.name}</Link><div className="muted">{group.groupCode}</div></td>
              {cells.map((value, index) => <td className="num" key={index}>{value}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
