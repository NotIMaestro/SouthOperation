import { Building2, ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReportBoard } from "@/components/reports/report-board";
import { listGroups, listItemCatalog, listReportsForGroup, listRoomsForGroup } from "@/lib/server-api";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId } = await searchParams;

  if (!groupId) {
    const groupsResult = await listGroups();
    if (!groupsResult.ok) {
      return (
        <main className="page-shell">
          <PageHeader title="דוחות מיפוי" description="יצירה ובקרה של פריטי ציוד" />
          <EmptyState icon={ClipboardCheck} title="שגיאה בטעינת קבוצות" description={groupsResult.message} />
        </main>
      );
    }

    if (groupsResult.data.length === 0) {
      return (
        <main className="page-shell">
          <PageHeader title="דוחות מיפוי" description="יצירה ובקרה של פריטי ציוד" />
          <EmptyState icon={Building2} title="אין קבוצות זמינות" description="אינכם משויכים לאף קבוצה פעילה." />
        </main>
      );
    }

    return (
      <main className="page-shell">
        <PageHeader description="בחרו קבוצה כדי להציג את הדוחות שלה" title="דוחות מיפוי" />
        <div className="card-list">
          {groupsResult.data.map((group) => (
            <Link className="entity-card" href={`/reports?groupId=${group.id}`} key={group.id}>
              <div>
                <p className="entity-card-title">{group.name}</p>
                <p className="entity-card-meta">{group.groupCode}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  const [reportsResult, roomsResult, catalogResult] = await Promise.all([
    listReportsForGroup(groupId),
    listRoomsForGroup(groupId),
    listItemCatalog(),
  ]);

  if (!reportsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="דוחות מיפוי" description="יצירה ובקרה של פריטי ציוד" />
        <EmptyState icon={ClipboardCheck} title="שגיאה בטעינת דוחות" description={reportsResult.message} />
      </main>
    );
  }

  const rooms = roomsResult.ok ? roomsResult.data : [];
  const catalog = catalogResult.ok ? catalogResult.data : [];

  return (
    <main className="page-shell">
      <PageHeader title="דוחות מיפוי" description="יצירה ובקרה של פריטי ציוד — דוחות זמינים מיד לאריזה" />
      {rooms.length === 0 ? (
        <EmptyState icon={Building2} title="אין חדרים בקבוצה זו" description="יש ליצור חדר לפני דיווח על פריטים." />
      ) : (
        <ReportBoard catalog={catalog} groupId={groupId} reports={reportsResult.data} rooms={rooms} />
      )}
    </main>
  );
}
