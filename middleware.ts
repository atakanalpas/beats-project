// middleware.ts (im root-Verzeichnis)
export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    // Hier kannst du weitere geschützte Routen hinzufügen
    // "/profile/:path*",
    // "/admin/:path*",
  ]
}