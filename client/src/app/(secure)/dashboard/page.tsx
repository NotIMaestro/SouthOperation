import { AlertTriangle, ArrowUpLeft, Boxes, Building2, ClipboardCheck, TimerReset } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";

const metrics = [
  { label: "קבוצות פעילות", value: "—", icon: Building2, hint: "ממתין לחיבור נתונים" },
  { label: "חדרים בתהליך", value: "—", icon: Boxes, hint: "ממתין לחיבור נתונים" },
  { label: "דוחות שהוגשו", value: "—", icon: ClipboardCheck, hint: "ממתין לחיבור נתונים" },
  { label: "דורש טיפול", value: "—", icon: AlertTriangle, hint: "ממתין לחיבור נתונים" },
];

export default function DashboardPage() {
  return (
    <main className="page-shell">
      <PageHeader title="לוח בקרה" description="תמונת מצב תפעולית עדכנית לפי ההרשאות שלך" />
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
    </main>
  );
}
