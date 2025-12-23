import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // später: scopes erweitern für Gmail
    }),
  ],

  session: { strategy: "database" }, // wichtig: damit Sessions + User sauber DB-gestützt sind
  secret: process.env.NEXTAUTH_SECRET,

  debug: true,
};
