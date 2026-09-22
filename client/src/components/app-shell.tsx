import {
  Menu,
  LogOut,
  PackageCheck,
  PackageOpen,
  ScanLine,
  ShieldCheck,
  Truck,
  Waypoints,
} from "lucide-react";
import Link from "next/link";

import { signOut } from "@/auth";

import { NavigationLink } from "./navigation-link";

const links = [
  { href: "/packing", label: "אריזת חבילות", icon: PackageCheck },
  { href: "/transport", label: "הובלת חבילות", icon: Truck },
  { href: "/receiving", label: "קבלת חבילות", icon: PackageOpen },
  { href: "/pickup", label: "איסוף חבילות", icon: PackageCheck },
];

const managementLinks = [
  { href: "/package-status", label: "סטטוס חבילות משוייכות", icon: PackageCheck },
  { href: "/memberships", label: "הצגת בכירים", icon: Waypoints },
  { href: "/logistics", label: "הצגת לוגיסטיקה", icon: Waypoints },
];

function localGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Jerusalem",
    }).format(new Date()),
  );

  if (hour < 12) return "בוקר טוב משתמש";
  if (hour < 18) return "צהריים טובים משתמש";
  return "ערב טוב משתמש";
}

function Navigation() {
  return <>
    <span className="nav-section-label">תהליך העברה</span>
    {links.map(({ href, label, icon: Icon }) => (
      <NavigationLink href={href} key={href}><Icon aria-hidden="true" /><span>{label}</span></NavigationLink>
    ))}
    <span className="nav-section-label">ניהול ובקרה</span>
    {managementLinks.map(({ href, label, icon: Icon }) => (
      <NavigationLink href={href} key={href}><Icon aria-hidden="true" /><span>{label}</span></NavigationLink>
    ))}
    <NavigationLink href="/scan-package"><ScanLine aria-hidden="true" /><span>סריקת יחידת אריזה</span></NavigationLink>
  </>;
}

function SignOutButton() {
  return (
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
  );
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark"><Waypoints aria-hidden="true" /></span>
          <span className="brand-copy"><strong>מעבר דרומה</strong><small>{localGreeting()}</small></span>
        </Link>
        <nav className="side-nav" aria-label="ניווט במערכת">
          <Navigation />
        </nav>
        <div className="sidebar-footer">
          <span className="secure-chip"><ShieldCheck aria-hidden="true" /> חיבור מאובטח</span>
          <SignOutButton />
        </div>
      </aside>
      <div className="workspace">
        <header className="mobile-header">
          <Link aria-label="לוח הבקרה" href="/dashboard"><Waypoints aria-hidden="true" /></Link>
          <span>מעבר דרומה</span>
          <details className="mobile-navigation"><summary><Menu aria-hidden="true" /><span>תפריט</span></summary><nav className="side-nav" aria-label="ניווט במכשיר נייד"><Navigation /><SignOutButton /></nav></details>
        </header>
        {children}
      </div>
    </div>
  );
}
