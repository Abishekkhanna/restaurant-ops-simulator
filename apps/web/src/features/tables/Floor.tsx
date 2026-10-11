import { useMemo, useState } from 'react';
import { Check, ChevronDown, CirclePlus, Minus, Plus, Search, Send, ShoppingBag, Trash2, Users } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { Dashboard, Employee, MenuCategory, MenuItem } from '../../types';

type CartLine = { menuItem: MenuItem; quantity: number };
type Props = {
  dashboard: Dashboard; categories: MenuCategory[]; employee?: Employee; selectedTable: string; onSelectTable: (tableNo: string) => void;
  busy: boolean; onSeat: (tableNo: string, partySize: number, serverId?: string) => Promise<void>;
  onOrder: (tableNo: string, items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>) => Promise<void>;
  onPay: (sessionId: string) => Promise<void>; onCleanup: (tableNo: string) => Promise<void>; onDiscount: (sessionId: string, discountPaise: number) => Promise<void>;
};
const price = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export function Floor({ dashboard, categories, employee, selectedTable, onSelectTable, busy, onSeat, onOrder, onPay, onCleanup, onDiscount }: Props) {
  const [category, setCategory] = useState('Breakfast');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [instruction, setInstruction] = useState('');
  const [party, setParty] = useState(2);
  const [serverId, setServerId] = useState('');
  const [discount, setDiscount] = useState('');
  const table = dashboard.tables.find((row) => row.tableNo === selectedTable) ?? dashboard.tables[0];
  const session = table?.currentSession;
  const activeSession = session?.status === 'OPEN';
  const menuItems = useMemo(() => {
    const group = categories.find((item) => item.name === category);
    return (group?.items ?? []).filter((item) => item.available && (item.englishName.toLowerCase().includes(search.toLowerCase()) || item.tamilName.includes(search)));
  }, [categories, category, search]);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.menuItem.pricePaise * line.quantity, 0);
  const estimatedTax = Math.round(cartSubtotal * dashboard.settings.taxRateBasisPoints / 10_000);
  const canEdit = employee && employee.status !== 'OFF_DUTY';
  const servers = dashboard.staff.filter((person) => person.role === 'SERVER' && person.status !== 'OFF_DUTY');

  const changeQty = (item: MenuItem, delta: number) => setCart((current) => {
    const existing = current.find((line) => line.menuItem.id === item.id);
    if (!existing && delta > 0) return [...current, { menuItem: item, quantity: 1 }];
    return current.map((line) => line.menuItem.id === item.id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0);
  });
  const submit = async () => {
    if (!table || !cart.length) return;
    await onOrder(table.tableNo, cart.map((line) => ({ menuItemId: line.menuItem.id, quantity: line.quantity, ...(instruction.trim() ? { specialInstructions: instruction.trim() } : {}) })));
    setCart([]); setInstruction('');
  };
  const readyToPay = Boolean(session?.orders.length) && session!.orders.every((order) => order.items.every((item) => ['SERVED', 'CANCELLED'].includes(item.status)));

  return <div className="view-stack">
    <div className="view-heading"><div><span className="section-kicker">FRONT OF HOUSE · FLOOR PLAN</span><h1>Tables & billing <span>மேசைகள்</span></h1><p>Seat guests, build their order and follow every plate to the table.</p></div><div className="shift-pill"><span className="live-dot" /> Live restaurant state</div></div>
    <div className="floor-layout">
      <section className="panel floor-main"><div className="panel-heading"><div><span className="section-kicker">MADURAI DINING ROOM</span><h2>Choose a table</h2></div><div className="capacity-key"><span><i className="key-dot key-free" /> Available</span><span><i className="key-dot key-busy" /> In service</span></div></div>
        <div className="floor-map"><div className="map-tag map-kitchen">KITCHEN · PICKUP</div><div className="map-tag map-window">COURTYARD</div><div className="floor-tables">{dashboard.tables.map((item, index) => <button key={item.id} className={`floor-table table-${index + 1} ${item.tableNo === selectedTable ? 'selected' : ''} ${item.status.toLowerCase()}`} onClick={() => { onSelectTable(item.tableNo); setCart([]); }}><div className="floor-table-label"><b>{item.tableNo}</b><StatusBadge value={item.status} /></div><div className="table-topper"><div className="plate-mark"><span>ம</span></div>{item.currentSession && <span className="guest-count"><Users size={12} />{item.currentSession.partySize}</span>}</div><div className="floor-table-foot"><span>{item.currentSession?.server.name ?? 'Awaiting guests'}</span><b>{item.currentSession?.orders[0]?.orderNo ?? '—'}</b></div></button>)}</div><div className="map-label dining-label">DINING AREA</div></div>
        {table && <div className="selected-table-details"><div className="detail-title"><div><span className="section-kicker">SELECTED TABLE</span><h2>{table.tableNo} <StatusBadge value={table.status} /></h2></div>{session && <div className="server-tag"><Users size={15} /> {session.server.name}</div>}</div>{session ? <><div className="session-strip"><div><span>Party size</span><b>{session.partySize} guests</b></div><div><span>Seated at</span><b>{new Date(session.seatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></div><div><span>Current bill</span><b>{price(session.bill?.totalPaise ?? 0)}</b></div></div><div className="table-order-list">{session.orders.length ? session.orders.flatMap((order) => order.items.map((item) => <div className="table-order-row" key={item.id}><div><b>{item.quantity}× {item.menuItem.englishName}</b><small>{item.menuItem.tamilName}</small></div><StatusBadge value={item.status} /></div>)) : <div className="empty-inline">No dishes ordered yet. Add from the menu.</div>}</div>{session.status === 'PAYMENT_PENDING' && <div className="paid-notice"><Check size={16} /> Payment recorded. Complete table cleanup after washing.</div>}</> : <div className="empty-inline">This table is ready for the next group.</div>}
          {table.status === 'AVAILABLE' && <div className="seat-form"><label>Party size<input type="number" min="1" max={table.capacity} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value)))} /></label>{employee?.role === 'MANAGER' && <label>Assign server<select value={serverId} onChange={(e) => setServerId(e.target.value)}><option value="">Choose server</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name} · {server.status.toLowerCase()}</option>)}</select></label>}<button disabled={!canEdit || busy || (employee?.role === 'MANAGER' && !serverId)} className="button button-dark" onClick={() => void onSeat(table.tableNo, party, serverId || undefined)}><Users size={15} /> Seat guests</button></div>}
          {session && <div className="table-actions">{session.status === 'OPEN' && readyToPay && <button disabled={!canEdit || busy} className="button button-outline" onClick={() => void onPay(session.id)}><Check size={15} /> Record full payment</button>}{session.status === 'PAYMENT_PENDING' && <button disabled={!canEdit || busy} className="button button-dark" onClick={() => void onCleanup(table.tableNo)}><Trash2 size={15} /> Clear table</button>}</div>}
          {session?.status === 'PAYMENT_PENDING' && <div className="table-actions"><button disabled={!canEdit || busy} className="button button-dark" onClick={() => void onCleanup(table.tableNo)}><Trash2 size={15} /> Start cleanup</button></div>}
        </div>}
      </section>
      <aside className="panel billing-panel"><div className="billing-head"><div><span className="section-kicker">TABLE BILL</span><h2>{table?.tableNo ?? 'Select table'} <span>· {session?.server.name ?? 'No server'}</span></h2></div><ShoppingBag size={18} /></div>
        <div className="menu-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Tamil or English menu" /><kbd>/</kbd></div>
        <div className="category-tabs">{categories.map((group) => <button key={group.id} className={category === group.name ? 'active' : ''} onClick={() => setCategory(group.name)}>{group.name}</button>)}</div>
        <div className="menu-results">{menuItems.map((item) => <article className="menu-item" key={item.id}><div className="dish-avatar">{item.vegetarian ? <Leaf size={15} /> : <span className="nonveg-dot" />}</div><div className="dish-info"><b>{item.englishName}</b><span>{item.tamilName}</span><small>{item.description}</small></div><div className="dish-buy"><b>{price(item.pricePaise)}</b>{cart.find((line) => line.menuItem.id === item.id) ? <div className="quantity-stepper"><button onClick={() => changeQty(item, -1)} aria-label="Decrease"><Minus size={12} /></button><b>{cart.find((line) => line.menuItem.id === item.id)?.quantity}</b><button onClick={() => changeQty(item, 1)} aria-label="Increase"><Plus size={12} /></button></div> : <button className="add-dish" onClick={() => changeQty(item, 1)} aria-label={`Add ${item.englishName}`}><CirclePlus size={18} /></button>}</div></article>)}{!menuItems.length && <div className="empty-state">No dishes match your search.</div>}</div>
        <div className="billing-bottom"><label className="instruction-field">Kitchen note<input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Less spicy, no onion…" maxLength={500} /></label>{cart.length > 0 && <div className="cart-lines">{cart.map((line) => <div key={line.menuItem.id}><span>{line.quantity} × {line.menuItem.englishName}</span><b>{price(line.quantity * line.menuItem.pricePaise)}</b></div>)}</div>}<div className="bill-summary"><div><span>New items</span><b>{price(cartSubtotal)}</b></div><div><span>Tax ({(dashboard.settings.taxRateBasisPoints / 100).toFixed(2)}%)</span><b>{price(estimatedTax)}</b></div><div className="bill-total"><span>New order total</span><b>{price(cartSubtotal + estimatedTax)}</b></div>{session?.bill && <><div className="current-bill-heading">Current dining session</div><div><span>Subtotal</span><b>{price(session.bill.subtotalPaise)}</b></div><div><span>Discount</span><b>−{price(session.bill.discountPaise ?? 0)}</b></div><div><span>Tax</span><b>{price(session.bill.taxPaise)}</b></div><div className="bill-total"><span>Current total</span><b>{price(session.bill.totalPaise)}</b></div></>}</div>{employee?.role === 'MANAGER' && session?.status === 'OPEN' && session.bill && <div className="discount-control"><label>Manager discount (₹)<input type="number" min="0" step="1" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label><button className="button button-outline" disabled={busy || !Number(discount)} onClick={() => void onDiscount(session.id, Math.round(Number(discount) * 100))}>Apply</button></div>}<button disabled={!canEdit || busy || !cart.length || !activeSession} onClick={() => void submit()} className="button button-terracotta full-button"><Send size={15} />{activeSession ? 'Send order to kitchen' : table?.status === 'AVAILABLE' ? 'Seat guests to order' : 'Table is not taking orders'}<ChevronDown size={15} /></button><small className="price-note">Prices are sample menu settings. Final totals are calculated by the API.</small></div>
      </aside>
    </div>
  </div>;
}
import { Leaf } from 'lucide-react';
