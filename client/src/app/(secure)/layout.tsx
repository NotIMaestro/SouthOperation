import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function SecureLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <AppShell userName={session.user.name ?? "משתמש ארגוני"}>
      {children}
    </AppShell>
  );
}
