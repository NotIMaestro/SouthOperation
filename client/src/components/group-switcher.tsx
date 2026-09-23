"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { selectGroup } from "@/lib/select-group-action";

const flowRoots = ["/packing", "/transport", "/receiving", "/pickup", "/rooms", "/package-status", "/memberships", "/logistics"];

export function GroupSwitcher({
  groups,
  selectedGroupId,
}: {
  groups: { id: string; name: string; groupCode: string }[];
  selectedGroupId?: string;
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Shows the picked group right away instead of snapping back until the server answers.
  const [shownGroupId, setShownGroupId] = useOptimistic(selectedGroupId ?? "");

  if (groups.length <= 1) return null;

  function switchGroup(groupId: string) {
    const flowRoot = flowRoots.find((root) => pathname === root || pathname.startsWith(`${root}/`));
    startTransition(async () => {
      setShownGroupId(groupId);
      await selectGroup(groupId, flowRoot ?? "/dashboard");
    });
  }

  return (
    <label className="group-switcher">
      <span className="group-switcher-label">
        <Building2 aria-hidden="true" /> קבוצה
      </span>
      <select
        aria-busy={pending}
        aria-label="בחירת קבוצה"
        disabled={pending}
        onChange={(event) => switchGroup(event.target.value)}
        value={shownGroupId}
      >
        {!shownGroupId && <option disabled value="">בחירת קבוצה</option>}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
}
