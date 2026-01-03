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

  // Clean + validate
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

  // Transaction: find -> update or create
  const saved = await prisma.$transaction(async (tx) => {
    const out = []
    for (const c of cleaned) {
      const existing = await tx.contact.findFirst({
        where: { userId: user.id, email: c.email },
        select: { id: true },
      })

      if (existing) {
        const updated = await tx.contact.update({
          where: { id: existing.id },
          data: { name: c.name, categoryId: c.categoryId },
        })
        out.push(updated)
      } else {
        const created = await tx.contact.create({
          data: {
            userId: user.id,
            email: c.email,
            name: c.name,
            categoryId: c.categoryId,
            position: 0,
          },
        })
        out.push(created)
      }
    }
    return out
  })

  return NextResponse.json({ contacts: saved }, { status: 201 })
}
