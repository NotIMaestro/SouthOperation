"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Boxes, Pencil, Plus } from "lucide-react";

import { Modal } from "@/components/modal";
import { callApi } from "@/lib/api-client";
import type { Location, RoomListItem } from "@/lib/server-api";

/** Create a room in `groupId`, or edit `room` when given. */
export function RoomFormButton({
  groupId,
  locations,
  room,
}: {
  groupId: string;
  locations: Location[];
  room?: RoomListItem;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(room);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (name: string) => String(formData.get(name) ?? "").trim();
    const locationId = text("locationId");

    setPending(true);
    setError("");
    const result = isEdit
      ? await callApi(`/api/v1/rooms/${room!.id}`, {
          method: "PATCH",
          body: {
            name: text("name"),
            description: text("description"),
            managerName: text("managerName"),
            locationId: locationId || null,
          },
        })
      : await callApi(`/api/v1/groups/${groupId}/rooms`, {
          body: {
            name: text("name"),
            description: text("description") || undefined,
            managerName: text("managerName") || undefined,
            locationId: locationId || undefined,
          },
        });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      {isEdit ? (
        <button className="button secondary compact" onClick={() => { setIsOpen(true); setError(""); }} type="button">
          <Pencil aria-hidden="true" /> עריכה
        </button>
      ) : (
        <button className="button primary" onClick={() => { setIsOpen(true); setError(""); }} type="button">
          <Plus aria-hidden="true" /> חדר חדש
        </button>
      )}
      {isOpen && (
        <Modal
          eyebrow={<><Boxes aria-hidden="true" /> {isEdit ? room!.name : "מיפוי חדרים"}</>}
          onClose={() => setIsOpen(false)}
          title={isEdit ? "עריכת חדר" : "הוספת חדר"}
          titleId="room-form-title"
        >
          <form className="transport-form" onSubmit={handleSubmit}>
            <label>שם החדר<input defaultValue={room?.name} maxLength={160} name="name" placeholder="לדוגמה: חדר שרתים 2" required /></label>
            <label>אחראי חדר<input defaultValue={room?.managerName ?? ""} maxLength={160} name="managerName" placeholder="לא חובה" /></label>
            <label className="transport-form-wide">מיקום<select defaultValue={room?.locationId ?? ""} name="locationId">
              <option value="">ללא מיקום</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select></label>
            <label className="transport-form-wide">תיאור<textarea defaultValue={room?.description ?? ""} maxLength={2000} name="description" placeholder="לא חובה" rows={2} /></label>
            {error && <p className="transport-form-error" role="alert">{error}</p>}
            <div className="transport-form-actions">
              <button className="button secondary" onClick={() => setIsOpen(false)} type="button">ביטול</button>
              <button className="button primary" disabled={pending} type="submit">
                {pending ? "שומר..." : isEdit ? "שמירת שינויים" : "הוספת חדר"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
