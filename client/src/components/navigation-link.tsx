"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavigationLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? "page" : undefined} onClick={(event) => {
    const menu = event.currentTarget.closest("details");
    if (menu) menu.open = false;
  }}>{children}</Link>;
}
