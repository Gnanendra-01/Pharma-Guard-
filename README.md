# 🛡️ PharmaGuard — Pharmacy Expiry & Stock Safety Tracker

> **A Full-Stack Pharmacy Expiry & Inventory Monitoring System built for Software Engineering Lab & Viva Demonstration.**

---

## 📌 1. Problem Statement
Small pharmacies track medicine stock levels and expiry dates manually using paper logbooks or static spreadsheets. This leads to:
1. **Critical Patient Safety Hazards:** Expired medicines inadvertently dispensed to patients.
2. **Dead Stock Financial Losses:** Medicine batches expiring unnoticed on the back of shelves.
3. **Emergency Stock-Outs:** Essential medications dropping below safety thresholds without timely supplier re-orders.

**PharmaGuard** automates this workflow: it maintains real-time batch-level tracking, logs an immutable transaction audit history for all stock changes, and automatically dispatches batched HTML email digests to the pharmacy owner when stock drops below minimum thresholds or batches approach their expiry date.

---

## ⚙️ 2. Technology Stack

| Layer | Technology | Rationale & Specifications |
|---|---|---|
| **Frontend** | **Next.js 16 (App Router) + Tailwind CSS** | Server & Client components, modern medical-teal aesthetic, responsive desktop sidebar & mobile drawer. |
| **Backend** | **Node.js + Express** | Clean modular REST API (`/api/auth`, `/api/medicines`, `/api/alerts`, `/api/dashboard`, `/api/settings`). |
| **Database** | **SQLite via `better-sqlite3`** | Single local file (`pharmaguard.db`), zero cloud latency, WAL journal mode, atomic transactions. |
| **Authentication** | **bcryptjs + JWT (`httpOnly` cookie)** | Passwords hashed with salt factor 10; JWT stored securely in `httpOnly`, `sameSite: lax` cookies (protected against XSS). |
| **Alert Engine** | **Pure JavaScript Math (No external date libs)** | Pure functional date arithmetic using UTC midnights; accepts an injectable `today` parameter for deterministic testing. |
| **Email Service** | **Nodemailer (Gmail SMTP + Console Fallback)** | Dispatches clinical HTML table digests. Falls back cleanly to terminal console mock if credentials are removed. |
| **Scheduler** | **`node-cron`** | Automated background checks running daily at 08:00 AM, or every 1 minute in `DEMO_MODE=true`. |
| **Automated Tests**| **Jest** | Unit tests verifying low-stock boundaries, expiry thresholds, repeat alert intervals, and negative stock rejection. |

---

## 🗄️ 3. Database Architecture & Schema

All 5 tables are stored locally in `pharmaguard.db`:

```
+---------------------------------------------------------------------------------+
|                                    USERS                                        |
| id (PK) | name | email (UNIQUE) | password_hash | created_at                   |
+---------------------------------------+-----------------------------------------+
                                        | 1:1
+---------------------------------------v-----------------------------------------+
|                                  SETTINGS                                       |
| user_id (FK) | alert_email | low_stock_threshold | expiry_warning_days | repeat |
+---------------------------------------+-----------------------------------------+
                                        | 1:N
+---------------------------------------v-----------------------------------------+
|                                  MEDICINES                                      |
| id (PK) | user_id (FK) | name | batch_id (UQ) | quantity | expiry_date          |
| last_expiry_alert_sent | low_stock_alert_sent | created_at | updated_at         |
+-------------------+-----------------------------------+-------------------------+
                    | 1:N                               | 1:N
+-------------------v-------------------+       +-------v-------------------------+
|             STOCK_HISTORY             |       |            ALERT_LOG            |
| id | medicine_id (FK) | old_qty       |       | id | user_id (FK) | medicine_id |
| new_qty | change_reason | changed_at  |       | type | channel | status | sent_at|
+---------------------------------------+       +---------------------------------+
```

### Safety & Integrity Constraints
- `medicines.quantity >= 0`: CHECK constraint enforced at the engine level.
- `UNIQUE(user_id, batch_id)`: Prevents accidental duplicate batch entry.
- `stock_history.change_reason`: Restricted to `'ADD'`, `'SOLD'`, `'RESTOCK'`, or `'CORRECTION'`.
- `db.pragma('foreign_keys = ON')` and `db.pragma('journal_mode = WAL')` enabled on startup.

---

## 🚀 4. Quick Start & Setup Guide

### Prerequisites
- **Node.js** v18+ (tested on Node.js v20/v22)
- **npm** v9+

---

### Step 4.1: Backend Setup
```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies (better-sqlite3, express, bcryptjs, jsonwebtoken, nodemailer, node-cron, jest)
npm install

# 3. Initialize & seed demo database
npm run seed

# 4. Run automated Jest tests
npm test

# 5. Start the backend REST API (runs on port 5000)
npm run dev
```

> **Backend Environment (`backend/.env`):**
> ```env
> PORT=5000
> JWT_SECRET=super_secret_pharmaguard_jwt_key_for_demo_2026
> EMAIL_USER=your-email@gmail.com
> EMAIL_APP_PASSWORD=your-16-character-app-password
> FRONTEND_URL=http://localhost:3000
> DEMO_MODE=false
> ```
>
> **How to Generate a Gmail App Password:**
> 1. Go to your **Google Account** > **Security**.
> 2. Ensure **2-Step Verification** is turned ON.
> 3. Search for or click on **App Passwords**.
> 4. Create a new entry named "PharmaGuard" and copy the 16-character password into `backend/.env`.
> 5. *(Note: If credentials are left blank or unset, PharmaGuard automatically logs beautiful formatted HTML digests to the terminal console as a fallback).*

