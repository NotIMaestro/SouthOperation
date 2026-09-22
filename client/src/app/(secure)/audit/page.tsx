import { FileClock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function AuditPage() {
  return <main className="page-shell"><PageHeader title="יומן ביקורת" description="תיעוד בלתי־משתנה של פעולות ושינויי הרשאה" /><EmptyState icon={FileClock} title="אין אירועים להצגה" description="אירועי ביקורת יופיעו כאן ללא תוכן רגיש או סודות." /></main>;
}
