import { PackageCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function PackingPage() {
  return <main className="page-shell"><PageHeader title="אריזה" description="פתיחת יחידות אריזה וסימון פריטים לפי חדר" /><EmptyState icon={PackageCheck} title="יש לבחור חדר" description="בחרו חדר ממופה כדי לפתוח ולנהל את יחידות האריזה שלו." /></main>;
}
