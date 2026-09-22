import { afterEach, describe, expect, it, vi } from "vitest";
import { PackageCamera, cameraErrorMessage } from "./camera";

function setup(values: Array<string | null> = [null]) {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const video = { srcObject: null, readyState: 4, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement;
  const decoder = { decode: vi.fn(async () => values.shift() ?? null), dispose: vi.fn() };
  const dependencies = { getStream: vi.fn(async () => stream), createDecoder: vi.fn(async () => decoder) };
  const callbacks = { ready: vi.fn(), decoded: vi.fn(), invalid: vi.fn(), error: vi.fn() };
  const camera = new PackageCamera(video, callbacks, dependencies);
  return { stop, stream, video, decoder, dependencies, callbacks, camera };
}
afterEach(() => vi.useRealTimers());

describe("camera lifetime", () => {
  it("stops every track and decoder when closed or unmounted", async () => {
    vi.useFakeTimers();
    const { camera, video, stop, decoder } = setup();
    await camera.start(); camera.stop(); camera.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(decoder.dispose).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(decoder.decode).toHaveBeenCalledTimes(1);
  });
  it("cleans up a permission request granted after close", async () => {
    const { camera, dependencies, stream, stop, video, callbacks } = setup();
    let grant!: (stream: MediaStream) => void;
    dependencies.getStream.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    const starting = camera.start(); camera.stop(); grant(stream); await starting;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(callbacks.ready).not.toHaveBeenCalled();
  });
  it("stops before a valid token callback and does not process duplicates", async () => {
    vi.useFakeTimers();
    const { camera, callbacks, stop, decoder } = setup(["PKG:A7F3K9M2", "PKG:A7F3K9M2"]);
    callbacks.decoded.mockImplementation(() => expect(stop).toHaveBeenCalled());
    await camera.start(); await vi.advanceTimersByTimeAsync(1000);
    expect(callbacks.decoded).toHaveBeenCalledExactlyOnceWith("PKG:A7F3K9M2");
    expect(decoder.decode).toHaveBeenCalledTimes(1);
  });
  it("continues past invalid QR values without repeated invalid notifications", async () => {
    vi.useFakeTimers();
    const { camera, callbacks } = setup(["https://example.test", "https://example.test", "PKG:A7F3K9M2"]);
    await camera.start(); await vi.advanceTimersByTimeAsync(400);
    expect(callbacks.invalid).toHaveBeenCalledTimes(1);
    expect(callbacks.decoded).toHaveBeenCalledTimes(1);
  });
  it("does not deliver a decode that completes after navigation", async () => {
    const { camera, decoder, callbacks, stop } = setup();
    let finish!: (value: string) => void;
    decoder.decode.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const starting = camera.start();
    await vi.waitFor(() => expect(decoder.decode).toHaveBeenCalled());
    camera.stop(); finish("PKG:A7F3K9M2"); await starting;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(callbacks.decoded).not.toHaveBeenCalled();
  });
  it("releases tracks when playback or decoding fails", async () => {
    const { camera, video, stop, callbacks } = setup();
    vi.mocked(video.play).mockRejectedValue(new Error("playback failed"));
    await camera.start();
    expect(stop).toHaveBeenCalled(); expect(callbacks.error).toHaveBeenCalled();
  });
  it.each([["NotAllowedError", "permission was denied"], ["NotFoundError", "No camera"], ["NotReadableError", "Close other apps"]])("explains %s", (name, message) => {
    const error = new Error(); error.name = name;
    expect(cameraErrorMessage(error)).toContain(message);
  });
});
