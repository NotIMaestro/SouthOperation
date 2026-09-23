"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";

import { callApi } from "@/lib/api-client";
import type { AppUser } from "@/lib/server-api";

import { membershipRoleLabels } from "./labels";

export function AddMembershipForm({ groupId, users }: { groupId: string; users: AppUser[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setPending(true);
    setError(null);
    const result = await callApi(`/api/v1/groups/${groupId}/memberships`, {
      body: { userId: String(formData.get("userId") ?? ""), role: String(formData.get("role") ?? "") },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>שיוך משתמש לקבוצה</h2>
      <p className="hint">בחירת משתמש שכבר משויך תעדכן את תפקידו בקבוצה.</p>
      <div className="inline-form">
        <div className="field">
          <label htmlFor="membership-user">משתמש</label>
          <select defaultValue="" id="membership-user" name="userId" required>
            <option disabled value="">בחירת משתמש</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.email}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="membership-role">תפקיד בקבוצה</label>
          <select defaultValue="operator" id="membership-role" name="role">
            {Object.entries(membershipRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
          </select>
        </div>
        <button className="button primary" disabled={pending} type="submit">
          <UserPlus aria-hidden="true" /> {pending ? "משייך..." : "שיוך"}
        </button>
      </div>
      {error && <p className="inline-error" style={{ marginTop: "0.6rem" }}>{error}</p>}
    </form>
  );
}
