import { io, type Socket } from 'socket.io-client';

const base = import.meta.env.VITE_API_URL ?? '';
const fallbackToken = 'local-only-change-this-token-before-sharing';
let activeEmployeeId = localStorage.getItem('restaurant-employee-id') ?? import.meta.env.VITE_EMPLOYEE_ID ?? '';
export const authToken = import.meta.env.VITE_AUTH_TOKEN ?? fallbackToken;
export const setActiveEmployee = (id: string) => { activeEmployeeId = id; localStorage.setItem('restaurant-employee-id', id); };
export const getActiveEmployee = () => activeEmployeeId;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${authToken}`);
  headers.set('Content-Type', 'application/json');
  if (activeEmployeeId) headers.set('X-Employee-Id', activeEmployeeId);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? `Request failed (${response.status})`);
  return payload.data as T;
}

export function connectSocket(onChange: () => void, onStatus: (connected: boolean) => void): Socket {
  const socket = io(base || window.location.origin, { auth: { token: authToken }, transports: ['websocket', 'polling'] });
  socket.on('connect', () => { onStatus(true); onChange(); });
  socket.on('disconnect', () => onStatus(false));
  socket.on('connect_error', () => onStatus(false));
  for (const event of ['order.created', 'kitchen.task.assigned', 'preparation.progress', 'preparation.quality_check', 'quality.checked', 'food.ready', 'food.picked_up', 'food.delivered', 'billing.changed', 'table.changed', 'staff.changed', 'inventory.changed', 'vessels.changed', 'washing.completed', 'manager.alert', 'simulation.changed', 'menu.changed', 'order.updated']) {
    socket.on(event, onChange);
  }
  return socket;
}
