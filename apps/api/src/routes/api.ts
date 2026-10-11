import { EmployeeRole, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { allowRoles, authenticate, loadActor } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { audit, confirmDelivery, confirmPickup, getSimulation, publishRefresh, qualityCheck, refreshBill, refreshOrderStatus, retryBlockedItem, seatTable, startCleanup, submitOrder } from '../services/operations.js';
import { idParam, positiveQuantity, tableParam } from '../utils/validation.js';

const router = Router();
const body = <T extends z.ZodType>(schema: T) => (value: unknown) => schema.parse(value);
const send = (res: import('express').Response, data: unknown, status = 200) => res.status(status).json({ data });

router.use(authenticate);

router.get('/employees', async (_req, res) => send(res, await prisma.employee.findMany({ where: { active: true }, orderBy: [{ role: 'asc' }, { employeeNo: 'asc' }], select: { id: true, employeeNo: true, name: true, role: true, status: true, station: true } })));

router.get('/menu', async (req, res) => {
  const search = z.string().trim().max(100).optional().parse(req.query.search);
  const category = z.string().trim().optional().parse(req.query.category);
  const groups = await prisma.menuCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { items: { where: { active: true, ...(category ? { category: { name: category } } : {}), ...(search ? { OR: [{ englishName: { contains: search } }, { tamilName: { contains: search } }] } : {}) }, orderBy: { englishName: 'asc' } } } });
  send(res, groups.map(({ items, ...group }) => ({ ...group, items })));
});

router.get('/tables', async (_req, res) => {
  const tables = await prisma.diningTable.findMany({ orderBy: { tableNo: 'asc' }, include: { sessions: { where: { status: { not: 'CLOSED' } }, orderBy: { seatedAt: 'desc' }, take: 1, include: { server: { select: { id: true, name: true, status: true } }, orders: { orderBy: { createdAt: 'desc' }, include: { items: { include: { menuItem: { select: { tamilName: true, englishName: true } } } } } }, bill: true } } } });
  send(res, tables.map((table) => ({ ...table, currentSession: table.sessions[0] ?? null, sessions: undefined })));
});

