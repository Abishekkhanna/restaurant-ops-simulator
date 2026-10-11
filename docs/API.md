# API reference

The API is served from `http://127.0.0.1:3000`. All `/api` routes require the shared local bearer token configured as `APP_AUTH_TOKEN`. Send `Authorization: Bearer <token>` and `X-Employee-Id: <employee-id>`; manager-only actions also check the selected employee's database role. This is a local development identity mechanism, not production authentication.

Errors use `{ error: { code, message, details? } }`. Successful responses use JSON. Mutations publish Socket.IO events after the database operation; clients must reload authoritative data after reconnecting.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process and database readiness |
| GET | `/api/dashboard` | Tables, staff, orders, queues, stock warnings, settings and activity |
| GET | `/api/tables` | Dining tables and active sessions |
| POST | `/api/tables/:id/seat` | Start a session and assign a server |
| GET | `/api/employees` | Staff roster and workload |
| PATCH | `/api/employees/:id/status` | Manager changes availability |
| GET | `/api/menu` | Categories and available menu items |
| PATCH | `/api/menu/:id/availability` | Manager changes menu availability |
| GET/POST | `/api/orders` | List orders / create a priced order round |
| POST | `/api/orders/:id/items/:itemId/cancel` | Manager cancels an eligible item |
| POST | `/api/orders/:id/items/:itemId/retry` | Manager retries a stock-blocked item after restocking |
| GET | `/api/kitchen` | Preparation tasks by station and state |
| POST | `/api/kitchen/tasks/:id/start` | Start assigned preparation and consume configured recipe stock |
| POST | `/api/kitchen/tasks/:id/quality` | Pass or fail quality check; failure creates rework |
| GET | `/api/service` | Pickup and delivery work |
| POST | `/api/pickups/:id/accept` | Server explicitly accepts a pickup |
| POST | `/api/pickups/:id/deliver` | Confirms item delivery to its own table |
| GET | `/api/sessions/:id/bill` | Server-calculated bill and items |
| POST | `/api/sessions/:id/discount` | Manager applies configured paise discount |
| POST | `/api/sessions/:id/payments` | Record payment; requires `Idempotency-Key` |
| POST | `/api/sessions/:id/cleanup` | Close paid session and create vessel washing work |
| GET | `/api/ingredients` | Ingredient inventory |
| POST | `/api/ingredients/:id/stock` | Manager records a restock movement |
| GET | `/api/vessels` | Vessel balances and washing tasks |
| POST | `/api/vessels/:id/stock` | Manager records vessel stock adjustment |
| POST | `/api/washing/:id/start` | Dishwasher starts washing/sanitizing task |
| GET/PATCH | `/api/settings` | Simulation configuration / manager update |
| GET | `/api/audit` | Manager audit history |

Request shapes are validated in `apps/api/src/routes/api.ts`; see those schemas for exact field names. Order line items accept menu item IDs, quantities, customizations, and special instructions. Client prices are ignored. `POST /api/orders` creates a distinct order round for the active session.

## Socket.IO

Connect to the API origin with the same token in `auth.token`. Events are operational notifications, not a durable event log. On `connect` or `reconnect`, refetch dashboard and feature data. The database remains authoritative.
