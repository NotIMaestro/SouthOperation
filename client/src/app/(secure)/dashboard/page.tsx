import {
  AlertTriangle,
  ArrowUpLeft,
  Boxes,
  Building2,
  ClipboardCheck,
  PackageCheck,
  PackageOpen,
  TimerReset,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";

const metrics = [
  { label: "קבוצות פעילות", value: "—", icon: Building2, hint: "ממתין לחיבור נתונים" },
  { label: "חדרים בתהליך", value: "—", icon: Boxes, hint: "ממתין לחיבור נתונים" },
  { label: "דוחות שהוגשו", value: "—", icon: ClipboardCheck, hint: "ממתין לחיבור נתונים" },
  { label: "דורש טיפול", value: "—", icon: AlertTriangle, hint: "ממתין לחיבור נתונים" },
];

const primaryTiles = [
  { href: "/packing", label: "אריזה", sub: "אריזת ציוד מחדר", icon: PackageCheck, tone: "tile-red" },
  { href: "/transport", label: "הובלה", sub: "העמסה על רכב", icon: Truck, tone: "tile-blue" },
  { href: "/receiving", label: "קבלת ציוד", sub: "פריקת הובלה", icon: PackageOpen, tone: "tile-teal" },
  { href: "/pickup", label: "איסוף ציוד", sub: "לחדרי היעד", icon: PackageCheck, tone: "tile-orange" },
];

const secondaryTiles = [
  { href: "/rooms", label: "מיפוי חדרים", sub: "מעקב לפי חדר", icon: Boxes, tone: "tile-purple" },
  { href: "/reports", label: "דוחות מיפוי", sub: "בקרת ציוד", icon: ClipboardCheck, tone: "tile-purple" },
];

export default function DashboardPage() {
  return (
    <main className="page-shell">
      <PageHeader title="לוח בקרה" description="תמונת מצב תפעולית עדכנית לפי ההרשאות שלך" />

      <div className="dashboard-desktop">
        <section className="metric-grid" aria-label="מדדים מרכזיים">
          {metrics.map(({ label, value, icon: Icon, hint }) => (
            <article className="metric-card" key={label}>
              <div><span>{label}</span><Icon aria-hidden="true" /></div>
              <strong>{value}</strong><small>{hint}</small>
            </article>
          ))}
        </section>
        <section className="dashboard-grid">
          <article className="panel wide-panel">
            <div className="panel-heading"><div><h2>התקדמות לפי שלב</h2><p>נתונים יופיעו לאחר חיבור סביבת הפיתוח</p></div><TimerReset /></div>
            <div className="placeholder-bars" aria-label="אין נתוני התקדמות">
              <span style={{ width: "72%" }} /><span style={{ width: "51%" }} /><span style={{ width: "34%" }} />
            </div>
          </article>
          <article className="panel quick-actions">
            <div className="panel-heading"><div><h2>פעולות מהירות</h2><p>קיצורי דרך לתהליכים נפוצים</p></div></div>
            <Link href="/groups">צפייה בקבוצות <ArrowUpLeft /></Link>
            <Link href="/reports">פתיחת דוחות מיפוי <ArrowUpLeft /></Link>
            <Link href="/audit">בדיקת יומן ביקורת <ArrowUpLeft /></Link>
          </article>
        </section>
      </div>

      <section className="dashboard-mobile-grid" aria-label="פעולות עיקריות">
        <div className="mobile-grid-primary">
          {primaryTiles.map(({ href, label, sub, icon: Icon, tone }) => (
            <Link className={`mobile-tile ${tone}`} href={href} key={href}>
              <span className="mobile-tile-icon"><Icon aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{sub}</small></span>
            </Link>
          ))}
        </div>
        <span className="dashboard-mobile-section-label">עוד</span>
        <div className="mobile-grid-secondary">
          {secondaryTiles.map(({ href, label, sub, icon: Icon, tone }) => (
            <Link className={`mobile-tile ${tone}`} href={href} key={href}>
              <span className="mobile-tile-icon"><Icon aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{sub}</small></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