router.get('/dashboard', async (_req, res) => {
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const [tables, staff, activeOrders, backlog, waiting, revenue, ingredients, vessels, activity, settings] = await Promise.all([
    prisma.diningTable.findMany({ orderBy: { tableNo: 'asc' }, include: { sessions: { where: { status: { not: 'CLOSED' } }, orderBy: { seatedAt: 'desc' }, take: 1, include: { server: { select: { id: true, name: true, status: true } }, orders: { orderBy: { createdAt: 'desc' }, include: { items: { include: { menuItem: { select: { englishName: true, tamilName: true } } } } } }, bill: true } } } }),
    prisma.employee.findMany({ where: { active: true }, select: { id: true, employeeNo: true, name: true, role: true, status: true, station: true } }),
    prisma.customerOrder.count({ where: { status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_SERVED'] } } }),
    prisma.preparationTask.count({ where: { status: { in: ['QUEUED', 'IN_PROGRESS', 'QUALITY_CHECK'] } } }),
    prisma.orderItem.count({ where: { status: 'READY_FOR_PICKUP' } }),
    prisma.payment.aggregate({ where: { status: 'COMPLETED', paidAt: { gte: midnight } }, _sum: { amountPaise: true } }),
    prisma.ingredient.findMany({ include: { stock: true }, orderBy: { name: 'asc' } }),
    prisma.vesselType.findMany({ orderBy: { name: 'asc' } }),
    prisma.auditLog.findMany({ take: 12, orderBy: { createdAt: 'desc' }, include: { employee: { select: { name: true } } } }),
    getSimulation(),
  ]);
  const activeTables = tables.map((table) => ({ ...table, currentSession: table.sessions[0] ?? null, sessions: undefined }));
  send(res, {
    restaurant: { tamilName: 'மதுரை மண்வாசனை', englishName: 'Madurai Manvasanai', operating: true, serverTime: now },
    metrics: { revenuePaise: revenue._sum.amountPaise ?? 0, activeOrders, availableTables: tables.filter((table) => table.status === 'AVAILABLE').length, occupiedTables: tables.filter((table) => table.status !== 'AVAILABLE').length, kitchenBacklog: backlog, waitingPickup: waiting, availableStaff: staff.filter((person) => person.status === 'AVAILABLE').length, totalStaff: staff.length },
    tables: activeTables, staff,
    alerts: [
      ...ingredients.filter((item) => !item.stock || item.stock.quantity.lessThanOrEqualTo(item.lowStockAt)).map((item) => ({ id: `ingredient-${item.id}`, type: 'INGREDIENT_LOW', name: item.name, quantity: item.stock?.quantity.toString() ?? '0', unit: item.unit })),
      ...vessels.filter((item) => item.cleanQty <= item.lowStockAt).map((item) => ({ id: `vessel-${item.id}`, type: 'VESSEL_LOW', name: item.name, quantity: String(item.cleanQty) })),
    ],
    activity: activity.map(({ employee, ...event }) => ({ ...event, employeeName: employee?.name ?? 'System' })),
    settings,
  });
});

router.post('/tables/:tableNo/seat', loadActor, allowRoles(EmployeeRole.SERVER, EmployeeRole.MANAGER), async (req, res) => {
  const { tableNo } = tableParam.parse(req.params);
  const data = body(z.object({ partySize: positiveQuantity, serverId: z.string().optional() }))(req.body);
  send(res, await seatTable(tableNo, data.partySize, data.serverId, req.actor!), 201);
});

router.post('/orders', loadActor, allowRoles(EmployeeRole.SERVER, EmployeeRole.MANAGER), async (req, res) => {
  const data = body(z.object({
    tableNo: z.string().regex(/^T\d{2}$/),
    items: z.array(z.object({ menuItemId: z.string().min(1), quantity: positiveQuantity, specialInstructions: z.string().max(500).optional(), customizations: z.record(z.string(), z.unknown()).optional() })).min(1).max(30),
  }))(req.body);
  const key = z.string().min(8).max(100).optional().parse(req.header('idempotency-key'));
  send(res, await submitOrder(data, req.actor!, key), 201);
});

router.get('/orders', async (req, res) => {
  const tableNo = z.string().regex(/^T\d{2}$/).optional().parse(req.query.tableNo);
  const orders = await prisma.customerOrder.findMany({ where: tableNo ? { session: { table: { tableNo } } } : {}, orderBy: { createdAt: 'desc' }, take: 100, include: { server: { select: { id: true, name: true } }, session: { include: { table: { select: { tableNo: true } } } }, items: { include: { menuItem: true, preparationTask: true, pickupTasks: true, deliveries: true } } } });
  send(res, orders);
});

router.get('/kitchen/tasks', async (_req, res) => send(res, await prisma.preparationTask.findMany({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }, orderBy: { createdAt: 'asc' }, include: { cook: { select: { id: true, name: true, status: true } }, orderItem: { include: { menuItem: true, order: { include: { session: { include: { table: true } } } } } } } })));

router.post('/kitchen/items/:id/quality', loadActor, allowRoles(EmployeeRole.COOK, EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = body(z.object({ passed: z.boolean(), reason: z.string().max(500).optional() }))(req.body);
  const item = await prisma.orderItem.findUnique({ where: { id }, include: { preparationTask: true } });
  if (req.actor!.role === 'COOK' && item?.preparationTask?.cookId !== req.actor!.id) throw new HttpError(403, 'NOT_ASSIGNED_COOK', 'Only the assigned cook can inspect this item.');
  send(res, await qualityCheck(id, data.passed, data.reason, req.actor!.id));
});

router.get('/pickups', async (_req, res) => {
  const pickups = await prisma.pickupTask.findMany({
    where: { status: { in: ['QUEUED', 'ASSIGNED', 'IN_PROGRESS'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      server: { select: { id: true, name: true } },
      item: {
        include: {
          menuItem: true,
          order: {
            include: {
              session: {
                include: {
                  table: true,
                  server: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  send(res, pickups);
});

router.post('/pickups/:id/confirm', loadActor, allowRoles(EmployeeRole.SERVER, EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  send(res, await confirmPickup(id, req.actor!.id, req.actor!.role === EmployeeRole.MANAGER));
});

router.post('/pickups/:id/deliver', loadActor, allowRoles(EmployeeRole.SERVER, EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = body(z.object({ tableNo: z.string().regex(/^T\d{2}$/) }))(req.body);
  send(res, await confirmDelivery(id, data.tableNo, req.actor!.id, req.actor!.role === EmployeeRole.MANAGER));
});

router.get('/sessions/:id/bill', async (req, res) => {
  const { id } = idParam.parse(req.params);
  const bill = await prisma.bill.findUnique({ where: { sessionId: id }, include: { payments: { orderBy: { createdAt: 'desc' } } } });
  if (!bill) throw new HttpError(404, 'BILL_NOT_FOUND', 'Bill not found for this session.');
  send(res, bill);
});

router.post('/sessions/:id/discount', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { discountPaise } = body(z.object({ discountPaise: z.number().int().min(0) }))(req.body);
  const bill = await prisma.$transaction(async (tx) => {
    const current = await refreshBill(tx, id);
    if (discountPaise > current.subtotalPaise) throw new HttpError(400, 'DISCOUNT_TOO_LARGE', 'Discount cannot exceed the bill subtotal.');
    const settings = await getSimulation(tx);
    const taxPaise = Math.round((current.subtotalPaise - discountPaise) * settings.taxRateBasisPoints / 10_000);
    const updated = await tx.bill.update({ where: { sessionId: id }, data: { discountPaise, taxPaise, totalPaise: current.subtotalPaise - discountPaise + taxPaise } });
    await audit(tx, req.actor!.id, 'Bill', updated.id, 'DISCOUNT_APPLIED', { discountPaise });
    return updated;
  });
  publishRefresh('billing.changed', bill);
  send(res, bill);
});

router.post('/sessions/:id/payments', loadActor, allowRoles(EmployeeRole.SERVER, EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const input = body(z.object({ method: z.enum(['CASH', 'CARD', 'UPI']), amountPaise: z.number().int().positive().optional() }))(req.body);
  const idempotencyKey = z.string().uuid().parse(req.header('idempotency-key'));
  const reference = `SIM-${idempotencyKey}`;
  const previous = await prisma.payment.findUnique({ where: { reference } });
  if (previous) return send(res, { payment: previous, remaining: 0 });
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.diningSession.findUnique({ where: { id }, include: { table: true } });
    if (!session || session.status !== 'OPEN') throw new HttpError(409, 'SESSION_NOT_OPEN', 'Dining session is not open for payment.');
    if (req.actor!.role === 'SERVER' && session.serverId !== req.actor!.id) throw new HttpError(403, 'WRONG_SERVER', 'Only the assigned server may record payment.');
    const unfinished = await tx.orderItem.count({ where: { order: { sessionId: id }, status: { notIn: ['SERVED', 'CANCELLED'] } } });
    if (unfinished) throw new HttpError(409, 'ORDER_NOT_SERVED', 'Serve or cancel every item before payment.');
    const bill = await refreshBill(tx, id);
    const paid = await tx.payment.aggregate({ where: { billId: bill.id, status: 'COMPLETED' }, _sum: { amountPaise: true } });
    const outstanding = bill.totalPaise - (paid._sum.amountPaise ?? 0);
    const amountPaise = input.amountPaise ?? outstanding;
    if (amountPaise > outstanding || amountPaise <= 0) throw new HttpError(400, 'INVALID_PAYMENT_AMOUNT', 'Payment must be positive and no greater than the outstanding balance.');
    const payment = await tx.payment.create({ data: { billId: bill.id, amountPaise, method: input.method, status: 'COMPLETED', paidAt: new Date(), reference } });
    const remaining = outstanding - amountPaise;
    if (remaining === 0) {
      await tx.diningSession.update({ where: { id }, data: { status: 'PAYMENT_PENDING' } });
      await tx.diningTable.update({ where: { id: session.tableId }, data: { status: 'PAYMENT_PENDING' } });
    }
    await audit(tx, req.actor!.id, 'Payment', payment.id, 'PAYMENT_RECORDED', { amountPaise, method: input.method, remaining });
    return { payment, bill, remaining };
  });
  publishRefresh('billing.changed', result);
  send(res, result, 201);
});

router.post('/tables/:tableNo/cleanup', loadActor, allowRoles(EmployeeRole.SERVER, EmployeeRole.MANAGER), async (req, res) => {
  const { tableNo } = tableParam.parse(req.params);
  send(res, await startCleanup(tableNo, req.actor!.id));
});

router.get('/staff', async (_req, res) => {
  const staff = await prisma.employee.findMany({
    where: { active: true },
    orderBy: [{ role: 'asc' }, { employeeNo: 'asc' }],
    include: {
      prepTasks: {
        where: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'QUALITY_CHECK'] } },
        select: { id: true, status: true, station: true },
      },
      pickupTasks: {
        where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        select: { id: true, status: true },
      },
      washingTasks: {
        where: { status: 'IN_PROGRESS' },
        select: { id: true, status: true },
      },
    },
  });
  send(res, staff);
});

router.patch('/staff/:id/status', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { status } = body(z.object({ status: z.enum(['AVAILABLE', 'OFF_DUTY']) }))(req.body);
  const employee = await prisma.employee.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({ data: { employeeId: req.actor!.id, entityType: 'Employee', entityId: id, action: 'AVAILABILITY_CHANGED', details: { status } } });
  publishRefresh('staff.changed', { employeeId: id, status });
  send(res, employee);
});

router.patch('/menu/:id/availability', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { available, active } = body(z.object({ available: z.boolean().optional(), active: z.boolean().optional() }).refine((x) => x.available !== undefined || x.active !== undefined))(req.body);
  const item = await prisma.menuItem.update({ where: { id }, data: { ...(available === undefined ? {} : { available }), ...(active === undefined ? {} : { active }) } });
  publishRefresh('menu.changed', item);
  send(res, item);
});

router.get('/ingredients', async (_req, res) => send(res, await prisma.ingredient.findMany({ include: { stock: true, recipeUses: { include: { recipe: { include: { menuItem: { select: { englishName: true } } } } } }, movements: { take: 10, orderBy: { createdAt: 'desc' } } }, orderBy: { name: 'asc' } })));

router.post('/ingredients', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const data = body(z.object({ name: z.string().trim().min(2).max(100), unit: z.string().trim().min(1).max(30), lowStockAt: z.number().nonnegative(), initialQuantity: z.number().nonnegative().default(0) }))(req.body);
  const ingredient = await prisma.$transaction(async (tx) => {
    const row = await tx.ingredient.create({ data: { name: data.name, unit: data.unit, lowStockAt: new Prisma.Decimal(data.lowStockAt) } });
    await tx.ingredientStock.create({ data: { ingredientId: row.id, quantity: new Prisma.Decimal(data.initialQuantity), updatedAt: new Date() } });
    if (data.initialQuantity) await tx.inventoryMovement.create({ data: { ingredientId: row.id, type: 'RECEIPT', quantity: new Prisma.Decimal(data.initialQuantity), reason: 'Initial manager stock entry' } });
    await audit(tx, req.actor!.id, 'Ingredient', row.id, 'INGREDIENT_CREATED', { name: data.name, initialQuantity: data.initialQuantity });
    return row;
  });
  publishRefresh('inventory.changed', { ingredientId: ingredient.id });
  send(res, ingredient, 201);
});

router.post('/ingredients/:id/stock', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = body(z.object({ delta: z.number().finite().refine((n) => n !== 0), reason: z.string().trim().min(3).max(200) }))(req.body);
  const delta = new Prisma.Decimal(data.delta);
  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.ingredientStock.findUnique({ where: { ingredientId: id } });
    if (!stock) throw new HttpError(404, 'STOCK_NOT_FOUND', 'Ingredient stock record not found.');
    const change = await tx.ingredientStock.updateMany({ where: { ingredientId: id, ...(data.delta < 0 ? { quantity: { gte: delta.abs() } } : {}) }, data: { quantity: { increment: delta }, updatedAt: new Date() } });
    if (change.count !== 1) throw new HttpError(409, 'INSUFFICIENT_STOCK', 'Stock cannot become negative.');
    await tx.inventoryMovement.create({ data: { ingredientId: id, type: data.delta > 0 ? 'RECEIPT' : 'ADJUSTMENT', quantity: delta.abs(), reason: data.reason } });
    await audit(tx, req.actor!.id, 'Ingredient', id, 'STOCK_ADJUSTED', { delta: data.delta, reason: data.reason });
    return tx.ingredientStock.findUniqueOrThrow({ where: { ingredientId: id } });
  });
  publishRefresh('inventory.changed', { ingredientId: id });
  send(res, result);
});

router.get('/vessels', async (_req, res) => {
  const [types, tasks] = await Promise.all([
    prisma.vesselType.findMany({ orderBy: { name: 'asc' } }),
    prisma.washingTask.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { vesselType: true, employee: { select: { id: true, name: true } } } }),
  ]);
  send(res, { types, tasks });
});

