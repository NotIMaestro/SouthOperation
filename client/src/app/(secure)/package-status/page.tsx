import { Building2, PackageCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { packingUnitTypeLabels, transportStatusLabels } from "@/components/packing/labels";
import { StatusBadge } from "@/components/packing/status-badge";
import { listGroups, listPackingUnitsWithStage } from "@/lib/server-api";

export default async function PackageStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;

  const groupsResult = await listGroups();
  if (!groupsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="סטטוס חבילות משוייכות" description="מעקב אחר חבילות ששויכו לתהליך ההעברה" />
        <EmptyState icon={PackageCheck} title="שגיאה בטעינת קבוצות" description={groupsResult.message} />
      </main>
    );
  }

  const groups = groupsResult.data;
  if (groups.length === 0) {
    return (
      <main className="page-shell">
        <PageHeader title="סטטוס חבילות משוייכות" description="מעקב אחר חבילות ששויכו לתהליך ההעברה" />
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
        <PageHeader description="בחרו קבוצה כדי להציג את סטטוס החבילות שלה" title="סטטוס חבילות משוייכות" />
        <div className="card-list">
          {groups.map((group) => (
            <Link className="entity-card" href={`/package-status?groupId=${group.id}`} key={group.id}>
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

  const unitsResult = await listPackingUnitsWithStage(activeGroupId);
  if (!unitsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="סטטוס חבילות משוייכות" description="מעקב אחר חבילות ששויכו לתהליך ההעברה" />
        <EmptyState icon={PackageCheck} title="שגיאה בטעינת נתונים" description={unitsResult.message} />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader title="סטטוס חבילות משוייכות" description="כל יחידות האריזה הסגורות בקבוצה זו, לפי שלב בתהליך ההעברה" />
      {unitsResult.data.length === 0 ? (
        <EmptyState icon={PackageCheck} title="אין חבילות משוייכות להצגה" description="חבילות שיוכנו לתהליך ההעברה יוצגו כאן." />
      ) : (
        <div className="card-list">
          {unitsResult.data.map((unit) => (
            <div className="entity-card" key={unit.id}>
              <div>
                <p className="entity-card-title">{unit.unitNumber ? `יחידה ${unit.unitNumber}` : unit.id} · {packingUnitTypeLabels[unit.unitType]}</p>
                <p className="entity-card-meta">
                  {unit.roomName}
                  {unit.destinationBuilding ? ` → ${unit.destinationBuilding}${unit.destinationRoom ? `, חדר ${unit.destinationRoom}` : ""}` : ""}
                  {unit.transportNumber ? ` · הובלה ${unit.transportNumber}` : ""}
                </p>
              </div>
              <div className="entity-card-side">
                {unit.transportStatus ? (
                  <StatusBadge label={transportStatusLabels[unit.transportStatus].label} tone={transportStatusLabels[unit.transportStatus].tone} />
                ) : (
                  <StatusBadge label="טרם שויכה להובלה" tone="neutral" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
