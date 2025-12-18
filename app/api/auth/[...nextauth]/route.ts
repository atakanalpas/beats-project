// app/api/auth/[...nextauth]/route.ts
// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// FORCE localhost für Entwicklung
const BASE_URL = "http://localhost:3000";

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  
  providers: [
    CredentialsProvider({
      name: "Development",
      credentials: {
        email: { 
          label: "Email", 
          type: "text", 
          placeholder: "test@test.com" 
        },
      },
      async authorize(credentials) {
        try {
          console.log("🔐 Login attempt:", credentials?.email);
          
          const email = credentials?.email || "test@test.com";
          
          let user = await prisma.user.findUnique({
            where: { email: email },
          });
          
          if (!user) {
            console.log("🔐 Creating user:", email);
            user = await prisma.user.create({
              data: {
                email: email,
                name: "Development User",
              },
            });
          }
          
          return {
            id: user.id,
            email: user.email,
            name: user.name || "Dev User",
          };
          
        } catch (error) {
          console.error("🔐 Auth error:", error);
          return null;
        }
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
        session.user.id = token.sub;
      }
      return session;
    },
    
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },

    // WICHTIG: Redirects zu localhost erzwingen
    async redirect({ url, baseUrl }) {
      console.log("🔐 Redirect - FORCING localhost");
      
      // Immer zu localhost leiten
      if (url.includes("vercel.app")) {
        return BASE_URL;
      }
      
      return url.startsWith("/") ? `${BASE_URL}${url}` : BASE_URL;
    },
  },
  
  // URLs für NextAuth explizit setzen
  theme: {
    colorScheme: "auto",
  },
  
  pages: {
    signIn: `${BASE_URL}`,
    error: `${BASE_URL}`,
  },
  
  debug: true,
});

console.log("🔐 Auth configured for:", BASE_URL);
console.log("🔐 NEXTAUTH_URL from env:", process.env.NEXTAUTH_URL);

export { handler as GET, handler as POST };