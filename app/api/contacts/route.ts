import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth-options";

/**
 * Create new contact (manual)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions); // ⬅️ statt getServerSession()

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { email, name, category } = body;

  if (!email || !name) {
    return NextResponse.json(
      { error: "Email and name are required" },
      { status: 400 }
    );
  }

  // eingeloggten User holen
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // nächste Position bestimmen (für Sortierung)
  const lastContact = await prisma.contact.findFirst({
    where: { userId: user.id },
    orderBy: { position: "desc" },
  });

  const nextPosition = lastContact ? lastContact.position + 1 : 0;

  try {
    const contact = await prisma.contact.create({
      data: {
        userId: user.id,
        email: email.toLowerCase().trim(),
        name,
        category: category ?? null,
        position: nextPosition,
        lastSentAt: null,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (err: any) {
    // Unique constraint (userId + email)
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Contact already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}