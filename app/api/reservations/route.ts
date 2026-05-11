import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();
export async function POST(req: Request) {
  try {
    // 1. Extract the Idempotency Key from headers
    const idempotencyKey = req.headers.get('Idempotency-Key');
    // 2. Check Redis FIRST if the key exists
    if (idempotencyKey) {
      const cachedResponse = await redis.get(`idempotency:${idempotencyKey}`);
      if (cachedResponse) {
        console.log('Returning cached response for key:', idempotencyKey);
        return NextResponse.json(cachedResponse, { status: 200 }); // OK for cached
      }
    }
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

    if (idempotencyKey) {
      await redis.set(`idempotency:${idempotencyKey}`, result, { ex: 86400 });
    }

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}