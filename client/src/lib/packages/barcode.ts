import type { CameraDecoder } from "./qr";

/** Decode pixels only; PackageCamera remains the sole owner of camera tracks. */
export async function createLabelDecoder() {
  const { QRCodeReader, Code128Reader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer, NotFoundException, ChecksumException, FormatException } = await import("@zxing/library");
  const readers = [new QRCodeReader(), new Code128Reader()];
  return {
    decodePixels(pixels: Uint8ClampedArray, width: number, height: number): string | null {
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < gray.length; i++) gray[i] = (pixels[i * 4] + 2 * pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 4;
      const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height)));
      for (const reader of readers) {
        try { return reader.decode(bitmap).getText(); }
        catch (error) {
          if (!(error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException)) throw error;
        }
      }
      return null;
    },
    dispose() { readers.forEach((reader) => reader.reset()); },
  };
}

export async function createCollectionCameraDecoder(): Promise<CameraDecoder> {
  const decoder = await createLabelDecoder();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) { decoder.dispose(); throw new Error("לא ניתן לאתחל את סורק הקודים בדפדפן."); }
  return {
    async decode(video) {
      if (!video.videoWidth || !video.videoHeight) return null;
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return decoder.decodePixels(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    },
    dispose() { decoder.dispose(); canvas.width = canvas.height = 0; },
  };
}

export async function decodeLabelImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("בחרו תמונת קוד מסוג PNG, JPEG או WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("בחרו תמונה שגודלה קטן מ־10 מגה־בייט.");
  const url = URL.createObjectURL(file);
  const decoder = await createLabelDecoder().catch(() => {
    URL.revokeObjectURL(url);
    throw new Error("לא ניתן להפעיל את סורק התמונות. נסו שוב או הזינו מספר חבילה.");
  });
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error("Image too large");
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const value = decoder.decodePixels(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (!value) throw new Error("No code found");
    return value;
  } catch { throw new Error("לא נמצא קוד קריא. העלו תמונה ברורה של קוד QR או ברקוד בשלמותו."); }
  finally { decoder.dispose(); URL.revokeObjectURL(url); }
}
