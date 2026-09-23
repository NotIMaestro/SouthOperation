// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScanPackage } from "./scan-package";
import { PackageServiceError, type PackageRecord } from "@/lib/packages/types";

const service = vi.hoisted(() => ({ findPackageByQrToken: vi.fn(), findPackageByPackageNumber: vi.fn() }));
const decode = vi.hoisted(() => vi.fn());
vi.mock("@/lib/packages/service", () => service);
vi.mock("@/lib/packages/qr", () => ({ decodeQrImage: decode }));
const record: PackageRecord = {
  id: "test", packageNumber: "800001", qrToken: "PKG:TEST0001", description: "Demo test kit",
  origin: "Fictional A", destination: "Fictional B", responsiblePerson: "Demo Keeper", status: "IN_TRANSIT",
  contents: ["Sample item"], createdAt: "2026-09-20T08:30:00Z", updatedAt: "2026-09-21T11:15:00Z",
};
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function submit(value: string) {
  fireEvent.change(screen.getByLabelText("מספר חבילה"), { target: { value } });
  fireEvent.submit(screen.getByRole("button", { name: "חיפוש" }).closest("form")!);
}
function upload() {
  fireEvent.change(screen.getByLabelText("העלאת תמונת QR"), { target: { files: [new File(["image"], "demo.png", { type: "image/png" })] } });
}
describe("package lookup UI", () => {
  it("trims manual entry and displays the result using form submission", async () => {
    service.findPackageByPackageNumber.mockResolvedValue(record);
    render(<ScanPackage />); submit(" 800001 ");
    expect(service.findPackageByPackageNumber).toHaveBeenCalledWith("800001");
    expect(await screen.findByRole("article", { name: "חבילה 800001" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "הזנת מספר נוסף" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("מספר חבילה"));
  });
  it("rejects manual invalid input before calling the service", async () => {
    render(<ScanPackage />); submit("invalid");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("שש ספרות"));
    expect(service.findPackageByPackageNumber).not.toHaveBeenCalled();
  });
  it("handles a valid unknown token after image decoding", async () => {
    decode.mockResolvedValue("PKG:UNKNOWN1"); service.findPackageByQrToken.mockResolvedValue(null);
    render(<ScanPackage />); upload();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("לא נמצאה חבילה"));
    expect(service.findPackageByQrToken).toHaveBeenCalledWith("PKG:UNKNOWN1");
  });
  it("does not look up an invalid decoded QR payload", async () => {
    decode.mockResolvedValue("https://example.test/untrusted"); render(<ScanPackage />); upload();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("PKG:"));
    expect(service.findPackageByQrToken).not.toHaveBeenCalled();
  });
  it("shows the same information through the QR route", async () => {
    decode.mockResolvedValue(record.qrToken); service.findPackageByQrToken.mockResolvedValue(record);
    render(<ScanPackage />); upload();
    expect(await screen.findByRole("article", { name: "חבילה 800001" })).toHaveProperty("textContent", expect.stringContaining("Demo test kit"));
  });
  it("disables lookup controls while pending and reports service-style failures", async () => {
    let fail!: (cause: Error) => void;
    service.findPackageByPackageNumber.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
    render(<ScanPackage />); submit("800001");
    expect(screen.getByRole("button", { name: "מחפשים…" })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("מספר חבילה")).toHaveProperty("disabled", true);
    fail(new PackageServiceError("Demo storage unavailable"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Demo storage unavailable");
    await waitFor(() => expect(screen.getByRole("button", { name: "חיפוש" })).toHaveProperty("disabled", false));
  });
  it("explains image decoding failures", async () => {
    decode.mockRejectedValue(new Error("No readable QR code was found.")); render(<ScanPackage />); upload();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "No readable QR code was found.");
  });
});
