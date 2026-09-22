import { qrTokenSchema } from "./types";
import { createCameraDecoder, type CameraDecoder } from "./qr";

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was denied. Allow camera access in your browser settings, then retry, or upload a QR image.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera is available. Connect a camera, upload a QR image, or enter the package number.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera could not start. Close other apps using it and retry.";
  return "Camera scanning failed. Retry, upload a QR image, or enter the package number.";
}

/** Owns every media track, including permission requests that finish after close. */
export class PackageCamera {
  private stopped = false;
  private stream?: MediaStream;
  private decoder?: CameraDecoder;
  private timer?: ReturnType<typeof setTimeout>;
  private lastInvalid = "";

  constructor(
    private video: HTMLVideoElement,
    private callbacks: { ready(): void; decoded(token: string): void; invalid(): void; error(error: unknown): void },
    private dependencies = {
      getStream: () => navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
      createDecoder: createCameraDecoder,
    },
  ) {}

  async start() {
    try {
      const stream = await this.dependencies.getStream();
      if (this.stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (this.stopped) return;
      const decoder = await this.dependencies.createDecoder();
      if (this.stopped) { decoder.dispose(); return; }
      this.decoder = decoder;
      this.callbacks.ready();
      await this.scan();
    } catch (error) {
      if (this.stopped) return;
      this.stop();
      this.callbacks.error(error);
    }
  }

  private async scan() {
    if (this.stopped) return;
    try {
      const value = this.video.readyState >= 2 ? await this.decoder?.decode(this.video) : null;
      if (this.stopped) return;
      if (value) {
        const parsed = qrTokenSchema.safeParse(value);
        if (parsed.success) {
          this.stop(); // Stop before lookup: the same visible QR can trigger only once.
          this.callbacks.decoded(parsed.data);
          return;
        }
        if (value !== this.lastInvalid) { this.lastInvalid = value; this.callbacks.invalid(); }
      }
      this.timer = setTimeout(() => void this.scan(), 180);
    } catch (error) {
      if (this.stopped) return;
      this.stop();
      this.callbacks.error(error);
    }
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video.srcObject = null;
    this.decoder?.dispose();
    this.decoder = undefined;
  }
}
