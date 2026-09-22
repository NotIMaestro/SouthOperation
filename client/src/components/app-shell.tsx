import {
  LayoutDashboard,
  Menu,
  QrCode,
  ScanLine,
  ShieldCheck,
  Truck,
  UsersRound,
  Waypoints,
} from "lucide-react";
import Link from "next/link";

import { NavigationLink } from "./navigation-link";

const links = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/memberships", label: "הרשאות", icon: UsersRound },
  { href: "/scan-package", label: "סריקת חבילה", icon: ScanLine },
  { href: "/transport", label: "הובלה", icon: Truck },
];

function Navigation() {
  return <>
    {links.map(({ href, label, icon: Icon }) => (
      <NavigationLink href={href} key={href}><Icon aria-hidden="true" /><span>{label}</span></NavigationLink>
    ))}
    <span className="nav-section-label">פיתוח / הדגמה</span>
    <NavigationLink href="/demo/qr-generator"><QrCode aria-hidden="true" /><span>מחולל קודי QR</span></NavigationLink>
  </>;
}

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
          <Navigation />
        </nav>
        <div className="sidebar-footer">
          <span className="secure-chip"><ShieldCheck aria-hidden="true" /> חיבור מאובטח</span>
          <div className="sidebar-user">
            <span className="avatar">מ</span>
            <span><strong>{userName}</strong><small>מצב מקומי</small></span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="mobile-header">
          <Link aria-label="לוח הבקרה" href="/dashboard"><Waypoints aria-hidden="true" /></Link>
          <span>מעבר דרומה</span>
          <details className="mobile-navigation"><summary><Menu aria-hidden="true" /><span>תפריט</span></summary><nav className="side-nav" aria-label="ניווט במכשיר נייד"><Navigation /></nav></details>
        </header>
        {children}
      </div>
    </div>
  );
}
