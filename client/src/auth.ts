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
  roles?: unknown;
  sub?: string | null;
};

const applicationRoles = ["admin", "manager", "commander", "operator"] as const;
type ApplicationRole = (typeof applicationRoles)[number];

function applicationRole(profile: EntraProfile): ApplicationRole {
  const roles = profile.roles;
  if (!Array.isArray(roles)) return "operator";

  // Enterprise App users with Entra's "Default Access" assignment do not
  // receive a roles claim. Give those already-authorized users the app's
  // least-privileged role while preserving any explicit app-role assignment.
  return applicationRoles.find((role) => roles.includes(role)) ?? "operator";
}

async function provisionUser(
  profile: EntraProfile,
  fallbackUser: { id?: string | null; email?: string | null; name?: string | null },
) {
  const subject = profile.oid ?? profile.sub ?? fallbackUser.id;
  const email = profile.email ?? profile.preferred_username ?? fallbackUser.email;
  const role = applicationRole(profile);
  if (!subject || !email) return undefined;

  return provisionEnterpriseUser({
    subject,
    email,
    displayName: profile.name?.trim() || fallbackUser.name?.trim() || email,
    role,
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
        const internalUser = await provisionUser(profile, user);
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
