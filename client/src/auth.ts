import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { resolveInvitedUser } from "@/lib/server-api";

type EntraProfile = {
  oid?: string;
  sub?: string | null;
};

async function findInvitedUser(profile: EntraProfile) {
  const subject = profile.oid ?? profile.sub;
  return subject ? resolveInvitedUser(subject) : undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    async signIn({ profile }) {
      if (!profile) return false;

      try {
        return Boolean(await findInvitedUser(profile));
      } catch {
        // Fail closed when identity membership cannot be verified.
        return false;
      }
    },
    async jwt({ token, profile }) {
      if (profile) {
        const invitedUser = await findInvitedUser(profile);
        token.internalUserId = invitedUser?.id;
      }
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
