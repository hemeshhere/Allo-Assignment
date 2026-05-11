
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 1. Create Warehouses
  const nyWarehouse = await prisma.warehouse.create({
    data: { name: 'East Coast Hub', location: 'New York, NY' },
  })
  const laWarehouse = await prisma.warehouse.create({
    data: { name: 'West Coast Hub', location: 'Los Angeles, CA' },
  })

  // 2. Create Products
  const mechanicalKeyboard = await prisma.product.create({
    data: { name: 'Keychron K2 Wireless Keyboard', price: 9900, description: '84-key RGB mechanical keyboard' },
  })
  const mouse = await prisma.product.create({
    data: { name: 'Logitech MX Master 3', price: 12000, description: 'Advanced wireless mouse' },
  })

  // 3. Allocate Stock (Notice we create a low stock scenario for testing race conditions)
  await prisma.stock.createMany({
    data: [
      { productId: mechanicalKeyboard.id, warehouseId: nyWarehouse.id, quantity: 1 }, // ONLY 1 LEFT! (For testing)
      { productId: mechanicalKeyboard.id, warehouseId: laWarehouse.id, quantity: 50 },
      { productId: mouse.id, warehouseId: nyWarehouse.id, quantity: 10 },
      { productId: mouse.id, warehouseId: laWarehouse.id, quantity: 20 },
    ],
  })

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })