// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CameraPreview } from "./camera-preview";

const mocks = vi.hoisted(() => ({ stop: vi.fn(), start: vi.fn() }));
vi.mock("@/lib/packages/camera", () => ({
  PackageCamera: class { start = mocks.start; stop = mocks.stop; },
  cameraErrorMessage: () => "Camera error",
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("camera preview lifecycle", () => {
  it("stops the camera on unmount, including route navigation", () => {
    const { unmount } = render(<CameraPreview onDecoded={vi.fn()} onError={vi.fn()} onClose={vi.fn()} />);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    unmount(); expect(mocks.stop).toHaveBeenCalledTimes(1);
  });
  it("closes when the page is hidden and removes listeners on unmount", () => {
    const close = vi.fn();
    const { unmount } = render(<CameraPreview onDecoded={vi.fn()} onError={vi.fn()} onClose={close} />);
    window.dispatchEvent(new Event("pagehide"));
    expect(close).toHaveBeenCalledTimes(1);
    unmount(); window.dispatchEvent(new Event("pagehide"));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
