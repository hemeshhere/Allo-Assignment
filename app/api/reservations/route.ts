import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
export async function POST(req: Request) {
  try {
    const { productId, warehouseId, quantity = 1 } = await req.json();

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

      // 1. LOCK the stock row for this product/warehouse specifically
      await tx.$executeRaw`SELECT * FROM "Stock" WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`;
      // 2. Calculate current availability
      const stockRecord = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } }
      });

      if (!stockRecord) throw new Error('NOT_FOUND');

      const activeReservations = await tx.reservation.aggregate({
        where: {
          productId,
          warehouseId,
          status: { in: ['PENDING', 'CONFIRMED'] }
        },
        _sum: { quantity: true }
      });

      const reservedCount = activeReservations._sum.quantity || 0;
      const available = stockRecord.quantity - reservedCount;

      // 3. Check if we have enough
      if (available < quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // 4. Create the reservation
      return await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
        }
      });
    });

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}