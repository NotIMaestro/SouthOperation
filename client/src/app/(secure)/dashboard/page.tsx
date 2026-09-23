import {
  AlertTriangle,
  ArrowUpLeft,
  Boxes,
  Building2,
  ClipboardCheck,
  FileClock,
  Library,
  PackageCheck,
  PackageOpen,
  TimerReset,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getDashboardMetrics } from "@/lib/server-api";

const primaryTiles = [
  { href: "/packing", label: "אריזה", sub: "אריזת ציוד מחדר", icon: PackageCheck },
  { href: "/transport", label: "הובלה", sub: "העמסה על רכב", icon: Truck },
  { href: "/receiving", label: "קבלת הובלות", sub: "פריקת הובלה", icon: PackageOpen },
  { href: "/pickup", label: "איסוף חבילות", sub: "לחדרי היעד", icon: PackageCheck },
];

const secondaryTiles = [
  { href: "/rooms", label: "מיפוי חדרים", sub: "מעקב לפי חדר", icon: Boxes },
  { href: "/groups", label: "קבוצות", sub: "ניהול יחידות", icon: Building2 },
  { href: "/catalog", label: "קטלוג פריטים", sub: "סוגי ציוד", icon: Library },
  { href: "/audit", label: "יומן ביקורת", sub: "מי עשה מה", icon: FileClock },
];

function percent({ done, total }: { done: number; total: number }) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export default async function DashboardPage() {
  const metricsResult = await getDashboardMetrics();

  const attention = metricsResult.ok ? metricsResult.data.needsAttention : undefined;
  const attentionTotal = attention
    ? attention.pausedRooms + attention.closedUnassignedUnits + attention.transportsInTransit
    : undefined;
  const progressRows = metricsResult.ok
    ? [
        { label: "חדרים ממופים", ...metricsResult.data.progress.mapping },
        { label: "יחידות אריזה סגורות", ...metricsResult.data.progress.packing },
        { label: "הובלות שהגיעו ליעד", ...metricsResult.data.progress.delivery },
      ]
    : [];

  const metrics = [
    {
      label: "קבוצות פעילות",
      value: metricsResult.ok ? String(metricsResult.data.groupCount) : "—",
      icon: Building2,
      hint: metricsResult.ok ? "מעודכן לרגע זה" : metricsResult.message,
    },
    {
      label: "חדרים בתהליך",
      value: metricsResult.ok ? String(metricsResult.data.roomsInProgress) : "—",
      icon: Boxes,
      hint: metricsResult.ok ? "מעודכן לרגע זה" : metricsResult.message,
    },
    {
      label: "פריטים ממופים",
      value: metricsResult.ok ? String(metricsResult.data.mappedItems) : "—",
      icon: ClipboardCheck,
      hint: metricsResult.ok ? "סך הכמויות בכל החדרים" : metricsResult.message,
    },
    {
      label: "דורש טיפול",
      value: attentionTotal === undefined ? "—" : String(attentionTotal),
      icon: AlertTriangle,
      hint: attention
        ? `${attention.closedUnassignedUnits} יחידות ללא הובלה · ${attention.pausedRooms} חדרים מושהים · ${attention.transportsInTransit} הובלות בדרך`
        : metricsResult.ok ? "" : metricsResult.message,
    },
  ];

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
            <div className="panel-heading"><div><h2>התקדמות לפי שלב</h2><p>{metricsResult.ok ? "מיפוי → אריזה → הובלה, בכל הקבוצות שלך" : metricsResult.message}</p></div><TimerReset /></div>
            <div className="progress-list">
              {progressRows.map((row) => (
                <div className="progress-row" key={row.label}>
                  <div className="progress-row-label"><span>{row.label}</span><span>{row.done} / {row.total} · {percent(row)}%</span></div>
                  <div aria-label={`${row.label}: ${percent(row)}%`} className="progress-track" role="img">
                    <div className="progress-fill" style={{ width: `${percent(row)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="panel quick-actions">
            <div className="panel-heading"><div><h2>פעולות מהירות</h2><p>קיצורי דרך לתהליכים נפוצים</p></div></div>
            <Link href="/groups">צפייה בקבוצות <ArrowUpLeft /></Link>
            <Link href="/rooms">מיפוי חדרים <ArrowUpLeft /></Link>
            <Link href="/logistics">תמונת מצב לוגיסטית <ArrowUpLeft /></Link>
            <Link href="/receiving">קבלת הובלות <ArrowUpLeft /></Link>
            <Link href="/audit">בדיקת יומן ביקורת <ArrowUpLeft /></Link>
          </article>
        </section>
      </div>

      <section className="dashboard-mobile-grid" aria-label="פעולות עיקריות">
        <div className="mobile-grid-primary">
          {primaryTiles.map(({ href, label, sub, icon: Icon }) => (
            <Link className="mobile-tile" href={href} key={href}>
              <span className="mobile-tile-icon"><Icon aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{sub}</small></span>
            </Link>
          ))}
        </div>
        <span className="dashboard-mobile-section-label">עוד</span>
        <div className="mobile-grid-secondary">
          {secondaryTiles.map(({ href, label, sub, icon: Icon }) => (
            <Link className="mobile-tile" href={href} key={href}>
              <span className="mobile-tile-icon"><Icon aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{sub}</small></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
