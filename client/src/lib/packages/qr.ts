import { qrTokenSchema } from "./types";

export async function generateQrPng(token: string): Promise<string> {
  const value = qrTokenSchema.parse(token);
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(value, { width: 640, margin: 4, errorCorrectionLevel: "M" });
}

export async function decodeQrImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("בחרו תמונת QR מסוג PNG, JPEG או WebP.");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("בחרו תמונה שגודלה קטן מ־10 מגה־בייט.");
  try {
    const { default: QrScanner } = await import("qr-scanner");
    const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
    return result.data;
  } catch {
    throw new Error("לא נמצא קוד QR קריא. העלו תמונה ברורה של התווית בשלמותה.");
  }
}

export interface CameraDecoder {
  decode(video: HTMLVideoElement): Promise<string | null>;
  dispose(): void;
}

export async function createCameraDecoder(): Promise<CameraDecoder> {
  const { default: QrScanner } = await import("qr-scanner");
  const engine = await QrScanner.createQrEngine();
  const canvas = document.createElement("canvas");
  return {
    async decode(video) {
      try {
        return (await QrScanner.scanImage(video, {
          qrEngine: engine, canvas, returnDetailedScanResult: true,
          scanRegion: { downScaledWidth: 720, downScaledHeight: 720 },
        })).data;
      } catch (error) {
        if (error === QrScanner.NO_QR_CODE_FOUND) return null;
        throw error;
      }
    },
    dispose() { if (engine instanceof Worker) engine.terminate(); },
  };
}
