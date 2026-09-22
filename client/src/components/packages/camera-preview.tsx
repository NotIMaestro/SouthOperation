"use client";

import { useEffect, useRef, useState } from "react";
import { PackageCamera, cameraErrorMessage } from "@/lib/packages/camera";

export function CameraPreview({ onDecoded, onError, onClose }: {
  onDecoded(token: string): void; onError(message: string): void; onClose(): void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("Camera is starting. Allow access when your browser asks.");
  useEffect(() => {
    const camera = new PackageCamera(video.current!, {
      ready() { setReady(true); setHint("Point the camera at a package QR code."); },
      decoded: onDecoded,
      invalid() { setHint("Invalid QR format. Use a package label containing PKG: followed by its token. Keep scanning or enter a number below."); },
      error(error) { onError(cameraErrorMessage(error)); },
    });
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
  }, [onClose, onDecoded, onError]);
  return (
    <div className="camera-preview">
      <video ref={video} muted playsInline aria-label="Live rear camera preview" />
      <p role="status">{ready ? "Camera active · " : ""}{hint}</p>
    </div>
  );
}
