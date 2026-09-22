import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function MembershipsPage() {
  return <main className="page-shell"><PageHeader title="הרשאות ושיוכים" description="גישה מצומצמת לפי תפקיד וקבוצה" /><EmptyState icon={UsersRound} title="אין שיוכים להצגה" description="מנהלים יוכלו להזמין משתמשים ולשייך אותם לקבוצות מורשות." /></main>;
}
