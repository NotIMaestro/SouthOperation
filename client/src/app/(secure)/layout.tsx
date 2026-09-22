import { AppShell } from "@/components/app-shell";

export default async function SecureLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell userName="משתמש מקומי">
      {children}
    </AppShell>
  );
}
