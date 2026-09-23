// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiCallResult } from "@/lib/api-client";
import type { CollectionPackage, CollectionSnapshot } from "@/lib/pickup/types";

import { PickupPage } from "./pickup-page";

const GROUP = "11111111-1111-4111-8111-111111111111";
const UNIT_1 = "aaaaaaaa-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({ callApi: vi.fn(), decode: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ callApi: mocks.callApi }));
vi.mock("@/lib/qr", async (original) => ({ ...(await original<typeof import("@/lib/qr")>()), decodeQrImage: mocks.decode }));
vi.mock("@/components/packing/camera-preview", () => ({
  CameraPreview: ({ onDecoded }: { onDecoded(value: string): void }) => <button onClick={() => onDecoded(`UNIT:${UNIT_1}`)}>קוד מהמצלמה</button>,
}));

function unit(id: string, unitNumber: string, items: [string, number][], collectedAt: string | null = null): CollectionPackage {
  return {
    id, unitNumber, unitType: "pallet", roomName: "חדר 12", destinationBuilding: "בניין 2", destinationFloor: "3", destinationRoom: "214",
    transportId: "t1", transportNumber: "TR-025", receivedAt: "2026-09-22T09:00:00Z", collectedAt,
    items: items.map(([name, quantity], index) => ({ id: `${id}-${index}`, name, quantity, issues: [] })),
  };
}

let server: CollectionSnapshot;
function seed() {
  server = {
    pending: [
      unit(UNIT_1, "00001", [["מסך", 2], ["מקלדת", 3], ["עכבר", 4]]),
      unit("aaaaaaaa-0000-4000-8000-000000000002", "00002", [["כיסא", 1], ["מנורה", 1]]),
      unit("aaaaaaaa-0000-4000-8000-000000000003", "00003", [["שולחן", 1]]),
    ],
    confirmed: [unit("aaaaaaaa-0000-4000-8000-000000000006", "00006", [["ארון", 1]], "2026-09-22T12:00:00Z")],
  };
}
/** In-memory stand-in for GET/POST /api/v1/groups/:groupId/pickup. */
async function fakeApi(url: string, { method = "POST", body }: { method?: string; body?: { packingUnitIds: string[] } } = {}): Promise<ApiCallResult> {
  expect(url).toBe(`/api/v1/groups/${GROUP}/pickup`);
  if (method === "GET") return { ok: true, data: structuredClone(server) };
  const ids = body!.packingUnitIds;
  const now = new Date().toISOString();
  server.confirmed.unshift(...server.pending.filter((item) => ids.includes(item.id)).map((item) => ({ ...item, collectedAt: now })));
  server.pending = server.pending.filter((item) => !ids.includes(item.id));
  return { ok: true, data: structuredClone(server) };
}

