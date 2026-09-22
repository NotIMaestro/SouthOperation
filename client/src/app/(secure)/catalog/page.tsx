import { LibraryBig } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function CatalogPage() {
  return <main className="page-shell"><PageHeader title="קטלוג ציוד" description="סוגים, קטגוריות ותתי־קטגוריות מבוקרים" /><EmptyState icon={LibraryBig} title="הקטלוג טרם נטען" description="רשומות קטלוג פעילות יופיעו לאחר חיבור מסד הנתונים." /></main>;
}
