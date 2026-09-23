// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiCallResult } from "@/lib/api-client";
import type { ArrivedUnit, Delivery, ReceivingSnapshot } from "@/lib/transports/types";

import { ReceivingPage } from "./receiving-page";

const GROUP = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ callApi: mocks.callApi }));

function unit(id: string, unitNumber: string, transportId: string, items: [string, number][]): ArrivedUnit {
  return {
    id, unitNumber, unitType: "professional_carton", roomName: "חדר 12", destinationBuilding: "בניין 2", destinationFloor: null,
    destinationRoom: "214", transportId, transportNumber: transportId.toUpperCase(), receivedAt: null, collectedAt: null,
    items: items.map(([name, quantity], index) => ({ id: `${id}-${index}`, name, quantity })),
  };
}
function delivery(id: string, arrivedAt: string, units: ArrivedUnit[], receivedAt: string | null = null): Delivery {
  return {
    id, transportNumber: id.toUpperCase(), sourceCity: "תל אביב", sourceUnit: "מחסן", destinationCity: "באר שבע", destinationUnit: "מרכז",
    destinationBuilding: "בניין 2", destinationRoom: "214", packageCount: units.length || 3, packageSummary: "ציוד משרדי",
    vehicleType: "משאית", vehicleNumber: "12-345-67", arrivedAt, receivedAt, units,
  };
}

let server: ReceivingSnapshot;
function seed() {
  server = {
    pending: [
      delivery("tr-025", "2026-09-22T09:00:00Z", [unit("u1", "00001", "tr-025", [["מסך", 2], ["מקלדת", 3], ["עכבר", 4]]), unit("u2", "00002", "tr-025", [["כיסא", 1]])]),
      delivery("tr-026", "2026-09-23T09:00:00Z", [unit("u3", "00003", "tr-026", [["שולחן", 1]])]),
      delivery("tr-027", "2026-09-23T10:00:00Z", []),
    ],
    confirmed: [delivery("tr-020", "2026-09-20T09:00:00Z", [], "2026-09-21T08:00:00Z")],
  };
}
/** In-memory stand-in for GET/POST /api/v1/groups/:groupId/receiving. */
async function fakeApi(url: string, { method = "POST", body }: { method?: string; body?: { transportIds: string[] } } = {}): Promise<ApiCallResult> {
  expect(url).toBe(`/api/v1/groups/${GROUP}/receiving`);
  if (method === "GET") return { ok: true, data: structuredClone(server) };
  const ids = body!.transportIds;
  if (!ids.every((id) => server.pending.some((entry) => entry.id === id))) return { ok: false, message: "אחת ההובלות כבר אושרה או אינה זמינה לאישור. רעננו את הרשימה." };
  const now = new Date().toISOString();
  server.confirmed.unshift(...server.pending.filter((entry) => ids.includes(entry.id)).map((entry) => ({ ...entry, receivedAt: now })));
  server.pending = server.pending.filter((entry) => !ids.includes(entry.id));
  return { ok: true, data: structuredClone(server) };
}

beforeEach(() => {
  seed();
  mocks.callApi.mockImplementation(fakeApi);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function ready() { render(<ReceivingPage groupId={GROUP} />); await screen.findByRole("checkbox", { name: /בחירת הובלה TR-025/ }); }
function select(number: string) { fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`בחירת הובלה ${number}:`) })); }
function filter(label: string, value: string) {
  const input = screen.getByLabelText(label);
  if (input.getAttribute("type") === "date") fireEvent.input(input, { target: { value } });
  else fireEvent.change(input, { target: { value } });
}
function search() { fireEvent.submit(screen.getByRole("button", { name: "חיפוש" }).closest("form")!); }
async function review(...numbers: string[]) {
  numbers.forEach(select); fireEvent.click(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" }));
  return screen.findByRole("button", { name: "אישור קבלת ההובלות" });
}

describe("delivery receiving", () => {
  it("lists pending before confirmed deliveries of the group", async () => {
    await ready();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const sections = screen.getAllByRole("region");
    expect(sections[0].textContent).toContain("הובלות ממתינות");
    expect(within(sections[1]).queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" })).toHaveProperty("disabled", true);
  });

  it.each([["תאריך מסירה", "2026-09-23", 2], ["מספר זיהוי הובלה", " tr-025 ", 1], ["מספר יחידת אריזה", "00003", 1]])("filters by %s", async (label, value, count) => {
    await ready(); filter(label, value); search();
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(count));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "ניקוי סינון" }));
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(3));
  });

  it("distinguishes no filter matches from no pending deliveries", async () => {
    await ready(); filter("מספר זיהוי הובלה", "TR-999"); search();
    await screen.findByText("לא נמצאו הובלות שתואמות לסינון שנבחר.");
  });

  it("reviews each unit and its items under the correct delivery", async () => {
    await ready(); await review("TR-025", "TR-027");
    const modal = screen.getByRole("dialog", { name: "אישור קבלת הובלות" });
    const first = within(modal).getByRole("region", { name: "הובלה TR-025" });
    expect(first.textContent).toContain("00001"); expect(first.textContent).toContain("00002");
    expect(first.textContent).toContain("9 פריטים · 3 סוגי פריטים");
    expect(first.textContent).toContain("כמות: 4");
    const empty = within(modal).getByRole("region", { name: "הובלה TR-027" });
    expect(empty.textContent).toContain("לא שויכו יחידות אריזה להובלה זו.");
  });

  it("confirms several deliveries at once", async () => {
    await ready(); fireEvent.click(await review("TR-025", "TR-026"));
    await screen.findByText("ההובלות אושרו בהצלחה.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.callApi).toHaveBeenCalledWith(`/api/v1/groups/${GROUP}/receiving`, { body: { transportIds: ["tr-025", "tr-026"] } });
  });

  it("sends one confirmation despite repeated clicks and blocks Escape while saving", async () => {
    await ready(); const button = await review("TR-025");
    let release!: () => void;
    mocks.callApi.mockImplementationOnce(async (...args: Parameters<typeof fakeApi>) => { await new Promise<void>((resolve) => { release = resolve; }); return fakeApi(...args); });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toHaveProperty("disabled", true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => release());
    await screen.findByText("ההובלה אושרה בהצלחה.");
    expect(mocks.callApi.mock.calls.filter(([, options]) => options?.body)).toHaveLength(1);
  });

  it("keeps a failed confirmation open and allows retry", async () => {
    await ready(); const button = await review("TR-025");
    mocks.callApi.mockResolvedValueOnce({ ok: false, message: "הפעולה נכשלה." });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "הפעולה נכשלה.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת ההובלות" }));
    await screen.findByText("ההובלה אושרה בהצלחה.");
  });

  it("refuses to review a delivery someone else confirmed meanwhile", async () => {
    await ready();
    server.confirmed.unshift({ ...server.pending[0], receivedAt: new Date().toISOString() });
    server.pending.shift();
    select("TR-025"); fireEvent.click(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("כבר אושרה"));
    expect(screen.queryByRole("button", { name: "אישור קבלת ההובלות" })).toBeNull();
  });

  it("shows recoverable load errors and separate empty states", async () => {
    server = { pending: [], confirmed: [] };
    mocks.callApi.mockResolvedValueOnce({ ok: false, message: "לא ניתן להתחבר לשרת." });
    render(<ReceivingPage groupId={GROUP} />);
    await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "ניסיון נוסף" }));
    await screen.findByText("אין כרגע הובלות שממתינות לאישור.");
    expect(screen.getByText("עדיין לא אושרו הובלות.")).toBeTruthy();
  });
});
