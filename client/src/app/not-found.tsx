import Link from "next/link";

export default function NotFound() {
  return <main className="auth-shell"><section className="auth-card"><span className="eyebrow">404</span><h1>העמוד לא נמצא</h1><p>הכתובת שביקשת אינה קיימת או שאינה זמינה.</p><Link className="button primary full" href="/dashboard">חזרה ללוח הבקרה</Link></section></main>;
}
