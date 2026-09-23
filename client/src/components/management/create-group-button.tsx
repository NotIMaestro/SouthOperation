"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Building2, Plus } from "lucide-react";

import { Modal } from "@/components/modal";
import { callApi } from "@/lib/api-client";
import type { GroupCode } from "@/lib/server-api";

export function CreateGroupButton({ groupCodes }: { groupCodes: GroupCode[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (name: string) => String(formData.get(name) ?? "").trim() || undefined;

    setPending(true);
    setError("");
    const result = await callApi("/api/v1/groups", {
      body: {
        groupCodeId: String(formData.get("groupCodeId") ?? ""),
        name: text("name"),
        contactName: text("contactName"),
        contactPhone: text("contactPhone"),
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
      <button className="button primary" onClick={() => { setIsOpen(true); setError(""); }} type="button">
        <Plus aria-hidden="true" /> קבוצה חדשה
      </button>
      {isOpen && (
        <Modal
          eyebrow={<><Building2 aria-hidden="true" /> ניהול קבוצות</>}
          onClose={() => setIsOpen(false)}
          title="יצירת קבוצה חדשה"
          titleId="new-group-title"
        >
          <form className="transport-form" onSubmit={handleSubmit}>
            <label className="transport-form-wide">שם הקבוצה<input maxLength={160} name="name" placeholder="לדוגמה: חטיבת תקשוב דרום" required /></label>
            <label className="transport-form-wide">קוד קבוצה<select defaultValue="" name="groupCodeId" required>
              <option disabled value="">בחירת קוד</option>
              {groupCodes.map((code) => <option key={code.id} value={code.id}>{code.code} · {code.description}</option>)}
            </select></label>
            <label>איש קשר<input maxLength={160} name="contactName" placeholder="לא חובה" /></label>
            <label>טלפון<input dir="ltr" maxLength={32} minLength={5} name="contactPhone" placeholder="050-0000000" type="tel" /></label>
            {error && <p className="transport-form-error" role="alert">{error}</p>}
            <div className="transport-form-actions">
              <button className="button secondary" onClick={() => setIsOpen(false)} type="button">ביטול</button>
              <button className="button primary" disabled={pending} type="submit"><Plus aria-hidden="true" /> {pending ? "יוצר..." : "יצירת קבוצה"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
