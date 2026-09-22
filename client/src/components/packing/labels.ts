import type { MappingReport, PackingUnit, Room, Transport } from "@/lib/server-api";

type BadgeTone = "neutral" | "progress" | "success" | "warning" | "danger";

export const roomStatusLabels: Record<Room["status"], { label: string; tone: BadgeTone }> = {
  unstarted: { label: "טרם מופה", tone: "neutral" },
  in_progress: { label: "במיפוי", tone: "progress" },
  completed: { label: "מופה", tone: "success" },
  archived: { label: "בארכיון", tone: "neutral" },
};

export const roomPackingStatusLabels: Record<Room["packingStatus"], { label: string; tone: BadgeTone }> = {
  not_started: { label: "אריזה טרם החלה", tone: "neutral" },
  in_packing: { label: "באריזה", tone: "progress" },
  paused: { label: "אריזה מושהית", tone: "warning" },
  closed: { label: "אריזה הושלמה", tone: "success" },
};

export const packingUnitStatusLabels: Record<PackingUnit["status"], { label: string; tone: BadgeTone }> = {
  awaiting_packing: { label: "ממתין לאריזה", tone: "neutral" },
  packing_in_progress: { label: "אריזה בתהליך", tone: "progress" },
  closed: { label: "נסגרה", tone: "success" },
};

export const packingUnitTypeLabels: Record<PackingUnit["unitType"], string> = {
  professional_carton: "קרטון מקצועי",
  personal_carton: "קרטון אישי",
  pallet: "משטח",
  dolav: "דולב",
  bulk: "תפזורת",
};

export const reportStatusLabels: Record<MappingReport["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "טיוטה", tone: "neutral" },
  submitted: { label: "הוגש", tone: "progress" },
  approved: { label: "אושר", tone: "success" },
  rejected: { label: "נדחה", tone: "danger" },
};

export const transportStatusLabels: Record<Transport["status"], { label: string; tone: BadgeTone }> = {
  waiting: { label: "ממתין לאיסוף", tone: "neutral" },
  transit: { label: "בדרך ליעד", tone: "progress" },
  arrived: { label: "הגיע ליעד", tone: "success" },
};

export type { BadgeTone };
