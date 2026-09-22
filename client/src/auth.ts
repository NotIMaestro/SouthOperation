import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { provisionEnterpriseUser } from "@/lib/server-api";

export const microsoftEntraIdConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
);

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

  return provisionEnterpriseUser({
    subject,
    email,
    displayName: profile.name?.trim() || fallbackUser.name?.trim() || email,
    role: "operator",
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: microsoftEntraIdConfigured
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          client: { token_endpoint_auth_method: "client_secret_post" },
        }),
      ]
    : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    async signIn({ profile, user }) {
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
