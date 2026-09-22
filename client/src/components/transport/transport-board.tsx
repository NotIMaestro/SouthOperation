"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
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

import type { Transport } from "@/lib/server-api";
import { transportStatusLabels } from "@/components/packing/labels";
import { Modal } from "@/components/modal";
import { getRemembered, setRemembered } from "@/lib/remembered-values";

type TransportStatus = Transport["status"];

function formatDate(value: Date | string | null) {
  if (!value) return "מועד לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function TransportBoard({ groupId, transports }: { groupId: string; transports: Transport[] }) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TransportStatus>("all");
  const [statusDraft, setStatusDraft] = useState<TransportStatus | null>(null);
  const [vehicleTypeDraft, setVehicleTypeDraft] = useState("");
  const [vehicleNumberDraft, setVehicleNumberDraft] = useState("");
  const [statusError, setStatusError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const selectedTransport = transports.find((item) => item.id === selectedId) ?? null;

  const filteredTransports = useMemo(() => {
    return transports.filter((item) => {
      const searchContent = [
        item.transportNumber,
        item.createdByName,
        item.sourceCity,
        item.sourceUnit,
        item.destinationCity,
        item.destinationUnit,
        item.packageSummary ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return (
        searchContent.includes(searchTerm.trim().toLowerCase()) &&
        (statusFilter === "all" || item.status === statusFilter)
      );
    });
  }, [transports, searchTerm, statusFilter]);

  const counts = useMemo(
    () => ({
      total: transports.length,
      waiting: transports.filter((item) => item.status === "waiting").length,
      transit: transports.filter((item) => item.status === "transit").length,
      arrived: transports.filter((item) => item.status === "arrived").length,
    }),
    [transports],
  );

  function openDetails(transport: Transport) {
    setSelectedId(transport.id);
    setStatusDraft(transport.status);
    setVehicleTypeDraft(transport.vehicleType ?? getRemembered("transport:vehicleType"));
    setVehicleNumberDraft(transport.vehicleNumber ?? getRemembered("transport:vehicleNumber"));
    setStatusError("");
  }

  async function createTransport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    const formData = new FormData(event.currentTarget);
    const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
    try {
      const response = await fetch(`/api/v1/groups/${groupId}/transports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createdByName: String(formData.get("createdByName") ?? ""),
          sourceCity: String(formData.get("sourceCity") ?? ""),
          sourceUnit: String(formData.get("sourceUnit") ?? ""),
          sourceBuilding: String(formData.get("sourceBuilding") ?? ""),
          sourceRoom: String(formData.get("sourceRoom") ?? ""),
          destinationCity: String(formData.get("destinationCity") ?? ""),
          destinationUnit: String(formData.get("destinationUnit") ?? ""),
          destinationBuilding: String(formData.get("destinationBuilding") ?? ""),
          destinationRoom: String(formData.get("destinationRoom") ?? ""),
          packageCount: Number(formData.get("packageCount") ?? 0),
          packageSummary: String(formData.get("packageSummary") ?? ""),
          scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setCreateError(payload?.error?.message ?? "יצירת ההובלה נכשלה.");
        return;
      }
      setIsCreateOpen(false);
      event.currentTarget.reset();
      router.refresh();
    } catch {
      setCreateError("לא ניתן להתחבר לשרת.");
    } finally {
      setCreating(false);
    }
  }

  async function saveStatus() {
    if (!selectedTransport || !statusDraft) return;
    const vehicleUnchanged =
      statusDraft === selectedTransport.status &&
      vehicleTypeDraft.trim() === (selectedTransport.vehicleType ?? "") &&
      vehicleNumberDraft.trim() === (selectedTransport.vehicleNumber ?? "");
    if (vehicleUnchanged) return;
    if (statusDraft === "transit" && (!vehicleTypeDraft.trim() || !vehicleNumberDraft.trim())) {
      setStatusError("כדי להעביר את ההובלה לדרך יש למלא סוג רכב ומספר רכב.");
      return;
    }

    setSavingStatus(true);
    setStatusError("");
    try {
      const response = await fetch(`/api/v1/transports/${selectedTransport.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft,
          vehicleType: vehicleTypeDraft.trim() || undefined,
          vehicleNumber: vehicleNumberDraft.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatusError(payload?.error?.message ?? "עדכון המצב נכשל.");
        return;
      }
      if (vehicleTypeDraft.trim()) setRemembered("transport:vehicleType", vehicleTypeDraft.trim());
      if (vehicleNumberDraft.trim()) setRemembered("transport:vehicleNumber", vehicleNumberDraft.trim());
      router.refresh();
    } catch {
      setStatusError("לא ניתן להתחבר לשרת.");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <>
      <section className="transport-grid" aria-label="סיכום הובלות">
        <article className="metric-card">
          <div><span>סה&quot;כ הובלות</span><Truck aria-hidden="true" /></div>
          <strong>{counts.total}</strong>
          <small>בקבוצה זו</small>
        </article>
        <article className="metric-card">
          <div><span>ממתינות לאיסוף</span><Clock3 aria-hidden="true" /></div>
          <strong>{counts.waiting}</strong>
        </article>
        <article className="metric-card">
          <div><span>בדרך ליעד</span><MapPin aria-hidden="true" /></div>
          <strong>{counts.transit}</strong>
        </article>
        <article className="metric-card">
          <div><span>הגיעו ליעד</span><CheckCircle2 aria-hidden="true" /></div>
          <strong>{counts.arrived}</strong>
        </article>
      </section>

      <div className="transport-toolbar">
        <div>
          <h2>משימות הובלה</h2>
          <p className="panel-heading p">ניהול מרוכז של השינועים הקרובים והאחרונים</p>
        </div>
        <div className="transport-filters">
          <select
            aria-label="סינון לפי סטטוס"
            onChange={(event) => setStatusFilter(event.target.value as "all" | TransportStatus)}
            value={statusFilter}
          >
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
        <button className="button primary" onClick={() => { setIsCreateOpen(true); setCreateError(""); }} type="button">
          <Plus /> הובלה חדשה
        </button>
      </div>

      <section className="transport-list" aria-label="רשימת משימות הובלה">
        {filteredTransports.map((item) => {
          const statusInfo = transportStatusLabels[item.status];
          return (
            <article className="transport-row" key={item.id}>
              <div>
                <strong>{item.sourceCity} ← {item.destinationCity}</strong>
                <small>{item.transportNumber}</small>
              </div>
              <div>
                <small><MapPin aria-hidden="true" /> יציאה: {item.sourceCity}, {item.sourceUnit}, {item.sourceBuilding}, חדר {item.sourceRoom}</small>
                <small>יעד: {item.destinationCity}, {item.destinationUnit}, {item.destinationBuilding}, חדר {item.destinationRoom}</small>
              </div>
              <div>
                <small><CalendarDays aria-hidden="true" /> {formatDate(item.scheduledAt)}</small>
                <small>{item.packageCount} חבילות · יצר: {item.createdByName}</small>
                <span className={`transport-status ${item.status}`}>{statusInfo.label}</span>
              </div>
              <div className="transport-actions">
                <button aria-label={`פתיחת ${item.transportNumber}`} className="button secondary" onClick={() => openDetails(item)} type="button">
                  פרטים <ArrowLeft aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
        {filteredTransports.length === 0 && (
          <div className="empty-state transport-no-results">
            <PackageCheck aria-hidden="true" />
            <h2>לא נמצאו הובלות</h2>
            <p>נסה לחפש לפי מספר ההובלה, תיאור החבילות, היחידה או המיקום.</p>
          </div>
        )}
      </section>

      {selectedTransport && (
        <Modal
          eyebrow={<><Truck aria-hidden="true" /> {selectedTransport.transportNumber}</>}
          onClose={() => setSelectedId(null)}
          title="פרטי הובלה"
          titleId="transport-details-title"
        >
            <div className="transport-details-grid">
              <div><small>שם יוצר ההובלה</small><strong>{selectedTransport.createdByName}</strong></div>
              <div className="transport-detail-wide"><small>מיקום יציאה</small><strong>{selectedTransport.sourceCity}, {selectedTransport.sourceUnit}, {selectedTransport.sourceBuilding}, חדר {selectedTransport.sourceRoom}</strong></div>
              <div className="transport-detail-wide"><small>מיקום יעד</small><strong>{selectedTransport.destinationCity}, {selectedTransport.destinationUnit}, {selectedTransport.destinationBuilding}, חדר {selectedTransport.destinationRoom}</strong></div>
              <div><small>מועד מתוכנן</small><strong>{formatDate(selectedTransport.scheduledAt)}</strong></div>
              <div><small>סטטוס</small><span className={`transport-status ${selectedTransport.status}`}>{transportStatusLabels[selectedTransport.status].label}</span></div>
              {selectedTransport.status !== "waiting" && (
                <>
                  <div className={selectedTransport.status === "arrived" ? "transport-readonly-field" : ""}><small>סוג כלי תחבורה</small><strong>{selectedTransport.vehicleType || "לא צוין"}</strong></div>
                  <div className={selectedTransport.status === "arrived" ? "transport-readonly-field" : ""}><small>מספר רכב</small><strong>{selectedTransport.vehicleNumber || "לא צוין"}</strong></div>
                </>
              )}
              <div><small>מספר חבילות</small><strong>{selectedTransport.packageCount}</strong></div>
              <div className="transport-detail-wide"><small>מה יש בחבילות</small><strong>{selectedTransport.packageSummary || "לא צוין"}</strong></div>
            </div>
            {selectedTransport.status !== "arrived" && (
              <div className="transport-status-editor">
                <h3>עדכון מצב ההובלה</h3>
                <p>ניתן להתקדם רק לפי סדר השלבים. לאחר הגעה ליעד ההובלה ננעלת.</p>
                <label>מצב נוכחי
                  <select
                    onChange={(event) => {
                      setStatusDraft(event.target.value as TransportStatus);
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
                <button className="button primary" disabled={savingStatus} onClick={saveStatus} type="button">
                  {savingStatus ? "שומר..." : "שמירת מצב ופרטי רכב"}
                </button>
              </div>
            )}
        </Modal>
      )}

      {isCreateOpen && (
        <Modal
          eyebrow={<><Truck aria-hidden="true" /> משימה חדשה</>}
          onClose={() => setIsCreateOpen(false)}
          title="יצירת הובלה חדשה"
          titleId="new-transport-title"
        >
            <form className="transport-form" onSubmit={createTransport}>
              <label>שם יוצר ההובלה<input name="createdByName" placeholder="לדוגמה: מעוז" required /></label>
              <div className="transport-location-section transport-form-wide">
                <h3>מיקום יציאה</h3>
                <div className="transport-location-grid">
                  <label>עיר<input name="sourceCity" required /></label>
                  <label>יחידה<input name="sourceUnit" placeholder="לדוגמה: מחלקת תפעול" required /></label>
                  <label>בניין<input name="sourceBuilding" placeholder="לדוגמה: מחסן ראשי" required /></label>
                  <label>חדר<input name="sourceRoom" placeholder="לדוגמה: 4" required /></label>
                </div>
              </div>
              <div className="transport-location-section transport-form-wide">
                <h3>מיקום יעד</h3>
                <div className="transport-location-grid">
                  <label>עיר<input name="destinationCity" required /></label>
                  <label>יחידה<input name="destinationUnit" placeholder="לדוגמה: קריית התקשוב" required /></label>
                  <label>בניין<input name="destinationBuilding" placeholder="לדוגמה: בניין 2" required /></label>
                  <label>חדר<input name="destinationRoom" placeholder="לדוגמה: 214" required /></label>
                </div>
              </div>
              <label>מספר חבילות<input min="1" name="packageCount" required type="number" /></label>
              <label className="transport-form-wide">מה יש בחבילות<textarea name="packageSummary" placeholder="תיאור כללי של הציוד בחבילות" required rows={3} /></label>
              <label>מועד מתוכנן<input name="scheduledAt" type="datetime-local" /></label>
              <label>סטטוס התחלתי<select disabled defaultValue="waiting"><option value="waiting">ממתין לאיסוף</option></select></label>
              {createError && <p className="transport-form-error" role="alert">{createError}</p>}
              <div className="transport-form-actions">
                <button className="button secondary" onClick={() => setIsCreateOpen(false)} type="button">ביטול</button>
                <button className="button primary" disabled={creating} type="submit"><Plus /> {creating ? "יוצר..." : "יצירת הובלה"}</button>
              </div>
            </form>
        </Modal>
      )}
    </>
  );
}
