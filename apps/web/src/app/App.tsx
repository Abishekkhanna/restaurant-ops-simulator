import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import { Shell, type ViewKey } from '../components/Shell';
import { Overview } from '../features/dashboard/Overview';
import { Floor } from '../features/tables/Floor';
import { Kitchen } from '../features/kitchen/Kitchen';
import { Service } from '../features/Service';
import { Dishwashing } from '../features/Dishwashing';
import { Manager } from '../features/Manager';
import { api, connectSocket, getActiveEmployee, setActiveEmployee } from '../lib/api';
import type { Dashboard, Employee, Ingredient, MenuCategory, Order, PickupTask, PrepTask, Settings, Vessel, WashTask } from '../types';

type VesselResponse = { types: Vessel[]; tasks: WashTask[] };
type PageData = { dashboard: Dashboard; employees: Employee[]; menu: MenuCategory[]; orders: Order[]; tasks: PrepTask[]; pickups: PickupTask[]; vessels: VesselResponse; ingredients: Ingredient[] };

export function App() {
  const [view, setView] = useState<ViewKey>('overview');
  const [data, setData] = useState<PageData | null>(null);
  const [employeeId, setEmployeeId] = useState(getActiveEmployee());
  const [selectedTable, setSelectedTable] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(new Date());

  const reload = useCallback(async () => {
    try {
      const [dashboard, employees, menu, orders, tasks, pickups, vessels, ingredients] = await Promise.all([
        api<Dashboard>('/api/dashboard'), api<Employee[]>('/api/employees'), api<MenuCategory[]>('/api/menu'), api<Order[]>('/api/orders'),
        api<PrepTask[]>('/api/kitchen/tasks'), api<PickupTask[]>('/api/pickups'), api<VesselResponse>('/api/vessels'), api<Ingredient[]>('/api/ingredients'),
      ]);
      setData({ dashboard, employees, menu, orders, tasks, pickups, vessels, ingredients });
      setSelectedTable((current) => current || dashboard.tables[0]?.tableNo || '');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load restaurant data.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); const interval = window.setInterval(() => void reload(), 15_000); const tick = window.setInterval(() => setClock(new Date()), 1000); return () => { window.clearInterval(interval); window.clearInterval(tick); }; }, [reload]);
  useEffect(() => { const socket = connectSocket(() => void reload(), setConnected); return () => { socket.disconnect(); }; }, [reload]);
  useEffect(() => { if (data && employeeId && !data.employees.some((employee) => employee.id === employeeId)) { setEmployeeId(''); setActiveEmployee(''); } }, [data, employeeId]);

  const employee = useMemo(() => data?.employees.find((person) => person.id === employeeId), [data, employeeId]);
  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setNotice('');
    try { await action(); await reload(); setNotice(success); window.setTimeout(() => setNotice(''), 3500); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  }, [reload]);

  const changeEmployee = (id: string) => { setEmployeeId(id); setActiveEmployee(id); };
  const seat = (tableNo: string, partySize: number, serverId?: string) => run(() => api(`/api/tables/${tableNo}/seat`, { method: 'POST', body: JSON.stringify({ partySize, serverId }) }), `${tableNo} seated. Vessel stock reserved.`);
  const order = (tableNo: string, items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>) => run(() => api('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ tableNo, items }) }), 'Order sent to the kitchen.');
  const pay = (sessionId: string) => run(() => api(`/api/sessions/${sessionId}/payments`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ method: 'CASH' }) }), 'Payment recorded.');
  const discount = (sessionId: string, discountPaise: number) => run(() => api(`/api/sessions/${sessionId}/discount`, { method: 'POST', body: JSON.stringify({ discountPaise }) }), 'Manager discount applied.');
  const cleanup = (tableNo: string) => run(() => api(`/api/tables/${tableNo}/cleanup`, { method: 'POST', body: '{}' }), 'Cleanup tasks created.');
  const quality = (itemId: string, passed: boolean, reason?: string) => run(() => api(`/api/kitchen/items/${itemId}/quality`, { method: 'POST', body: JSON.stringify({ passed, reason }) }), passed ? 'Quality passed; item moved to pickup.' : 'Rework started with a recorded reason.');
  const pickup = (id: string) => run(() => api(`/api/pickups/${id}/confirm`, { method: 'POST', body: '{}' }), 'Pickup confirmed.');
  const deliver = (id: string, tableNo: string) => run(() => api(`/api/pickups/${id}/deliver`, { method: 'POST', body: JSON.stringify({ tableNo }) }), `${tableNo} delivery confirmed and bill updated.`);
  const startWash = (id: string) => run(() => api(`/api/washing/${id}/start`, { method: 'POST', body: '{}' }), 'Washing and sanitizing started.');
  const updateSettings = (settings: Partial<Settings>) => run(() => api('/api/settings', { method: 'PATCH', body: JSON.stringify(settings) }), 'Simulation settings saved.');
  const updateStaff = (id: string, status: string) => run(() => api(`/api/staff/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }), 'Staff availability updated.');
  const updateMenu = (id: string, available: boolean) => run(() => api(`/api/menu/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ available }) }), `Menu item ${available ? 'enabled' : 'paused'}.`);
  const addIngredient = (input: { name: string; unit: string; lowStockAt: number; initialQuantity: number }) => run(() => api('/api/ingredients', { method: 'POST', body: JSON.stringify(input) }), 'Ingredient added to inventory.');
  const adjustIngredient = (id: string, delta: number, reason: string) => run(() => api(`/api/ingredients/${id}/stock`, { method: 'POST', body: JSON.stringify({ delta, reason }) }), 'Ingredient stock adjusted.');
  const adjustVessel = (id: string, cleanDelta: number, reason: string) => run(() => api(`/api/vessels/${id}/stock`, { method: 'POST', body: JSON.stringify({ cleanDelta, reason }) }), 'Clean vessel stock adjusted.');
  const cancelItem = (id: string, reason: string) => run(() => api(`/api/orders/items/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }), 'Order item cancelled with audit entry.');
  const retryItem = (id: string) => run(() => api(`/api/orders/items/${id}/retry`, { method: 'POST', body: '{}' }), 'Blocked item returned to the kitchen queue.');

  return <Shell view={view} setView={setView} employees={data?.employees ?? []} employee={employee} onEmployee={changeEmployee} connected={connected} time={clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}>
    {error && <div className="error-banner"><AlertCircle size={17} /><span>{error}</span><button onClick={() => void reload()}><RefreshCw size={14} /> Retry</button></div>}
    {notice && <div className="success-toast"><span>✓</span>{notice}</div>}
    {loading && !data ? <div className="loading-page"><LoaderCircle size={26} className="spin" /><b>Connecting to Madurai Manvasanai</b><span>Loading current tables, kitchen work and menu from the restaurant API…</span></div> : data ? <>
      {view === 'overview' && <Overview dashboard={data.dashboard} orders={data.orders} onNavigate={setView} />}
      {view === 'floor' && <Floor dashboard={data.dashboard} categories={data.menu} employee={employee} selectedTable={selectedTable} onSelectTable={setSelectedTable} busy={busy} onSeat={seat} onOrder={order} onPay={pay} onCleanup={cleanup} onDiscount={discount} />}
      {view === 'kitchen' && <Kitchen tasks={data.tasks} employee={employee} busy={busy} onQuality={quality} />}
      {view === 'servers' && <Service dashboard={data.dashboard} pickups={data.pickups} employee={employee} busy={busy} onPickup={pickup} onDeliver={deliver} />}
      {view === 'wash' && <Dishwashing types={data.vessels.types} tasks={data.vessels.tasks} employee={employee} busy={busy} onStart={startWash} />}
      {view === 'manager' && <Manager dashboard={data.dashboard} categories={data.menu} ingredients={data.ingredients} vessels={data.vessels.types} orders={data.orders} employee={employee} busy={busy} onSettings={updateSettings} onStaff={updateStaff} onMenu={updateMenu} onAddIngredient={addIngredient} onIngredientStock={adjustIngredient} onVesselStock={adjustVessel} onCancel={cancelItem} onRetry={retryItem} />}
      <footer className="page-foot"><span>மதுரை மண்வாசனை</span><span>Live application state · refreshed from the API after reconnect</span></footer>
    </> : <div className="load-error"><AlertCircle size={24} /><h2>Restaurant data unavailable</h2><p>Check that the API is running, MySQL is connected, and the local auth token matches the API.</p><button className="button button-dark" onClick={() => void reload()}><RefreshCw size={15} /> Retry connection</button></div>}
  </Shell>;
}
