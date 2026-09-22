"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";

const packingUnitSchema = z.object({
  id: z.uuid(),
  serialNumber: z.string().regex(/^\d{5}$/),
  status: z.literal("in_transit"),
  destination: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
});

const transportUnitSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  groupName: z.string(),
  licensePlate: z.string(),
  status: z.literal("in_transit"),
  version: z.number().int().positive(),
  departedAt: z.string().nullable(),
  packingUnits: z.array(packingUnitSchema),
});

const listResponseSchema = z.object({ data: z.array(transportUnitSchema) });
const completeResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: z.literal("released"),
    receivedCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    notificationQueued: z.boolean(),
  }),
});

type TransportUnit = z.infer<typeof transportUnitSchema>;
type Completion = z.infer<typeof completeResponseSchema>["data"];

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? "לא ניתן היה להשלים את הפעולה.";
  } catch {
    return "לא ניתן היה להשלים את הפעולה.";
  }
}

export default function ReceivingPage() {
  const [transports, setTransports] = useState<TransportUnit[]>([]);
  const [selectedTransportId, setSelectedTransportId] = useState("");
  const [receivedIds, setReceivedIds] = useState<Set<string>>(new Set());
  const [showMissingReview, setShowMissingReview] = useState(false);
  const [completion, setCompletion] = useState<Completion>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const selectedTransport = useMemo(
    () => transports.find((transport) => transport.id === selectedTransportId),
    [selectedTransportId, transports],
  );
  const missingPackingUnits = useMemo(
    () => selectedTransport?.packingUnits.filter((unit) => !receivedIds.has(unit.id)) ?? [],
    [receivedIds, selectedTransport],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const response = await fetch("/api/v1/receiving/transports", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readError(response));
        const payload = listResponseSchema.parse(await response.json());
        setTransports(payload.data);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "טעינת ההובלות נכשלה.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  function selectTransport(transportId: string) {
    setSelectedTransportId(transportId);
    setReceivedIds(new Set());
    setShowMissingReview(false);
    setCompletion(undefined);
    setError(undefined);
  }

  function togglePackingUnit(id: string) {
    setReceivedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowMissingReview(false);
  }

  function selectAll() {
    if (!selectedTransport) return;
    const allSelected = receivedIds.size === selectedTransport.packingUnits.length;
    setReceivedIds(
      allSelected ? new Set() : new Set(selectedTransport.packingUnits.map((unit) => unit.id)),
    );
    setShowMissingReview(false);
  }

  async function completeUnloading() {
    if (!selectedTransport) return;
    if (missingPackingUnits.length > 0 && !showMissingReview) {
      setShowMissingReview(true);
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/v1/receiving/transports/${encodeURIComponent(selectedTransport.id)}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: selectedTransport.version,
            receivedPackingUnitIds: [...receivedIds],
          }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const payload = completeResponseSchema.parse(await response.json());
      setCompletion(payload.data);
      setTransports((current) => current.filter((item) => item.id !== selectedTransport.id));
      setShowMissingReview(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "סיום הפריקה נכשל.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completion) {
    return (
      <main className="page-shell receiving-page">
        <PageHeader title="קבלת ציוד" description="קליטה ופריקה של יחידות הובלה שהגיעו" />
        <section className="receiving-success" aria-live="polite">
          <span><CheckCheck aria-hidden="true" /></span>
          <p className="eyebrow">הפריקה הושלמה</p>
          <h2>יחידת ההובלה שוחררה</h2>
          <p>
            {completion.receivedCount} אריזות התקבלו
            {completion.missingCount > 0 ? `, ${completion.missingCount} סומנו כחסרות` : " ללא חוסרים"}.
          </p>
          <small>אירוע ההודעה נרשם לשליחה מאובטחת דרך תור המערכת.</small>
          <button className="button primary" type="button" onClick={() => selectTransport("")}>
            <RotateCcw aria-hidden="true" /> קבלת הובלה נוספת
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell receiving-page">
      <PageHeader
        title="קבלת ציוד"
        description="סימון האריזות שהגיעו, תיעוד חוסרים ושחרור יחידת ההובלה"
      />

      <ol className="receiving-steps" aria-label="שלבי קבלת ציוד">
        <li className={selectedTransport ? "done" : "active"}><span>1</span> בחירת הובלה</li>
        <li className={selectedTransport && !showMissingReview ? "active" : ""}><span>2</span> בדיקת אריזות</li>
        <li className={showMissingReview ? "active" : ""}><span>3</span> אישור וסיום</li>
      </ol>

      {error ? <div className="receiving-error" role="alert"><AlertTriangle /> {error}</div> : null}

      <section className="panel receiving-selector" aria-labelledby="transport-selection-title">
        <div className="panel-heading">
          <div>
            <h2 id="transport-selection-title">יחידת הובלה בדרך</h2>
            <p>בחרו לפי מספר הרישוי והיחידה</p>
          </div>
          <Truck aria-hidden="true" />
        </div>
        {loading ? (
          <div className="receiving-loading"><LoaderCircle className="spin" /> טוען הובלות פעילות…</div>
        ) : transports.length === 0 ? (
          <div className="receiving-empty">אין כרגע יחידות הובלה הממתינות לפריקה.</div>
        ) : (
          <div className="transport-choice-grid">
            {transports.map((transport) => (
              <button
                aria-pressed={transport.id === selectedTransportId}
                className={`transport-choice ${transport.id === selectedTransportId ? "selected" : ""}`}
                key={transport.id}
                onClick={() => selectTransport(transport.id)}
                type="button"
              >
                <span><Truck aria-hidden="true" /></span>
                <strong>{transport.licensePlate}</strong>
                <small>{transport.groupName} · {transport.packingUnits.length} אריזות</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedTransport ? (
        <section className="panel receiving-manifest" aria-labelledby="manifest-title">
          <div className="manifest-heading">
            <div>
              <p className="eyebrow">רכב {selectedTransport.licensePlate}</p>
              <h2 id="manifest-title">סימון האריזות שהגיעו בפועל</h2>
              <p>יש לסמן ✓ לכל יחידת אריזה שנפרקה ונבדקה.</p>
            </div>
            <div className="manifest-count">
              <strong>{receivedIds.size}/{selectedTransport.packingUnits.length}</strong>
              <small>התקבלו</small>
            </div>
          </div>

          <button className="select-all-button" onClick={selectAll} type="button">
            <Check aria-hidden="true" />
            {receivedIds.size === selectedTransport.packingUnits.length ? "נקה סימון" : "סמן את כולן"}
          </button>

          <div className="packing-unit-list">
            {selectedTransport.packingUnits.map((unit) => {
              const checked = receivedIds.has(unit.id);
              return (
                <label className={`packing-unit-row ${checked ? "checked" : ""}`} key={unit.id}>
                  <input
                    checked={checked}
                    onChange={() => togglePackingUnit(unit.id)}
                    type="checkbox"
                  />
                  <span className="packing-check" aria-hidden="true"><Check /></span>
                  <span className="packing-icon"><PackageCheck aria-hidden="true" /></span>
                  <span className="packing-copy">
                    <strong>יחידת אריזה {unit.serialNumber}</strong>
                    <small>{unit.destination ?? "יעד לא הוגדר"} · {unit.itemCount} פריטים</small>
                  </span>
                  <span className="packing-state">{checked ? "התקבלה" : "טרם סומנה"}</span>
                </label>
              );
            })}
          </div>

          {showMissingReview ? (
            <div className="missing-review" role="alert">
              <div className="missing-review-title">
                <AlertTriangle aria-hidden="true" />
                <div>
                  <strong>שימו לב, לא כל האריזות נפרקו</strong>
                  <p>האריזות הבאות יסומנו כחסרות, יחד עם הפריטים המשויכים אליהן.</p>
                </div>
              </div>
              <ul>
                {missingPackingUnits.map((unit) => (
                  <li key={unit.id}><ClipboardList /> יחידת אריזה {unit.serialNumber}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="receiving-actions">
            {showMissingReview ? (
              <button className="button secondary" onClick={() => setShowMissingReview(false)} type="button">
                <ArrowRight /> חזרה לבדיקה
              </button>
            ) : null}
            <button
              className="button primary"
              disabled={submitting}
              onClick={() => void completeUnloading()}
              type="button"
            >
              {submitting ? <LoaderCircle className="spin" /> : <CheckCheck />}
              {showMissingReview ? "סיום העדכון ושחרור ההובלה" : "סיום פריקה"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
