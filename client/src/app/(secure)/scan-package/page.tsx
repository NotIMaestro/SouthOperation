import { PageHeader } from "@/components/page-header";
import { ScanPackingUnit } from "@/components/packing/scan-packing-unit";

export const metadata = { title: "סריקת יחידת אריזה" };
export default function ScanPackagePage() {
  return (
    <main className="page-shell package-page" lang="he" dir="rtl">
      <PageHeader title="סריקת יחידת אריזה" description="סרקו את תווית ה־QR שהודפסה בסגירת האריזה כדי לראות את מצבה בזמן אמת." />
      <ScanPackingUnit />
    </main>
  );
}
