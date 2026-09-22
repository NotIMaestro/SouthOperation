import { describe, expect, it } from "vitest";

import { HttpError } from "../lib/errors";
import {
  assertPackingUnitTransition,
  assertReportTransition,
  assertRoomPackingTransition,
  assertRoomTransition,
} from "./workflows";

describe("workflow state machines", () => {
  it("allows only the next operational room state", () => {
    expect(() => assertRoomTransition("unstarted", "in_progress")).not.toThrow();
    expect(() => assertRoomTransition("unstarted", "completed")).toThrow(HttpError);
  });

  it("allows review outcomes only after submission", () => {
    expect(() => assertReportTransition("submitted", "approved")).not.toThrow();
    expect(() => assertReportTransition("draft", "approved")).toThrow(HttpError);
  });

  it("allows a room to pause and resume packing, but not restart once closed", () => {
    expect(() => assertRoomPackingTransition("not_started", "in_packing")).not.toThrow();
    expect(() => assertRoomPackingTransition("in_packing", "paused")).not.toThrow();
    expect(() => assertRoomPackingTransition("paused", "in_packing")).not.toThrow();
    expect(() => assertRoomPackingTransition("closed", "in_packing")).toThrow(HttpError);
  });

  it("allows a packing unit to close only after packing has started", () => {
    expect(() => assertPackingUnitTransition("awaiting_packing", "packing_in_progress")).not.toThrow();
    expect(() => assertPackingUnitTransition("packing_in_progress", "closed")).not.toThrow();
    expect(() => assertPackingUnitTransition("awaiting_packing", "closed")).toThrow(HttpError);
    expect(() => assertPackingUnitTransition("closed", "packing_in_progress")).toThrow(HttpError);
  });
});
