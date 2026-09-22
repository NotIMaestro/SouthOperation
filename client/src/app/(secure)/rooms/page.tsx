import { Boxes } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function RoomsPage() {
  return <main className="page-shell"><PageHeader title="חדרים" description="מעקב אחר מצב המיפוי וההתקדמות בכל חדר" /><EmptyState icon={Boxes} title="יש לבחור קבוצה" description="בחרו קבוצה מורשית כדי להציג את החדרים השייכים אליה." /></main>;
}
