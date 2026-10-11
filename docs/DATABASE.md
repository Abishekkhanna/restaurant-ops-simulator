# Database model reference

The Prisma schema at `prisma/schema.prisma` is authoritative. The existing initial migration is retained. The additive migration `20261011010000_link_washing_tasks_to_sessions` adds a nullable session foreign key to washing tasks so the scheduler can determine when a specific table's cleanup is complete. Apply migrations with the documented development command; no migration is applied by this source change.

| Domain | Models | Relationship / purpose |
| --- | --- | --- |
| Workforce | `Employee`, `TableAssignment` | Persistent role, availability, station and server/table assignment |
| Dining | `DiningTable`, `DiningSession` | Table state and historical customer visit; session links its server, orders, bill and cleanup work |
| Menu | `MenuCategory`, `MenuItem`, `Recipe`, `RecipeIngredient` | Editable menu, station, duration, price snapshot source and recipe requirements |
| Inventory | `Ingredient`, `IngredientStock`, `InventoryMovement` | Current quantity plus auditable stock changes and waste |
| Orders | `CustomerOrder`, `OrderItem` | Order rounds and individually tracked items with price snapshots and states |
| Kitchen | `PreparationTask` | Cook, station, expected times, progress, quality and rework lifecycle |
| Service | `PickupTask`, `DeliveryRecord` | Explicit pickup and correct-table delivery evidence |
| Finance | `Bill`, `Payment` | Session totals and idempotently keyed payment records |
| Dishwashing | `VesselType`, `WashingTask` | Clean/dirty/in-use quantities and batch washing linked to session |
| Operations | `AuditLog`, `SimulationSettings` | State transition history and persisted scheduler settings |

## Operational invariants

- Order totals and tax are computed by the API from persisted menu prices in integer paise; item price snapshots preserve historical pricing.
- Recipe stock is deducted transactionally when a cook starts a task. Items with a configured recipe cannot start if stock is insufficient. Seeded sample recipes currently cover idli, masala dosa and filter coffee; other menu items do not yet consume ingredient stock.
- Preparation completion only makes an item eligible for quality inspection. Quality approval creates pickup work; it does not mark the item served.
- Delivery checks that the pickup's item, session and destination table match. Only the delivered item changes to served.
- Cleanup records dirty vessel batches and disposable banana leaf waste. A session can release its table after payment and its associated washing tasks complete.
- Scheduler timestamps are real database timestamps; simulation speed scales future durations. The first implementation runs one in-process scheduler and is intended for one API process.
- These models use the existing Prisma enums, foreign keys and indexes. Review `schema.prisma` and its migrations for exact column-level constraints.
