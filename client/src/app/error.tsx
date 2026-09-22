"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-shell"><section className="auth-card"><span className="eyebrow">שגיאה</span><h1>לא ניתן להשלים את הפעולה</h1><p>המערכת לא חשפה פרטים טכניים. ניתן לנסות שוב.</p><button className="button primary full" onClick={reset} type="button">ניסיון חוזר</button></section></main>;
}
