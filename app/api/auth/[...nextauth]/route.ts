export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 Tage
    updateAge: 24 * 60 * 60,   // Update täglich
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("SignIn attempt:", user.email);
      return true;
    },
    
    async redirect({ url, baseUrl }) {
      // Nach Login zur Homepage oder ursprünglich gewünschte URL
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
    
    async session({ session, user }) {
      // Füge user.id zur Session hinzu (mit Type Assertion)
      if (session.user) {
        (session.user as any).id = user.id;
      }
      return session;
    },
    
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = user.id;
      }
      return token;
    }
  },
  pages: {
    signIn: "/auth/signin",
    // Optional: Fehlerseite
    // error: "/auth/error",
    // newUser: "/auth/new-user"
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`${user.email} signed in ${isNewUser ? '(new user)' : '(existing user)'}`);
    },
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`);
    }
  },
  debug: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as POST };