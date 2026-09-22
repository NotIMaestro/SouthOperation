import { Waypoints } from "lucide-react";

export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <section className="welcome-mark" aria-label="מעבר דרומה">
        <span className="welcome-icon"><Waypoints aria-hidden="true" /></span>
        <h1>מעבר דרומה</h1>
      </section>
    </main>
  );
}