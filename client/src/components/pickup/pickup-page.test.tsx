// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PickupPage } from "./pickup-page";
import { createMockCollectionService } from "@/lib/pickup/mock-service";
import { PackageServiceError } from "@/lib/packages/types";

const mocks = vi.hoisted(() => ({ service: {} as ReturnType<typeof createMockCollectionService>, decode: vi.fn(), cameraClose: vi.fn() }));
vi.mock("@/lib/pickup/service", () => ({ get collectionService() { return mocks.service; } }));
vi.mock("@/lib/packages/barcode", () => ({ decodeLabelImage: mocks.decode }));
vi.mock("@/components/packages/camera-preview", () => ({ CameraPreview: ({ onDecoded }: { onDecoded(value: string): void }) => <button onClick={() => onDecoded("7290001000010")}>קוד מהמצלמה</button> }));

beforeEach(() => {
  localStorage.clear();
  mocks.service = createMockCollectionService({ storage: () => localStorage, source: async () => [], delayMs: 0 });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
async function ready() { render(<PickupPage />); await screen.findByRole("checkbox", { name: /בחירת חבילה 100001/ }); }
async function manual(number: string) {
  fireEvent.click(screen.getByRole("button", { name: "אישור חבילה לפי מספר" }));
  fireEvent.change(screen.getByLabelText("מספר חבילה ייחודי"), { target: { value: number } });
  fireEvent.submit(screen.getByRole("button", { name: "המשך לאישור" }).closest("form")!);
}
describe("Hebrew pickup workflows", () => {
  it("wraps keyboard focus inside the modal in both directions", async () => {
    await ready(); await manual("100001");
    const dialog = await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    const cancel = within(dialog).getByRole("button", { name: "ביטול" });
    const confirm = within(dialog).getByRole("button", { name: "אישור קבלת החבילה" });
    confirm.focus(); fireEvent.keyDown(confirm, { key: "Tab" }); expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(confirm);
  });
  it("shows pending before confirmed and never shows other users' records", async () => {
    await ready();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("100008")).toBeNull();
    expect(screen.getByRole("button", { name: "אישור החבילות שנבחרו" })).toHaveProperty("disabled", true);
    const sections = screen.getAllByRole("region");
    expect(sections[0].textContent).toContain("חבילות שממתינות לאישור");
    expect(sections[1].textContent).toContain("חבילות מאושרות");
    expect(within(sections[1]).queryByRole("checkbox")).toBeNull();
  });
  it("groups every product in a batch, deselects and persists confirmations across remount", async () => {
    await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: /בחירת חבילה 100001/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחירת חבילה 100002/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחירת חבילה 100003/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחירת חבילה 100003/ }));
    expect(screen.getByText("נבחרו 2 חבילות")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "אישור החבילות שנבחרו" }));
    const modal = screen.getByRole("dialog", { name: "אישור קבלת חבילות" });
    const first = within(modal).getByRole("region", { name: "חבילה 100001" });
    const second = within(modal).getByRole("region", { name: "חבילה 100002" });
    expect(within(first).getAllByRole("listitem")).toHaveLength(3);
    expect(within(second).getAllByRole("listitem")).toHaveLength(2);
    expect(within(first).getByText("כמות: 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת החבילות" }));
    await screen.findByText("קבלת 2 חבילות אושרה בהצלחה.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText("נבחרו 0 חבילות")).toBeTruthy();
    cleanup(); render(<PickupPage />);
    await screen.findByRole("article", { name: "חבילה מאושרת 100001" });
    expect(screen.queryByRole("checkbox", { name: /בחירת חבילה 100001/ })).toBeNull();
  });
  it("manually identifies one package, does not auto-confirm, guards repeated clicks", async () => {
    await ready(); await manual(" 100001 ");
    await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    const original = mocks.service.confirmPackagesForUser;
    let release!: () => void;
    const spy = vi.spyOn(mocks.service, "confirmPackagesForUser").mockImplementation(async (...args) => {
      await new Promise<void>((resolve) => { release = resolve; }); return original(...args);
    });
    expect(await mocks.service.getPendingPackagesForUser("user-001")).toHaveLength(5);
    const button = screen.getByRole("button", { name: "אישור קבלת החבילה" });
    fireEvent.click(button); fireEvent.click(button);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(button).toHaveProperty("disabled", true);
    await act(async () => release());
    await screen.findByRole("article", { name: "חבילה מאושרת 100001" });
  });
  it.each(["PKG:A7F3K9M2", "7290001000010"])("opens the same review after decoding %s", async (value) => {
    mocks.decode.mockResolvedValue(value); await ready();
    fireEvent.click(screen.getByRole("button", { name: "סריקת קוד לאישור חבילה" }));
    fireEvent.change(screen.getByLabelText("העלאת תמונת קוד"), { target: { files: [new File(["image"], "label.png", { type: "image/png" })] } });
    const dialog = await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    expect(within(dialog).getByRole("region", { name: "חבילה 100001" })).toBeTruthy();
    expect(await mocks.service.getPendingPackagesForUser("user-001")).toHaveLength(5);
  });
  it("routes a camera barcode to review without saving", async () => {
    await ready(); fireEvent.click(screen.getByRole("button", { name: "סריקת קוד לאישור חבילה" }));
    fireEvent.click(screen.getByRole("button", { name: "קוד מהמצלמה" }));
    await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    expect(await mocks.service.getConfirmedPackagesForUser("user-001")).toHaveLength(2);
  });
  it.each([["100008", "לא נמצאה חבילה זמינה"], ["999999", "לא נמצאה חבילה זמינה"], ["100006", "כבר אושרה"], ["bad", "שש ספרות"], [" ", "שש ספרות"]])("reports manual input %s", async (value, message) => {
    await ready(); await manual(value);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining(message));
    expect(screen.queryByRole("dialog", { name: "אישור קבלת חבילה" })).toBeNull();
  });
  it.each([["PKG:UNKNOWN1", "לא נמצאה חבילה מתאימה"], ["PKG:H6N2S8U4", "לא נמצאה חבילה מתאימה"], ["PKG:F4L8Q6S2", "כבר אושרה"], ["https://example.test", "הקוד אינו תקין"]])("reports scanned input %s", async (value, message) => {
    mocks.decode.mockResolvedValue(value); await ready();
    fireEvent.click(screen.getByRole("button", { name: "סריקת קוד לאישור חבילה" }));
    fireEvent.change(screen.getByLabelText("העלאת תמונת קוד"), { target: { files: [new File(["image"], "label.png", { type: "image/png" })] } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining(message));
  });
  it("closes on Escape, restores focus and discards cancelled lookup results", async () => {
    await ready();
    const trigger = screen.getByRole("button", { name: "אישור חבילה לפי מספר" }); trigger.focus();
    let resolve!: (value: null) => void;
    vi.spyOn(mocks.service, "findPackageForUserByPackageNumber").mockImplementation(() => new Promise((done) => { resolve = done; }));
    await manual("100001");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => resolve(null));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("keeps the dialog open and package pending on save failure, then allows retry", async () => {
    await ready(); await manual("100001");
    await screen.findByRole("dialog", { name: "אישור קבלת חבילה" });
    vi.spyOn(mocks.service, "confirmPackagesForUser").mockRejectedValueOnce(new PackageServiceError("האישור לא נשמר."));
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת החבילה" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "האישור לא נשמר.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "אישור קבלת החבילה" }));
    await screen.findByText("קבלת החבילה אושרה בהצלחה.");
  });
  it("shows recoverable loading errors and empty sections", async () => {
    vi.spyOn(mocks.service, "getPackagesForUser").mockRejectedValueOnce(new PackageServiceError("השירות אינו זמין")).mockResolvedValue({ pending: [], confirmed: [] });
    render(<PickupPage />);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "ניסיון נוסף" }));
    await waitFor(() => expect(screen.getByText("אין כרגע חבילות שממתינות לאישור.")).toBeTruthy());
    expect(screen.getByText("עדיין לא אישרת חבילות.")).toBeTruthy();
  });
});
