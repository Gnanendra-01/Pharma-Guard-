# PharmaGuard — Project Progress & State Tracker

## Project Summary
PharmaGuard is a local pharmacy expiry and stock tracker designed for Software Engineering lab demonstrations. It manages medicine batches, enforces atomic stock transactions, generates visual safety badges, and triggers automated email digests when medicines are low in stock or near expiry.

## Tech Stack & Fixed Decisions
- **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Lucide React icons. Light theme only, medical-teal palette (`#0F766E`).
- **Backend**: Node.js + Express REST API running on port 5000 (`http://localhost:5000/api`).
- **Database**: SQLite via `better-sqlite3` (`pharmaguard.db` in project root), WAL mode, strict foreign keys, atomic transactions.
- **Auth**: bcryptjs password hashing + JWT delivered via secure `httpOnly` cookie.
- **Alert Engine**: Pure JavaScript date arithmetic with injectable `today` parameter, digest batching, repeat intervals.
- **Email**: Nodemailer via Gmail SMTP with fallback to terminal console mock when credentials are unset. No SMS.
- **Scheduler**: `node-cron` running daily at 08:00 AM, or every 1 min when `DEMO_MODE=true`.
- **Tests**: Jest unit test suite covering alert engine boundary conditions.

## Phase Status Table

| Phase | Status | Evidence (Key Files) | Notes |
|---|---|---|---|
| **1. Scaffold, DB, Seed** | DONE | `backend/src/db/database.js`, `backend/src/db/seed.js` | 5 tables, foreign keys, relative date seed script |
| **2. Auth & Route Protection** | DONE | `backend/src/routes/auth.js`, `frontend/middleware.js`, `frontend/app/login/page.js` | JWT httpOnly cookie, demo login shortcut |
| **3. Medicine CRUD & Badges** | DONE | `backend/src/routes/medicines.js`, `frontend/app/medicines/page.js`, `frontend/components/StatusBadge.js` | Search, sort, filters, clinical status badges |
| **4. Update Qty & History** | DONE | `backend/src/routes/medicines.js`, `frontend/app/medicines/page.js` | Sell/Restock modals, atomic transaction, audit history |
| **5. Alert Engine & Tests** | DONE | `backend/src/services/alertEngine.js`, `backend/tests/alertEngine.test.js` | Pure functional logic, 8/8 Jest tests pass |
| **6. Email Service** | DONE | `backend/src/services/emailService.js` | Nodemailer SMTP + console mock fallback, HTML digests |
| **7. Scheduler & Alert Log** | DONE | `backend/src/services/scheduler.js`, `frontend/app/alerts/page.js` | node-cron, alert log table, date simulator (+30d) |
| **8. Dashboard & Settings** | DONE | `frontend/app/dashboard/page.js`, `frontend/app/settings/page.js` | 4 metric cards, attention list, settings form, toasts |
| **9. Documentation & Viva Script** | DONE | `README.md` | Lab viva demo script, architecture, setup guide |

## Current State
- **Backend Server**: RUNNING on `http://localhost:5000` with active CORS and cookie parser.
- **Frontend Server**: RUNNING on `http://localhost:3000` with Turbopack.
- **E2E Integration Verification**: 10/10 automated checks passed (Health, Auth/JWT, Dashboard, Medicines CRUD, Over-Sell Rejection, Restock Transaction, Audit History, +30d Expiry Simulation & Email Digest, Frontend Route Availability).
- **Tests**: 8/8 Jest unit tests passing (`npm test` in `backend/`).
- **Database**: Seeded and ready for viva demonstration (`demo@pharmaguard.com / Demo@1234`).

## Known Bugs / Issues
- None blocking. Next.js reports a non-blocking deprecation notice recommending migrating `middleware.js` to `proxy` in future updates.

## Next Step
- Project is 100% complete and fully verified. Ready for the live Software Engineering lab presentation. Follow the 2-minute demo script in `README.md`.

## How to Run

### 1. Database Seed & Tests
```bash
cd backend
npm install
npm run seed       # Re-seeds demo data relative to current date
npm test           # Executes all 8 Jest tests
```

### 2. Backend Server (Port 5000)
```bash
cd backend
npm run dev        # Starts Express API at http://localhost:5000
```

### 3. Frontend Application (Port 3000)
```bash
cd frontend
npm install
npm run dev        # Starts Next.js at http://localhost:3000
```

## Change Log
- 2026-10-03: Initialized backend scaffold, SQLite schema, seed data, and alertEngine unit tests (Phases 1, 5).
- 2026-10-03: Completed backend REST endpoints, emailService, scheduler, and auth routes (Phases 2, 3, 4, 6, 7, 8).
- 2026-10-03: Built frontend auth, API client, toast context, and route protection middleware (Phase 2).
- 2026-10-03: Built medicines inventory table, StatusBadge component, and Add Medicine form (Phase 3).
- 2026-10-03: Implemented Sell/Restock/Correction modals and stock audit history timeline (Phase 4).
- 2026-10-03: Built alert history log page with on-demand check runner and date simulation presets (Phase 7).
- 2026-10-03: Built safety dashboard with 4 metric cards, attention items table, and settings page (Phase 8).
- 2026-10-03: Created full project README with architecture diagrams and 2-minute viva demo script (Phase 9).
- 2026-10-03: Created PROGRESS.md tracking file for seamless session resumption.
- 2026-10-03: Started live servers on ports 5000 & 3000; executed 10/10 automated E2E integration walkthrough tests successfully.
