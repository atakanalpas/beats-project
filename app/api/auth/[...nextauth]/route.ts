// app/api/auth/[...nextauth]/route.ts
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

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
        (session.user as any).id = token.sub
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Nach Login zur Startseite oder ursprünglichen URL
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
  },
  pages: {
    signIn: "/api/auth/signin", // Standard NextAuth Seite
  },
  debug: process.env.NODE_ENV === "development",
})

export { handler as GET, handler as POST }