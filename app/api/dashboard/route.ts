import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions); // ⬅️ ändern

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      contacts: {
        orderBy: { position: "asc" },
        include: {
          sentMails: {
            orderBy: { sentAt: "desc" },
            include: {
              attachments: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(user?.contacts ?? []);
}