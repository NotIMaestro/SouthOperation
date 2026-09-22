import { ClipboardCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ReportsPage() {
  return <main className="page-shell"><PageHeader title="דוחות מיפוי" description="יצירה, הגשה ובקרה של פריטי ציוד" action={<button aria-label="יצירת דוח תהיה זמינה לאחר חיבור מסד הנתונים" className="button primary" disabled type="button"><Plus /> דוח חדש</button>} /><EmptyState icon={ClipboardCheck} title="אין דוחות להצגה" description="דוחות עבור הקבוצה שנבחרה יופיעו כאן." /></main>;
}
