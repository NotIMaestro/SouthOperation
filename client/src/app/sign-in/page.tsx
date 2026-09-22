import { redirect } from "next/navigation";

export const metadata = { title: "כניסה" };

export default async function SignInPage() {
  redirect("/dashboard");
}
