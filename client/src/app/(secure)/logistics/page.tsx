import { Waypoints } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function LogisticsPage() {
  return (
    <main className="page-shell">
      <PageHeader
        title="הצגת לוגיסטיקה"
        description="תמונת מצב של תהליכי הלוגיסטיקה והמשימות הפעילות"
      />
      <EmptyState
        icon={Waypoints}
        title="אין נתוני לוגיסטיקה להצגה"
        description="נתוני לוגיסטיקה יוצגו כאן לאחר חיבור הנתונים."
      />
    </main>
  );
}