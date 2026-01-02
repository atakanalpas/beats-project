import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

export const dynamic = "force-dynamic"

// GET /api/manual-drafts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const drafts = await prisma.manualDraft.findMany({
    where: { userId: user.id },
    orderBy: [
      { contactId: "asc" },
      { position: "asc" },
      { sentAt: "asc" }, // ✅ nimm sentAt statt createdAt, wenn createdAt nicht existiert
    ],
  })

  return NextResponse.json(drafts, { headers: { "Cache-Control": "no-store" } })
}

// POST /api/manual-drafts
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

  const body = await req.json()
  const { note } = body as { note?: string }

  const last = await prisma.manualDraft.findFirst({
    where: { userId: user.id, contactId: null },
    orderBy: { position: "desc" },
  })
  const nextPos = last ? last.position + 1 : 0

  const created = await prisma.manualDraft.create({
    data: {
      userId: user.id,
      contactId: null,
      note: note ?? "",
      position: nextPos,
      sentAt: new Date(),
    },
  })

  return NextResponse.json(created, { status: 201 })
}
