"use client";

import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  PackageCheck,
  Plus,
  Truck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

type TransportItem = {
  id: string;
  title: string;
  route: string;
  date: string;
  status: "waiting" | "transit" | "arrived";
  statusLabel: string;
  createdBy: string;
  sourceCity: string;
  sourceUnit: string;
  sourceBuilding: string;
  sourceRoom: string;
  destinationCity: string;
  destinationUnit: string;
  destinationBuilding: string;
  destinationRoom: string;
  packageCount: number;
  packageSummary: string;
  vehicleType?: string;
  vehicleNumber?: string;
};

const initialTransportItems: TransportItem[] = [
  {
    id: "TR-024",
    title: "מעוז",
    route: "רמת גן > באר שבע",
    date: "היום, 14:30",
    status: "waiting",
    statusLabel: "ממתין לאיסוף",
    createdBy: "מעוז",
    sourceCity: "רמת גן",
    sourceUnit: "יחידת מעוז",
    sourceBuilding: "בניין מרכזי",
    sourceRoom: "12",
    destinationCity: "באר שבע",
    destinationUnit: "קריית התקשוב",
    destinationBuilding: "בניין 2",
    destinationRoom: "214",
    packageCount: 2,
    packageSummary: "תיקים וציוד אישי",
  },
  {
    id: "TR-023",
    title: "ציוד משרדי",
    route: "תל אביב > באר שבע",
    date: "מחר, 08:00",
    status: "transit",
    statusLabel: "בדרך ליעד",
    createdBy: "מחלקת תפעול",
    sourceCity: "תל אביב",
    sourceUnit: "מחלקת תפעול",
    sourceBuilding: "מחסן ראשי",
    sourceRoom: "4",
    destinationCity: "באר שבע",
    destinationUnit: "קריית התקשוב",
    destinationBuilding: "בניין 1",
    destinationRoom: "108",
    packageCount: 6,
    packageSummary: "מסכים, מקלדות, עכברים וציוד כתיבה",
    vehicleType: "משאית",
    vehicleNumber: "58-123-45",
  },
  {
    id: "TR-022",
    title: "ציוד מצריפין",
    route: "צריפין > באר שבע",
    date: "18.09.2026, 11:00",
    status: "arrived",
    statusLabel: "הגיע ליעד",
    createdBy: "לוגיסטיקה",
    sourceCity: "צריפין",
    sourceUnit: "לוגיסטיקה",
    sourceBuilding: "מחסן צריפין",
    sourceRoom: "7",
    destinationCity: "באר שבע",
    destinationUnit: "קריית התקשוב",
    destinationBuilding: "בניין 3",
    destinationRoom: "305",
    packageCount: 4,
    packageSummary: "ארגזי ציוד ופריטי מיגון",
    vehicleType: "טנדר",
    vehicleNumber: "76-456-12",
  },
];

