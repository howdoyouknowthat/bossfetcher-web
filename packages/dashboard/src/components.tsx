import type { ReactNode } from 'react';

export function Card({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  return <div className={`bfd-card${pad ? ' bfd-card-pad' : ''}`}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bfd-stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <h3 className="bfd-section-title">
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </h3>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'pos' | 'warn' | 'acc' }) {
  return <span className={`bfd-chip${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="bfd-empty">{children}</div>;
}

export function BarRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bfd-bar-row">
      <div className="lbl">{label}</div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="n">{count}</div>
    </div>
  );
}

export function PageHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="bfd-page-head">
      <h1>{title}</h1>
      {desc ? <p>{desc}</p> : null}
    </div>
  );
}
