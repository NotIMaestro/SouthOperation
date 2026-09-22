import Link from "next/link";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ScanPackage } from "@/components/packages/scan-package";

export const metadata = { title: "סריקת חבילה" };
export default function ScanPackagePage() {
  return <main className="page-shell package-page" lang="he" dir="rtl">
    <PageHeader title="סריקת חבילה" description="תווית אחת עם כל המידע שצריך לדעת על החבילה." action={<Link className="button secondary" href="/demo/qr-generator"><QrCode aria-hidden="true" /> הדגמה: מחולל קודי QR</Link>} />
    <div className="package-demo-banner"><span className="package-badge">נתוני הדגמה</span><p>אב־טיפוס מקומי עם חבילות בדיוניות. אין צורך בחיבור למסד נתונים.</p></div>
    <ScanPackage />
  </main>;
}
