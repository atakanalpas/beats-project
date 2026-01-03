import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

type Incoming = { name?: string; email?: string; categoryId?: string | null }

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const sanitizeEmail = (email: string) => email.trim().toLowerCase()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const items = (body?.contacts ?? []) as Incoming[]

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 })
  }

  // clean + validate
  const cleaned = items
    .map((c) => {
      const email = c.email ? sanitizeEmail(c.email) : ""
      const name = (c.name ?? "").trim()
      return {
        email,
        name: name || email,
        categoryId: c.categoryId ?? null,
      }
    })
    .filter((c) => c.email && isValidEmail(c.email))

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "No valid contacts found" }, { status: 400 })
  }

  // Upsert pro row (einfach & zuverlässig, reicht für <= 200 Imports)
  // -> erstellt neue, updated name/categoryId wenn existiert
  const results = await prisma.$transaction(
    cleaned.map((c) =>
      prisma.contact.upsert({
        where: { userId_email: { userId: user.id, email: c.email } }, // braucht @@unique([userId,email]) -> hast du
        create: {
          userId: user.id,
          email: c.email,
          name: c.name,
          categoryId: c.categoryId,
          position: 0,
        },
        update: {
          name: c.name,
          categoryId: c.categoryId,
        },
      })
    )
  )

  return NextResponse.json({ contacts: results }, { status: 201 })
}
