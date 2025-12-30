import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

// PATCH /api/contacts/:id  -> Kontakt updaten (name, email, category, position, lastSentAt)
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
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = await req.json()

  const { name, email, category, position, lastSentAt } = body as {
    name?: string
    email?: string
    category?: string | null
    position?: number
    lastSentAt?: string | null
  }

  try {
    const updated = await prisma.contact.update({
      where: {
        id,
        userId: user.id, // Sicherheit: nur eigene Kontakte
      },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email.toLowerCase().trim() } : {}),
        ...(category !== undefined ? { categoryId: category } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(lastSentAt !== undefined
          ? { lastSentAt: lastSentAt ? new Date(lastSentAt) : null }
          : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    const anyErr = err as any

    if (anyErr.code === "P2025") {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }
    if (anyErr.code === "P2002") {
      return NextResponse.json(
        { error: "Email already exists for this user" },
        { status: 409 },
      )
    }

    console.error(anyErr)
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 },
    )
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
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  try {
    await prisma.contact.delete({
      where: {
        id,
        userId: user.id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const anyErr = err as any

    if (anyErr.code === "P2025") {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    console.error(anyErr)
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 },
    )
  }
}
