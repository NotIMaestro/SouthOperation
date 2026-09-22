import { createCameraDecoder, type CameraDecoder } from "./qr";

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "הרשאת הגישה למצלמה נדחתה. אפשרו גישה בהגדרות הדפדפן ונסו שוב, או העלו תמונת QR.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "לא נמצאה מצלמה זמינה. חברו מצלמה, העלו תמונת QR או הזינו את המזהה.";
  if (name === "NotReadableError" || name === "AbortError") return "לא ניתן להפעיל את המצלמה. סגרו יישומים אחרים המשתמשים בה ונסו שוב.";
  return "הסריקה באמצעות המצלמה נכשלה. נסו שוב, העלו תמונת QR או הזינו את המזהה.";
}

/** Owns every media track, including permission requests that finish after close. */
export class QrCamera {
  private stopped = false;
  private stream?: MediaStream;
  private decoder?: CameraDecoder;
  private timer?: ReturnType<typeof setTimeout>;
  private lastInvalid = "";

  constructor(
    private video: HTMLVideoElement,
    private callbacks: { ready(): void; decoded(value: string): void; invalid(): void; error(error: unknown): void },
    private isValid: (value: string) => boolean = () => true,
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
        if (this.isValid(value)) {
          this.stop(); // Stop before lookup: the same visible QR can trigger only once.
          this.callbacks.decoded(value);
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
