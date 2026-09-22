import { Building2, PackageOpen } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReceivingList } from "@/components/transport/receiving-list";
import { listGroups, listTransportsForGroup } from "@/lib/server-api";

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;

  const groupsResult = await listGroups();
  if (!groupsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="קבלת חבילות" description="קליטת חבילות שהגיעו ליעדן ובדיקתן" />
        <EmptyState icon={PackageOpen} title="שגיאה בטעינת קבוצות" description={groupsResult.message} />
      </main>
    );
  }

  const groups = groupsResult.data;
  if (groups.length === 0) {
    return (
      <main className="page-shell">
        <PageHeader title="קבלת חבילות" description="קליטת חבילות שהגיעו ליעדן ובדיקתן" />
        <EmptyState icon={Building2} title="אין קבוצות זמינות" description="אינכם משויכים לאף קבוצה פעילה." />
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
        <PageHeader description="בחרו קבוצה כדי להציג את ההובלות שבדרך" title="קבלת חבילות" />
        <div className="card-list">
          {groups.map((group) => (
            <Link className="entity-card" href={`/receiving?groupId=${group.id}`} key={group.id}>
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

  const transportsResult = await listTransportsForGroup(activeGroupId, "transit");
  if (!transportsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="קבלת חבילות" description="קליטת חבילות שהגיעו ליעדן ובדיקתן" />
        <EmptyState icon={PackageOpen} title="שגיאה בטעינת הובלות" description={transportsResult.message} />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader title="קבלת חבילות" description="הובלות בדרך ליעד בקבוצה זו. אישור קבלה נועל את ההובלה." />
      {transportsResult.data.length === 0 ? (
        <EmptyState icon={PackageOpen} title="אין חבילות ממתינות לקבלה" description="הובלות שבדרך ליעד יופיעו כאן." />
      ) : (
        <ReceivingList transports={transportsResult.data} />
      )}
    </main>
  );
}
