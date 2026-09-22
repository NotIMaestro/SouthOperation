import Link from "next/link";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QrGenerator } from "@/components/packages/qr-generator";

export const metadata = { title: "QR Code Generator · Demo" };
export default function QrGeneratorPage() {
  return <main className="page-shell package-page generator-page" lang="en" dir="ltr">
    <PageHeader title="QR Code Generator" description="Create a demo package, print its label, and try the scanning workflow." action={<Link className="button secondary" href="/scan-package"><ScanLine aria-hidden="true" /> Scan Package</Link>} />
    <QrGenerator />
  </main>;
}
