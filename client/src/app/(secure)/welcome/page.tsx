"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Waypoints } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/dashboard"), 900);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="welcome-page">
      <section className="welcome-mark" aria-label="מעבר דרומה">
        <span className="welcome-icon"><Waypoints aria-hidden="true" /></span>
        <h1>מעבר דרומה</h1>
      </section>
    </main>
  );
}
