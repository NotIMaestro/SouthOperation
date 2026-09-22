import { PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function ReceivingPage() {
  return (
    <main className="page-shell">
      <PageHeader title="קבלת חבילות" description="קליטת חבילות שהגיעו ליעדן ובדיקתן" />
      <EmptyState
        icon={PackageOpen}
        title="אין חבילות ממתינות לקבלה"
        description="חבילות שיגיעו ליעדן וימתינו לקליטה יופיעו כאן."
      />
    </main>
  );
}