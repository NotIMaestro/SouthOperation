import { Building2, Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function GroupsPage() {
  return <main className="page-shell"><PageHeader title="קבוצות" description="ניהול יחידות, שיוך קודים ומעקב סטטוס" action={<button aria-label="יצירת קבוצה תהיה זמינה לאחר חיבור מסד הנתונים" className="button primary" disabled type="button"><Plus /> קבוצה חדשה</button>} /><EmptyState icon={Building2} title="אין קבוצות להצגה" description="קבוצות מורשות יופיעו כאן לאחר חיבור מסד הנתונים." /></main>;
}
