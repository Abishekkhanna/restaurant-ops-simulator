import { EmployeeRole, OrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { publish } from '../sockets/hub.js';
import { HttpError } from '../middleware/errors.js';

type Tx = Prisma.TransactionClient;
const vesselConsumption = [
  { name: 'Stainless-steel tumbler', perGuest: 1, disposable: false },
  { name: 'Stainless-steel plate', perGuest: 1, disposable: false },
  { name: 'Banana leaf', perGuest: 1, disposable: true },
  { name: 'Serving bowl', perGuest: 0.5, disposable: false },
  { name: 'Serving spoon', perGuest: 0.5, disposable: false },
];

export async function audit(tx: Tx, employeeId: string | null, entityType: string, entityId: string, action: string, details?: Record<string, unknown>) {
  await tx.auditLog.create({ data: { employeeId, entityType, entityId, action, details: details as Prisma.InputJsonValue | undefined } });
}

export function publishRefresh(event: string, payload: unknown) { publish(event, payload); }

export async function getSimulation(tx: Tx = prisma) {
  let settings = await tx.simulationSettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await tx.simulationSettings.create({ data: { id: 1 } });
  return settings;
}

export async function assignQueuedPreparation(tx: Tx) {
  const queued = await tx.preparationTask.findMany({
    where: { status: 'QUEUED', cookId: null },
    include: {
      orderItem: {
        include: {
          menuItem: {
            include: {
              recipe: {
                include: {
                  ingredients: {
                    include: {
                      ingredient: {
                        include: { stock: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const settings = await getSimulation(tx);
  for (const task of queued) {
    const candidates = await tx.employee.findMany({ where: { role: 'COOK', active: true, status: 'AVAILABLE' }, orderBy: { employeeNo: 'asc' } });
    const cook = candidates.find((candidate) => candidate.station === task.station || candidate.station === null || (task.station === 'Meals' && candidate.station === 'Tiffin'));
    if (!cook) continue;
    const recipe = task.orderItem.menuItem.recipe;
    const missing = recipe?.ingredients.find((recipePart) => {
      const required = recipePart.quantity.mul(task.orderItem.quantity).div(recipe.yieldQty);
      return !recipePart.ingredient.stock || recipePart.ingredient.stock.quantity.lessThan(required);
    });
    if (missing) {
      const required = missing.quantity.mul(task.orderItem.quantity).div(recipe!.yieldQty);
      await tx.preparationTask.update({ where: { id: task.id }, data: { status: 'BLOCKED', exceptionHistory: [{ at: new Date().toISOString(), reason: `Insufficient ${missing.ingredient.name}`, required: required.toString() }] } });
      await tx.orderItem.update({ where: { id: task.orderItemId }, data: { status: 'BLOCKED', failureReason: `Insufficient ${missing.ingredient.name} stock.` } });
      await audit(tx, null, 'PreparationTask', task.id, 'BLOCKED_INSUFFICIENT_INGREDIENT', { ingredientId: missing.ingredientId, ingredientName: missing.ingredient.name, required: required.toString() });
      publish('manager.alert', { type: 'LOW_INGREDIENT', ingredientId: missing.ingredientId, name: missing.ingredient.name, orderItemId: task.orderItemId });
      continue;
    }
    if (recipe) {
      for (const recipePart of recipe.ingredients) {
        const required = recipePart.quantity.mul(task.orderItem.quantity).div(recipe.yieldQty);
        const consumed = await tx.ingredientStock.updateMany({ where: { ingredientId: recipePart.ingredientId, quantity: { gte: required } }, data: { quantity: { decrement: required } } });
        if (consumed.count !== 1) throw new HttpError(409, 'INGREDIENT_STOCK_CHANGED', 'Ingredient stock changed while assigning this cooking task.');
        await tx.inventoryMovement.create({ data: { ingredientId: recipePart.ingredientId, type: 'CONSUMPTION', quantity: required, reason: `Cooking started for order item ${task.orderItemId}` } });
      }
    }
    const now = new Date();
    const duration = Math.max(1, task.orderItem.menuItem.prepSeconds / settings.speed);
    await tx.preparationTask.update({ where: { id: task.id }, data: { cookId: cook.id, status: 'IN_PROGRESS', progress: 0, startedAt: now, expectedAt: new Date(now.getTime() + duration * 1000) } });
    await tx.orderItem.update({ where: { id: task.orderItemId }, data: { status: 'PREPARING' } });
    await tx.employee.update({ where: { id: cook.id }, data: { status: 'BUSY' } });
    await audit(tx, null, 'PreparationTask', task.id, 'COOK_ASSIGNED', { cookId: cook.id, station: task.station, reason: 'First eligible available cook by employee number.' });
    publish('kitchen.task.assigned', { taskId: task.id, cookId: cook.id, station: task.station });
  }
}

async function assignPickup(tx: Tx, orderItemId: string) {
  const item = await tx.orderItem.findUnique({ where: { id: orderItemId }, include: { order: { include: { session: { include: { server: true } } } } } });
  if (!item) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Order item not found.');
  const responsible = item.order.session.server;
  let server = responsible.active && responsible.status !== 'OFF_DUTY' ? responsible : null;
  if (!server) {
    const candidates = await tx.employee.findMany({ where: { role: 'SERVER', active: true, status: 'AVAILABLE' }, orderBy: { employeeNo: 'asc' } });
    const loads = await Promise.all(candidates.map(async (candidate) => ({ employee: candidate, load: await tx.pickupTask.count({ where: { serverId: candidate.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } }) })));
    server = loads.sort((a, b) => a.load - b.load || a.employee.employeeNo.localeCompare(b.employee.employeeNo))[0]?.employee ?? null;
  }
  const settings = await getSimulation(tx);
  const now = new Date();
  const pickup = await tx.pickupTask.create({ data: {
    orderItemId, serverId: server?.id ?? null, status: server ? 'ASSIGNED' : 'QUEUED', assignedAt: server ? now : null,
    deadlineAt: server ? new Date(now.getTime() + settings.pickupDeadlineSeconds * 1000) : null,
  } });
  await tx.orderItem.update({ where: { id: orderItemId }, data: { status: 'READY_FOR_PICKUP' } });
  await audit(tx, null, 'PickupTask', pickup.id, 'PICKUP_ASSIGNED', { serverId: server?.id ?? null, tableNo: item.order.session.tableId });
  publish('food.ready', { orderItemId, pickupTaskId: pickup.id, serverId: server?.id ?? null });
  return pickup;
}

export async function refreshOrderStatus(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { status: true } });
  if (!items.length) return;
  const allTerminal = items.every((item) => item.status === 'SERVED' || item.status === 'CANCELLED');
  const anyServed = items.some((item) => item.status === 'SERVED');
  const allCancelled = items.every((item) => item.status === 'CANCELLED');
  const status: OrderStatus = allCancelled ? 'CANCELLED' : allTerminal ? 'SERVED' : anyServed ? 'PARTIALLY_SERVED' : 'IN_PREPARATION';
  await tx.customerOrder.update({ where: { id: orderId }, data: { status } });
}

export async function refreshBill(tx: Tx, sessionId: string) {
  const settings = await getSimulation(tx);
  const rows = await tx.orderItem.findMany({
    where: { order: { sessionId }, status: { not: 'CANCELLED' } },
    select: { quantity: true, unitPricePaise: true },
  });
  const subtotalPaise = rows.reduce((sum, item) => sum + item.quantity * item.unitPricePaise, 0);
  const previous = await tx.bill.findUnique({ where: { sessionId } });
  const discountPaise = previous?.discountPaise ?? 0;
  const taxPaise = Math.round((subtotalPaise - discountPaise) * settings.taxRateBasisPoints / 10_000);
  return tx.bill.upsert({
    where: { sessionId },
    create: { sessionId, subtotalPaise, discountPaise, taxPaise, totalPaise: subtotalPaise - discountPaise + taxPaise },
    update: { subtotalPaise, taxPaise, totalPaise: subtotalPaise - discountPaise + taxPaise },
  });
}

export async function seatTable(tableNo: string, partySize: number, requestedServerId: string | undefined, actor: { id: string; role: EmployeeRole }) {
  const session = await prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findUnique({ where: { tableNo } });
    if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND', 'Dining table not found.');
    if (table.status !== 'AVAILABLE') throw new HttpError(409, 'TABLE_NOT_AVAILABLE', 'Only an available table can be seated.');
    if (partySize > table.capacity) throw new HttpError(400, 'PARTY_TOO_LARGE', `Party size exceeds table capacity (${table.capacity}).`);
    const serverId = actor.role === 'SERVER' ? actor.id : requestedServerId;
    if (!serverId) throw new HttpError(400, 'SERVER_REQUIRED', 'Choose an assigned server.');
    const server = await tx.employee.findFirst({ where: { id: serverId, role: 'SERVER', active: true, status: { not: 'OFF_DUTY' } } });
    if (!server) throw new HttpError(400, 'SERVER_UNAVAILABLE', 'Selected server is unavailable.');
    const claimed = await tx.diningTable.updateMany({ where: { id: table.id, status: 'AVAILABLE' }, data: { status: 'SEATED' } });
    if (claimed.count !== 1) throw new HttpError(409, 'TABLE_NOT_AVAILABLE', 'Another operation has already seated this table.');
    for (const rule of vesselConsumption) {
      const vessel = await tx.vesselType.findUnique({ where: { name: rule.name } });
      if (!vessel) continue;
      const quantity = Math.ceil(partySize * rule.perGuest);
      const reserved = await tx.vesselType.updateMany({ where: { id: vessel.id, cleanQty: { gte: quantity } }, data: { cleanQty: { decrement: quantity }, inUseQty: { increment: quantity } } });
      if (reserved.count !== 1) throw new HttpError(409, 'CLEAN_VESSELS_LOW', `Not enough clean ${rule.name.toLowerCase()}s for this party.`);
    }
    const created = await tx.diningSession.create({ data: { tableId: table.id, serverId, partySize, assignments: { create: { employeeId: serverId } } } });
    await audit(tx, actor.id, 'DiningSession', created.id, 'CUSTOMERS_SEATED', { tableNo, partySize, serverId });
    return created;
  });
  publish('table.changed', { tableNo, status: 'SEATED', sessionId: session.id });
  return session;
}

export async function submitOrder(input: { tableNo: string; items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string; customizations?: Record<string, unknown> }> }, actor: { id: string; role: EmployeeRole }, idempotencyKey?: string) {
  if (idempotencyKey) {
    const prior = await prisma.customerOrder.findUnique({ where: { idempotencyKey }, include: { items: true } });
    if (prior) return prior;
  }
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.diningSession.findFirst({ where: { table: { tableNo: input.tableNo }, status: 'OPEN' }, include: { table: true } });
    if (!session) throw new HttpError(409, 'SESSION_NOT_OPEN', 'Seat customers at this table before ordering.');
    if (actor.role === 'SERVER' && session.serverId !== actor.id) throw new HttpError(403, 'WRONG_SERVER', 'Only the assigned server may add to this table.');
    const ids = [...new Set(input.items.map((item) => item.menuItemId))];
    const menu = await tx.menuItem.findMany({ where: { id: { in: ids }, active: true, available: true } });
    if (menu.length !== ids.length) throw new HttpError(400, 'MENU_UNAVAILABLE', 'One or more menu items are inactive or unavailable.');
    const menuById = new Map(menu.map((item) => [item.id, item]));
    const order = await tx.customerOrder.create({ data: {
      orderNo: `MM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
      sessionId: session.id, serverId: session.serverId, status: 'SUBMITTED', submittedAt: new Date(), idempotencyKey: idempotencyKey ?? null,
    } });
    const createdItems = [];
    for (const requestItem of input.items) {
      const dish = menuById.get(requestItem.menuItemId)!;
      const item = await tx.orderItem.create({ data: {
        orderId: order.id, menuItemId: dish.id, quantity: requestItem.quantity, unitPricePaise: dish.pricePaise,
        specialInstructions: requestItem.specialInstructions, customizations: requestItem.customizations as Prisma.InputJsonValue | undefined,
        preparationTask: { create: { station: dish.station, status: 'QUEUED' } },
      } });
      createdItems.push(item);
    }
    await tx.diningTable.update({ where: { id: session.tableId }, data: { status: 'ORDER_PLACED' } });
    await audit(tx, actor.id, 'CustomerOrder', order.id, 'ORDER_SUBMITTED', { itemCount: createdItems.length, tableNo: session.table.tableNo });
    await refreshBill(tx, session.id);
    await assignQueuedPreparation(tx);
    return tx.customerOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { menuItem: true, preparationTask: true } } } });
  }, { maxWait: 10_000, timeout: 30_000 });
  publish('order.created', { orderId: result.id, orderNo: result.orderNo, tableNo: input.tableNo });
  return result;
}

export async function qualityCheck(itemId: string, passed: boolean, reason: string | undefined, actorId: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({ where: { id: itemId }, include: { preparationTask: true, order: { include: { session: true } }, menuItem: true } });
    if (!item?.preparationTask || item.status !== 'QUALITY_CHECK') throw new HttpError(409, 'INVALID_TRANSITION', 'Item is not waiting for quality inspection.');
    const task = item.preparationTask;
    if (!passed) {
      if (!reason?.trim()) throw new HttpError(400, 'REWORK_REASON_REQUIRED', 'Record a reason for rework.');
      const settings = await getSimulation(tx);
      const now = new Date();
      await tx.preparationTask.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', progress: 0, startedAt: now, expectedAt: new Date(now.getTime() + settings.reworkSeconds / settings.speed * 1000), exceptionHistory: [{ at: now.toISOString(), reason, action: 'REWORK' }] } });
      await tx.orderItem.update({ where: { id: itemId }, data: { status: 'PREPARING', failureReason: reason } });
      if (task.cookId) await tx.employee.update({ where: { id: task.cookId }, data: { status: 'BUSY' } });
      await audit(tx, actorId, 'OrderItem', itemId, 'QUALITY_FAILED_REWORK_STARTED', { reason });
      return { status: 'PREPARING' as const };
    }
    await tx.preparationTask.update({ where: { id: task.id }, data: { status: 'READY', completedAt: new Date(), progress: 100 } });
    await tx.employee.update({ where: { id: task.cookId! }, data: { status: 'AVAILABLE' } });
    const pickup = await assignPickup(tx, itemId);
    await tx.diningTable.update({ where: { id: item.order.session.tableId }, data: { status: 'FOOD_SERVING' } });
    await audit(tx, actorId, 'OrderItem', itemId, 'QUALITY_PASSED', { pickupTaskId: pickup.id });
    await assignQueuedPreparation(tx);
    return { status: 'READY_FOR_PICKUP' as const, pickupTaskId: pickup.id };
  });
  publish('quality.checked', { orderItemId: itemId, ...outcome });
  return outcome;
}

export async function confirmPickup(taskId: string, actorId: string, isManager = false) {
  const task = await prisma.$transaction(async (tx) => {
    const pickup = await tx.pickupTask.findUnique({ where: { id: taskId }, include: { item: { include: { order: { include: { session: true } } } } } });
    if (!pickup || pickup.status !== 'ASSIGNED' || (!isManager && pickup.serverId !== actorId)) throw new HttpError(409, 'PICKUP_NOT_ASSIGNED', 'This pickup is not assigned to you.');
    const updated = await tx.pickupTask.update({ where: { id: taskId }, data: { status: 'IN_PROGRESS', pickedUpAt: new Date() } });
    await tx.orderItem.update({ where: { id: pickup.orderItemId }, data: { status: 'PICKED_UP' } });
    await audit(tx, actorId, 'PickupTask', taskId, 'FOOD_PICKED_UP', { tableId: pickup.item.order.session.tableId });
    return updated;
  });
  publish('food.picked_up', { pickupTaskId: taskId, serverId: actorId });
  return task;
}

export async function confirmDelivery(taskId: string, deliveredTableNo: string, actorId: string, isManager = false) {
  const delivery = await prisma.$transaction(async (tx) => {
    const pickup = await tx.pickupTask.findUnique({
      where: { id: taskId },
      include: {
        item: {
          include: {
            order: {
              include: {
                session: { include: { table: true } },
              },
            },
          },
        },
      },
    });
    if (!pickup || pickup.status !== 'IN_PROGRESS' || (!isManager && pickup.serverId !== actorId)) throw new HttpError(409, 'PICKUP_NOT_ACTIVE', 'Pick up this item before delivery.');
    if (pickup.item.order.session.table.tableNo !== deliveredTableNo) throw new HttpError(409, 'WRONG_TABLE', 'Food must be delivered to its order table.');
    const record = await tx.deliveryRecord.create({ data: { orderItemId: pickup.orderItemId, tableId: pickup.item.order.session.tableId, serverId: actorId } });
    await tx.pickupTask.update({ where: { id: taskId }, data: { status: 'COMPLETED' } });
    await tx.orderItem.update({ where: { id: pickup.orderItemId }, data: { status: 'SERVED' } });
    await refreshOrderStatus(tx, pickup.item.orderId);
    const outstanding = await tx.orderItem.count({ where: { orderId: pickup.item.orderId, status: { notIn: ['SERVED', 'CANCELLED'] } } });
    await tx.diningTable.update({ where: { id: pickup.item.order.session.tableId }, data: { status: outstanding ? 'FOOD_SERVING' : 'OCCUPIED' } });
    const bill = await refreshBill(tx, pickup.item.order.sessionId);
    await audit(tx, actorId, 'DeliveryRecord', record.id, 'FOOD_DELIVERED', { tableNo: deliveredTableNo, orderItemId: pickup.orderItemId });
    return { record, bill };
  });
  publish('food.delivered', { deliveryId: delivery.record.id, tableNo: deliveredTableNo, bill: delivery.bill });
  return delivery;
}

export async function retryBlockedItem(itemId: string, actorId: string) {
  const item = await prisma.$transaction(async (tx) => {
    const current = await tx.orderItem.findUnique({ where: { id: itemId }, include: { preparationTask: true } });
    if (!current || current.status !== 'BLOCKED' || current.preparationTask?.status !== 'BLOCKED') throw new HttpError(409, 'ITEM_NOT_BLOCKED', 'Only a blocked preparation item can be retried.');
    await tx.preparationTask.update({ where: { id: current.preparationTask.id }, data: { status: 'QUEUED', cookId: null, progress: 0, startedAt: null, expectedAt: null, completedAt: null } });
    const updated = await tx.orderItem.update({ where: { id: itemId }, data: { status: 'QUEUED', failureReason: null } });
    await audit(tx, actorId, 'OrderItem', itemId, 'BLOCKED_ITEM_REQUEUED', {});
    await assignQueuedPreparation(tx);
    return updated;
  });
  publish('order.updated', { orderItemId: itemId, status: item.status });
  return item;
}

export async function startCleanup(tableNo: string, actorId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.diningSession.findFirst({ where: { table: { tableNo }, status: 'PAYMENT_PENDING' }, include: { table: true } });
    if (!session) throw new HttpError(409, 'PAYMENT_REQUIRED', 'Complete payment before clearing this table.');
    const unfinished = await tx.orderItem.count({ where: { order: { sessionId: session.id }, status: { notIn: ['SERVED', 'CANCELLED'] } } });
    if (unfinished) throw new HttpError(409, 'ORDER_NOT_COMPLETE', 'All order items must be served or cancelled before cleanup.');
    const tasks = [];
    for (const rule of vesselConsumption) {
      const vessel = await tx.vesselType.findUnique({ where: { name: rule.name } });
      if (!vessel) continue;
      const quantity = Math.ceil(session.partySize * rule.perGuest);
      if (rule.disposable) {
        const discarded = await tx.vesselType.updateMany({ where: { id: vessel.id, inUseQty: { gte: quantity } }, data: { inUseQty: { decrement: quantity }, damagedQty: { increment: quantity } } });
        if (discarded.count !== 1) throw new HttpError(409, 'VESSEL_COUNT_MISMATCH', `Used ${rule.name.toLowerCase()} count is inconsistent.`);
        await tx.inventoryMovement.create({ data: { vesselTypeId: vessel.id, type: 'WASTE', quantity: new Prisma.Decimal(quantity), reason: `Single-use item from session ${session.id}` } });
      } else {
        const dirtied = await tx.vesselType.updateMany({ where: { id: vessel.id, inUseQty: { gte: quantity } }, data: { inUseQty: { decrement: quantity }, dirtyQty: { increment: quantity } } });
        if (dirtied.count !== 1) throw new HttpError(409, 'VESSEL_COUNT_MISMATCH', `Used ${rule.name.toLowerCase()} count is inconsistent.`);
        tasks.push(await tx.washingTask.create({ data: { sessionId: session.id, vesselTypeId: vessel.id, quantity, status: 'QUEUED' } }));
      }
    }
    await tx.diningTable.update({ where: { id: session.tableId }, data: { status: 'CLEANING' } });
    await audit(tx, actorId, 'DiningSession', session.id, 'TABLE_CLEARED', { washingTaskCount: tasks.length });
    if (!tasks.length) {
      await tx.diningSession.update({ where: { id: session.id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await tx.diningTable.update({ where: { id: session.tableId }, data: { status: 'AVAILABLE' } });
    }
    return { session, tasks };
  });
  publish('table.changed', { tableNo, status: 'CLEANING' });
  return result;
}

