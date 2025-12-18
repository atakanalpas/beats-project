// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// EXPLIZITE URL für Ihren Codespace
const CODESPACE_URL = "https://scaling-space-succostash-3000.app.github.dev";

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // WICHTIG: redirect_uri explizit setzen
      authorization: {
        params: {
          redirect_uri: `${CODESPACE_URL}/api/auth/callback/google`,
        },
      },
    }),
  ],
  
  session: {
    strategy: "jwt",
  },
  
  secret: process.env.NEXTAUTH_SECRET!,
  
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },

    // WICHTIG: redirect callback hinzufügen
    async redirect({ url, baseUrl }) {
      console.log("🔐 Redirect callback - Using URL:", CODESPACE_URL);
      // Immer zu unserer Codespaces URL leiten
      if (url.startsWith("/")) {
        return `${CODESPACE_URL}${url}`;
      }
      // Falls Google eine vollständige URL zurückgibt
      return url.includes("accounts.google.com") ? CODESPACE_URL : url;
    },
  },
  
  debug: true,
});

// Debug logging
console.log("🔐 Auth Configuration:");
console.log("CODESPACE_URL:", CODESPACE_URL);
console.log("NEXTAUTH_URL from env:", process.env.NEXTAUTH_URL);
console.log("Google Client ID exists:", !!process.env.GOOGLE_CLIENT_ID);

export { handler as GET, handler as POST };