import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// GET /api/manual-drafts -> alle Drafts vom User
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const drafts = await prisma.manualDraft.findMany({
      where: { userId: user.id },
      // ❗ createdAt raus – war bei dir der Auslöser für 500 (Model hat es wohl nicht)
      orderBy: [{ contactId: "asc" }, { position: "asc" }],
    })

    return NextResponse.json(drafts, { headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    console.error("manual-drafts GET failed:", err)
    return NextResponse.json(
      { error: "Failed to load manual drafts", detail: String(err?.message ?? err) },
      { status: 500 }
    )
  }
}

// POST /api/manual-drafts -> neuen Draft erstellen
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const { note } = body as { note?: string }

    // Stack-Drafts: contactId = null
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
      },
    })

    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    console.error("manual-drafts POST failed:", err)
    return NextResponse.json(
      { error: "Failed to create draft", detail: String(err?.message ?? err) },
      { status: 500 }
    )
  }
}
