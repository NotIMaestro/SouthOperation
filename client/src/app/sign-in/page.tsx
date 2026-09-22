import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = { title: "כניסה" };

export default async function SignInPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-icon"><Building2 aria-hidden="true" /></div>
        <span className="eyebrow"><ShieldCheck aria-hidden="true" /> כניסה ארגונית</span>
        <h1>ברוכים הבאים</h1>
        <p>מצב פיתוח מקומי: תצוגת המערכת זמינה ללא התחברות.</p>
        <form
          action={async () => {
            "use server";
            redirect("/dashboard");
          }}
        >
          <button className="button primary full" type="submit">
            כניסה למערכת <ArrowLeft aria-hidden="true" />
          </button>
        </form>
        <small>מצב פיתוח מקומי — לא נדרש אימות משויך למשתמש אמיתי.</small>
      </section>
    </main>
  );
}
