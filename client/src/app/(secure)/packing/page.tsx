import { Building2, PackageCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { roomPackingStatusLabels, roomStatusLabels } from "@/components/packing/labels";
import { StatusBadge } from "@/components/packing/status-badge";
import { listGroups, listRoomsForGroup } from "@/lib/server-api";

export default async function PackingPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const internalUserId = session.user.id;
  const { groupId: requestedGroupId } = await searchParams;

  const groupsResult = await listGroups(internalUserId);
  if (!groupsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="אריזה" description="פתיחת יחידות אריזה וסימון פריטים לפי חדר" />
        <EmptyState description={groupsResult.message} icon={PackageCheck} title="שגיאה בטעינת קבוצות" />
      </main>
    );
  }

  const groups = groupsResult.data;
  if (groups.length === 0) {
    return (
      <main className="page-shell">
        <PageHeader title="אריזה" description="פתיחת יחידות אריזה וסימון פריטים לפי חדר" />
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
        <PageHeader description="בחרו קבוצה כדי להציג את החדרים שלה" title="אריזה" />
        <div className="card-list">
          {groups.map((group) => (
            <Link className="entity-card" href={`/packing?groupId=${group.id}`} key={group.id}>
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

  const roomsResult = await listRoomsForGroup(internalUserId, activeGroupId);
  if (!roomsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="אריזה" description="פתיחת יחידות אריזה וסימון פריטים לפי חדר" />
        <EmptyState description={roomsResult.message} icon={PackageCheck} title="שגיאה בטעינת חדרים" />
      </main>
    );
  }

  const rooms = roomsResult.data;

  return (
    <main className="page-shell">
      <PageHeader description="בחרו חדר ממופה כדי לפתוח ולנהל את יחידות האריזה שלו" title="אריזה" />
      {rooms.length === 0 ? (
        <EmptyState
          description="חדרים שנוצרו בקבוצה זו יופיעו כאן לאחר שיוגדרו."
          icon={PackageCheck}
          title="אין חדרים בקבוצה זו"
        />
      ) : (
        <div className="card-list">
          {rooms.map((room) => {
            const mapped = room.status === "completed";
            const statusInfo = roomStatusLabels[room.status];
            const packingInfo = roomPackingStatusLabels[room.packingStatus];
            const content = (
              <>
                <div>
                  <p className="entity-card-title">{room.name}</p>
                  <p className="entity-card-meta">{mapped ? "ניתן לפתוח יחידות אריזה" : "יש לסיים את המיפוי"}</p>
                </div>
                <div className="entity-card-side">
                  <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
                  {mapped && <StatusBadge label={packingInfo.label} tone={packingInfo.tone} />}
                </div>
              </>
            );
            return mapped ? (
              <Link className="entity-card" href={`/packing/${room.id}`} key={room.id}>
                {content}
              </Link>
            ) : (
              <div aria-disabled="true" className="entity-card disabled" key={room.id}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
