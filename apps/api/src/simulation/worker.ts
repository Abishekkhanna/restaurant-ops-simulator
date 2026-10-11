import { prisma } from '../db.js';
import { audit, assignQueuedPreparation, publishRefresh } from '../services/operations.js';
import { env } from '../config/env.js';

let timer: NodeJS.Timeout | undefined;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const events = await prisma.$transaction(async (tx) => {
      const settings = await tx.simulationSettings.findUnique({ where: { id: 1 } });
      if (settings?.paused) return [];
      const now = new Date();
      const updates: Array<{ event: string; payload: unknown }> = [];
      const prepTasks = await tx.preparationTask.findMany({ where: { status: 'IN_PROGRESS', startedAt: { not: null }, expectedAt: { not: null } }, include: { cook: true } });
      for (const task of prepTasks) {
        const start = task.startedAt!.getTime();
        const end = task.expectedAt!.getTime();
        const progress = Math.min(100, Math.max(0, Math.floor(((now.getTime() - start) / Math.max(1, end - start)) * 100)));
        if (now >= task.expectedAt!) {
          await tx.preparationTask.update({ where: { id: task.id }, data: { status: 'QUALITY_CHECK', progress: 100 } });
          await tx.orderItem.update({ where: { id: task.orderItemId }, data: { status: 'QUALITY_CHECK' } });
          if (task.cookId) await tx.employee.update({ where: { id: task.cookId }, data: { status: 'AVAILABLE' } });
          await audit(tx, null, 'PreparationTask', task.id, 'COOKING_FINISHED_AWAITING_QC', { expectedAt: task.expectedAt?.toISOString() });
          updates.push({ event: 'preparation.quality_check', payload: { taskId: task.id, orderItemId: task.orderItemId } });
        } else if (progress !== task.progress) {
          await tx.preparationTask.update({ where: { id: task.id }, data: { progress } });
          updates.push({ event: 'preparation.progress', payload: { taskId: task.id, progress, expectedAt: task.expectedAt } });
        }
      }

      const washes = await tx.washingTask.findMany({ where: { status: 'IN_PROGRESS', expectedAt: { lte: now } }, include: { vesselType: true } });
      for (const wash of washes) {
        await tx.washingTask.update({ where: { id: wash.id }, data: { status: 'COMPLETED', completedAt: now } });
        await tx.vesselType.update({ where: { id: wash.vesselTypeId }, data: { washingQty: { decrement: wash.quantity }, cleanQty: { increment: wash.quantity } } });
        if (wash.employeeId) await tx.employee.update({ where: { id: wash.employeeId }, data: { status: 'AVAILABLE' } });
        await tx.inventoryMovement.create({ data: { vesselTypeId: wash.vesselTypeId, type: 'RECEIPT', quantity: wash.quantity, reason: `Washed and sanitized batch ${wash.id}` } });
        await audit(tx, wash.employeeId, 'WashingTask', wash.id, 'WASHING_SANITIZED', { quantity: wash.quantity });
        if (wash.sessionId) {
          const pending = await tx.washingTask.count({ where: { sessionId: wash.sessionId, status: { not: 'COMPLETED' } } });
          if (pending === 0) {
            const session = await tx.diningSession.findUnique({ where: { id: wash.sessionId } });
            if (session && session.status === 'PAYMENT_PENDING') {
              await tx.diningSession.update({ where: { id: session.id }, data: { status: 'CLOSED', closedAt: now } });
              await tx.diningTable.update({ where: { id: session.tableId }, data: { status: 'AVAILABLE' } });
              await audit(tx, null, 'DiningSession', session.id, 'CLEANUP_COMPLETED_TABLE_AVAILABLE');
              updates.push({ event: 'table.changed', payload: { sessionId: session.id, status: 'AVAILABLE' } });
            }
          }
        }
        updates.push({ event: 'washing.completed', payload: { taskId: wash.id, quantity: wash.quantity } });
      }
      await assignQueuedPreparation(tx);
      return updates;
    }, { maxWait: 5000, timeout: 15_000 });
    for (const update of events) publishRefresh(update.event, update.payload);
  } catch (error) {
    console.error('Simulation scheduler tick failed:', error);
  } finally {
    running = false;
  }
}

export function startSimulationWorker() {
  if (timer) return;
  timer = setInterval(() => void tick(), env.SIMULATION_TICK_MS);
  void tick();
}

export async function stopSimulationWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  while (running) await new Promise((resolve) => setTimeout(resolve, 20));
}
