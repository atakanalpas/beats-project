import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

// PATCH /api/contacts/:id  -> Kontakt updaten (name, email, category, position, lastSentAt)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
        // Sicherheitsnetz: nur Kontakte dieses Users
        id: params.id,
        userId: user.id,
      },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email.toLowerCase().trim() } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(lastSentAt !== undefined
          ? { lastSentAt: lastSentAt ? new Date(lastSentAt) : null }
          : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Email already exists for this user" },
        { status: 409 },
      )
    }

    console.error(err)
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 },
    )
  }
}

// DELETE /api/contacts/:id  -> Kontakt löschen
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
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
        id: params.id,
        userId: user.id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    console.error(err)
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 },
    )
  }
}
