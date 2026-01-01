import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

// PATCH /api/contacts/:id  -> Kontakt updaten
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = await req.json()
  const { name, email, categoryId, position, lastSentAt } = body as {
    name?: string
    email?: string
    categoryId?: string | null
    position?: number
    lastSentAt?: string | null
  }

  try {
    const r = await prisma.contact.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email.toLowerCase().trim() } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(lastSentAt !== undefined
          ? { lastSentAt: lastSentAt ? new Date(lastSentAt) : null }
          : {}),
      },
    })

    if (r.count === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const updated = await prisma.contact.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Email already exists for this user" },
        { status: 409 }
      )
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
  }
}

// DELETE /api/contacts/:id  -> Kontakt löschen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  try {
    const r = await prisma.contact.deleteMany({
      where: { id, userId: user.id },
    })

    if (r.count === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
  }
}
