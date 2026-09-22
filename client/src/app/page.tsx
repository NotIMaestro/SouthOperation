import { ArrowLeft, LockKeyhole, ShieldCheck, Waypoints } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <div className="landing-glow" aria-hidden="true" />
      <nav className="public-nav" aria-label="ניווט ראשי">
        <Link className="brand" href="/">
          <span className="brand-mark"><Waypoints aria-hidden="true" /></span>
          <span>מעבר דרומה</span>
        </Link>
        <Link className="button secondary" href="/sign-in">
          כניסה מאובטחת
        </Link>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck aria-hidden="true" /> סביבת עבודה מאובטחת</span>
          <h1>שליטה מלאה בתהליך המיפוי והעברת הציוד</h1>
          <p>
            תמונת מצב אמינה, תהליכי עבודה ברורים והרשאות מדויקות — מהחדר ועד ליעד.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/sign-in">
              כניסה למערכת <ArrowLeft aria-hidden="true" />
            </Link>
            <span className="security-note"><LockKeyhole aria-hidden="true" /> כניסה ארגונית בלבד</span>
          </div>
        </div>

        <div className="signal-panel" aria-label="עקרונות המערכת">
          <div className="signal-header">
            <span>רצף תפעולי</span>
            <span className="status-dot">מוכן</span>
          </div>
          <ol className="operation-flow">
            <li><span>01</span><div><strong>מיפוי</strong><small>חדרים וציוד</small></div></li>
            <li><span>02</span><div><strong>אריזה</strong><small>בקרת שלמות</small></div></li>
            <li><span>03</span><div><strong>העברה</strong><small>מעקב מבוקר</small></div></li>
            <li><span>04</span><div><strong>קליטה</strong><small>אימות ביעד</small></div></li>
          </ol>
        </div>
      </section>
    </main>
  );
}
