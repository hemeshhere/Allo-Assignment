import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const updated = await prisma.reservation.update({
      where: { id: params.id },
      data: { status: 'RELEASED' }
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Could not release reservation' }, { status: 500 });
  }
}