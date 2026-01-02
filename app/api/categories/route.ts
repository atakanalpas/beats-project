import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// GET /api/categories -> alle Kategorien des Users
export async function GET() {
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

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(categories)
}

// POST /api/categories -> neue Kategorie anlegen
export async function POST(req: NextRequest) {
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
  const { name, position } = body as { name?: string; position?: number }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  try {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: name.trim(),
        ...(position !== undefined ? { position } : {}),
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    const anyErr = err as any
    if (anyErr.code === "P2002") {
      return NextResponse.json(
        { error: "Category name already exists for this user" },
        { status: 409 },
      )
    }
    console.error(anyErr)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
