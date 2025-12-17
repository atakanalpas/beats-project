// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Dynamische Basis-URL ermitteln
const getBaseUrl = () => {
  // In Production/Staging: Environment Variable
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // In GitHub Codespaces/Vercel Preview: aus NEXT_PUBLIC_VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback für lokale Entwicklung
  return "http://localhost:3000";
};

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    async redirect({ url, baseUrl }) {
      // Verwende die dynamische Basis-URL
      const actualBaseUrl = getBaseUrl();
      if (url.startsWith("/")) {
        return `${actualBaseUrl}${url}`;
      }
      return url;
    },
  },
  debug: true, // Für Debugging in Codespaces aktivieren
});

export { handler as GET, handler as POST };