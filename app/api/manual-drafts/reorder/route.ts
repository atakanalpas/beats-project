import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth-options"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const { ids } = body as { ids?: string[] }
  if (!ids?.length) return NextResponse.json({ error: "ids required" }, { status: 400 })

  await prisma.$transaction(
    ids.map((id, idx) =>
      prisma.manualDraft.updateMany({
        where: { id, userId: user.id },
        data: { position: idx },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
