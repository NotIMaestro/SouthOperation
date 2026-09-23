import { PackageCheck } from "lucide-react";
import Link from "next/link";

import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  packingUnitStatusLabels,
  packingUnitTypeLabels,
  roomPackingStatusLabels,
} from "@/components/packing/labels";
import { OpenPackingUnitForm } from "@/components/packing/open-packing-unit-form";
import { ReportItemButton } from "@/components/packing/report-item-modal";
import { RoomPackingControls } from "@/components/packing/room-packing-controls";
import { StatusBadge } from "@/components/packing/status-badge";
import { getRoom, listItemCatalog, listPackableItems, listPackingUnitsForRoom } from "@/lib/server-api";

export default async function RoomPackingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  const roomResult = await getRoom(roomId);
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
        <div className="form-actions">
          <Link className="button primary" href="/rooms">למיפוי חדרים</Link>
        </div>
      </main>
    );
  }

  const [unitsResult, itemsResult, catalogResult] = await Promise.all([
    listPackingUnitsForRoom(roomId),
    listPackableItems(roomId),
    listItemCatalog(),
  ]);
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

        <section className="stack" style={{ gap: "0.85rem" }}>
          <div className="section-heading">
            <div>
              <h2>פריטים ממופים בחדר</h2>
              <p>פריטים שדווחו בחדר זה והכמות שנותרה לאריזה.</p>
            </div>
            {catalogResult.ok && room.packingStatus !== "closed" && (
              <ReportItemButton catalog={catalogResult.data} groupId={room.groupId} roomId={roomId} />
            )}
          </div>
          {!itemsResult.ok ? (
            <p className="inline-error">{itemsResult.message}</p>
          ) : itemsResult.data.length === 0 ? (
            <p className="hint">עדיין לא דווחו פריטים בחדר זה.</p>
          ) : (
            <div className="card-list">
              {itemsResult.data.map((item) => (
                <div className="entity-card" key={item.mappingReportId}>
                  <div>
                    <p className="entity-card-title">
                      {[item.itemTypeName, item.categoryName, item.subcategoryName].filter(Boolean).join(" / ")}
                    </p>
                    <p className="entity-card-meta">
                      {item.serialNumber ? `מס' סידורי: ${item.serialNumber} · ` : ""}
                      נארזו {item.packedQuantity} מתוך {item.quantity}
                    </p>
                  </div>
                  <div className="entity-card-actions">
                    {item.remainingQuantity === 0 ? (
                      <StatusBadge label="נארז במלואו" tone="success" />
                    ) : item.packedQuantity > 0 ? (
                      <StatusBadge label="נארז חלקית" tone="progress" />
                    ) : (
                      <ActionButton
                        confirmLabel="לאשר מחיקה?"
                        method="DELETE"
                        url={`/api/v1/mapping-reports/${item.mappingReportId}`}
                      >
                        מחיקה
                      </ActionButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {room.packingStatus === "in_packing" && !hasOpenUnit && <RoomPackingControls roomId={roomId} />}
      </div>
    </main>
  );
}
