import { Boxes } from "lucide-react";
import Link from "next/link";

import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { GroupPicker } from "@/components/group-picker";
import { RoomFormButton } from "@/components/management/room-form-button";
import { PageHeader } from "@/components/page-header";
import { roomPackingStatusLabels, roomStatusLabels } from "@/components/packing/labels";
import { StatusBadge } from "@/components/packing/status-badge";
import { resolveActiveGroup } from "@/lib/active-group";
import { getViewerAccess, listLocations, listRoomsForGroup } from "@/lib/server-api";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;
  const active = await resolveActiveGroup(requestedGroupId);

  if (active.kind !== "active") {
    return (
      <main className="page-shell">
        <PageHeader title="מיפוי חדרים" description="בחרו קבוצה כדי להציג את החדרים שלה" />
        <GroupPicker basePath="/rooms" result={active} />
      </main>
    );
  }

  const groupId = active.group.id;
  const [roomsResult, accessResult, locationsResult] = await Promise.all([
    listRoomsForGroup(groupId),
    getViewerAccess(groupId),
    listLocations(),
  ]);
  const access = accessResult.ok ? accessResult.data : { canManageGroup: false, canCommand: false };
  const locations = locationsResult.ok ? locationsResult.data : [];

  if (!roomsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="מיפוי חדרים" description="מעקב אחר מצב המיפוי וההתקדמות בכל חדר" />
        <EmptyState icon={Boxes} title="שגיאה בטעינת חדרים" description={roomsResult.message} />
      </main>
    );
  }

  const rooms = roomsResult.data;

  return (
    <main className="page-shell">
      <PageHeader
        action={access.canManageGroup ? <RoomFormButton groupId={groupId} locations={locations} /> : undefined}
        description={`${active.group.name} · התחילו מיפוי, סמנו חדר כממופה כדי לפתוח אותו לאריזה`}
        title="מיפוי חדרים"
      />
      {rooms.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="אין חדרים בקבוצה זו"
          description={access.canManageGroup ? "הוסיפו חדר ראשון כדי להתחיל במיפוי." : "חדרים שנוצרו בקבוצה זו יופיעו כאן."}
        />
      ) : (
        <div className="card-list">
          {rooms.map((room) => {
            const statusInfo = roomStatusLabels[room.status];
            const packingInfo = roomPackingStatusLabels[room.packingStatus];
            const meta = [room.locationName, room.managerName && `אחראי: ${room.managerName}`, room.description]
              .filter(Boolean)
              .join(" · ");
            return (
              <div className="entity-card" key={room.id}>
                <div>
                  <p className="entity-card-title">{room.name}</p>
                  {meta && <p className="entity-card-meta">{meta}</p>}
                  <div className="entity-card-side" style={{ marginTop: "0.5rem" }}>
                    <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
                    {room.status === "completed" && <StatusBadge label={packingInfo.label} tone={packingInfo.tone} />}
                  </div>
                </div>
                <div className="entity-card-actions">
                  {access.canCommand && room.status === "unstarted" && (
                    <ActionButton body={{ status: "in_progress" }} url={`/api/v1/rooms/${room.id}/status`} variant="primary">
                      התחלת מיפוי
                    </ActionButton>
                  )}
                  {access.canCommand && room.status === "in_progress" && (
                    <ActionButton
                      body={{ status: "completed" }}
                      confirmLabel="לסמן כממופה?"
                      url={`/api/v1/rooms/${room.id}/status`}
                      variant="primary"
                    >
                      סיום מיפוי
                    </ActionButton>
                  )}
                  {room.status === "completed" && (
                    <Link className="button primary compact" href={`/packing/${room.id}`}>לאריזה</Link>
                  )}
                  {access.canManageGroup && <RoomFormButton groupId={groupId} locations={locations} room={room} />}
                  {access.canManageGroup && (
                    <ActionButton confirmLabel="לאשר מחיקה?" method="DELETE" url={`/api/v1/rooms/${room.id}`}>
                      מחיקה
                    </ActionButton>
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
