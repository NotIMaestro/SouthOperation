import { PackageCheck } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PickupPage() {
  return (
    <main className="page-shell">
      <PageHeader title="איסוף חבילות" description="ריכוז חבילות הממתינות לאיסוף והעברה" />
      <EmptyState
        icon={PackageCheck}
        title="אין חבילות לאיסוף"
        description="חבילות שימתינו לאיסוף יוצגו כאן."
      />
    </main>
  );
}