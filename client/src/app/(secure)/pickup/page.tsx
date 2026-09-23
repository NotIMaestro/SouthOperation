import { GroupPicker } from "@/components/group-picker";
import { PageHeader } from "@/components/page-header";
import { PickupPage } from "@/components/pickup/pickup-page";
import { resolveActiveGroup } from "@/lib/active-group";

export const metadata = { title: "איסוף חבילות" };

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const { groupId: requestedGroupId } = await searchParams;
  const active = await resolveActiveGroup(requestedGroupId);

  if (active.kind !== "active") {
    return (
      <main className="page-shell">
        <PageHeader title="איסוף חבילות" description="בחרו קבוצה כדי להציג את החבילות שממתינות לאיסוף" />
        <GroupPicker basePath="/pickup" result={active} />
      </main>
    );
  }

  return (
    <main className="page-shell package-page" dir="rtl" lang="he" tabIndex={-1}>
      <PageHeader title="איסוף חבילות" description={`${active.group.name} · בחרו את החבילות שהגיעו אליכם ואשרו שכל הפריטים בתוכן התקבלו במלואם וללא נזק.`} />
      <PickupPage groupId={active.group.id} key={active.group.id} />
    </main>
  );
}
