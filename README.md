# Allo Logistics – High-Concurrency Inventory System

**Live Demo:** [Insert your Vercel URL here]
**Repository:** [Insert your GitHub URL here]

This repository contains a full-stack Next.js application built for the Allo Engineering take-home exercise. It handles high-concurrency inventory reservations, preventing race conditions during checkout flows for multi-warehouse retail brands.

---

## 🧠 Core Engineering Decisions

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

### 3. AI Observability & Hallucination Control (Superfone Architecture)
Modern telecommunication and fulfillment platforms are increasingly relying on AI agents. To demonstrate production-ready AI handling, I included an internal `/api/assistant` endpoint.
* **The Problem:** LLMs hallucinate data, which is catastrophic in inventory systems.
* **The Solution:** The endpoint utilizes the Vercel AI SDK (`generateObject`) to enforce strict, structured JSON outputs. It dynamically injects the live, locked database state into the system prompt.
* **Observability:** Crucially, the AI is constrained to calculate and return a `hallucination_risk_score` (0.0 to 1.0). If the query cannot be answered using the provided database snapshot, it defaults to a high risk score, allowing downstream systems to intercept and fallback to a human agent.

---

## 🏗️ Architecture & Tech Stack

* **Framework:** Next.js 15 (App Router, Server Actions, React 19)
* **Database:** PostgreSQL (Hosted via Supabase)
* **ORM:** Prisma
* **Caching & Idempotency:** Redis (Hosted via Upstash)
* **UI/UX:** Tailwind CSS, shadcn/ui, Framer Motion (Spatial shared-layout transitions)
* **AI:** Vercel AI SDK, OpenAI GPT-4o, Zod (Schema validation)

---

## ⏱️ Production Expiry Mechanism

To handle abandoned carts, reservations must be released if payment isn't confirmed within the 10-minute window. 
* **Implementation:** I utilized a **Vercel Cron Job**.
* **How it works:** Vercel is configured via `vercel.json` to ping the secure `/api/cron/release-expired` endpoint every minute. 
* **The Query:** The endpoint executes a single, highly efficient Prisma `updateMany` query that finds all reservations where `status = 'PENDING'` and `expiresAt < NOW()`, setting them to `RELEASED`. 
* *Why this approach:* Lazy cleanup on read (checking expiry when a user views a product) is acceptable, but it requires complex aggregations on every `GET` request. A cron job keeps the read-paths incredibly fast and ensures the database state is consistently clean.

---

## 💻 Running the App Locally

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd allo-inventory
npm install
```

### 2. Environment Variables
# Supabase Transaction connection (For App routing)
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT]:[PASSWORD]@[aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true](https://aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true)"

# Supabase Session connection (For Prisma Migrations)
DIRECT_URL="postgresql://postgres.[YOUR_PROJECT]:[PASSWORD]@[aws-0-REGION.pooler.supabase.com:5432/postgres](https://aws-0-REGION.pooler.supabase.com:5432/postgres)"

# Upstash Redis (For Idempotency)
UPSTASH_REDIS_REST_URL="[https://your-upstash-url.upstash.io](https://your-upstash-url.upstash.io)"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"

# Optional: For AI Observability Endpoint
OPENAI_API_KEY="sk-..."

# Cron Security
CRON_SECRET="generate_a_random_secure_string"

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

