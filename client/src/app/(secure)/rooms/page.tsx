import { Boxes, Building2 } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { roomPackingStatusLabels, roomStatusLabels } from "@/components/packing/labels";
import { StatusBadge } from "@/components/packing/status-badge";
import { listGroups, listRoomsForGroup } from "@/lib/server-api";
import { getSelectedGroupIdFromCookie } from "@/lib/selected-group";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;

  let groupId = requestedGroupId;
  if (!groupId) {
    const groupsResult = await listGroups();
    if (!groupsResult.ok) {
      return (
        <main className="page-shell">
          <PageHeader title="חדרים" description="מעקב אחר מצב המיפוי וההתקדמות בכל חדר" />
          <EmptyState icon={Boxes} title="שגיאה בטעינת קבוצות" description={groupsResult.message} />
        </main>
      );
    }

    if (groupsResult.data.length === 0) {
      return (
        <main className="page-shell">
          <PageHeader title="חדרים" description="מעקב אחר מצב המיפוי וההתקדמות בכל חדר" />
          <EmptyState icon={Building2} title="אין קבוצות זמינות" description="אינכם משויכים לאף קבוצה פעילה." />
        </main>
      );
    }

    const cookieGroupId = await getSelectedGroupIdFromCookie();
    groupId =
      (cookieGroupId && groupsResult.data.some((group) => group.id === cookieGroupId) ? cookieGroupId : undefined) ??
      (groupsResult.data.length === 1 ? groupsResult.data[0].id : undefined);

    if (!groupId) {
      return (
        <main className="page-shell">
          <PageHeader title="חדרים" description="בחרו קבוצה כדי להציג את החדרים שלה" />
          <div className="card-list">
            {groupsResult.data.map((group) => (
              <Link className="entity-card" href={`/rooms?groupId=${group.id}`} key={group.id}>
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
  }

  const roomsResult = await listRoomsForGroup(groupId);
  if (!roomsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="חדרים" description="מעקב אחר מצב המיפוי וההתקדמות בכל חדר" />
        <EmptyState icon={Boxes} title="שגיאה בטעינת חדרים" description={roomsResult.message} />
      </main>
    );
  }

  const rooms = roomsResult.data;

  return (
    <main className="page-shell">
      <PageHeader description="מעקב אחר מצב המיפוי וההתקדמות בכל חדר" title="חדרים" />
      {rooms.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="אין חדרים בקבוצה זו"
          description="חדרים שנוצרו בקבוצה זו יופיעו כאן."
        />
      ) : (
        <div className="card-list">
          {rooms.map((room) => {
            const statusInfo = roomStatusLabels[room.status];
            const packingInfo = roomPackingStatusLabels[room.packingStatus];
            return (
              <div className="entity-card" key={room.id}>
                <div>
                  <p className="entity-card-title">{room.name}</p>
                  {room.description && <p className="entity-card-meta">{room.description}</p>}
                </div>
                <div className="entity-card-side">
                  <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
                  {room.status === "completed" && (
                    <StatusBadge label={packingInfo.label} tone={packingInfo.tone} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
