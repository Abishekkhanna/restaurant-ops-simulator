import { useState } from 'react';
import { Check, ChefHat, CircleAlert, Clock3, Flame, RotateCcw, UtensilsCrossed } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { Employee, PrepTask } from '../../types';

export function Kitchen({ tasks, employee, busy, onQuality }: { tasks: PrepTask[]; employee?: Employee; busy: boolean; onQuality: (itemId: string, passed: boolean, reason?: string) => Promise<void> }) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const stations = [...new Set(tasks.map((task) => task.station))];
  return <div className="view-stack">
    <div className="view-heading"><div><span className="section-kicker">BACK OF HOUSE · LIVE QUEUE</span><h1>Kitchen pass <span>சமையலறை</span></h1><p>Cooking timers are persisted by the server; food moves forward only after quality approval.</p></div><div className="shift-pill"><Flame size={15} /> {tasks.filter((task) => task.status === 'IN_PROGRESS').length} cooking now</div></div>
    <div className="kitchen-summary"><div><ChefHat size={17} /><b>{tasks.filter((task) => task.status === 'IN_PROGRESS').length}</b><span>In preparation</span></div><div><CircleAlert size={17} /><b>{tasks.filter((task) => task.status === 'QUALITY_CHECK').length}</b><span>Quality checks</span></div><div><UtensilsCrossed size={17} /><b>{tasks.filter((task) => task.status === 'QUEUED').length}</b><span>Waiting for cook</span></div><div><Clock3 size={17} /><b>{tasks.filter((task) => task.status === 'BLOCKED').length}</b><span>Blocked</span></div></div>
    <div className="station-grid">{(stations.length ? stations : ['Tiffin', 'Meals', 'Non-Vegetarian', 'Beverage']).map((station) => {
      const stationTasks = tasks.filter((task) => task.station === station);
      return <section className="panel station-panel" key={station}><div className="station-head"><div className="station-symbol"><ChefHat size={17} /></div><div><span className="section-kicker">PREPARATION STATION</span><h2>{station}</h2></div><span className="station-count">{stationTasks.length}</span></div><div className="task-stack">{stationTasks.map((task) => {
        const item = task.orderItem;
        const allowed = employee?.role === 'MANAGER' || (employee?.role === 'COOK' && task.cook?.id === employee.id);
        const remaining = task.expectedAt ? Math.max(0, Math.ceil((new Date(task.expectedAt).getTime() - Date.now()) / 1000)) : null;
        return <article className="prep-card" key={task.id}><div className="prep-card-top"><b>{item.menuItem.englishName}</b><StatusBadge value={task.status} /></div><div className="prep-card-sub"><span>{item.menuItem.tamilName} · {item.quantity} portion{item.quantity > 1 ? 's' : ''}</span><b>{item.order.orderNo} · {item.order.session.table.tableNo}</b></div><div className="prep-meta"><span>{task.cook ? <><ChefHat size={13} /> {task.cook.name}</> : 'Awaiting cook assignment'}</span><span>{remaining !== null ? <><Clock3 size={13} /> {remaining > 0 ? `${remaining}s left` : 'Ready to inspect'}</> : `${Math.ceil(item.menuItem.prepSeconds / 60)} min standard`}</span></div>{['IN_PROGRESS', 'QUALITY_CHECK'].includes(task.status) && <div className="progress-track"><i style={{ width: `${task.progress}%` }} /></div>}{task.status === 'QUALITY_CHECK' && <div className="qc-actions">{task.cook?.id === employee?.id || employee?.role === 'MANAGER' ? <><button className="button button-leaf" disabled={busy || !allowed} onClick={() => void onQuality(item.id, true)}><Check size={14} /> Approve & send to pass</button><div className="rework-control"><input value={reasons[task.id] ?? ''} onChange={(e) => setReasons((x) => ({ ...x, [task.id]: e.target.value }))} placeholder="Reason for rework" /><button className="button button-outline" disabled={busy || !allowed || !(reasons[task.id] ?? '').trim()} onClick={() => void onQuality(item.id, false, reasons[task.id])}><RotateCcw size={14} /> Rework</button></div></> : <small>Quality check reserved for the assigned cook or manager.</small>}</div>}{task.status === 'BLOCKED' && <div className="blocked-note"><CircleAlert size={14} />{item.failureReason ?? 'Blocked. Manager resolution required.'}</div>}</article>;
      })}{!stationTasks.length && <div className="empty-state compact"><UtensilsCrossed size={21} /><span>No active work at this station.</span></div>}</div></section>;
    })}</div>
  </div>;
}
