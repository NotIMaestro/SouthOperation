import { PackageCheck } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PackageStatusPage() {
  return (
    <main className="page-shell">
      <PageHeader
        title="סטטוס חבילות משוייכות"
        description="מעקב אחר חבילות ששויכו לתהליך ההעברה"
      />
      <EmptyState
        icon={PackageCheck}
        title="אין חבילות משוייכות להצגה"
        description="חבילות שיוכנו לתהליך ההעברה יוצגו כאן."
      />
    </main>
  );
}