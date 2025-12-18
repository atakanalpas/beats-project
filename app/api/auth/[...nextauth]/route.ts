// app/api/contacts/route.ts
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  try {
    // Session mit authOptions holen
    const session = await getServerSession(authOptions);

    // Session debugging
    console.log("Session in API:", session);

    if (!session || !session.user) {
      console.log("No session or user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Type assertion für den User
    const userId = (session.user as any).id;
    
    if (!userId) {
      console.log("No user ID in session:", session.user);
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    // User mit Prisma finden
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      console.log("User not found in database for ID:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("Found contacts for user:", user.contacts.length);
    return NextResponse.json(user.contacts ?? []);

  } catch (error) {
    console.error("Error in GET /api/contacts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}