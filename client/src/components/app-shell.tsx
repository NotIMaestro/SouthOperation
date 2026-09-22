import {
  Boxes,
  Building2,
  ChevronUp,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  ShieldCheck,
  PackageCheck,
  Truck,
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
  { href: "/catalog", label: "קטלוג", icon: LibraryBig },
  { href: "/memberships", label: "הרשאות", icon: UsersRound },
  { href: "/audit", label: "יומן ביקורת", icon: FileClock },
  { href: "/transport", label: "הובלה", icon: Truck },
  { href: "/receiving", label: "קבלת ציוד", icon: PackageCheck },
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
          <details className="sidebar-user-menu">
            <summary className="sidebar-user">
              <span className="avatar">מ</span>
              <span><strong>{userName}</strong><small>משתמש מאומת</small></span>
              <ChevronUp className="user-menu-chevron" aria-hidden="true" />
            </summary>
            <div className="user-menu-popover">
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/sign-in" });
                }}
              >
                <button className="sign-out-button" type="submit">
                  <LogOut aria-hidden="true" />
                  <span>התנתקות</span>
                </button>
              </form>
            </div>
          </details>
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
