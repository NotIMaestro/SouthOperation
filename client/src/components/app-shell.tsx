import {
  Boxes,
  Building2,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  PackageCheck,
  ShieldCheck,
  UsersRound,
  Waypoints,
} from "lucide-react";
import Link from "next/link";

import { signOut } from "@/auth";

const links = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/groups", label: "קבוצות", icon: Building2 },
  { href: "/rooms", label: "חדרים", icon: Boxes },
  { href: "/reports", label: "דוחות מיפוי", icon: ClipboardCheck },
  { href: "/packing", label: "אריזה", icon: PackageCheck },
  { href: "/catalog", label: "קטלוג", icon: LibraryBig },
  { href: "/memberships", label: "הרשאות", icon: UsersRound },
  { href: "/audit", label: "יומן ביקורת", icon: FileClock },
];

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark"><Waypoints aria-hidden="true" /></span>
          <span>מעבר דרומה</span>
        </Link>
        <nav className="side-nav" aria-label="ניווט במערכת">
          {links.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href}><Icon aria-hidden="true" /><span>{label}</span></Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="secure-chip"><ShieldCheck aria-hidden="true" /> חיבור מאובטח</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="sidebar-user" type="submit">
              <span className="avatar">{userName.slice(0, 1)}</span>
              <span><strong>{userName}</strong><small>יציאה מהמערכת</small></span>
              <LogOut aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="mobile-header">
          <Link aria-label="לוח הבקרה" href="/dashboard"><Waypoints aria-hidden="true" /></Link>
          <span>מעבר דרומה</span>
        </header>
        {children}
      </div>
    </div>
  );
}
