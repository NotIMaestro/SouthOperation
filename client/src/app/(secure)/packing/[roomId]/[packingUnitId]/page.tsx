import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { packingUnitStatusLabels, packingUnitTypeLabels } from "@/components/packing/labels";
import { ClosePackingUnitForm } from "@/components/packing/close-packing-unit-form";
import { PackingUnitItemPicker } from "@/components/packing/packing-unit-item-picker";
import { PackingUnitQr } from "@/components/packing/packing-unit-qr";
import { ReportItemButton } from "@/components/packing/report-item-modal";
import { StatusBadge } from "@/components/packing/status-badge";
import {
  getRoom,
  listItemCatalog,
  listPackableItems,
  listPackingUnitsForRoom,
  listWaitingTransportsForAssignment,
} from "@/lib/server-api";

export default async function PackingUnitPage({
  params,
}: {
  params: Promise<{ roomId: string; packingUnitId: string }>;
}) {
  const { roomId, packingUnitId } = await params;

  const [roomResult, unitsResult] = await Promise.all([
    getRoom(roomId),
    listPackingUnitsForRoom(roomId),
  ]);

  if (!roomResult.ok || !unitsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader description="פרטי יחידת אריזה" title="אריזה" />
        <EmptyState
          description={!roomResult.ok ? roomResult.message : unitsResult.ok ? "" : unitsResult.message}
          icon={PackageCheck}
          title="שגיאה בטעינת הנתונים"
        />
      </main>
    );
  }

  const room = roomResult.data;
  const unit = unitsResult.data.find((candidate) => candidate.id === packingUnitId);
  if (!unit) notFound();

  const statusInfo = packingUnitStatusLabels[unit.status];
  const needsItemPicker = unit.unitType !== "personal_carton" && unit.status !== "closed";
  const canClose =
    unit.status === "packing_in_progress" ||
    (unit.status === "awaiting_packing" && unit.unitType === "personal_carton");

  const [packableItemsResult, catalogResult] = needsItemPicker
    ? await Promise.all([listPackableItems(roomId), listItemCatalog()])
    : [undefined, undefined];
  const waitingTransportsResult =
    unit.status === "closed" && !unit.transportId
      ? await listWaitingTransportsForAssignment(room.groupId)
      : undefined;

  return (
    <main className="page-shell">
      <p className="breadcrumb">
        <Link href="/packing">אריזה</Link> / <Link href={`/packing/${roomId}`}>{room.name}</Link> /{" "}
        {packingUnitTypeLabels[unit.unitType]}
        {unit.unitNumber ? ` ${unit.unitNumber}` : ""}
      </p>
      <PageHeader
        action={<StatusBadge label={statusInfo.label} tone={statusInfo.tone} />}
        description={packingUnitTypeLabels[unit.unitType]}
        title={unit.unitNumber ? `יחידת אריזה ${unit.unitNumber}` : "יחידת אריזה חדשה"}
      />

      <div className="stack">
        {unit.status === "closed" ? (
          <>
            <div className="form-card">
              <h2>האריזה הושלמה</h2>
              <p className="hint">
                יעד: {unit.destinationBuilding}
                {unit.destinationFloor ? ` · קומה ${unit.destinationFloor}` : ""} · חדר {unit.destinationRoom}
              </p>
            </div>
            {unit.unitNumber && (
              <PackingUnitQr
                currentTransport={
                  unit.transportId && unit.transportNumber && unit.transportStatus
                    ? { transportNumber: unit.transportNumber, status: unit.transportStatus }
                    : null
                }
                packingUnitId={unit.id}
                unitNumber={unit.unitNumber}
                waitingTransports={
                  unit.transportId
                    ? []
                    : waitingTransportsResult?.ok
                      ? waitingTransportsResult.data
                      : []
                }
              />
            )}
          </>
        ) : (
          <>
            {needsItemPicker &&
              (packableItemsResult?.ok ? (
                <PackingUnitItemPicker
                  addItemAction={
                    catalogResult?.ok && (
                      <ReportItemButton catalog={catalogResult.data} groupId={room.groupId} roomId={roomId} />
                    )
                  }
                  items={packableItemsResult.data}
                  packingUnitId={unit.id}
                />
              ) : (
                <EmptyState
                  description={packableItemsResult?.ok === false ? packableItemsResult.message : ""}
                  icon={PackageCheck}
                  title="שגיאה בטעינת הפריטים הממופים"
                />
              ))}
            {canClose && <ClosePackingUnitForm packingUnitId={unit.id} roomId={roomId} />}
            <div className="form-actions">
              <ActionButton
                confirmLabel="לבטל את היחידה?"
                method="DELETE"
                redirectTo={`/packing/${roomId}`}
                url={`/api/v1/packing-units/${unit.id}`}
              >
                ביטול יחידת האריזה
              </ActionButton>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
