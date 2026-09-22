import { Building2, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { listGroups } from "@/lib/server-api";

export default async function GroupsPage() {
  const groupsResult = await listGroups();

  return (
    <main className="page-shell">
      <PageHeader
        title="קבוצות"
        description="ניהול יחידות, שיוך קודים ומעקב סטטוס"
        action={
          <button aria-label="יצירת קבוצה" className="button primary" type="button">
            <Plus /> קבוצה חדשה
          </button>
        }
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
            <Link className="entity-card" href={`/rooms?groupId=${group.id}`} key={group.id}>
              <div>
                <p className="entity-card-title">{group.name}</p>
                <p className="entity-card-meta">{group.groupCode}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
