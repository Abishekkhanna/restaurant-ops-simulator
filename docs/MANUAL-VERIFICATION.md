# Manual verification checklist

The project author did not execute commands, connect to MySQL, or run build/test checks as part of this implementation. Use a dedicated development database and verify each step locally.

## Startup and seed

- [ ] Apply pending migrations and run the idempotent seed command.
- [ ] Check the API health endpoint and confirm `database: "ok"`.
- [ ] Open the web app; confirm tables, menu, staff, settings and dashboard metrics load through `/api`.
- [ ] Confirm refreshing the browser preserves sessions, orders and active task progress.
- [ ] Open two browser clients and confirm a mutation appears on the other client, then disconnect/reconnect and verify it refetches current state.

## End-to-end order

1. Select a manager or server identity in the application. Seat a party of two at T01 and assign an available server.
2. Add idli, masala dosa, and filter coffee; submit the order. Confirm the API response and kitchen view show three independently tracked order items routed to their configured stations.
3. Start each available preparation task. Verify progress and estimated completion change over elapsed time. For a fast manual check, set simulation speed to 5x before starting.
4. Wait for completion; run quality checks. Fail one check and verify a rework task appears; pass all items to create pickup work.
5. As an eligible server, accept pickup work, then deliver each item to T01. Confirm the API rejects a different table and each item becomes served only after its own delivery confirmation.
6. Review the session bill. Confirm quantities and server-calculated totals, apply a manager discount if desired, and record payment with the UI's idempotency key handling.
7. Start cleanup. Confirm a washing batch is tied to the session, start it as a dishwasher, and let the scheduler complete wash/sanitization. Verify T01 becomes available only when cleanup work is complete.

## Exceptions

- [ ] Set a sample ingredient quantity low and verify a recipe-backed item becomes blocked without negative stock; restock and retry as manager.
- [ ] Mark a cook unavailable before ordering and verify assignment skips them or leaves work unassigned with an explanation.
- [ ] Mark a server unavailable and verify pickup work is not silently delivered.
- [ ] Submit a payment request twice with the same idempotency key and confirm only one payment is recorded.
- [ ] Cancel an eligible item as manager and verify an audit record and updated bill.
- [ ] Stop and restart the API during active preparation; confirm the persistent scheduler resumes from saved timestamps.
- [ ] Pause/resume simulation, and verify future durations honor the selected speed.
- [ ] Verify staff/member authorization failures for role-restricted actions.

## Suggested SQL spot checks

Run read-only queries in the dedicated application database:

```sql
SELECT role, COUNT(*) AS employees FROM Employee GROUP BY role;
SELECT status, COUNT(*) AS tables FROM DiningTable GROUP BY status;
SELECT COUNT(*) AS categories FROM MenuCategory;
SELECT COUNT(*) AS menu_items FROM MenuItem;
SELECT COUNT(*) AS settings FROM SimulationSettings;
SELECT id, tableId, status, startedAt, endedAt FROM DiningSession ORDER BY startedAt DESC LIMIT 5;
SELECT o.orderNumber, o.status, COUNT(i.id) AS item_count
FROM CustomerOrder o LEFT JOIN OrderItem i ON i.orderId = o.id
GROUP BY o.id, o.orderNumber, o.status ORDER BY o.createdAt DESC LIMIT 10;
SELECT status, COUNT(*) AS prep_tasks FROM PreparationTask GROUP BY status;
SELECT status, COUNT(*) AS pickup_tasks FROM PickupTask GROUP BY status;
SELECT COUNT(*) AS deliveries FROM DeliveryRecord;
SELECT COUNT(*) AS payments FROM Payment;
SELECT status, COUNT(*) AS washing_tasks FROM WashingTask GROUP BY status;
```

Prisma's MySQL model/table names may be quoted or mapped differently in the installed schema. Use the actual model mappings from `prisma/schema.prisma` if a query needs adjustment. These queries are read-only.
