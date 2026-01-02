import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const { note, contactId, position } = body as {
    note?: string | null
    contactId?: string | null
    position?: number
  }

  try {
    const r = await prisma.manualDraft.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(note !== undefined ? { note: note ?? "" } : {}),
        ...(contactId !== undefined ? { contactId } : {}),
        ...(position !== undefined ? { position } : {}),
      },
    })

    if (r.count === 0) return NextResponse.json({ error: "Draft not found" }, { status: 404 })

    const updated = await prisma.manualDraft.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to update draft" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  try {
    const r = await prisma.manualDraft.deleteMany({
      where: { id, userId: user.id },
    })
    if (r.count === 0) return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 })
  }
}
