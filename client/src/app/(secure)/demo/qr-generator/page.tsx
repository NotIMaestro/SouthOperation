import Link from "next/link";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QrGenerator } from "@/components/packages/qr-generator";
import { PickupDemoControls } from "@/components/pickup/demo-controls";

export const metadata = { title: "מחולל קודי QR · הדגמה" };
export default function QrGeneratorPage() {
  return <main className="page-shell package-page generator-page" lang="he" dir="rtl">
    <PageHeader title="מחולל קודי QR" description="צרו חבילת הדגמה, הדפיסו תווית ונסו את תהליך הסריקה." action={<Link className="button secondary" href="/scan-package"><ScanLine aria-hidden="true" /> סריקת חבילה</Link>} />
    <QrGenerator />
    <PickupDemoControls />
  </main>;
}
