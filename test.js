async function runTest() {
  const productsRes = await fetch('http://localhost:3000/api/products');
  const products = await productsRes.json();
  
  // 1. Find the Keyboard
  const keyboard = products.find(p => p.name.toLowerCase().includes('keychron'));
  if (!keyboard) {
    console.error("Could not find Keyboard. Check your seed data.");
    return;
  }

  // 2. Find the Warehouse (Searching for "East Coast" or just taking the first one)
  const nyInventory = keyboard.inventory.find(i => 
    i.warehouse.includes('East Coast') || i.warehouse.includes('New York')
  ) || keyboard.inventory[0]; // Fallback to first warehouse if search fails

  if (!nyInventory) {
    console.error("Could not find inventory for this product.");
    return;
  }

  console.log(`Found Product: ${keyboard.name}`);
  console.log(`Found Warehouse: ${nyInventory.warehouse}`);
  console.log(`Initial Available Stock: ${nyInventory.available}`);

  const payload = {
    productId: keyboard.id,
    warehouseId: nyInventory.warehouseId,
    quantity: 1
  };

  console.log('\n🚀 Simulating 2 users clicking "Reserve" at the SAME TIME...');

  const [response1, response2] = await Promise.all([
    fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  ]);
  const data1 = await response1.json();
  const data2 = await response2.json();
  console.log('User 1 Status:', response1.status, response1.status === 201 ? 'Success' : 'Failed');
  console.log('User 2 Status:', response2.status, response2.status === 201 ? 'Success' : 'Failed');
  if ((response1.status === 201 && response2.status === 409) || 
      (response1.status === 409 && response2.status === 201)) {
    console.log('CONCURRENCY TEST PASSED: Exactly one user got the item.');
  } else {
    console.log('TEST INCONCLUSIVE: Check if initial stock was greater than 1.');
  }
}

runTest();