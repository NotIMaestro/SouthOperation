import { Building2 } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import type { ActiveGroupResult } from "@/lib/active-group";

/** Renders the non-"active" states of resolveActiveGroup: error, no groups, or a group chooser. */
export function GroupPicker({
  result,
  basePath,
}: {
  result: Exclude<ActiveGroupResult, { kind: "active" }>;
  basePath: string;
}) {
  if (result.kind === "error") {
    return <EmptyState description={result.message} icon={Building2} title="שגיאה בטעינת קבוצות" />;
  }
  if (result.kind === "none") {
    return <EmptyState description="אינכם משויכים לאף קבוצה פעילה." icon={Building2} title="אין קבוצות זמינות" />;
  }
  return (
    <div className="card-list">
      {result.groups.map((group) => (
        <Link className="entity-card" href={`${basePath}?groupId=${group.id}`} key={group.id}>
          <div>
            <p className="entity-card-title">{group.name}</p>
            <p className="entity-card-meta">{group.groupCode}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
