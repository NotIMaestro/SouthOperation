import { UsersRound } from "lucide-react";

import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { GroupPicker } from "@/components/group-picker";
import { AddMembershipForm } from "@/components/management/add-membership-form";
import { membershipRoleLabels, membershipRoleTones } from "@/components/management/labels";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/packing/status-badge";
import { resolveActiveGroup } from "@/lib/active-group";
import { getViewerAccess, listActiveUsers, listMembershipsForGroup } from "@/lib/server-api";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(value);
}

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;
  const active = await resolveActiveGroup(requestedGroupId);

  if (active.kind !== "active") {
    return (
      <main className="page-shell">
        <PageHeader title="הצגת בכירים" description="בחרו קבוצה כדי להציג את בעלי התפקידים בה" />
        <GroupPicker basePath="/memberships" result={active} />
      </main>
    );
  }

  const groupId = active.group.id;
  const [membershipsResult, accessResult] = await Promise.all([
    listMembershipsForGroup(groupId),
    getViewerAccess(groupId),
  ]);
  const canManage = accessResult.ok && accessResult.data.canManageGroup;
  const usersResult = canManage ? await listActiveUsers() : undefined;

  if (!membershipsResult.ok) {
    return (
      <main className="page-shell">
        <PageHeader title="הצגת בכירים" description={active.group.name} />
        <EmptyState icon={UsersRound} title="שגיאה בטעינת שיוכים" description={membershipsResult.message} />
      </main>
    );
  }

  const members = membershipsResult.data;
  const assignableUsers = usersResult?.ok ? usersResult.data : [];

  return (
    <main className="page-shell">
      <PageHeader title="הצגת בכירים" description={`${active.group.name} · בעלי תפקידים והרשאות בקבוצה`} />
      <div className="stack">
        {members.length === 0 ? (
          <EmptyState icon={UsersRound} title="אין שיוכים להצגה" description="עדיין לא שויכו משתמשים לקבוצה זו." />
        ) : (
          <div className="card-list">
            {members.map((member) => (
              <div className="entity-card" key={member.userId}>
                <div>
                  <p className="entity-card-title">{member.displayName}</p>
                  <p className="entity-card-meta">{member.email} · שויך ב־{formatDate(member.assignedAt)}</p>
                </div>
                <div className="entity-card-actions">
                  <StatusBadge label={membershipRoleLabels[member.role]} tone={membershipRoleTones[member.role]} />
                  {canManage && (
                    <ActionButton
                      confirmLabel="להסיר מהקבוצה?"
                      method="DELETE"
                      url={`/api/v1/groups/${groupId}/memberships/${member.userId}`}
                    >
                      הסרה
                    </ActionButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {canManage && <AddMembershipForm groupId={groupId} users={assignableUsers} />}
      </div>
    </main>
  );
}
