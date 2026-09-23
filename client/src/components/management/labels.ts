import type { BadgeTone } from "@/components/packing/labels";

export const membershipRoleLabels: Record<"manager" | "commander" | "operator", string> = {
  manager: "מנהל",
  commander: "מפקד",
  operator: "מפעיל",
};

export const userRoleLabels: Record<"admin" | "manager" | "commander" | "operator", string> = {
  admin: "מנהל מערכת",
  ...membershipRoleLabels,
};

export const membershipRoleTones: Record<keyof typeof membershipRoleLabels, BadgeTone> = {
  manager: "success",
  commander: "progress",
  operator: "neutral",
};
