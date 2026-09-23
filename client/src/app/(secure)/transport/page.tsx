"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

import { transportService } from "@/lib/transports/service";
import { getCurrentUser } from "@/lib/pickup/current-user";
import { TRANSPORTS_CHANGED, TRANSPORTS_KEY, deliveryDate, displayDeliveryDate, transportErrorMessage, type TransportItem } from "@/lib/transports/types";
const user = getCurrentUser();

export default function TransportPage() {
  const [transportItems, setTransportItems] = useState<TransportItem[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTransport, setSelectedTransport] = useState<TransportItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusDraft, setStatusDraft] = useState<TransportItem["status"] | null>(null);
  const [vehicleTypeDraft, setVehicleTypeDraft] = useState("");
  const [vehicleNumberDraft, setVehicleNumberDraft] = useState("");
  const [statusError, setStatusError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mutating = useRef(false);
  const request = useRef(0);
  const invalidate = useCallback(() => { ++request.current; }, []);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    try {
      const records = await transportService.getTransportsForUser(user.id);
      if (version !== request.current) return;
      setTransportItems(records); setError("");
      setSelectedTransport((current) => current ? records.find((entry) => entry.id === current.id) ?? null : null);
    } catch (cause) { if (version === request.current) setError(transportErrorMessage(cause)); }
    finally { if (version === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const changed = () => { if (!mutating.current) void refresh(); };
    const stored = (event: StorageEvent) => { if (event.key === TRANSPORTS_KEY || event.key === null) changed(); };
    window.addEventListener(TRANSPORTS_CHANGED, changed); window.addEventListener("storage", stored);
    return () => { clearTimeout(timer); invalidate(); window.removeEventListener(TRANSPORTS_CHANGED, changed); window.removeEventListener("storage", stored); };
  }, [refresh, invalidate]);

  const filteredTransportItems = transportItems.filter((item) => {
    const searchContent = [item.title, item.id, item.route, item.sourceUnit, item.destinationUnit, item.packageSummary]
      .join(" ")
      .toLowerCase();
    return searchContent.includes(searchTerm.trim().toLowerCase()) &&
      (statusFilter === "all" || item.status === statusFilter);
  });

  async function createTransport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutating.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
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

    mutating.current = true; setSaving(true); setError("");
    const version = ++request.current;
    try {
      const created = await transportService.createTransport(user.id, { createdBy, sourceCity, sourceUnit, sourceBuilding, sourceRoom, destinationCity, destinationUnit, destinationBuilding, destinationRoom, packageCount, packageSummary, date });
      if (version !== request.current) return;
      setTransportItems((items) => [created, ...items]); setIsCreateOpen(false); form.reset();
    } catch (cause) { if (version === request.current) setError(transportErrorMessage(cause)); }
    finally { mutating.current = false; setSaving(false); }
  }

  function openTransportDetails(item: TransportItem) {
    setSelectedTransport(item);
    setStatusDraft(item.status);
    setVehicleTypeDraft(item.vehicleType ?? "");
    setVehicleNumberDraft(item.vehicleNumber ?? "");
    setStatusError("");
  }

  async function saveTransportStatus() {
    if (!selectedTransport || !statusDraft || mutating.current) return;
    mutating.current = true; setSaving(true); setStatusError("");
    const version = ++request.current;
    try {
      const updated = await transportService.updateTransportStatus(user.id, selectedTransport.id, statusDraft, vehicleTypeDraft, vehicleNumberDraft);
      if (version !== request.current) return;
      setTransportItems((items) => items.map((entry) => entry.id === updated.id ? updated : entry)); setSelectedTransport(updated);
    } catch (cause) { if (version === request.current) setStatusError(transportErrorMessage(cause)); }
    finally { mutating.current = false; setSaving(false); }
  }

  return (
    <main className="page-shell" dir="rtl" lang="he">
      <PageHeader
        title="הובלת חבילות"
        description="תכנון, מעקב וניהול משימות שינוע במערכת"
        action={
          <button aria-label="יצירת משימת הובלה" className="button primary" disabled={loading || saving} onClick={() => { setError(""); setIsCreateOpen(true); }} type="button">
            <Plus /> הובלה חדשה
          </button>
        }
      />

      {error && !isCreateOpen && <p role="alert" className="package-notice error">{error} <button className="button secondary" onClick={() => void refresh()}>ניסיון נוסף</button></p>}
      {loading && <p role="status">טוענים הובלות…</p>}
      <section className="transport-grid" aria-label="סיכום הובלות">
        <article className="metric-card">
          <div><span>משימות פתוחות</span><Truck aria-hidden="true" /></div>
          <strong>{transportItems.filter((entry) => entry.status !== "arrived").length}</strong>
          <small>ממתינות לאיסוף ובדרך ליעד</small>
        </article>
        <article className="metric-card">
          <div><span>בשינוע</span><Clock3 aria-hidden="true" /></div>
          <strong>{transportItems.filter((entry) => entry.status === "transit").length}</strong>
          <small>הובלות בדרך ליעד</small>
        </article>
        <article className="metric-card">
          <div><span>קבלה אושרה</span><CheckCircle2 aria-hidden="true" /></div>
          <strong>{transportItems.filter((entry) => entry.receiptStatus === "RECEIVED_CONFIRMED").length}</strong>
          <small>קבלת ההובלות אושרה ביעד</small>
        </article>
        <article className="metric-card">
          <div><span>נקודות יעד</span><MapPin aria-hidden="true" /></div>
          <strong>{new Set(transportItems.map((entry) => entry.destinationCity)).size}</strong>
          <small>יעדים בהובלות המשויכות</small>
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
              <small><CalendarDays aria-hidden="true" /> {displayDeliveryDate(deliveryDate(item))}</small>
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
        {!loading && !error && filteredTransportItems.length === 0 && (
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
          <Link className="button secondary" href="/receiving"><PackageCheck /> קבלת הובלות</Link>
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
              <button aria-label="סגירת פרטי ההובלה" className="icon-button" disabled={saving} onClick={() => setSelectedTransport(null)} type="button"><X /></button>
            </div>
            <div className="transport-details-grid">
              <div><small>קבלת ההובלה</small><strong>{selectedTransport.receiptStatus === "RECEIVED_CONFIRMED" ? "התקבלה ואושרה" : selectedTransport.receiptStatus === "AWAITING_RECEIPT_CONFIRMATION" ? "ממתינה לאישור קבלה" : "טרם הגיעה ליעד"}</strong></div>
              <div><small>שם יוצר ההובלה</small><strong>{selectedTransport.createdBy}</strong></div>
              <div className="transport-detail-wide"><small>מיקום יציאה</small><strong>{selectedTransport.sourceCity}, {selectedTransport.sourceUnit}, {selectedTransport.sourceBuilding}, חדר {selectedTransport.sourceRoom}</strong></div>
              <div className="transport-detail-wide"><small>מיקום יעד</small><strong>{selectedTransport.destinationCity}, {selectedTransport.destinationUnit}, {selectedTransport.destinationBuilding}, חדר {selectedTransport.destinationRoom}</strong></div>
              <div><small>תאריך מסירה</small><strong>{displayDeliveryDate(deliveryDate(selectedTransport))}</strong></div>
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
                      <input onChange={(event) => setVehicleNumberDraft(event.target.value)} placeholder="לדוגמה: רכב הדגמה" value={vehicleNumberDraft} />
                    </label>
                  </div>
                )}
                {statusError && <p className="transport-form-error" role="alert">{statusError}</p>}
                <button className="button primary" disabled={saving} onClick={() => void saveTransportStatus()} type="button">שמירת מצב ופרטי רכב</button>
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
                <p>הזינו פרטי הובלה ויעד בדיוניים להדגמה. לכל חבילה יתווסף פריט הדגמה אחד לפי התיאור.</p>
              </div>
              <button aria-label="סגירת החלונית" className="icon-button" disabled={saving} onClick={() => setIsCreateOpen(false)} type="button"><X /></button>
            </div>
            <form className="transport-form" onSubmit={(event) => void createTransport(event)}>
              {error && <p className="transport-form-wide transport-form-error" role="alert">{error}</p>}
              <label>שם יוצר ההובלה<input defaultValue="יוצר הדגמה" name="createdBy" placeholder="לדוגמה: יוצר הדגמה" required /></label>
              <div className="transport-location-section transport-form-wide">
                <h3>מיקום יציאה</h3>
                <div className="transport-location-grid">
                  <label>עיר<input defaultValue="עיר הדגמה א" name="sourceCity" required /></label>
                  <label>יחידה<input name="sourceUnit" placeholder="לדוגמה: מחלקת תפעול" required /></label>
                  <label>בניין<input name="sourceBuilding" placeholder="לדוגמה: מחסן ראשי" required /></label>
                  <label>חדר<input name="sourceRoom" placeholder="לדוגמה: 4" required /></label>
                </div>
              </div>
              <div className="transport-location-section transport-form-wide">
                <h3>מיקום יעד</h3>
                <div className="transport-location-grid">
                  <label>עיר<input defaultValue="עיר הדגמה ב" name="destinationCity" required /></label>
                  <label>יחידה<input name="destinationUnit" placeholder="לדוגמה: מרכז יעד בדיוני" required /></label>
                  <label>בניין<input name="destinationBuilding" placeholder="לדוגמה: בניין 2" required /></label>
                  <label>חדר<input name="destinationRoom" placeholder="לדוגמה: 214" required /></label>
                </div>
              </div>
              <label>מספר חבילות<input min="1" max="30" name="packageCount" required type="number" /></label>
              <label className="transport-form-wide">מה יש בחבילות<textarea name="packageSummary" placeholder="תיאור כללי של הציוד בחבילות" required rows={3} /></label>
              <label>תאריך מסירה<input name="createdAt" type="datetime-local" required /></label>
              <label>סטטוס התחלתי<select disabled defaultValue="waiting"><option value="waiting">ממתין לאיסוף</option></select></label>
              <div className="transport-form-actions">
                <button className="button secondary" disabled={saving} onClick={() => setIsCreateOpen(false)} type="button">ביטול</button>
                <button className="button primary" disabled={saving} type="submit"><Plus /> {saving ? "שומרים הובלה…" : "יצירת הובלה"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