beforeEach(() => {
  seed();
  mocks.callApi.mockImplementation(fakeApi);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const confirmCalls = () => mocks.callApi.mock.calls.filter(([, options]) => options?.body);
async function ready() { render(<PickupPage groupId={GROUP} />); await screen.findByRole("checkbox", { name: /בחירת חבילה 00001/ }); }
async function manual(number: string) {
  fireEvent.click(screen.getByRole("button", { name: "אישור חבילה לפי מספר" }));
  fireEvent.change(screen.getByLabelText("מספר יחידת אריזה"), { target: { value: number } });
  fireEvent.submit(screen.getByRole("button", { name: "המשך לאישור" }).closest("form")!);
}
function upload() {
  fireEvent.click(screen.getByRole("button", { name: "סריקת קוד לאישור חבילה" }));
  fireEvent.change(screen.getByLabelText("העלאת תמונת קוד"), { target: { files: [new File(["image"], "label.png", { type: "image/png" })] } });
}

describe("package pickup", () => {
  it("shows pending before confirmed units", async () => {
    await ready();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const sections = screen.getAllByRole("region");
    expect(sections[0].textContent).toContain("חבילות שממתינות לאישור");
    expect(within(sections[1]).queryByRole("checkbox")).toBeNull();
  });

  it("reviews every item in a batch and confirms it", async () => {
    await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: /בחירת חבילה 00001/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחירת חבילה 00002/ }));
    expect(screen.getByText("נבחרו 2 חבילות")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "אישור החבילות שנבחרו" }));
    const modal = screen.getByRole("dialog", { name: "אישור קבלת חבילות" });
    expect(within(within(modal).getByRole("region", { name: "חבילה 00001" })).getAllByRole("listitem")).toHaveLength(3);
    expect(within(within(modal).getByRole("region", { name: "חבילה 00002" })).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת החבילות" }));
    await screen.findByText("קבלת 2 חבילות אושרה בהצלחה.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("finds a unit by number without confirming it, and guards repeated clicks", async () => {
    await ready(); await manual(" 1 ");
    await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    expect(confirmCalls()).toHaveLength(0);
    let release!: () => void;
    mocks.callApi.mockImplementationOnce(async (...args: Parameters<typeof fakeApi>) => { await new Promise<void>((resolve) => { release = resolve; }); return fakeApi(...args); });
    const button = screen.getByRole("button", { name: "אישור קבלת החבילה" });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toHaveProperty("disabled", true);
    await act(async () => release());
    await screen.findByRole("article", { name: "חבילה מאושרת 00001" });
    expect(confirmCalls()).toHaveLength(1);
  });

  it("opens the review from an uploaded unit label", async () => {
    mocks.decode.mockResolvedValue(`UNIT:${UNIT_1}`); await ready(); upload();
    const dialog = await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    expect(within(dialog).getByRole("region", { name: "חבילה 00001" })).toBeTruthy();
    expect(confirmCalls()).toHaveLength(0);
  });

  it("routes a camera scan to review", async () => {
    await ready(); fireEvent.click(screen.getByRole("button", { name: "סריקת קוד לאישור חבילה" }));
    fireEvent.click(screen.getByRole("button", { name: "קוד מהמצלמה" }));
    await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
  });

  it.each([["00009", "לא נמצאה חבילה זמינה"], ["6", "כבר אושרה"], ["bad", "עד חמש ספרות"], [" ", "עד חמש ספרות"]])("reports manual input %s", async (value, message) => {
    await ready(); await manual(value);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining(message));
    expect(screen.queryByRole("dialog", { name: "אישור קבלת חבילה" })).toBeNull();
  });

  it.each([["UNIT:aaaaaaaa-0000-4000-8000-000000000009", "לא נמצאה חבילה מתאימה"], ["UNIT:aaaaaaaa-0000-4000-8000-000000000006", "כבר אושרה"], ["PKG:A7F3K9M2", "הקוד אינו תקין"]])("reports scanned input %s", async (value, message) => {
    mocks.decode.mockResolvedValue(value); await ready(); upload();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining(message));
  });

  it("closes on Escape and discards the cancelled lookup", async () => {
    await ready();
    const trigger = screen.getByRole("button", { name: "אישור חבילה לפי מספר" }); trigger.focus();
    let resolve!: (value: ApiCallResult) => void;
    mocks.callApi.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await manual("1");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => resolve({ ok: true, data: structuredClone(server) }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the dialog open on save failure, then allows retry", async () => {
    await ready(); await manual("1");
    await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    mocks.callApi.mockResolvedValueOnce({ ok: false, message: "האישור לא נשמר." });
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת החבילה" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "האישור לא נשמר.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת החבילה" }));
    await screen.findByText("קבלת החבילה אושרה בהצלחה.");
  });

  it("shows recoverable loading errors and empty sections", async () => {
    server = { pending: [], confirmed: [] };
    mocks.callApi.mockResolvedValueOnce({ ok: false, message: "לא ניתן להתחבר לשרת." });
    render(<PickupPage groupId={GROUP} />);
    await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "ניסיון נוסף" }));
    await waitFor(() => expect(screen.getByText("אין כרגע חבילות שממתינות לאישור.")).toBeTruthy());
    expect(screen.getByText("עדיין לא אישרת חבילות.")).toBeTruthy();
  });
});
