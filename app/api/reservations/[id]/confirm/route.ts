import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id }
    });

    if (!reservation || reservation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Reservation not found or already processed' }, { status: 404 });
    }

    // Double-check expiration just to be safe
    if (new Date() > new Date(reservation.expiresAt)) {
      return NextResponse.json({ error: 'Reservation expired' }, { status: 410 });
    }

    const updated = await prisma.reservation.update({
      where: { id: params.id },
      data: { status: 'CONFIRMED' }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Confirmation failed' }, { status: 500 });
  }
}