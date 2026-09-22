import { PackageCheck } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PackingPage() {
  return (
    <main className="page-shell">
      <PageHeader title="אריזה" description="פתיחת יחידות אריזה וסימון פריטים לפי חדר" />
      <EmptyState
        description="אריזה אינה זמינה במצב פיתוח מקומי (ללא הזדהות)."
        icon={PackageCheck}
        title="לא זמין במצב מקומי"
      />
    </main>
  );
}
