"use client";

import { useEffect, useRef, useState } from "react";
import { QrCamera, cameraErrorMessage } from "@/lib/camera";

export function CameraPreview({ onDecoded, onError, onClose, isValid }: {
  onDecoded(value: string): void; onError(message: string): void; onClose(): void; isValid?(value: string): boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("המצלמה מופעלת. אשרו גישה כאשר הדפדפן מבקש זאת.");
  useEffect(() => {
    const camera = new QrCamera(video.current!, {
      ready() { setReady(true); setHint("כוונו את המצלמה לקוד ה־QR שעל תווית היחידה."); },
      decoded: onDecoded,
      invalid() { setHint("קוד ה־QR שנסרק אינו תווית יחידת אריזה תקינה. המשיכו לסרוק."); },
      error(error) { onError(cameraErrorMessage(error)); },
    }, isValid);
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
  }, [onClose, onDecoded, onError, isValid]);
  return (
    <div className="camera-preview">
      <video ref={video} muted playsInline aria-label="תצוגה חיה מהמצלמה האחורית" />
      <p role="status">{ready ? "המצלמה פעילה · " : ""}{hint}</p>
    </div>
  );
}
