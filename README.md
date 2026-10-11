# மதுரை மண்வாசனை — Restaurant Operations Simulator

A local full-stack restaurant operations simulator inspired by Tamil Nadu restaurants. It combines a React dashboard with an Express API, MySQL persistence through Prisma, and Socket.IO notifications.

## Current features

- Live dashboard and restaurant floor backed by the API and MySQL.
- Menu browsing, table seating, order rounds, server-calculated bills and payments.
- Kitchen task assignment, persisted preparation timing, quality checks, rework, pickup, and per-item delivery confirmation.
- Ingredient stock checks for the seeded sample recipes, vessel tracking, table cleanup and washing tasks.
- Manager controls for staff availability, menu availability, simulation settings and audit history.
- Responsive operations interface with a Three.js restaurant scene: selectable tables, 3D dining furniture and stations, camera orbit/zoom controls, and staff characters that walk to destinations derived from assigned preparation, pickup, delivery and washing tasks. Scene movement visualizes backend state; operational actions still require API confirmation.
- Persistent POS dock with a per-table order draft, live menu, existing item statuses, server-calculated bill workflow and compact mobile drawer.

The app uses a shared local development token and employee selector. This is not production authentication. Sample recipe inventory consumption currently covers idli, masala dosa and filter coffee. Payment is recorded locally; there is no payment provider. The scheduler is a single-process worker, so run one API instance per database.

## Requirements

- Node.js and npm compatible with the versions declared by the project.
- MySQL with a dedicated development database and user.
- Prisma 6.19.3 (installed as a project dependency).

Do not point `DATABASE_URL` at another application's database. Never use `prisma migrate reset` against working data.

## Configure

Keep `.env` private. Set the existing `DATABASE_URL` and `PORT`, then add:

```dotenv
WEB_ORIGIN=http://127.0.0.1:5173
APP_AUTH_TOKEN=use-a-long-random-local-token
SIMULATION_TICK_MS=1000
```

Create `apps/web/.env` from `apps/web/.env.example` and set `VITE_APP_AUTH_TOKEN` to the same value as `APP_AUTH_TOKEN`.

## Install and prepare the database

Run from the repository root:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

The migration adds the nullable relationship between washing tasks and dining sessions. Inspect migration SQL before applying it. The seed is designed to upsert initial staff, tables, menu data, settings, sample ingredients, recipes and vessel types without resetting existing data.

## Start the application

Option A, separate terminals:

Terminal 1 — API:

```bash
npm run dev:api
```

Terminal 2 — frontend:

```bash
npm run dev:web
```

Option B, both workspaces in one terminal:

```bash
npm run dev
```

Open the dashboard at http://127.0.0.1:5173. API health is at http://127.0.0.1:3000/health.

## Check the code

```bash
npm run typecheck
npm test
npm run build
```

The test suite and build should be run locally before relying on this application. Socket.IO events notify connected clients; clients reload authoritative state after reconnecting.

## Workflow guide and documentation

See [docs/API.md](docs/API.md) for endpoints, [docs/DATABASE.md](docs/DATABASE.md) for the model overview, and [docs/MANUAL-VERIFICATION.md](docs/MANUAL-VERIFICATION.md) for the end-to-end restaurant workflow and read-only SQL checks.

## Known limitations

- Local bearer token and employee selector are development-only authentication.
- Only the three seeded recipes listed above currently consume ingredient inventory.
- There is no external payment gateway or reservations/arrival simulator.
- The scheduler is safe for a single API process; multi-instance locking is not implemented.
- Run the manual verification checklist after migrations and seed. Builds, tests, database connectivity and runtime behavior must be verified in the target environment.
