import { PageHeader } from "@/components/page-header";
import { PickupPage } from "@/components/pickup/pickup-page";

export const metadata = { title: "איסוף חבילות" };
export default function CollectionPage() {
  return (
    <main className="page-shell package-page" dir="rtl" lang="he" tabIndex={-1}>
      <PageHeader title="איסוף חבילות" description="בחרו את החבילות שהגיעו אליכם ואשרו שכל הפריטים בתוכן התקבלו במלואם וללא נזק." />
      <PickupPage />
    </main>
  );
}
