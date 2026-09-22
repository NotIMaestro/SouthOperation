import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { createLabelDecoder } from "./barcode";

describe("real label pixel decoding", () => {
  it("decodes a generated package QR image", async () => {
    const qr = QRCode.create("PKG:A7F3K9M2");
    const size = (qr.modules.size + 8) * 6;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 6) - 4, column = Math.floor(x / 6) - 4;
      if (row >= 0 && column >= 0 && row < qr.modules.size && column < qr.modules.size && qr.modules.get(row, column)) {
        const i = (y * size + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
    const decoder = await createLabelDecoder();
    expect(decoder.decodePixels(pixels, size, size)).toBe("PKG:A7F3K9M2"); decoder.dispose();
  });
  it("decodes a Code 128 B label with checksum and quiet zones", async () => {
    // Fixed standard module widths for 7290001000010, start B, checksum 72, stop.
    const widths = ["211214", "312131", "223211", "321122", "123122", "123122", "123122", "123221", "123122", "123122", "123122", "123122", "123221", "123122", "122411", "2331112"].join("").split("").map(Number);
    const width = (widths.reduce((sum, n) => sum + n, 0) + 40) * 3, height = 180;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    let left = 60;
    widths.forEach((n, index) => {
      if (index % 2 === 0) for (let x = left; x < left + n * 3; x++) for (let y = 20; y < 160; y++) {
        const i = (y * width + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
      left += n * 3;
    });
    const decoder = await createLabelDecoder();
    expect(decoder.decodePixels(pixels, width, height)).toBe("7290001000010"); decoder.dispose();
  });
  it("returns no code for a blank image", async () => {
    const decoder = await createLabelDecoder();
    expect(decoder.decodePixels(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100)).toBeNull(); decoder.dispose();
  });
});
