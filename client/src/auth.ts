import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { provisionEnterpriseUser } from "@south-operation/server/authorization";

export const microsoftEntraIdConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
);

// DEV-ONLY BYPASS. `NODE_ENV` is always "production" for a built/deployed app
// (Vercel included, preview or prod) — `next dev` is the only runtime where
// it is not — so this branch is structurally unreachable outside a local
// `pnpm dev`. It additionally requires an explicit opt-in env var so a bare
// local run never silently skips real sign-in. Remove before shipping real
// auth-dependent features.
export const devBypassEnabled =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
const devBypassUserId =
  process.env.DEV_AUTH_BYPASS_USER_ID ?? "00000000-0000-0000-0000-000000000001";

type EntraProfile = {
  email?: string | null;
  name?: string | null;
  oid?: string;
  preferred_username?: string | null;
  sub?: string | null;
};

async function provisionEntraUser(
  profile: EntraProfile,
  fallbackUser: { id?: string | null; email?: string | null; name?: string | null },
) {
  const subject = profile.oid ?? profile.sub ?? fallbackUser.id;
  const email = profile.email ?? profile.preferred_username ?? fallbackUser.email;
  if (!subject || !email) return undefined;

  const bootstrapAdminEmail = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const isBootstrapAdmin = Boolean(bootstrapAdminEmail && email.toLowerCase() === bootstrapAdminEmail);

  return provisionEnterpriseUser({
    subject,
    email,
    displayName: profile.name?.trim() || fallbackUser.name?.trim() || email,
    initialRole: isBootstrapAdmin ? "admin" : "pending",
    bootstrapAdmin: isBootstrapAdmin,
  });
}

const providers: Provider[] = microsoftEntraIdConfigured
  ? [
      MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        client: { token_endpoint_auth_method: "client_secret_post" },
      }),
    ]
  : [];

if (devBypassEnabled) {
  providers.push(
    Credentials({
      id: "dev-bypass",
      name: "Local dev (insecure)",
      credentials: {},
      async authorize() {
        return { id: devBypassUserId, name: "משתמש פיתוח מקומי", email: "dev-bypass@local" };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    async signIn({ profile, user, account }) {
      if (devBypassEnabled && account?.provider === "dev-bypass") return true;
      if (!profile) return false;

      try {
        const internalUser = await provisionEntraUser(profile, user);
        if (!internalUser) return false;
        user.id = internalUser.id;
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) token.internalUserId = user.id;
      return token;
    },
    session({ session, token }) {
      const internalUserId =
        typeof token.internalUserId === "string" ? token.internalUserId : undefined;
      if (session.user && internalUserId) session.user.id = internalUserId;
      return session;
    },
    authorized({ auth: session }) {
      return Boolean(session?.user?.id);
    },
  },
});
