import { LogIn, ShieldCheck } from "lucide-react";
import { connection } from "next/server";

import { devBypassEnabled, microsoftEntraIdConfigured, signIn } from "@/auth";

export const metadata = { title: "כניסה מאובטחת" };

export default async function SignInPage() {
  // Reads the Entra env vars per request; a prerendered page would freeze them at build time.
  await connection();
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
        {devBypassEnabled && (
          <form
            action={async () => {
              "use server";
              await signIn("dev-bypass", { redirectTo: "/dashboard" });
            }}
          >
            <button className="button secondary full" type="submit">
              כניסת פיתוח מקומית (ללא Entra)
            </button>
          </form>
        )}
        <small>המערכת אינה שומרת סיסמאות ארגוניות.</small>
      </section>
    </main>
  );
}
