import { PackageCheck } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PackingUnitPage() {
  return (
    <main className="page-shell">
      <p className="breadcrumb">
        <Link href="/packing">אריזה</Link>
      </p>
      <PageHeader description="פרטי יחידת אריזה" title="אריזה" />
      <EmptyState
        description="אריזה אינה זמינה במצב פיתוח מקומי (ללא הזדהות)."
        icon={PackageCheck}
        title="לא זמין במצב מקומי"
      />
    </main>
  );
}
