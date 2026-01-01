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
  const { name, position } = body as { name?: string; position?: number }

  try {
    const r = await prisma.category.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(position !== undefined ? { position } : {}),
      },
    })

    if (r.count === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    const updated = await prisma.category.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 })
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
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
    // Kontakte entkoppeln, bevor Kategorie gelöscht wird
    await prisma.contact.updateMany({
      where: { userId: user.id, categoryId: id },
      data: { categoryId: null },
    })

    const r = await prisma.category.deleteMany({
      where: { id, userId: user.id },
    })

    if (r.count === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
