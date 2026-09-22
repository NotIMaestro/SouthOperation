import type {
  PackingUnitStatus,
  ReportStatus,
  RoomPackingStatus,
  RoomStatus,
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

const roomPackingTransitions: Record<
  RoomPackingStatus,
  readonly RoomPackingStatus[]
> = {
  not_started: ["in_packing"],
  in_packing: ["paused", "closed"],
  paused: ["in_packing"],
  closed: [],
};

const packingUnitTransitions: Record<
  PackingUnitStatus,
  readonly PackingUnitStatus[]
> = {
  awaiting_packing: ["packing_in_progress"],
  packing_in_progress: ["closed"],
  closed: [],
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

export function assertRoomPackingTransition(
  from: RoomPackingStatus,
  to: RoomPackingStatus,
) {
  if (!roomPackingTransitions[from].includes(to)) {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The room packing status transition is not allowed.");
  }
}

export function assertPackingUnitTransition(
  from: PackingUnitStatus,
  to: PackingUnitStatus,
) {
  if (!packingUnitTransitions[from].includes(to)) {
    throw new HttpError(409, "INVALID_STATE_TRANSITION", "The packing unit status transition is not allowed.");
  }
}
