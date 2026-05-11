async function runAllTests() {
  console.log("Starting Allo Engineering Test Suite...\n");

  // 1. Fetch current inventory
  const productsRes = await fetch('http://localhost:3000/api/products');
  const products = await productsRes.json();

  const keyboard = products.find(p => p.name.toLowerCase().includes('keychron'));
  const mouse = products.find(
  p =>
    p.name.toLowerCase().includes('logitech') ||
    p.name.toLowerCase().includes('mx master')
);
  
  const nyKeyboardStock = keyboard.inventory.find(i => i.warehouse.includes('East Coast') || i.warehouse.includes('New York'));
  const nyMouseStock = mouse.inventory.find(i => i.warehouse.includes('East Coast') || i.warehouse.includes('New York'));

  // TEST CASE 1: IDEMPOTENCY (REDIS BONUS)
  console.log("--- TEST 1: IDEMPOTENCY (REDIS) ---");
  const idempotencyKey = crypto.randomUUID(); // Generate a unique key
  const mousePayload = { productId: mouse.id, warehouseId: nyMouseStock.warehouseId, quantity: 1 };

  console.log(`Sending FIRST request with Key: ${idempotencyKey}`);
  const res1 = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(mousePayload)
  });
  const data1 = await res1.json();
  console.log(`First request status: ${res1.status} (Expected: 201 Created)`);

  console.log(`Sending SECOND request with the EXACT SAME Key...`);
  const res2 = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(mousePayload)
  });
  console.log(`Second request status: ${res2.status} (Expected: 200 OK - Cached from Redis)`);

  if (res1.status === 201 && res2.status === 200) {
      console.log("IDEMPOTENCY PASSED\n");
  } else {
      console.log("IDEMPOTENCY FAILED\n");
  }

  // TEST CASE 2: CONCURRENCY (ROW-LEVEL LOCK)
  console.log("--- TEST 2: CONCURRENCY (RACE CONDITION) ---");
  console.log(`Initial Keyboard Stock: ${nyKeyboardStock.available} (Must be exactly 1 for this test)`);
  const keyboardPayload = { productId: keyboard.id, warehouseId: nyKeyboardStock.warehouseId, quantity: 1 };

  console.log("Firing 2 requests at the exact same millisecond...");
  const [cRes1, cRes2] = await Promise.all([
      fetch('http://localhost:3000/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify(keyboardPayload)
      }),
      fetch('http://localhost:3000/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify(keyboardPayload)
      })
  ]);

  console.log(`Request A status: ${cRes1.status}`);
  console.log(`Request B status: ${cRes2.status}`);

  if ((cRes1.status === 201 && cRes2.status === 409) || (cRes1.status === 409 && cRes2.status === 201)) {
      console.log("CONCURRENCY PASSED (One succeeded, one was blocked)\n");
  } else {
      console.log("CONCURRENCY FAILED\n");
  }

  // ==========================================
  // TEST CASE 3: CONFIRM ENDPOINT
  // ==========================================
  console.log("--- TEST 3: CONFIRMATION ---");
  console.log(`Confirming reservation ID: ${data1.id}...`);
  const confirmRes = await fetch(`http://localhost:3000/api/reservations/${data1.id}/confirm`, { method: 'POST' });
  console.log(`Confirm status: ${confirmRes.status} (Expected: 200)`);
  if (confirmRes.status === 200) {
      console.log("CONFIRMATION PASSED\n");
  }

  console.log("ALL AUTOMATED TESTS COMPLETE!");
}

runAllTests();