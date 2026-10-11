import { useMemo, useState } from 'react';
import { Check, CirclePlus, Leaf, Minus, Plus, Search, Send, Trash2, Users } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { Dashboard, Employee, MenuCategory, MenuItem } from '../types';

export type DraftLine = { menuItem: MenuItem; quantity: number };
type Props = {
  dashboard: Dashboard; categories: MenuCategory[]; employee?: Employee; selectedTable: string;
  onSelectTable: (tableNo: string) => void; draft: DraftLine[]; setDraft: (next: DraftLine[] | ((current: DraftLine[]) => DraftLine[])) => void;
  busy: boolean; onSeat: (tableNo: string, partySize: number, serverId?: string) => Promise<void>;
  onOrder: (tableNo: string, items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>) => Promise<boolean>;
  onPay: (sessionId: string) => Promise<void>; onCleanup: (tableNo: string) => Promise<void>;
  onDiscount: (sessionId: string, discountPaise: number) => Promise<void>;
};
const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export function BillingDock({ dashboard, categories, employee, selectedTable, onSelectTable, draft, setDraft, busy, onSeat, onOrder, onPay, onCleanup, onDiscount }: Props) {
  const [category, setCategory] = useState(categories[0]?.name ?? '');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [party, setParty] = useState(2);
  const [serverId, setServerId] = useState('');
  const [discount, setDiscount] = useState('');
  const table = dashboard.tables.find((row) => row.tableNo === selectedTable) ?? dashboard.tables[0];
  const session = table?.currentSession;
  const items = useMemo(() => (categories.find((group) => group.name === category)?.items ?? []).filter((item) => item.available && (item.englishName.toLowerCase().includes(search.toLowerCase()) || item.tamilName.includes(search))), [categories, category, search]);
  const subtotal = draft.reduce((sum, line) => sum + line.menuItem.pricePaise * line.quantity, 0);
  const tax = Math.round(subtotal * dashboard.settings.taxRateBasisPoints / 10_000);
  const servers = dashboard.staff.filter((person) => person.role === 'SERVER' && person.status !== 'OFF_DUTY');
  const canEdit = Boolean(employee && employee.status !== 'OFF_DUTY');
  const readyToPay = Boolean(session?.orders.length) && session!.orders.every((order) => order.items.every((item) => ['SERVED', 'CANCELLED'].includes(item.status)));
  const changeQty = (item: MenuItem, delta: number) => setDraft((current) => {
    const found = current.find((line) => line.menuItem.id === item.id);
    if (!found && delta > 0) return [...current, { menuItem: item, quantity: 1 }];
    return current.map((line) => line.menuItem.id === item.id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0);
  });
  const submit = async () => {
    if (!table || !draft.length || busy) return;
    const submitted = await onOrder(table.tableNo, draft.map((line) => ({ menuItemId: line.menuItem.id, quantity: line.quantity, ...(note.trim() ? { specialInstructions: note.trim() } : {}) })));
    if (submitted) { setDraft([]); setNote(''); }
  };

  return <div className="billing-dock-content">
    <header className="dock-header"><span className="dock-brand-mark"><Leaf size={16} /></span><div><b>மதுரை மண்வாசனை</b><small>Madurai Manvasanai · POS</small></div></header>
    <div className="dock-section-title"><div><span className="section-kicker">CURRENT ORDER</span><h2>{table?.tableNo ?? 'Select a table'}</h2></div>{session && <StatusBadge value={table.status} />}</div>
    <label className="dock-table-picker">Dining table<select value={table?.tableNo ?? ''} onChange={(event) => onSelectTable(event.target.value)}>{dashboard.tables.map((row) => <option key={row.id} value={row.tableNo}>{row.tableNo} · {row.status.replaceAll('_', ' ').toLowerCase()}</option>)}</select></label>
    {session ? <><div className="dock-session"><span><Users size={14} /> {session.partySize} guests · {session.server.name}</span><b>Current bill {money(session.bill?.totalPaise ?? 0)}</b></div><div className="dock-current-items" aria-label="Items already on this dining session">{session.orders.flatMap((order) => order.items.map((item) => <div className="dock-current-line" key={item.id}><span><b>{item.quantity}×</b> {item.menuItem.englishName}</span><StatusBadge value={item.status} /></div>))}{!session.orders.length && <small>No items ordered yet.</small>}</div></> : <div className="dock-seat"><label>Party size<input type="number" min="1" max={table?.capacity ?? 8} value={party} onChange={(event) => setParty(Math.max(1, Number(event.target.value)))} /></label>{employee?.role === 'MANAGER' && <label>Server<select value={serverId} onChange={(event) => setServerId(event.target.value)}><option value="">Choose server</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></label>}<button className="button button-dark full-button" disabled={!canEdit || busy || !table || (employee?.role === 'MANAGER' && !serverId)} onClick={() => table && void onSeat(table.tableNo, party, serverId || undefined)}><Users size={15} /> Seat guests</button></div>}
    <div className="dock-menu-heading"><b>Add dishes</b><span>{categories.length} categories</span></div>
    <div className="dock-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu" /></div>
    <div className="dock-categories">{categories.map((group) => <button key={group.id} className={category === group.name ? 'active' : ''} onClick={() => setCategory(group.name)}>{group.name}</button>)}</div>
    <div className="dock-menu-list">{items.map((item) => <article className="dock-menu-item" key={item.id}><div className="dish-avatar">{item.vegetarian ? <Leaf size={14} /> : <span className="nonveg-dot" />}</div><div className="dock-dish-copy"><b>{item.englishName}</b><span>{item.tamilName}</span><small>{money(item.pricePaise)}</small></div><button className="dock-add" onClick={() => changeQty(item, 1)} aria-label={'Add ' + item.englishName}><CirclePlus size={18} /></button></article>)}{!items.length && <p className="dock-empty">No available dishes match this search.</p>}</div>
    <div className="dock-draft"><div className="dock-menu-heading"><b>New items</b><span>{draft.reduce((sum, line) => sum + line.quantity, 0)} items</span></div>{draft.length ? draft.map((line) => <div className="dock-order-line" key={line.menuItem.id}><div className="dock-order-name"><b>{line.menuItem.englishName}</b><small>{money(line.menuItem.pricePaise * line.quantity)}</small></div><div className="dock-qty"><button onClick={() => changeQty(line.menuItem, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQty(line.menuItem, 1)} aria-label="Increase quantity"><Plus size={13} /></button><button onClick={() => changeQty(line.menuItem, -line.quantity)} aria-label="Remove item"><Trash2 size={13} /></button></div></div>) : <p className="dock-empty">Choose a dish above to start an order.</p>}
      <label className="dock-note">Kitchen note<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Less spicy, no onion…" /></label>
      <div className="dock-totals"><div><span>New item subtotal</span><b>{money(subtotal)}</b></div><div><span>Tax · {(dashboard.settings.taxRateBasisPoints / 100).toFixed(2)}%</span><b>{money(tax)}</b></div><div className="dock-grand-total"><span>New order total</span><b>{money(subtotal + tax)}</b></div></div>
      {session?.bill && <div className="dock-existing-total"><span>Dining session total</span><strong>{money(session.bill.totalPaise)}</strong></div>}
      {employee?.role === 'MANAGER' && session?.status === 'OPEN' && session.bill && <div className="dock-discount"><label>Discount (₹)<input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><button className="button button-outline" disabled={busy || !Number(discount)} onClick={() => void onDiscount(session.id, Math.round(Number(discount) * 100))}>Apply</button></div>}
      <button className="button button-terracotta full-button" disabled={!canEdit || busy || !draft.length || session?.status !== 'OPEN'} onClick={() => void submit()}><Send size={15} />{session ? 'Send to kitchen' : 'Seat guests to order'}</button>
      {session?.status === 'OPEN' && readyToPay && <button className="button button-outline full-button" disabled={!canEdit || busy} onClick={() => void onPay(session.id)}><Check size={15} /> Record payment</button>}
      {session?.status === 'PAYMENT_PENDING' && <button className="button button-dark full-button" disabled={!canEdit || busy} onClick={() => void onCleanup(table.tableNo)}><Check size={15} /> Start table cleanup</button>}
      <small className="dock-price-note">Prices and final totals are verified by the restaurant API.</small>
    </div>
  </div>;
}
