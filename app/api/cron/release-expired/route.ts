import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const expiredReservations = await prisma.reservation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { 
          lt: new Date() 
        }
      },
      data: { status: 'RELEASED' }
    });
    return NextResponse.json({ 
        success: true, 
        released: expiredReservations.count 
      }
    );
  } 
  catch (error) {
    return NextResponse.json({ 
      error: 'Cron failed' 
    }, { status: 500 });
  }
}