import { Building2, Truck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TransportBoard } from "@/components/transport/transport-board";
import { listGroups, listTransportsForGroup } from "@/lib/server-api";

export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;

  const groupsResult = await listGroups();
  if (!groupsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="הובלת חבילות" description="תכנון, מעקב וניהול משימות שינוע במערכת" />
        <EmptyState description={groupsResult.message} icon={Truck} title="שגיאה בטעינת קבוצות" />
      </main>
    );
  }

  const groups = groupsResult.data;
  if (groups.length === 0) {
    return (
      <main className="page-shell">
        <PageHeader title="הובלת חבילות" description="תכנון, מעקב וניהול משימות שינוע במערכת" />
        <EmptyState description="אינכם משויכים לאף קבוצה פעילה." icon={Building2} title="אין קבוצות זמינות" />
      </main>
    );
  }

  const activeGroupId =
    requestedGroupId && groups.some((group) => group.id === requestedGroupId)
      ? requestedGroupId
      : groups.length === 1
        ? groups[0].id
        : undefined;

  if (!activeGroupId) {
    return (
      <main className="page-shell">
        <PageHeader description="בחרו קבוצה כדי להציג את משימות ההובלה שלה" title="הובלת חבילות" />
        <div className="card-list">
          {groups.map((group) => (
            <Link className="entity-card" href={`/transport?groupId=${group.id}`} key={group.id}>
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

  const transportsResult = await listTransportsForGroup(activeGroupId);
  if (!transportsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="הובלת חבילות" description="תכנון, מעקב וניהול משימות שינוע במערכת" />
        <EmptyState description={transportsResult.message} icon={Truck} title="שגיאה בטעינת הובלות" />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader title="הובלת חבילות" description="תכנון, מעקב וניהול משימות שינוע במערכת" />
      <TransportBoard groupId={activeGroupId} transports={transportsResult.data} />
    </main>
  );
}
