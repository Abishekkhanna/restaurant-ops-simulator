import type { ReactNode } from 'react';

export function StatCard({ label, value, foot, icon, tint = 'terracotta' }: { label: string; value: string | number; foot?: string; icon: ReactNode; tint?: string }) {
  return <article className="stat-card">
    <div className={`stat-icon tint-${tint}`}>{icon}</div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong>{foot && <small>{foot}</small>}</div>
  </article>;
}
