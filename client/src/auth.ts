import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { resolveInvitedUser } from "@/lib/server-api";

type EntraProfile = {
  oid?: string;
  sub?: string | null;
};

export const isMicrosoftConfigured = () => {
  const id = process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "";
  const secret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "";
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";

  const placeholderTokens = ["00000000-0000-0000-0000-000000000000", "YOUR_TENANT_ID", "your_tenant_id", "local-dev", "example"];

  return [id, secret, issuer].every((value) => value.trim().length > 0) &&
    !placeholderTokens.some((value) => id.includes(value) || secret.includes(value) || issuer.includes(value));
};

async function findInvitedUser(profile: EntraProfile) {
  const subject = profile.oid ?? profile.sub;
  return subject ? resolveInvitedUser(subject) : undefined;
}

const localDevCredentialsProvider = Credentials({
  name: "Local development",
  credentials: {
    username: { label: "Username", type: "text" },
  },
  async authorize(credentials) {
    const username = String(credentials?.username ?? "local-admin").trim() || "local-admin";
    return {
      id: `local-dev-${username}`,
      name: username,
      email: `${username}@local.test`,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: isMicrosoftConfigured() ? [MicrosoftEntraID] : [localDevCredentialsProvider],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.provider === "credentials") return true;
      if (!profile) return false;

      try {
        return Boolean(await findInvitedUser(profile));
      } catch {
        return false;
      }
    },
    async jwt({ token, profile, user, account }) {
      if (account?.provider === "credentials") {
        token.internalUserId = user?.id ?? "local-dev-user";
        return token;
      }

      if (!profile) return token;

      const subject = profile.oid ?? profile.sub;
      if (!subject) return token;

      const invitedUser = await findInvitedUser(profile).catch(() => undefined);
      token.internalUserId = invitedUser?.id ?? `local-dev:${subject}`;
      return token;
    },
    session({ session, token }) {
      const internalUserId =
        typeof token.internalUserId === "string" ? token.internalUserId : undefined;
      if (session.user && internalUserId) {
        session.user.id = internalUserId;
      }
      return session;
    },
    authorized({ auth: session }) {
      return Boolean(session?.user?.id);
    },
  },
  events: {
    async signOut() {
      // Authentication events are deliberately not logged with tokens or claims.
    },
  },
});