export default function TransportPage() {
  const [transportItems, setTransportItems] = useState(initialTransportItems);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState<TransportItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusDraft, setStatusDraft] = useState<TransportItem["status"] | null>(null);
  const [vehicleTypeDraft, setVehicleTypeDraft] = useState("");
  const [vehicleNumberDraft, setVehicleNumberDraft] = useState("");
  const [statusError, setStatusError] = useState("");
  const [additionalPackageCount, setAdditionalPackageCount] = useState("");
  const [additionalPackageSummary, setAdditionalPackageSummary] = useState("");

  const filteredTransportItems = transportItems.filter((item) => {
    const searchContent = [item.title, item.id, item.route, item.sourceUnit, item.destinationUnit, item.packageSummary]
      .join(" ")
      .toLowerCase();
    return searchContent.includes(searchTerm.trim().toLowerCase()) &&
      (statusFilter === "all" || item.status === statusFilter);
  });

  function createTransport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const createdBy = String(formData.get("createdBy") ?? "");
    const sourceCity = String(formData.get("sourceCity") ?? "");
    const sourceUnit = String(formData.get("sourceUnit") ?? "");
    const sourceBuilding = String(formData.get("sourceBuilding") ?? "");
    const sourceRoom = String(formData.get("sourceRoom") ?? "");
    const destinationCity = String(formData.get("destinationCity") ?? "");
    const destinationUnit = String(formData.get("destinationUnit") ?? "");
    const destinationBuilding = String(formData.get("destinationBuilding") ?? "");
    const destinationRoom = String(formData.get("destinationRoom") ?? "");
    const packageCount = Number(formData.get("packageCount") ?? 0);
    const packageSummary = String(formData.get("packageSummary") ?? "");
    const date = String(formData.get("createdAt") ?? "");

    setTransportItems((items) => [
      {
        id: `TR-${String(items.length + 25).padStart(3, "0")}`,
        title: "הובלה חדשה",
        route: `${sourceCity} > ${destinationCity}`,
        date: date || "מועד לא נקבע",
        status: "waiting",
        statusLabel: "ממתין לאיסוף",
        createdBy,
        sourceCity,
        sourceUnit,
        sourceBuilding,
        sourceRoom,
        destinationCity,
        destinationUnit,
        destinationBuilding,
        destinationRoom,
        packageCount,
        packageSummary,
      },
      ...items,
    ]);
    setIsCreateOpen(false);
    event.currentTarget.reset();
  }

  function openTransportDetails(item: TransportItem) {
    setSelectedTransport(item);
    setStatusDraft(item.status);
    setVehicleTypeDraft(item.vehicleType ?? "");
    setVehicleNumberDraft(item.vehicleNumber ?? "");
    setStatusError("");
    setAdditionalPackageCount("");
    setAdditionalPackageSummary("");
  }

  function saveTransportStatus() {
    if (!selectedTransport || !statusDraft) return;
    const vehicleChanged = selectedTransport.status === "transit" &&
      (vehicleTypeDraft.trim() !== (selectedTransport.vehicleType ?? "") ||
        vehicleNumberDraft.trim() !== (selectedTransport.vehicleNumber ?? ""));
    if (statusDraft === selectedTransport.status && !vehicleChanged) return;
    if (statusDraft === "transit" && (!vehicleTypeDraft.trim() || !vehicleNumberDraft.trim())) {
      setStatusError("כדי להעביר את ההובלה לדרך יש למלא סוג רכב ומספר רכב.");
      return;
    }

    const statusLabels: Record<TransportItem["status"], string> = {
      waiting: "ממתין לאיסוף",
      transit: "בדרך ליעד",
      arrived: "הגיע ליעד",
    };
    const updatedTransport = {
      ...selectedTransport,
      status: statusDraft,
      statusLabel: statusLabels[statusDraft],
      vehicleType: vehicleTypeDraft.trim() || selectedTransport.vehicleType,
      vehicleNumber: vehicleNumberDraft.trim() || selectedTransport.vehicleNumber,
    };
    setTransportItems((items) => items.map((item) => item.id === updatedTransport.id ? updatedTransport : item));
    if (statusDraft !== selectedTransport.status) {
      setSelectedTransport(null);
    } else {
      setSelectedTransport(updatedTransport);
    }
    setStatusError("");
  }

  function addPackagesToTransport() {
    if (!selectedTransport || selectedTransport.status !== "waiting") return;
    const count = Number(additionalPackageCount);
    const summary = additionalPackageSummary.trim();
    if (!Number.isInteger(count) || count < 1 || !summary) return;
    if (!window.confirm(`האם אתה בטוח שברצונך להוסיף ${count} חבילות להובלה ${selectedTransport.id}?`)) return;

    const updatedTransport = {
      ...selectedTransport,
      packageCount: selectedTransport.packageCount + count,
      packageSummary: selectedTransport.packageSummary
        ? `${selectedTransport.packageSummary}; ${summary}`
        : summary,
    };
    setTransportItems((items) => items.map((item) => item.id === updatedTransport.id ? updatedTransport : item));
    setSelectedTransport(updatedTransport);
    setAdditionalPackageCount("");
    setAdditionalPackageSummary("");
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="הובלת חבילות"
        description="תכנון, מעקב וניהול משימות שינוע במערכת"
        action={
          <button aria-label="יצירת משימת הובלה" className="button primary" onClick={() => setIsCreateOpen(true)} type="button">
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
          <select aria-label="סינון לפי סטטוס" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">כל הסטטוסים</option>
            <option value="waiting">ממתין לאיסוף</option>
            <option value="transit">בדרך ליעד</option>
            <option value="arrived">הגיע ליעד</option>
          </select>
          <input
            aria-label="חיפוש משימת הובלה"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="חיפוש משימה"
            type="search"
            value={searchTerm}
          />
        </div>
      </div>

      <section className="transport-list" aria-label="רשימת משימות הובלה">
        {filteredTransportItems.map((item) => (
          <article className="transport-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>{item.id}</small>
            </div>
            <div>
              <small><MapPin aria-hidden="true" /> יציאה: {item.sourceCity}, {item.sourceUnit}, {item.sourceBuilding}, חדר {item.sourceRoom}</small>
              <small>יעד: {item.destinationCity}, {item.destinationUnit}, {item.destinationBuilding}, חדר {item.destinationRoom}</small>
            </div>
            <div>
              <small><CalendarDays aria-hidden="true" /> {item.date}</small>
              <small>{item.packageCount} חבילות · יצר: {item.createdBy}</small>
              <span className={`transport-status ${item.status}`}>{item.statusLabel}</span>
            </div>
            <div className="transport-actions">
              <button aria-label={`פתיחת ${item.title}`} className="button secondary" onClick={() => openTransportDetails(item)} type="button">
                פרטים <ArrowLeft aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
        {filteredTransportItems.length === 0 && (
          <div className="empty-state transport-no-results">
            <PackageCheck aria-hidden="true" />
            <h2>לא נמצאו הובלות</h2>
            <p>נסה לחפש לפי שם ההובלה, תיאור החבילות, מספר ההובלה או מיקום.</p>
          </div>
        )}
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

      {selectedTransport && (
        <div className="transport-modal-backdrop" role="presentation">
          <section aria-labelledby="transport-details-title" aria-modal="true" className="transport-modal" role="dialog">
            <div className="transport-modal-header">
              <div>
                <span className="eyebrow"><Truck aria-hidden="true" /> {selectedTransport.id}</span>
                <h2 id="transport-details-title">פרטי הובלה</h2>
                <p>{selectedTransport.id}</p>
              </div>
              <button aria-label="סגירת פרטי ההובלה" className="icon-button" onClick={() => setSelectedTransport(null)} type="button"><X /></button>
            </div>
            <div className="transport-details-grid">
              <div><small>שם יוצר ההובלה</small><strong>{selectedTransport.createdBy}</strong></div>
              <div className="transport-detail-wide"><small>מיקום יציאה</small><strong>{selectedTransport.sourceCity}, {selectedTransport.sourceUnit}, {selectedTransport.sourceBuilding}, חדר {selectedTransport.sourceRoom}</strong></div>
              <div className="transport-detail-wide"><small>מיקום יעד</small><strong>{selectedTransport.destinationCity}, {selectedTransport.destinationUnit}, {selectedTransport.destinationBuilding}, חדר {selectedTransport.destinationRoom}</strong></div>
              <div><small>מועד יצירה / שינוע</small><strong>{selectedTransport.date}</strong></div>
              <div><small>סטטוס</small><span className={`transport-status ${selectedTransport.status}`}>{selectedTransport.statusLabel}</span></div>
              {selectedTransport.status !== "waiting" && (
                <>
                  <div className={selectedTransport.status === "arrived" ? "transport-readonly-field" : ""}><small>סוג כלי תחבורה</small><strong>{selectedTransport.vehicleType || "לא צוין"}</strong></div>
                  <div className={selectedTransport.status === "arrived" ? "transport-readonly-field" : ""}><small>מספר רכב</small><strong>{selectedTransport.vehicleNumber || "לא צוין"}</strong></div>
                </>
              )}
              <div><small>מספר חבילות</small><strong>{selectedTransport.packageCount}</strong></div>
              <div className="transport-detail-wide"><small>מה יש בחבילות</small><strong>{selectedTransport.packageSummary}</strong></div>
            </div>
            {selectedTransport.status === "waiting" && (
              <div className="transport-package-editor">
                <h3>הוספת חבילות</h3>
                <p>אפשר להוסיף חבילות כל עוד ההובלה ממתינה לאיסוף.</p>
                <div className="vehicle-fields">
                  <label>כמה חבילות להוסיף
                    <input min="1" onChange={(event) => setAdditionalPackageCount(event.target.value)} type="number" value={additionalPackageCount} />
                  </label>
                  <label>מה יש בחבילות
                    <input onChange={(event) => setAdditionalPackageSummary(event.target.value)} placeholder="לדוגמה: ציוד משרדי" value={additionalPackageSummary} />
                  </label>
                </div>
                <button
                  className="button secondary"
                  disabled={!additionalPackageCount || !additionalPackageSummary.trim()}
                  onClick={addPackagesToTransport}
                  type="button"
                >
                  <Plus /> הוספת חבילות
                </button>
              </div>
            )}
            {selectedTransport.status !== "arrived" && (
              <div className="transport-status-editor">
                <h3>עדכון מצב ההובלה</h3>
                <p>ניתן להתקדם רק לפי סדר השלבים. לאחר הגעה ליעד ההובלה ננעלת.</p>
                <label>מצב נוכחי
                  <select
                    onChange={(event) => {
                      setStatusDraft(event.target.value as TransportItem["status"]);
                      setStatusError("");
                    }}
                    value={statusDraft ?? selectedTransport.status}
                  >
                    {selectedTransport.status === "waiting" && <option value="waiting">ממתין לאיסוף</option>}
                    <option value="transit">בדרך ליעד</option>
                    {selectedTransport.status === "transit" && <option value="arrived">הגיע ליעד</option>}
                  </select>
                </label>
                {statusDraft === "transit" && (
                  <div className="vehicle-fields">
                    <label>סוג כלי תחבורה
                      <select onChange={(event) => setVehicleTypeDraft(event.target.value)} value={vehicleTypeDraft}>
                        <option value="">בחירת סוג רכב</option>
                        <option value="משאית">משאית</option>
                        <option value="רכב פרטי">רכב פרטי</option>
                        <option value="טנדר">טנדר</option>
                        <option value="אחר">אחר</option>
                      </select>
                    </label>
                    <label>מספר רכב
                      <input onChange={(event) => setVehicleNumberDraft(event.target.value)} placeholder="לדוגמה: 58-123-45" value={vehicleNumberDraft} />
                    </label>
                  </div>
                )}
                {statusError && <p className="transport-form-error" role="alert">{statusError}</p>}
                <button className="button primary" onClick={saveTransportStatus} type="button">שמירת מצב ופרטי רכב</button>
              </div>
            )}
          </section>
        </div>
      )}

      {isCreateOpen && (
        <div className="transport-modal-backdrop" role="presentation">
          <section aria-labelledby="new-transport-title" aria-modal="true" className="transport-modal" role="dialog">
            <div className="transport-modal-header">
              <div>
                <span className="eyebrow"><Truck aria-hidden="true" /> משימה חדשה</span>
                <h2 id="new-transport-title">יצירת הובלה חדשה</h2>
                <p>הזן את פרטי ההובלה והיעד בקריית התקשוב.</p>
              </div>
              <button aria-label="סגירת החלונית" className="icon-button" onClick={() => setIsCreateOpen(false)} type="button"><X /></button>
            </div>
            <form className="transport-form" onSubmit={createTransport}>
              <label>שם יוצר ההובלה<input defaultValue="מעוז" name="createdBy" placeholder="לדוגמה: מעוז" required /></label>
              <div className="transport-location-section transport-form-wide">
                <h3>מיקום יציאה</h3>
                <div className="transport-location-grid">
                  <label>עיר<input defaultValue="הרצליה" name="sourceCity" required /></label>
                  <label>יחידה<input name="sourceUnit" placeholder="לדוגמה: מחלקת תפעול" required /></label>
                  <label>בניין<input name="sourceBuilding" placeholder="לדוגמה: מחסן ראשי" required /></label>
                  <label>חדר<input name="sourceRoom" placeholder="לדוגמה: 4" required /></label>
                </div>
              </div>
              <div className="transport-location-section transport-form-wide">
                <h3>מיקום יעד</h3>
                <div className="transport-location-grid">
                  <label>עיר<input defaultValue="באר שבע" name="destinationCity" required /></label>
                  <label>יחידה<input name="destinationUnit" placeholder="לדוגמה: קריית התקשוב" required /></label>
                  <label>בניין<input name="destinationBuilding" placeholder="לדוגמה: בניין 2" required /></label>
                  <label>חדר<input name="destinationRoom" placeholder="לדוגמה: 214" required /></label>
                </div>
              </div>
              <label>מספר חבילות<input min="1" name="packageCount" required type="number" /></label>
              <label className="transport-form-wide">מה יש בחבילות<textarea name="packageSummary" placeholder="תיאור כללי של הציוד בחבילות" required rows={3} /></label>
              <label>מועד יצירה<input name="createdAt" type="datetime-local" required /></label>
              <label>סטטוס התחלתי<select disabled defaultValue="waiting"><option value="waiting">ממתין לאיסוף</option></select></label>
              <div className="transport-form-actions">
                <button className="button secondary" onClick={() => setIsCreateOpen(false)} type="button">ביטול</button>
                <button className="button primary" type="submit"><Plus /> יצירת הובלה</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
