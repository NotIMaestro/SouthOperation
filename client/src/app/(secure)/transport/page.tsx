import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Plus,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

const transportItems = [
  {
    id: "TR-024",
    title: "ציוד משרדי למבנה הדרומי",
    route: "מרכז לוגיסטי > אופקים",
    date: "היום, 14:30",
    status: "ready",
    statusLabel: "ממתין לשינוע",
  },
  {
    id: "TR-023",
    title: "מכולת ציוד לקבוצת נחל",
    route: "באר שבע > נתיבות",
    date: "מחר, 08:00",
    status: "progress",
    statusLabel: "בהכנה",
  },
  {
    id: "TR-022",
    title: "ארגזי חירום למתחם מערב",
    route: "מרכז לוגיסטי > שדרות",
    date: "18.09.2026",
    status: "done",
    statusLabel: "הושלם",
  },
];

export default function TransportPage() {
  return (
    <main className="page-shell">
      <PageHeader
        title="הובלה"
        description="תכנון, מעקב וניהול משימות שינוע במערכת"
        action={
          <button aria-label="יצירת משימת הובלה" className="button primary" type="button">
            <Plus /> הובלה חדשה
          </button>
        }
      />

      <section className="transport-grid" aria-label="סיכום הובלות">
        <article className="metric-card">
          <div><span>משימות פתוחות</span><Truck aria-hidden="true" /></div>
          <strong>12</strong>
          <small>3 נוספו השבוע</small>
        </article>
        <article className="metric-card">
          <div><span>בשינוע היום</span><Clock3 aria-hidden="true" /></div>
          <strong>4</strong>
          <small>2 ממתינות לאישור</small>
        </article>
        <article className="metric-card">
          <div><span>הושלמו החודש</span><CheckCircle2 aria-hidden="true" /></div>
          <strong>28</strong>
          <small>92% בזמן</small>
        </article>
        <article className="metric-card">
          <div><span>נקודות יעד</span><MapPin aria-hidden="true" /></div>
          <strong>7</strong>
          <small>ב-3 אזורים</small>
        </article>
      </section>

      <div className="transport-toolbar">
        <div>
          <h2>משימות הובלה</h2>
          <p className="panel-heading p">ניהול מרוכז של השינועים הקרובים והאחרונים</p>
        </div>
        <div className="transport-filters">
          <select aria-label="סינון לפי סטטוס" defaultValue="all">
            <option value="all">כל הסטטוסים</option>
            <option value="ready">ממתין לשינוע</option>
            <option value="progress">בהכנה</option>
            <option value="done">הושלם</option>
          </select>
          <input aria-label="חיפוש משימת הובלה" placeholder="חיפוש משימה" type="search" />
        </div>
      </div>

      <section className="transport-list" aria-label="רשימת משימות הובלה">
        {transportItems.map((item) => (
          <article className="transport-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>{item.id}</small>
            </div>
            <div>
              <small><MapPin aria-hidden="true" /> {item.route}</small>
            </div>
            <div>
              <small><CalendarDays aria-hidden="true" /> {item.date}</small>
              <span className={`transport-status ${item.status}`}>{item.statusLabel}</span>
            </div>
            <div className="transport-actions">
              <button aria-label={`פתיחת ${item.title}`} className="button secondary" type="button">
                פרטים <ArrowLeft aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="panel-heading">
          <div>
            <h2>פעולות מהירות</h2>
            <p>כלים שימושיים לניהול ההובלה היומיומית</p>
          </div>
        </div>
        <div className="quick-actions">
          <button className="button secondary" type="button"><PackageCheck /> אישור קבלת ציוד</button>
          <button className="button secondary" type="button"><CalendarDays /> צפייה בלוח השינועים</button>
        </div>
      </section>
    </main>
  );
}
