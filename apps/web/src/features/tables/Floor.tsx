import { lazy, Suspense, useState } from 'react';
import { Check, CircleAlert, Clock3, Droplets, PackageCheck, RotateCcw, Truck, Users } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { Dashboard, Employee, PickupTask, PrepTask, WashTask } from '../../types';
const FloorScene3D = lazy(() => import('./FloorScene3D').then((module) => ({ default: module.FloorScene3D })));
type Props = {
  dashboard: Dashboard; employee?: Employee; selectedTable: string; onSelectTable: (tableNo: string) => void; tasks: PrepTask[]; pickups: PickupTask[]; washTasks: WashTask[];
  busy: boolean; onSeat: (tableNo: string, partySize: number, serverId?: string) => Promise<void>;
  onQuality: (itemId: string, passed: boolean, reason?: string) => Promise<void>; onPickup: (id: string) => Promise<void>;
  onDeliver: (id: string, tableNo: string) => Promise<void>; onStartWash: (id: string) => Promise<void>;
};
const price = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export function Floor({ dashboard, employee, selectedTable, onSelectTable, tasks, pickups, washTasks, busy, onSeat, onQuality, onPickup, onDeliver, onStartWash }: Props) {
  const [party, setParty] = useState(2);
  const [serverId, setServerId] = useState('');
  const [reworkReasons, setReworkReasons] = useState<Record<string, string>>({});
  const table = dashboard.tables.find((row) => row.tableNo === selectedTable) ?? dashboard.tables[0];
  const session = table?.currentSession;
  const canEdit = employee && employee.status !== 'OFF_DUTY';
  const servers = dashboard.staff.filter((person) => person.role === 'SERVER' && person.status !== 'OFF_DUTY');
  const qualityQueue = tasks.filter((task) => task.status === 'QUALITY_CHECK' && (employee?.role === 'MANAGER' || task.cook?.id === employee?.id));
  const pickupQueue = pickups.filter((task) => task.status === 'ASSIGNED' && (employee?.role === 'MANAGER' || task.serverId === employee?.id));
  const deliveryQueue = pickups.filter((task) => task.status === 'IN_PROGRESS' && (employee?.role === 'MANAGER' || task.serverId === employee?.id));
  const washingQueue = washTasks.filter((task) => task.status === 'QUEUED' && (employee?.role === 'MANAGER' || employee?.role === 'DISHWASHER'));

  return <div className="view-stack">
    <div className="view-heading"><div><span className="section-kicker">FRONT OF HOUSE · LIVE SIMULATION</span><h1>Restaurant simulation <span>உணவக செயல்பாடு</span></h1><p>Watch live service, select a table, place an order and manage work from this floor.</p></div><div className="shift-pill"><span className="live-dot" /> Live restaurant state</div></div>
    <div className="floor-layout">
      <section className="panel floor-main"><div className="panel-heading"><div><span className="section-kicker">MADURAI DINING ROOM</span><h2>Choose a table</h2></div><div className="capacity-key"><span><i className="key-dot key-free" /> Available</span><span><i className="key-dot key-busy" /> In service</span></div></div>
        <Suspense fallback={<div className="simulation-loading">Loading the 3D dining room…</div>}><FloorScene3D tables={dashboard.tables} employees={dashboard.staff} tasks={tasks} pickups={pickups} washTasks={washTasks} selectedTableId={table?.id} onSelectTable={(id) => { const selected = dashboard.tables.find((row) => row.id === id); if (selected) onSelectTable(selected.tableNo); }} /></Suspense>
        {table && <div className="selected-table-details"><div className="detail-title"><div><span className="section-kicker">SELECTED TABLE</span><h2>{table.tableNo} <StatusBadge value={table.status} /></h2></div>{session && <div className="server-tag"><Users size={15} /> {session.server.name}</div>}</div>{session ? <><div className="session-strip"><div><span>Party size</span><b>{session.partySize} guests</b></div><div><span>Seated at</span><b>{new Date(session.seatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></div><div><span>Current bill</span><b>{price(session.bill?.totalPaise ?? 0)}</b></div></div><div className="table-order-list">{session.orders.length ? session.orders.flatMap((order) => order.items.map((item) => <div className="table-order-row" key={item.id}><div><b>{item.quantity}× {item.menuItem.englishName}</b><small>{item.menuItem.tamilName}</small></div><StatusBadge value={item.status} /></div>)) : <div className="empty-inline">No dishes ordered yet. Add from the menu.</div>}</div>{session.status === 'PAYMENT_PENDING' && <div className="paid-notice"><Check size={16} /> Payment recorded. Complete table cleanup after washing.</div>}</> : <div className="empty-inline">This table is ready for the next group.</div>}
          {table.status === 'AVAILABLE' && <div className="seat-form"><label>Party size<input type="number" min="1" max={table.capacity} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value)))} /></label>{employee?.role === 'MANAGER' && <label>Assign server<select value={serverId} onChange={(e) => setServerId(e.target.value)}><option value="">Choose server</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name} · {server.status.toLowerCase()}</option>)}</select></label>}<button disabled={!canEdit || busy || (employee?.role === 'MANAGER' && !serverId)} className="button button-dark" onClick={() => void onSeat(table.tableNo, party, serverId || undefined)}><Users size={15} /> Seat guests</button></div>}
        </div>}
        <section className="simulation-action-tray"><div className="simulation-action-heading"><div><span className="section-kicker">LIVE TASK CONTROL</span><h2>Operations in motion</h2></div><span>{qualityQueue.length + pickupQueue.length + deliveryQueue.length + washingQueue.length} actions ready</span></div>
          <div className="simulation-action-grid">
            {qualityQueue.map((task) => <article className="scene-action-card" key={task.id}><span className="scene-action-icon amber"><RotateCcw size={16} /></span><div><b>Quality check · {task.orderItem.menuItem.englishName}</b><small>{task.orderItem.order.orderNo} · {task.orderItem.order.session.table.tableNo} · Cook {task.cook?.name}</small></div><button className="button button-leaf" disabled={busy} onClick={() => void onQuality(task.orderItem.id, true)}>Approve</button><label><span className="sr-only">Rework reason</span><input value={reworkReasons[task.id] ?? ''} onChange={(event) => setReworkReasons((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Rework reason" /></label><button className="button button-outline" disabled={busy || !(reworkReasons[task.id] ?? '').trim()} onClick={() => void onQuality(task.orderItem.id, false, reworkReasons[task.id])}>Rework</button></article>)}
            {pickupQueue.map((task) => <article className="scene-action-card" key={task.id}><span className="scene-action-icon leaf"><PackageCheck size={16} /></span><div><b>Collect · {task.item.menuItem.englishName}</b><small>{task.item.order.session.table.tableNo} · {task.item.order.session.server.name}</small></div><button className="button button-dark" disabled={busy} onClick={() => void onPickup(task.id)}>Confirm pickup</button></article>)}
            {deliveryQueue.map((task) => <article className="scene-action-card" key={task.id}><span className="scene-action-icon terracotta"><Truck size={16} /></span><div><b>Deliver · {task.item.menuItem.englishName}</b><small>Correct destination: {task.item.order.session.table.tableNo}</small></div><button className="button button-leaf" disabled={busy} onClick={() => void onDeliver(task.id, task.item.order.session.table.tableNo)}>Confirm delivery</button></article>)}
            {washingQueue.map((task) => <article className="scene-action-card" key={task.id}><span className="scene-action-icon blue"><Droplets size={16} /></span><div><b>Wash · {task.quantity} {task.vesselType.name}</b><small>Dirty vessels queued for sanitation</small></div><button className="button button-dark" disabled={busy} onClick={() => void onStartWash(task.id)}>Start wash</button></article>)}
            {!qualityQueue.length && !pickupQueue.length && !deliveryQueue.length && !washingQueue.length && <div className="scene-clear-state"><Clock3 size={17} /><span><b>All caught up for this role.</b> New assigned work appears here as the restaurant changes.</span></div>}
          </div>
          {!!tasks.filter((task) => task.status === 'BLOCKED').length && <div className="scene-blocked-note"><CircleAlert size={15} /> {tasks.filter((task) => task.status === 'BLOCKED').length} blocked kitchen item(s) need manager attention.</div>}
        </section>
      </section>
    </div>
  </div>;
}
