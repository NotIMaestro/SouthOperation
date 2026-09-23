import { PageHeader } from "@/components/page-header";
import { ReceivingPage } from "@/components/receiving/receiving-page";

export const metadata = { title: "קבלת הובלות" };
export default function DeliveryReceivingPage() {
  return <main className="page-shell package-page" dir="rtl" lang="he" tabIndex={-1}>
    <PageHeader title="קבלת הובלות" description="בחרו את ההובלות שהגיעו ליעד, בדקו את החבילות המשויכות אליהן ואשרו את קבלתן." />
    <ReceivingPage />
  </main>;
}