router.post('/vessels/:id/stock', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = body(z.object({ cleanDelta: z.number().int().refine((n) => n !== 0), reason: z.string().trim().min(3).max(200) }))(req.body);
  const row = await prisma.$transaction(async (tx) => {
    const change = await tx.vesselType.updateMany({ where: { id, ...(data.cleanDelta < 0 ? { cleanQty: { gte: -data.cleanDelta } } : {}) }, data: { cleanQty: { increment: data.cleanDelta } } });
    if (change.count !== 1) throw new HttpError(409, 'VESSEL_STOCK_INVALID', 'Clean vessel inventory cannot become negative.');
    await tx.inventoryMovement.create({ data: { vesselTypeId: id, type: data.cleanDelta > 0 ? 'RECEIPT' : 'ADJUSTMENT', quantity: new Prisma.Decimal(Math.abs(data.cleanDelta)), reason: data.reason } });
    await audit(tx, req.actor!.id, 'VesselType', id, 'VESSEL_STOCK_ADJUSTED', { cleanDelta: data.cleanDelta, reason: data.reason });
    return tx.vesselType.findUniqueOrThrow({ where: { id } });
  });
  publishRefresh('vessels.changed', row);
  send(res, row);
});

router.post('/washing/:id/start', loadActor, allowRoles(EmployeeRole.DISHWASHER, EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const task = await prisma.$transaction(async (tx) => {
    const wash = await tx.washingTask.findUnique({ where: { id }, include: { vesselType: true } });
    if (!wash || !['QUEUED', 'ASSIGNED'].includes(wash.status)) throw new HttpError(409, 'WASH_NOT_QUEUED', 'Washing task is not available to start.');
    if (wash.vesselType.dirtyQty < wash.quantity) throw new HttpError(409, 'DIRTY_COUNT_MISMATCH', 'Dirty vessel inventory is lower than this batch.');
    const now = new Date();
    const settings = await getSimulation(tx);
    const seconds = Math.ceil(Math.max(60, wash.quantity * 8) / settings.speed);
    const updated = await tx.washingTask.update({ where: { id }, data: { employeeId: req.actor!.id, status: 'IN_PROGRESS', startedAt: now, expectedAt: new Date(now.getTime() + seconds * 1000) } });
    await tx.vesselType.update({ where: { id: wash.vesselTypeId }, data: { dirtyQty: { decrement: wash.quantity }, washingQty: { increment: wash.quantity } } });
    await tx.employee.update({ where: { id: req.actor!.id }, data: { status: 'BUSY' } });
    await audit(tx, req.actor!.id, 'WashingTask', id, 'WASHING_STARTED', { quantity: wash.quantity, expectedAt: updated.expectedAt?.toISOString() });
    return updated;
  });
  publishRefresh('vessels.changed', { taskId: id, status: task.status });
  send(res, task);
});

