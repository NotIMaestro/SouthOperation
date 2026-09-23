"use client";

import { useEffect, useRef, useState } from "react";
import { PackageCamera, cameraErrorMessage } from "@/lib/packages/camera";
import { createCollectionCameraDecoder } from "@/lib/packages/barcode";
import { scannedValueSchema } from "@/lib/pickup/types";

export function CameraPreview({ onDecoded, onError, onClose, collection = false }: {
  onDecoded(token: string): void; onError(message: string): void; onClose(): void;
  collection?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("המצלמה מופעלת. אשרו גישה כאשר הדפדפן מבקש זאת.");
  useEffect(() => {
    const camera = new PackageCamera(video.current!, {
      ready() { setReady(true); setHint(collection ? "כוונו את המצלמה לקוד QR או לברקוד שעל החבילה." : "כוונו את המצלמה לקוד ה־QR שעל החבילה."); },
      decoded: onDecoded,
      invalid() { setHint(collection ? "הקוד אינו תקין. סרקו תווית חבילה או הזינו מספר חבילה." : "פורמט ה־QR אינו תקין. השתמשו בתווית חבילה המכילה את הקידומת PKG: ואחריה מזהה. המשיכו לסרוק או הזינו מספר למטה."); },
      error(error) { onError(cameraErrorMessage(error)); },
    }, collection ? {
      getStream: () => {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Camera unavailable", "NotSupportedError");
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      },
      createDecoder: createCollectionCameraDecoder,
    } : undefined, collection ? (value) => scannedValueSchema.safeParse(value) : undefined);
    const close = () => { camera.stop(); onClose(); };
    const visibility = () => { if (document.hidden) close(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", close);
    void camera.start();
    return () => {
      camera.stop();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", close);
    };
  }, [collection, onClose, onDecoded, onError]);
  return (
    <div className="camera-preview">
      <video ref={video} muted playsInline aria-label="תצוגה חיה מהמצלמה האחורית" />
      <p role="status">{ready ? "המצלמה פעילה · " : ""}{hint}</p>
    </div>
  );
}
