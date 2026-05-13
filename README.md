# Allo Logistics – High-Concurrency Inventory System

**Live Demo:** https://allo-assignment-take-home.vercel.app/

**Repository:** https://github.com/hemeshhere/Allo-Assignment/

This repository contains a full-stack Next.js application built for the Allo Engineering take-home exercise. It handles high-concurrency inventory reservations, preventing race conditions during checkout flows for multi-warehouse retail brands.

---

##  Core Engineering Decisions

### 1. Solving the Race Condition (Concurrency)
The core challenge of this project is ensuring that if two users attempt to reserve the final unit of a SKU at the exact same millisecond, only one succeeds (returning a `200 OK`), and the other gracefully fails (returning a `409 Conflict`).

To solve this, the application leverages **Postgres Row-Level Locking**.
* All reservation mutations are wrapped in Prisma `$transaction` blocks.
* We utilize `SELECT ... FOR UPDATE` (or serializable transaction isolation) to explicitly lock the specific inventory row at the database level.
* While User A's transaction is executing, User B's transaction is forced to wait. If User A successfully reserves the last unit, User B's transaction reads the updated `available: 0` state and aborts, throwing the 409 error.
* *Why this matters:* Relying on application-layer checks (e.g., checking stock, then updating) creates a race condition window. Pushing the lock down to the ACID-compliant database guarantees mathematical correctness regardless of server load.

### 2. Distributed Idempotency (Bonus)
To prevent network retries from causing double-bookings (e.g., a user's phone drops connection during checkout and automatically retries the POST request), I implemented an Idempotency layer using **Upstash Redis**.
* The client generates a UUID (`Idempotency-Key`) and sends it in the request headers.
* The Next.js API checks Redis. If the key exists, it instantly returns the cached 200/201 response without hitting Postgres or triggering side-effects.
* If it is a new request, it processes the reservation, caches the success response in Redis with a TTL (Time-To-Live) of 24 hours, and returns to the client.

---

##  Architecture & Tech Stack

* **Framework:** Next.js 15 (App Router, Server Actions, React 19)
* **Database:** PostgreSQL (Hosted via Supabase)
* **ORM:** Prisma
* **Caching & Idempotency:** Redis (Hosted via Upstash)
* **UI/UX:** Tailwind CSS, shadcn/ui, Framer Motion (Spatial shared-layout transitions)

---

##  Production Expiry Mechanism

To handle abandoned carts, reservations must be released if payment isn't confirmed within the 10-minute window. 
* **Implementation:** I utilized a **Vercel Cron Job**.
* **How it works:** Vercel is configured via `vercel.json` to ping the secure `/api/cron/release-expired` endpoint every minute. 
* **The Query:** The endpoint executes a single, highly efficient Prisma `updateMany` query that finds all reservations where `status = 'PENDING'` and `expiresAt < NOW()`, setting them to `RELEASED`. 
* *Why this approach:* Lazy cleanup on read (checking expiry when a user views a product) is acceptable, but it requires complex aggregations on every `GET` request. A cron job keeps the read-paths incredibly fast and ensures the database state is consistently clean.

---

## Data Model Overview

The database is designed to prevent data duplication and efficiently calculate available stock dynamically.

* **Product:** Represents the physical item (e.g., Keychron Keyboard).
* **Warehouse:** Represents the physical location.
* **Stock:** A join table connecting `Product` and `Warehouse` that holds the `total_quantity`.
* **Reservation:** Tracks temporary holds. 
  * *Dynamic Calculation:* Available stock is never hardcoded. It is calculated on-the-fly as: `Stock.total_quantity - COUNT(Active Reservations)`. This prevents data desync between tables.

---

## API Reference

The following REST endpoints were implemented per the core requirements:

* `GET /api/products`: Returns all products with their nested stock availability per warehouse.
* `POST /api/reservations`: Locks the database row, checks availability, and creates a `PENDING` hold. Expects `productId` and `warehouseId`.
* `POST /api/reservations/:id/confirm`: Verifies the reservation hasn't expired, then marks it `CONFIRMED`.
* `POST /api/reservations/:id/release`: Manually aborts the checkout and marks the reservation as `RELEASED`.
---



## 💻 Running the App Locally

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd allo-inventory
npm install
```

### 2. Environment Variables
* Supabase Transaction connection (For App routing)
```bash
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT]:[PASSWORD]@[aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true](https://aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true)"
```

* Supabase Session connection (For Prisma Migrations)
```bash
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT]:[PASSWORD]@[aws-0-REGION.pooler.supabase.com:5432/postgres](https://aws-0-REGION.pooler.supabase.com:5432/postgres)"
```

* Upstash Redis (For Idempotency)
```bash
UPSTASH_REDIS_REST_URL="[https://your-upstash-url.upstash.io](https://your-upstash-url.upstash.io)"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"
```

* Cron Security
```bash
CRON_SECRET="generate_a_random_secure_string"
```

### 3. Database Setup (Migrations & Seeding)
```bash
npx prisma migrate dev --name init
npx prisma db seed
```
### 4. Run the Development Server
```bash
npm run dev
```
Navigate to http://localhost:3000.

---

## Trade-offs & Future Scalability

Given the time constraints of a take-home exercise, I made deliberate architectural choices. If this were a production system handling Black Friday traffic, I would implement the following upgrades:

1. **Supabase Realtime (WebSockets):** 
   Currently, the client uses Next.js `force-dynamic` to fetch fresh data on navigation. I would implement WebSockets so that when User A reserves an item, the stock count visually ticks down on User B's screen instantly, without requiring a page refresh.
2. **Postgres Triggers vs. Cron:** 
   Moving the Reservation Expiry logic from a Vercel Cron Job into a native Postgres `pg_cron` extension or database trigger. This removes the network hop entirely and makes the release mechanism strictly self-contained within the database layer.
3. **Advanced Rate Limiting:** 
   While Idempotency protects against accidental double-clicks and network retries, the `/api/reservations` endpoint would need an Upstash Rate Limiter (e.g., Token Bucket algorithm) to protect the Postgres database from coordinated DDoS attacks mimicking checkout flows.
4. **Message Queues (Kafka / SQS):**
   If checkout volume scaled to tens of thousands per second, the Postgres row-locks would bottleneck. I would introduce a message broker to queue reservation requests and process them asynchronously, returning a "pending" state to the UI until the worker confirms the lock.