router.get('/settings', async (_req, res) => send(res, await getSimulation()));
router.patch('/settings', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const data = body(z.object({ speed: z.union([z.literal(1), z.literal(2), z.literal(5)]).optional(), paused: z.boolean().optional(), taxRateBasisPoints: z.number().int().min(0).max(3000).optional(), reworkSeconds: z.number().int().min(10).max(3600).optional(), pickupDeadlineSeconds: z.number().int().min(30).max(1800).optional() }).refine((x) => Object.keys(x).length > 0))(req.body);
  const row = await prisma.simulationSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  await prisma.auditLog.create({ data: { employeeId: req.actor!.id, entityType: 'SimulationSettings', entityId: '1', action: 'SETTINGS_UPDATED', details: data } });
  publishRefresh('simulation.changed', row);
  send(res, row);
});

router.get('/audit', async (req, res) => {
  const take = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.take);
  send(res, await prisma.auditLog.findMany({ take, orderBy: { createdAt: 'desc' }, include: { employee: { select: { name: true, role: true } } } }));
});

router.post('/orders/items/:id/cancel', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { reason } = body(z.object({ reason: z.string().trim().min(3).max(300) }))(req.body);
  const item = await prisma.$transaction(async (tx) => {
    const current = await tx.orderItem.findUnique({ where: { id }, include: { order: true, preparationTask: true, pickupTasks: true } });
    if (!current || !['QUEUED', 'BLOCKED'].includes(current.status)) throw new HttpError(409, 'INVALID_CANCELLATION', 'Only queued or blocked items can be cancelled safely.');
    if (current.preparationTask && !['QUEUED', 'BLOCKED'].includes(current.preparationTask.status)) throw new HttpError(409, 'INVALID_CANCELLATION', 'Preparation has already started; record an exception instead.');
    const updated = await tx.orderItem.update({ where: { id }, data: { status: 'CANCELLED', failureReason: reason } });
    if (current.preparationTask) await tx.preparationTask.update({ where: { id: current.preparationTask.id }, data: { status: 'CANCELLED' } });
    await tx.pickupTask.updateMany({ where: { orderItemId: id, status: { not: 'COMPLETED' } }, data: { status: 'CANCELLED' } });
    await refreshOrderStatus(tx, current.orderId);
    await audit(tx, req.actor!.id, 'OrderItem', id, 'ORDER_ITEM_CANCELLED', { reason });
    await refreshBill(tx, current.order.sessionId);
    return updated;
  });
  publishRefresh('order.updated', { orderItemId: id, status: item.status });
  send(res, item);
});

router.post('/orders/items/:id/retry', loadActor, allowRoles(EmployeeRole.MANAGER), async (req, res) => {
  const { id } = idParam.parse(req.params);
  send(res, await retryBlockedItem(id, req.actor!.id));
});

export default router;
