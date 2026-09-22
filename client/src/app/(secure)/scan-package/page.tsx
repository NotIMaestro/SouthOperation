import Link from "next/link";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ScanPackage } from "@/components/packages/scan-package";

export const metadata = { title: "Scan Package" };
export default function ScanPackagePage() {
  return <main className="page-shell package-page" lang="en" dir="ltr">
    <PageHeader title="Scan Package" description="One label. Everything you need to know about your package." action={<Link className="button secondary" href="/demo/qr-generator"><QrCode aria-hidden="true" /> Demo: QR Code Generator</Link>} />
    <div className="package-demo-banner"><span className="package-badge">MOCK DATA</span><p>A local prototype with fictional packages. No database connection required.</p></div>
    <ScanPackage />
  </main>;
}
