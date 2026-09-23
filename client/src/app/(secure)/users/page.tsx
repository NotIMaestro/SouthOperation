import { createGroup, listActiveGroupCodes, listVisibleGroups } from "@south-operation/server/groups";
import { assignUserToGroup, listUsersForAdministration, requireGlobalRole, setUserRole } from "@south-operation/server/authorization";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import { getActor } from "@/lib/actor";
import { membershipRoleSchema, userRoleSchema, uuidSchema } from "@/lib/api-schemas";

const systemRoleLabels = { pending: "ללא הרשאות", admin: "מנהל מערכת", manager: "מנהל", commander: "מפקד", operator: "מפעיל" } as const;
const groupRoleLabels = { manager: "מנהל קבוצה", commander: "מפקד קבוצה", operator: "מפעיל קבוצה" } as const;

export default async function UsersPage() {
  const actor = await getActor();
  requireGlobalRole(actor, ["admin"]);
  const [users, groups, groupCodes] = await Promise.all([listUsersForAdministration(), listVisibleGroups(actor), listActiveGroupCodes()]);

  async function changeRole(formData: FormData) {
    "use server";
    const admin = await getActor(); requireGlobalRole(admin, ["admin"]);
    await setUserRole(admin, uuidSchema.parse(formData.get("userId")), userRoleSchema.parse(formData.get("role")), crypto.randomUUID());
    revalidatePath("/users");
  }
  async function assignGroup(formData: FormData) {
    "use server";
    const admin = await getActor(); requireGlobalRole(admin, ["admin"]);
    await assignUserToGroup(admin, uuidSchema.parse(formData.get("userId")), uuidSchema.parse(formData.get("groupId")), membershipRoleSchema.parse(formData.get("role")), crypto.randomUUID());
    revalidatePath("/users");
  }
  async function addGroup(formData: FormData) {
    "use server";
    const admin = await getActor(); requireGlobalRole(admin, ["admin"]);
    await createGroup(admin, { groupCodeId: uuidSchema.parse(formData.get("groupCodeId")), name: String(formData.get("name") ?? "").trim(), contactName: String(formData.get("contactName") ?? "").trim() || undefined, contactPhone: String(formData.get("contactPhone") ?? "").trim() || undefined }, crypto.randomUUID());
    revalidatePath("/users");
  }

  return <main className="page-shell">
    <PageHeader title="ניהול משתמשים וקבוצות" description="משתמשי Entra חדשים מתחילים ללא הרשאות. הקצו להם תפקיד ושיוך קבוצה כאן." />
    <section className="section-panel"><h2>תפקיד מערכת</h2><form action={changeRole} className="form-grid"><select aria-label="משתמש" defaultValue="" name="userId" required><option disabled value="">בחרו משתמש</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName} — {user.email}</option>)}</select><select aria-label="תפקיד מערכת" defaultValue="pending" name="role">{Object.entries(systemRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><button className="button" type="submit">שמירת תפקיד</button></form></section>
    <section className="section-panel"><h2>שיוך משתמש לקבוצה</h2><form action={assignGroup} className="form-grid"><select aria-label="משתמש" defaultValue="" name="userId" required><option disabled value="">בחרו משתמש</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select><select aria-label="קבוצה" defaultValue="" name="groupId" required><option disabled value="">בחרו קבוצה</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.groupCode})</option>)}</select><select aria-label="תפקיד בקבוצה" defaultValue="operator" name="role">{Object.entries(groupRoleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><button className="button" type="submit">שייכו לקבוצה</button></form></section>
    <section className="section-panel"><h2>יצירת קבוצה</h2><form action={addGroup} className="form-grid"><input aria-label="שם קבוצה" name="name" placeholder="שם הקבוצה" maxLength={160} required /><select aria-label="קוד קבוצה" defaultValue="" name="groupCodeId" required><option disabled value="">בחרו קוד קבוצה</option>{groupCodes.map((code) => <option key={code.id} value={code.id}>{code.code} — {code.description}</option>)}</select><input aria-label="איש קשר" name="contactName" placeholder="איש קשר (אופציונלי)" maxLength={160} /><input aria-label="טלפון איש קשר" name="contactPhone" placeholder="טלפון (אופציונלי)" maxLength={32} /><button className="button" type="submit">יצירת קבוצה</button></form></section>
  </main>;
}
