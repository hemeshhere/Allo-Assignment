export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const products = await prisma.product.findMany({
    include: {
      stocks: { include: { warehouse: true } },
      reservations: {
        where: { status: { in: ['PENDING', 'CONFIRMED'] } }
      }
    }
  });

  const availableProducts = products.map((p:any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    inventory: p.stocks.map((s:any) => {
      const reserved = p.reservations
        .filter((r:any) => r.warehouseId === s.warehouseId)
        .reduce((sum: number, r:any) => sum + r.quantity, 0);
      return {
        warehouse: s.warehouse.name,
        warehouseId: s.warehouseId,
        available: Math.max(0, s.quantity - reserved)
      };
    })
  }));

  return NextResponse.json(availableProducts);
}