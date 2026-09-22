import { AppShell } from "@/components/app-shell";

export default async function SecureLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