---

### Step 4.2: Frontend Setup
Open a second terminal window:
```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start Next.js development server (runs on port 3000)
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 🎯 5. Step-by-Step 2-Minute Lab Viva Demo Script

Use this exact sequence to explain and demonstrate PharmaGuard to your professor or evaluator:

| Step | Action in UI | What to Say / Explain to the Evaluator |
|---|---|---|
| **1. Login & Auth** | Go to `http://localhost:3000/login`. Click the **"Fill Demo"** button (`demo@pharmaguard.com / Demo@1234`) and click **Sign In**. | *"The system uses bcrypt password hashing and signs a JSON Web Token stored in an httpOnly cookie. This protects against XSS attacks because client-side JavaScript cannot read the token."* |
| **2. Dashboard & Safety** | Point to the 4 metric cards: **Total Batches**, **Low Stock**, **Expiring Soon**, and **Expired**. Notice the red Urgent Shelf Removal notice. | *"The dashboard automatically queries the database using relative day arithmetic. Cough Relief Syrup expired 3 days ago, triggering an urgent shelf-removal compliance warning."* |
| **3. Inventory & Status** | Click **"Medicines & Batches"** in the sidebar. Demonstrate filtering tabs (*Low Stock*, *Expiring Soon*, *Expired*, *Safe*) and live text search. | *"Each batch computes its safety badge dynamically from UTC midnights to eliminate timezone drift. Red badges represent expired lots, amber warns of imminent expiry within 30 days, and orange flags low stock."* |
| **4. Sell & Atomic Transaction** | Click the **"Sell"** button on `Amoxicillin 500mg`. Try typing `600` (exceeds current 500). Show the rejection message. Then sell `20` units. | *"Stock updates run inside an atomic SQLite transaction. Selling below zero is strictly rejected at the database level. Notice the stock changed from 500 to 480."* |
| **5. Audit History** | Click the **History** icon on `Amoxicillin 500mg`. | *"Every stock mutation creates an immutable record in `stock_history` documenting the transition, timestamp, and reason (`SOLD`, `RESTOCK`, or `CORRECTION`)."* |
| **6. Fast-Forward Time & Email Alerts** | Navigate to **"Alert History"**. In the **Viva Simulator Card**, click the **"+30 Days"** preset button and click **"Run Check Now"**. | *"Because a live demo cannot wait 30 real days, our alert engine accepts an injectable date parameter. By fast-forwarding 30 days, batches that were safe now cross the warning threshold, instantly generating a batched HTML email digest sent via Nodemailer."* |
| **7. Code Quality & Jest Tests** | Open the terminal and run `npm test` inside `backend/`. | *"All core business logic in `alertEngine.js` is pure and decoupled from system time. All 8 Jest unit tests verify threshold boundaries, repeat alert intervals, and rollback constraints."* |

---

## 🧪 6. Automated Jest Test Suite

Run anytime inside the `backend` folder:
```bash
npm test
```

### Test Coverage Highlights:
- ✅ **Test 1:** Low stock fires at `quantity <= 100` and does NOT fire at `101`.
- ✅ **Test 2:** Flag prevents duplicate low-stock alerts on subsequent daily cron runs.
- ✅ **Test 3:** Low-stock flag resets automatically when medicine is restocked above threshold.
- ✅ **Test 4:** Expiry alert triggers at exactly 30 days and NOT at 31 days.
- ✅ **Test 5:** Respects `alert_repeat_days`: does not re-alert within the repeat interval.
- ✅ **Test 6:** Repeat alert fires after repeat interval (>= 10 days) has elapsed.
- ✅ **Test 7:** Expired batch (`days_left < 0`) triggers the urgent shelf-removal alert.
- ✅ **Test 8:** Selling below zero is strictly rolled back with stock preserved.

---

## 💡 7. Frequently Asked Viva Questions

### Q1: Why use SQLite instead of MySQL or PostgreSQL?
> **Answer:** For a local pharmacy deployment, SQLite requires zero setup, runs embedded in-process, has no server daemon to crash, and produces a single file (`pharmaguard.db`) that can be backed up with a single file copy. With **WAL (Write-Ahead Logging)** mode enabled, reads and writes occur concurrently without table locks.

### Q2: How does the system prevent selling items below zero?
> **Answer:** Two layers of defense:
> 1. An application-level check verifies `amount <= old_quantity` before beginning the update.
> 2. A database-level `CHECK(quantity >= 0)` constraint guarantees that even if concurrent requests race, SQLite will abort the transaction with an error.

### Q3: Why is `today` passed as a parameter in `runAlertCheck(userId, today)`?
> **Answer:** Coupling code to `new Date()` makes time-dependent business logic impossible to unit test deterministically. By injecting `today`, we can write unit tests for any future or past date without mocking system timers or mutating the host machine clock.

### Q4: How does the system avoid spamming the pharmacy owner with duplicate emails?
> **Answer:**
> - For **Low Stock**: The `low_stock_alert_sent` boolean flag is set to `1` when an alert is sent, and is only reset back to `0` once a restock brings quantity strictly above the threshold.
> - For **Expiry**: The `last_expiry_alert_sent` timestamp is stored. The scheduler only fires again if `(today - last_expiry_alert_sent) >= alert_repeat_days` (default 10 days).
> - Multiple medicines are batched into a **single consolidated HTML digest email** per run rather than sending individual emails per batch.

---

## 📄 License
MIT License. Created for Software Engineering Laboratory Demonstration.