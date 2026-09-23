import { listGroups, type Group, type ServerResult } from "@/lib/server-api";
import { getSelectedGroupIdFromCookie } from "@/lib/selected-group";

export type ActiveGroupResult =
  | { kind: "error"; message: string }
  | { kind: "none" }
  | { kind: "choose"; groups: Group[] }
  | { kind: "active"; group: Group; groups: Group[] };

/** Same precedence the flow pages use: ?groupId, then the group-switcher cookie, then the only group. */
export async function resolveActiveGroup(requestedGroupId?: string): Promise<ActiveGroupResult> {
  const groupsResult: ServerResult<Group[]> = await listGroups();
  if (!groupsResult.ok) return { kind: "error", message: groupsResult.message };

  const groups = groupsResult.data;
  if (groups.length === 0) return { kind: "none" };

  const cookieGroupId = await getSelectedGroupIdFromCookie();
  const byId = (id?: string) => (id ? groups.find((group) => group.id === id) : undefined);
  const group = byId(requestedGroupId) ?? byId(cookieGroupId) ?? (groups.length === 1 ? groups[0] : undefined);

  return group ? { kind: "active", group, groups } : { kind: "choose", groups };
}
