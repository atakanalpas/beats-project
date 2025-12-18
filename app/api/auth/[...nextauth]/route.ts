// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
  // WICHTIGSTE LINIE: Prisma Adapter MUSS aktiv sein
  adapter: PrismaAdapter(prisma),
  
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
  
  // WICHTIG: Diese callbacks MÜSSEN da sein
  callbacks: {
    async session({ session, token }) {
      // User-ID in die Session einfügen
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
  },
  
  debug: true,
});

export { handler as GET, handler as POST };