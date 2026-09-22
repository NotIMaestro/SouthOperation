import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

export const metadata = { title: "כניסה" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-icon"><Building2 aria-hidden="true" /></div>
        <span className="eyebrow"><ShieldCheck aria-hidden="true" /> כניסה ארגונית</span>
        <h1>ברוכים הבאים</h1>
        <p>הגישה ניתנת למשתמשים מוזמנים בלבד באמצעות Microsoft Entra ID.</p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
          }}
        >
          <button className="button primary full" type="submit">
            כניסה באמצעות Microsoft <ArrowLeft aria-hidden="true" />
          </button>
        </form>
        <small>אימות רב־שלבי נאכף על ידי מדיניות הארגון.</small>
      </section>
    </main>
  );
}
