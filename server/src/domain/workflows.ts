import type {
  PackingUnitStatus,
  ReportStatus,
  RoomStatus,
  TransportUnitStatus,
} from "../db/schema";
import { HttpError } from "../lib/errors";

const roomTransitions: Record<RoomStatus, readonly RoomStatus[]> = {
  unstarted: ["in_progress"],
  in_progress: ["completed"],
  completed: ["archived"],
  archived: [],
};

const reportTransitions: Record<ReportStatus, readonly ReportStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
};

const transportUnitTransitions: Record<
  TransportUnitStatus,
  readonly TransportUnitStatus[]
> = {
  loading: ["in_transit"],
  in_transit: ["released"],
  released: [],
};

const packingUnitTransitions: Record<
  PackingUnitStatus,
  readonly PackingUnitStatus[]
> = {
  closed: ["in_transit"],
  in_transit: ["received", "missing", "surplus_review"],
  received: ["surplus_review"],
  missing: ["received", "surplus_review"],
  surplus_review: ["received"],
};

export function assertRoomTransition(from: RoomStatus, to: RoomStatus) {
  if (!roomTransitions[from].includes(to)) {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The room status transition is not allowed.");
  }
}

export function assertReportTransition(from: ReportStatus, to: ReportStatus) {
  if (!reportTransitions[from].includes(to)) {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The report status transition is not allowed.");
  }
}

export function assertTransportUnitTransition(
  from: TransportUnitStatus,
  to: TransportUnitStatus,
) {
  if (!transportUnitTransitions[from].includes(to)) {
    throw new HttpError(
      409,
      "INVALID_STATE_TRANSITION",
      "The transport unit status transition is not allowed.",
    );
  }
}

export function assertPackingUnitTransition(
  from: PackingUnitStatus,
  to: PackingUnitStatus,
) {
  if (!packingUnitTransitions[from].includes(to)) {
    throw new HttpError(
      409,
      "INVALID_STATE_TRANSITION",
      "The packing unit status transition is not allowed.",
    );
  }
}

export function reviewReceivingManifest(
  manifestPackingUnitIds: readonly string[],
  receivedPackingUnitIds: readonly string[],
) {
  const manifest = new Set(manifestPackingUnitIds);
  const received = new Set(receivedPackingUnitIds);

  if (received.size !== receivedPackingUnitIds.length) {
    throw new HttpError(
      400,
      "DUPLICATE_PACKING_UNIT",
      "A packing unit was submitted more than once.",
    );
  }

  for (const packingUnitId of received) {
    if (!manifest.has(packingUnitId)) {
      throw new HttpError(
        400,
        "INVALID_PACKING_UNIT",
        "A packing unit is not part of this transport unit.",
      );
    }
  }

  return {
    receivedIds: manifestPackingUnitIds.filter((id) => received.has(id)),
    missingIds: manifestPackingUnitIds.filter((id) => !received.has(id)),
  };
}
