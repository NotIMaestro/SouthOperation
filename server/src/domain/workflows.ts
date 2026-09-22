import type { ReportStatus, RoomStatus } from "../db/schema";
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
