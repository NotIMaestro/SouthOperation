import { GroupPicker } from "@/components/group-picker";
import { PageHeader } from "@/components/page-header";
import { ReceivingPage } from "@/components/receiving/receiving-page";
import { resolveActiveGroup } from "@/lib/active-group";

export const metadata = { title: "קבלת הובלות" };

export default async function DeliveryReceivingPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;
  const active = await resolveActiveGroup(requestedGroupId);

  if (active.kind !== "active") {
    return (
      <main className="page-shell">
        <PageHeader title="קבלת הובלות" description="בחרו קבוצה כדי להציג את ההובלות שהגיעו ליעד" />
        <GroupPicker basePath="/receiving" result={active} />
      </main>
    );
  }

  return (
    <main className="page-shell package-page" dir="rtl" lang="he" tabIndex={-1}>
      <PageHeader title="קבלת הובלות" description={`${active.group.name} · בחרו את ההובלות שהגיעו ליעד, בדקו את החבילות המשויכות אליהן ואשרו את קבלתן.`} />
      <ReceivingPage groupId={active.group.id} key={active.group.id} />
    </main>
  );
}
