"use client";

import { usePathname, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { SELECTED_GROUP_COOKIE } from "@/lib/selected-group-cookie-name";

const flowRoots = ["/packing", "/transport", "/receiving", "/pickup", "/rooms", "/package-status"];

export function GroupSwitcher({
  groups,
  selectedGroupId,
}: {
  groups: { id: string; name: string; groupCode: string }[];
  selectedGroupId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (groups.length <= 1) return null;

  function switchGroup(groupId: string) {
    document.cookie = `${SELECTED_GROUP_COOKIE}=${encodeURIComponent(groupId)}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const flowRoot = flowRoots.find((root) => pathname === root || pathname.startsWith(`${root}/`));
    router.push(flowRoot ?? "/dashboard");
    router.refresh();
  }

  return (
    <label className="group-switcher">
      <span className="group-switcher-label">
        <Building2 aria-hidden="true" /> קבוצה
      </span>
      <select
        aria-label="בחירת קבוצה"
        onChange={(event) => switchGroup(event.target.value)}
        value={selectedGroupId ?? ""}
      >
        {!selectedGroupId && <option disabled value="">בחירת קבוצה</option>}
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </label>
  );
}
