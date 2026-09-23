// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReceivingPage } from "./receiving-page";
import TransportPage from "@/app/(secure)/transport/page";
import { createMockTransportService } from "@/lib/transports/mock-service";
import collection from "@/lib/pickup/mock-collection.json";
import { TransportServiceError, emptyDeliveryFilters, type ReceivingSnapshot } from "@/lib/transports/types";

const mocks = vi.hoisted(() => ({ service: {} as ReturnType<typeof createMockTransportService> }));
vi.mock("@/lib/transports/service", () => ({ get transportService() { return mocks.service; } }));
beforeEach(() => {
  localStorage.clear();
  mocks.service = createMockTransportService({ storage: () => localStorage, source: async () => structuredClone(collection.packages), delayMs: 0 });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function ready() { render(<ReceivingPage />); await screen.findByRole("checkbox", { name: /בחירת הובלה TR-025/ }); }
function select(id: string) { fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`בחירת הובלה ${id}:`) })); }
function filter(label: string, value: string) {
  const input = screen.getByLabelText(label);
  if (input.getAttribute("type") === "date") fireEvent.input(input, { target: { value } });
  else fireEvent.change(input, { target: { value } });
}
function search() { fireEvent.submit(screen.getByRole("button", { name: "חיפוש" }).closest("form")!); }
async function review(...ids: string[]) {
  ids.forEach(select); fireEvent.click(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" }));
  return screen.findByRole("button", { name: "אישור קבלת ההובלות" });
}
describe("delivery receiving UI", () => {
  it("lists six pending before three confirmed with accessible selection and no other user's delivery", async () => {
    await ready(); expect(screen.getAllByRole("checkbox")).toHaveLength(6); expect(screen.getAllByRole("article")).toHaveLength(3);
    const sections = screen.getAllByRole("region");
    expect(sections[0].textContent).toContain("הובלות ממתינות"); expect(sections[1].textContent).toContain("הובלות מאושרות");
    expect(within(sections[1]).queryByRole("checkbox")).toBeNull(); expect(screen.queryByText("TR-033")).toBeNull();
    expect(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" })).toHaveProperty("disabled", true);
  });
  it.each([["תאריך מסירה", "2026-09-24", 2], ["מספר זיהוי הובלה", " tr-025 ", 1], ["מספר זיהוי חבילה", "100003", 1]])("filters by %s and leaves confirmed unchanged", async (label, value, count) => {
    await ready(); filter(label, value); search();
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(count));
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "ניקוי סינון" }));
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(6));
  });
  it("combines filters with AND and distinguishes no matches from no pending deliveries", async () => {
    await ready(); filter("תאריך מסירה", "2026-09-23"); filter("מספר זיהוי הובלה", "tr-02"); filter("מספר זיהוי חבילה", "100003"); search();
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(1));
    expect(screen.getByRole("checkbox", { name: /TR-026/ })).toBeTruthy();
    filter("תאריך מסירה", "2026-09-24"); search();
    await screen.findByText("לא נמצאו הובלות שתואמות לסינון שנבחר.");
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
  it("retains only visible selected deliveries and supports deselection", async () => {
    await ready(); select("TR-025"); select("TR-026");
    filter("מספר זיהוי חבילה", "100001"); search();
    await screen.findByText("נבחרו 1 הובלות");
    fireEvent.click(screen.getByRole("button", { name: "ניקוי סינון" }));
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(6));
    expect(screen.getByRole("checkbox", { name: /TR-026/ })).toHaveProperty("checked", false);
    select("TR-025"); expect(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" })).toHaveProperty("disabled", true);
  });
  it("keeps each package and expandable product list under the correct parent", async () => {
    await ready(); await review("TR-025", "TR-026");
    const modal = screen.getByRole("dialog", { name: "אישור קבלת הובלות" });
    const first = within(modal).getByRole("region", { name: "הובלה TR-025" });
    const second = within(modal).getByRole("region", { name: "הובלה TR-026" });
    expect(first.textContent).toContain("100001"); expect(first.textContent).toContain("100002"); expect(first.textContent).not.toContain("100003");
    expect(second.textContent).toContain("100003"); expect(second.textContent).toContain("100004");
    expect(first.textContent).toContain("9 פריטים · 3 סוגי מוצרים");
    fireEvent.click(within(first).getAllByText(/פירוט מוצרים וכמויות בחבילה/, { selector: "summary" })[0]);
    expect(first.textContent).toContain("מסך לדוגמה"); expect(first.textContent).toContain("כמות: 2");
  });
  it("confirms multiple deliveries immediately and restores confirmations on remount", async () => {
    await ready(); const button = await review("TR-025", "TR-026"); fireEvent.click(button);
    await screen.findByText("ההובלות אושרו בהצלחה.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(4); expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByText("נבחרו 0 הובלות")).toBeTruthy();
    cleanup(); render(<ReceivingPage />);
    await screen.findByRole("article", { name: "הובלה מאושרת TR-025" });
    expect(screen.queryByRole("checkbox", { name: /TR-025/ })).toBeNull();
  });
  it("guards single confirmation against repeated clicks and Escape until saving succeeds", async () => {
    await ready(); const button = await review("TR-025");
    const original = mocks.service.confirmDeliveriesForUser; let release!: () => void;
    const spy = vi.spyOn(mocks.service, "confirmDeliveriesForUser").mockImplementation(async (...args) => { await new Promise<void>((resolve) => { release = resolve; }); return original(...args); });
    fireEvent.click(button); fireEvent.click(button);
    expect(spy).toHaveBeenCalledTimes(1); expect(button).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "ביטול" })).toHaveProperty("disabled", true);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })); expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => release()); await screen.findByText("ההובלה אושרה בהצלחה.");
  });
  it("keeps failed confirmations open and pending, allowing retry", async () => {
    await ready(); const button = await review("TR-025");
    vi.spyOn(mocks.service, "confirmDeliveriesForUser").mockRejectedValueOnce(new TransportServiceError("אירעה שגיאה באישור ההובלה. נסו שוב."));
    fireEvent.click(button); await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeTruthy(); expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת ההובלות" })); await screen.findByText("ההובלה אושרה בהצלחה.");
  });
  it("announces missing details and prevents confirming an incomplete manifest", async () => {
    await ready(); vi.spyOn(mocks.service, "getDeliveryWithPackages").mockRejectedValue(new TransportServiceError("חסרים פרטי חבילה בהובלה TR-025."));
    select("TR-025"); fireEvent.click(screen.getByRole("button", { name: "אישור ההובלות שנבחרו" }));
    await screen.findByText("טוענים את פרטי ההובלות והחבילות…");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("חסרים פרטי חבילה"));
    expect(screen.queryByRole("button", { name: "אישור קבלת ההובלות" })).toBeNull();
  });
  it("cancels detail requests, closes with Escape and restores focus", async () => {
    await ready(); let resolve!: (value: Awaited<ReturnType<typeof mocks.service.getDeliveryWithPackages>>) => void;
    const result = await mocks.service.getDeliveryWithPackages("user-001", "TR-025");
    vi.spyOn(mocks.service, "getDeliveryWithPackages").mockImplementation(() => new Promise((done) => { resolve = done; }));
    select("TR-025"); const trigger = screen.getByRole("button", { name: "אישור ההובלות שנבחרו" }); trigger.focus(); fireEvent.click(trigger);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
    await act(async () => resolve(result)); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not let a stale filter response replace a newer clear action", async () => {
    await ready(); const original = mocks.service.searchDeliveriesForUser; let resolve!: (value: ReceivingSnapshot) => void;
    vi.spyOn(mocks.service, "searchDeliveriesForUser").mockImplementation((user, filters) => filters.deliveryNumber === "slow" ? new Promise((done) => { resolve = done; }) : original(user, filters));
    filter("מספר זיהוי הובלה", "slow"); search(); await waitFor(() => expect(resolve).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button", { name: "ניקוי סינון" })); await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(6));
    await act(async () => resolve({ pending: [], confirmed: [], pendingTotal: 6 })); expect(screen.getAllByRole("checkbox")).toHaveLength(6);
  });
  it("shows recoverable load errors and separate empty states", async () => {
    vi.spyOn(mocks.service, "searchDeliveriesForUser").mockRejectedValueOnce(new TransportServiceError("שגיאת טעינה")).mockResolvedValue({ pending: [], confirmed: [], pendingTotal: 0 });
    render(<ReceivingPage />); expect(screen.getAllByRole("status")).toHaveLength(2);
    await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "ניסיון נוסף" }));
    await screen.findByText("אין כרגע הובלות שממתינות לאישור."); expect(screen.getByText("עדיין לא אושרו הובלות.")).toBeTruthy();
  });
  it("reflects an arrival in transportation and a receipt confirmation back in transportation", async () => {
    render(<TransportPage />);
    const open = await screen.findByRole("button", { name: "פתיחת הובלת ציוד משרדי לדוגמה" }); fireEvent.click(open);
    fireEvent.change(screen.getByLabelText("מצב נוכחי"), { target: { value: "arrived" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירת מצב ופרטי רכב" }));
    await screen.findByText("ממתינה לאישור קבלה");
    cleanup(); render(<ReceivingPage />); await screen.findByRole("checkbox", { name: /TR-023/ });
    const button = await review("TR-023"); fireEvent.click(button); await screen.findByText("ההובלה אושרה בהצלחה.");
    cleanup(); render(<TransportPage />);
    fireEvent.click(await screen.findByRole("button", { name: "פתיחת הובלת ציוד משרדי לדוגמה" }));
    expect(await screen.findByText("התקבלה ואושרה")).toBeTruthy();
    expect((await mocks.service.searchDeliveriesForUser("user-001", emptyDeliveryFilters)).pending).toHaveLength(6);
  });
});
