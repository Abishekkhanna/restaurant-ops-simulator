import type { ReactNode } from 'react';
import { ChefHat, ClipboardList, LayoutDashboard, Leaf, Utensils, Users, WashingMachine, Wifi, WifiOff, Sparkles } from 'lucide-react';
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

export function Shell({ view, setView, children, employee, employees, onEmployee, connected, time }: {
  view: ViewKey; setView: (view: ViewKey) => void; children: ReactNode; employee?: Employee; employees: Employee[];
  onEmployee: (id: string) => void; connected: boolean; time: string;
}) {
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
      <div className="mobile-nav">{links.map(({ id, title, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)} aria-label={title}><Icon size={18} /><span>{title}</span></button>)}</div>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
