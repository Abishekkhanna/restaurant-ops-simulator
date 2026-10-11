import { useState, type ReactNode } from 'react';
import { ChefHat, ClipboardList, LayoutDashboard, Leaf, Utensils, Users, WashingMachine, Wifi, WifiOff, Sparkles, ReceiptText, X } from 'lucide-react';
import type { Employee } from '../types';

export type ViewKey = 'overview' | 'floor' | 'kitchen' | 'servers' | 'wash' | 'manager';
const links: Array<{ id: ViewKey; title: string; tamil: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', title: 'Overview', tamil: 'நிலவரம்', icon: LayoutDashboard },
  { id: 'floor', title: 'Restaurant floor', tamil: 'உணவகம்', icon: Utensils },
  { id: 'kitchen', title: 'Kitchen', tamil: 'சமையலறை', icon: ChefHat },
  { id: 'servers', title: 'Service team', tamil: 'பரிமாறுதல்', icon: Users },
  { id: 'wash', title: 'Dishwashing', tamil: 'பாத்திரங்கள்', icon: WashingMachine },
  { id: 'manager', title: 'Manager desk', tamil: 'மேலாளர்', icon: ClipboardList },
];

export function Shell({ view, setView, children, employee, employees, onEmployee, connected, time, billing, billingTotal }: {
  view: ViewKey; setView: (view: ViewKey) => void; children: ReactNode; employee?: Employee; employees: Employee[];
  onEmployee: (id: string) => void; connected: boolean; time: string; billing: ReactNode; billingTotal: number;
}) {
  const [billingOpen, setBillingOpen] = useState(false);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark"><Leaf size={19} /></div><div><b>மண்வாசனை</b><small>MADURAI · EST. 1988</small></div></div>
      <div className="branch-label">OPERATIONS CONSOLE</div>
      <nav>{links.map(({ id, title, tamil, icon: Icon }) => <button key={id} onClick={() => setView(id)} className={`nav-link ${view === id ? 'active' : ''}`}><Icon size={18} /><span>{title}<small>{tamil}</small></span>{view === id && <i />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="today-card"><span className="lamp-dot" /><div><b>Madurai dining room</b><small>All stations operational</small></div><Sparkles size={15} /></div><div className="sidebar-version">MANVASANAI · SIMULATOR <span>v0.1</span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark"><Leaf size={17} /></div><b>மதுரை மண்வாசனை</b></div>
        <div className="crumb"><span>Operations</span><b>/</b><strong>{links.find((x) => x.id === view)?.title}</strong></div>
        <div className="topbar-right"><div className={`connection-chip ${connected ? 'online' : 'offline'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}{connected ? 'Live' : 'Reconnecting'}</div><div className="sim-clock"><span className="clock-pulse" />{time}</div><label className="employee-select"><Users size={15} /><select value={employee?.id ?? ''} onChange={(e) => onEmployee(e.target.value)} aria-label="Working as employee"><option value="">Select staff</option>{employees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select></label><div className="avatar">{employee?.name.slice(0, 1) ?? 'M'}</div></div>
      </header>
      <div className="page-content">{children}</div>
    </main>
    <aside className="billing-dock" aria-label="Current order billing">{billing}</aside>
    <button className="billing-mobile-trigger" onClick={() => setBillingOpen(true)} aria-label="Open current order"><ReceiptText size={18} /><span>Current order</span><b>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(billingTotal / 100)}</b></button>
    {billingOpen && <div className="billing-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setBillingOpen(false); }}><section className="billing-drawer"><button className="billing-drawer-close" onClick={() => setBillingOpen(false)} aria-label="Close billing"><X size={18} /></button>{billing}</section></div>}
  </div>;
}
