import { Building2 } from "lucide-react";
import Link from "next/link";

import { ActionButton } from "@/components/action-button";
import { EmptyState } from "@/components/empty-state";
import { CreateGroupButton } from "@/components/management/create-group-button";
import { PageHeader } from "@/components/page-header";
import { getViewerAccess, listGroupCodes, listGroups } from "@/lib/server-api";

export default async function GroupsPage() {
  const [groupsResult, accessResult] = await Promise.all([listGroups(), getViewerAccess()]);
  const isAdmin = accessResult.ok && accessResult.data.isAdmin;
  const groupCodesResult = isAdmin ? await listGroupCodes() : undefined;

  return (
    <main className="page-shell">
      <PageHeader
        title="קבוצות"
        description="ניהול יחידות, שיוך קודים ומעקב סטטוס"
        action={isAdmin && groupCodesResult?.ok ? <CreateGroupButton groupCodes={groupCodesResult.data} /> : undefined}
      />
      {!groupsResult.ok ? (
        <EmptyState icon={Building2} title="שגיאה בטעינת קבוצות" description={groupsResult.message} />
      ) : groupsResult.data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="אין קבוצות להצגה"
          description="קבוצות מורשות יופיעו כאן לאחר שייווצרו."
        />
      ) : (
        <div className="card-list">
          {groupsResult.data.map((group) => (
            <div className="entity-card" key={group.id}>
              <div>
                <Link className="entity-card-title" href={`/rooms?groupId=${group.id}`}>{group.name}</Link>
                <p className="entity-card-meta">
                  {group.groupCode}
                  {group.contactName ? ` · איש קשר: ${group.contactName}` : ""}
                  {group.contactPhone ? ` · ${group.contactPhone}` : ""}
                </p>
              </div>
              <div className="entity-card-actions">
                <Link className="button secondary compact" href={`/rooms?groupId=${group.id}`}>חדרים</Link>
                <Link className="button secondary compact" href={`/memberships?groupId=${group.id}`}>בכירים</Link>
                {isAdmin && (
                  <ActionButton confirmLabel="לאשר מחיקה?" method="DELETE" url={`/api/v1/groups/${group.id}`}>
                    מחיקה
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
