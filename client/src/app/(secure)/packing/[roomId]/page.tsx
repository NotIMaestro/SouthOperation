import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  packingUnitStatusLabels,
  packingUnitTypeLabels,
  roomPackingStatusLabels,
} from "@/components/packing/labels";
import { OpenPackingUnitForm } from "@/components/packing/open-packing-unit-form";
import { RoomPackingControls } from "@/components/packing/room-packing-controls";
import { StatusBadge } from "@/components/packing/status-badge";
import { getRoom, listPackingUnitsForRoom } from "@/lib/server-api";

export default async function RoomPackingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const internalUserId = session.user.id;
  const { roomId } = await params;

  const roomResult = await getRoom(internalUserId, roomId);
  if (!roomResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader description="פתיחת יחידות אריזה וסימון פריטים" title="אריזה" />
        <EmptyState description={roomResult.message} icon={PackageCheck} title="שגיאה בטעינת החדר" />
      </main>
    );
  }
  const room = roomResult.data;

  if (room.status !== "completed") {
    return (
      <main className="page-shell">
        <p className="breadcrumb">
          <Link href="/packing">אריזה</Link> / {room.name}
        </p>
        <PageHeader description="פתיחת יחידות אריזה וסימון פריטים" title={room.name} />
        <EmptyState
          description="לא ניתן לפתוח יחידות אריזה עד שמיפוי החדר יושלם."
          icon={PackageCheck}
          title="יש לסיים את המיפוי"
        />
      </main>
    );
  }

  const unitsResult = await listPackingUnitsForRoom(internalUserId, roomId);
  if (!unitsResult.ok) {
    return (
      <main className="page-shell">
        <p className="breadcrumb">
          <Link href="/packing">אריזה</Link> / {room.name}
        </p>
        <PageHeader description="פתיחת יחידות אריזה וסימון פריטים" title={room.name} />
        <EmptyState description={unitsResult.message} icon={PackageCheck} title="שגיאה בטעינת יחידות האריזה" />
      </main>
    );
  }

  const units = unitsResult.data;
  const hasOpenUnit = units.some((unit) => unit.status !== "closed");
  const packingInfo = roomPackingStatusLabels[room.packingStatus];

  return (
    <main className="page-shell">
      <p className="breadcrumb">
        <Link href="/packing">אריזה</Link> / {room.name}
      </p>
      <PageHeader
        action={<StatusBadge label={packingInfo.label} tone={packingInfo.tone} />}
        description={room.managerName ? `אחראי חדר: ${room.managerName}` : "פתיחת יחידות אריזה וסימון פריטים"}
        title={room.name}
      />

      <div className="stack">
        {units.length === 0 ? (
          <EmptyState
            description="פתחו יחידת אריזה ראשונה כדי להתחיל."
            icon={PackageCheck}
            title="אין יחידות אריזה עדיין"
          />
        ) : (
          <div className="card-list">
            {units.map((unit) => {
              const statusInfo = packingUnitStatusLabels[unit.status];
              return (
                <Link className="entity-card" href={`/packing/${roomId}/${unit.id}`} key={unit.id}>
                  <div>
                    <p className="entity-card-title">
                      {packingUnitTypeLabels[unit.unitType]}
                      {unit.unitNumber ? ` · מס' ${unit.unitNumber}` : ""}
                    </p>
                    {unit.destinationRoom && (
                      <p className="entity-card-meta">
                        יעד: {unit.destinationBuilding}
                        {unit.destinationFloor ? ` · קומה ${unit.destinationFloor}` : ""} · חדר{" "}
                        {unit.destinationRoom}
                      </p>
                    )}
                  </div>
                  <StatusBadge label={statusInfo.label} tone={statusInfo.tone} />
                </Link>
              );
            })}
          </div>
        )}

        {room.packingStatus !== "closed" && <OpenPackingUnitForm roomId={roomId} />}
        {room.packingStatus === "in_packing" && !hasOpenUnit && <RoomPackingControls roomId={roomId} />}
      </div>
    </main>
  );
}
