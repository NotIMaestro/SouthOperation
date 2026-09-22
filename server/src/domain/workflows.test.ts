import { describe, expect, it } from "vitest";

import { HttpError } from "../lib/errors";
import { assertReportTransition, assertRoomTransition } from "./workflows";

describe("workflow state machines", () => {
  it("allows only the next operational room state", () => {
    expect(() => assertRoomTransition("unstarted", "in_progress")).not.toThrow();
    expect(() => assertRoomTransition("unstarted", "completed")).toThrow(HttpError);
  });

  it("allows review outcomes only after submission", () => {
    expect(() => assertReportTransition("submitted", "approved")).not.toThrow();
    expect(() => assertReportTransition("draft", "approved")).toThrow(HttpError);
  });
});
