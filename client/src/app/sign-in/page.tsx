import { LogIn, ShieldCheck } from "lucide-react";

import { microsoftEntraIdConfigured, signIn } from "@/auth";

export const metadata = { title: "כניסה מאובטחת" };

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="auth-icon"><ShieldCheck aria-hidden="true" /></span>
        <p className="eyebrow">מעבר דרומה</p>
        <h1>כניסה למערכת</h1>
        <p>הכניסה מיועדת למשתמשים שהוזמנו מראש ומתבצעת באמצעות החשבון הארגוני.</p>
        {microsoftEntraIdConfigured ? (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
            }}
          >
            <button className="button primary full" type="submit">
              <LogIn aria-hidden="true" /> כניסה עם Microsoft Entra
            </button>
          </form>
        ) : (
          <div className="receiving-error" role="status">
            החיבור הארגוני עדיין לא הוגדר בסביבה זו.
          </div>
        )}
        <small>המערכת אינה שומרת סיסמאות ארגוניות.</small>
      </section>
    </main>
  );
}
