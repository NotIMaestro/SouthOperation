import { describe, expect, it } from "vitest";

import { HttpError } from "../lib/errors";
import {
  assertPackingUnitTransition,
  assertReportTransition,
  assertRoomTransition,
  assertTransportUnitTransition,
  reviewReceivingManifest,
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

  it("releases a transport only from in-transit", () => {
    expect(() => assertTransportUnitTransition("in_transit", "released")).not.toThrow();
    expect(() => assertTransportUnitTransition("loading", "released")).toThrow(HttpError);
  });

  it("classifies unchecked packing units as missing", () => {
    expect(reviewReceivingManifest(["a", "b", "c"], ["a", "c"])).toEqual({
      receivedIds: ["a", "c"],
      missingIds: ["b"],
    });
  });

  it("rejects duplicate or foreign packing units", () => {
    expect(() => reviewReceivingManifest(["a"], ["a", "a"])).toThrow(HttpError);
    expect(() => reviewReceivingManifest(["a"], ["b"])).toThrow(HttpError);
  });

  it("allows a missing packing unit to be recovered", () => {
    expect(() => assertPackingUnitTransition("missing", "received")).not.toThrow();
    expect(() => assertPackingUnitTransition("received", "missing")).toThrow(HttpError);
  });
});
