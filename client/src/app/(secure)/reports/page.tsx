import { Building2, ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { reportStatusLabels } from "@/components/packing/labels";
import { StatusBadge } from "@/components/packing/status-badge";
import { listGroups, listReportsForGroup, listRoomsForGroup } from "@/lib/server-api";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId } = await searchParams;
  const newReportAction = (
    <button aria-label="יצירת דוח" className="button primary" type="button">
      <Plus /> דוח חדש
    </button>
  );

  if (!groupId) {
    const groupsResult = await listGroups();
    if (!groupsResult.ok) {
      return (
        <main className="page-shell">
          <PageHeader title="דוחות מיפוי" description="יצירה, הגשה ובקרה של פריטי ציוד" action={newReportAction} />
          <EmptyState icon={ClipboardCheck} title="שגיאה בטעינת קבוצות" description={groupsResult.message} />
        </main>
      );
    }

    if (groupsResult.data.length === 0) {
      return (
        <main className="page-shell">
          <PageHeader title="דוחות מיפוי" description="יצירה, הגשה ובקרה של פריטי ציוד" action={newReportAction} />
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

  const [reportsResult, roomsResult] = await Promise.all([
    listReportsForGroup(groupId),
    listRoomsForGroup(groupId),
  ]);

  if (!reportsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="דוחות מיפוי" description="יצירה, הגשה ובקרה של פריטי ציוד" action={newReportAction} />
        <EmptyState icon={ClipboardCheck} title="שגיאה בטעינת דוחות" description={reportsResult.message} />
      </main>
    );
  }

  const roomNameById = new Map((roomsResult.ok ? roomsResult.data : []).map((room) => [room.id, room.name]));
  const reports = reportsResult.data;

  return (
    <main className="page-shell">
      <PageHeader title="דוחות מיפוי" description="יצירה, הגשה ובקרה של פריטי ציוד" action={newReportAction} />
      {reports.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="אין דוחות להצגה" description="דוחות עבור הקבוצה שנבחרה יופיעו כאן." />
      ) : (
        <div className="card-list">
          {reports.map((report) => {
            const statusInfo = reportStatusLabels[report.status];
            return (
              <div className="entity-card" key={report.id}>
                <div>
                  <p className="entity-card-title">{roomNameById.get(report.roomId) ?? report.roomId}</p>
                  <p className="entity-card-meta">
                    כמות: {report.quantity}
                    {report.serialNumber ? ` · מס' סידורי: ${report.serialNumber}` : ""}
                  </p>
                </div>
                <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
