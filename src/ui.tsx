import React, { useEffect, useState } from 'react';
import { gsShort } from './util';

export function Sheet({ title, onClose, children, wide }: { title?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; }; }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog">
        <div className="sheet-head"><div className="sheet-title">{title}</div><button className="x" onClick={onClose} aria-label="Cerrar">✕</button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <em>{hint}</em>}</label>;
}
export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <div className="chips">{options.map(([v, l]) => <button key={v} className={'chip' + (v === value ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export function Empty({ children, icon = '✓' }: { children: React.ReactNode; icon?: string }) { return <div className="empty"><div className="empty-ic">{icon}</div>{children}</div>; }

export function Ring({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, p = total ? done / total : 1;
  return (
    <svg width={size} height={size} className="ring">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" className="ring-t">{total ? `${done}/${total}` : '✓'}</text>
    </svg>
  );
}
export function Progress({ value, tone }: { value: number; tone?: string }) { return <div className="prog"><div className={'prog-f ' + (tone || '')} style={{ width: Math.max(0, Math.min(100, value * 100)) + '%' }} /></div>; }

export function useConfirm() {
  const [st, setSt] = useState<any>(null);
  const ask = (msg: string): Promise<boolean> => new Promise((res) => setSt({ msg, res }));
  const node = st ? (
    <Sheet title="Confirmar" onClose={() => { st.res(false); setSt(null); }}>
      <p style={{ margin: '0 0 14px' }}>{st.msg}</p>
      <div className="row end"><button className="btn ghost" onClick={() => { st.res(false); setSt(null); }}>Cancelar</button><button className="btn" onClick={() => { st.res(true); setSt(null); }}>Sí, continuar</button></div>
    </Sheet>) : null;
  return { ask, node };
}

// ---- Gráficos SVG simples ----
export function BarChart({ labels, series, height = 180, colors = ['var(--sage)', 'var(--sand)'], faded = [] as number[] }: { labels: string[]; series: { name: string; values: number[] }[]; height?: number; colors?: string[]; faded?: number[] }) {
  const W = Math.max(320, labels.length * (series.length * 14 + 14)); const H = height, P = { l: 38, r: 6, t: 8, b: 22 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const gw = (W - P.l - P.r) / labels.length; const bw = Math.min(16, (gw - 6) / series.length);
  const ticks = [0, 0.5, 1].map((t) => t * max);
  return (
    <div className="chart-scroll"><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="chart">
      {ticks.map((t, i) => { const y = P.t + (H - P.t - P.b) * (1 - t / max); return <g key={i}><line x1={P.l} x2={W - P.r} y1={y} y2={y} className="grid" /><text x={P.l - 4} y={y + 3} textAnchor="end" className="ax">{gsShort(t)}</text></g>; })}
      {labels.map((l, i) => (
        <g key={i} opacity={faded.includes(i) ? 0.35 : 1}>
          {series.map((s, j) => { const h = (H - P.t - P.b) * (s.values[i] / max); const x = P.l + gw * i + (gw - bw * series.length) / 2 + bw * j; return <rect key={j} x={x} y={H - P.b - h} width={bw - 1} height={Math.max(0, h)} rx="2" fill={colors[j % colors.length]}><title>{s.name}: {Math.round(s.values[i]).toLocaleString('es-PY')}</title></rect>; })}
          <text x={P.l + gw * i + gw / 2} y={H - 6} textAnchor="middle" className="ax">{l}</text>
        </g>
      ))}
    </svg></div>
  );
}
export function LineChart({ labels, series, height = 160, colors = ['var(--sage)', 'var(--sand)', 'var(--sky)'], money = true }: { labels: string[]; series: { name: string; values: (number | null)[] }[]; height?: number; colors?: string[]; money?: boolean }) {
  const W = Math.max(320, labels.length * 44); const H = height, P = { l: 38, r: 10, t: 8, b: 22 };
  const all = series.flatMap((s) => s.values.filter((v) => v !== null) as number[]); const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const x = (i: number) => P.l + ((W - P.l - P.r) * i) / Math.max(1, labels.length - 1); const y = (v: number) => P.t + (H - P.t - P.b) * (1 - (v - min) / (max - min || 1));
  return (
    <div className="chart-scroll"><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="chart">
      {[min, (min + max) / 2, max].map((t, i) => <g key={i}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 4} y={y(t) + 3} textAnchor="end" className="ax">{money ? gsShort(t) : Math.round(t)}</text></g>)}
      {labels.map((l, i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="ax">{l}</text>)}
      {series.map((s, j) => {
        const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean) as number[][];
        return <g key={j}><polyline fill="none" stroke={colors[j % colors.length]} strokeWidth="2" points={pts.map((p) => p.join(',')).join(' ')} />{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill={colors[j % colors.length]} />)}</g>;
      })}
    </svg></div>
  );
}
export function Legend({ items, colors = ['var(--sage)', 'var(--sand)', 'var(--sky)'] }: { items: string[]; colors?: string[] }) {
  return <div className="legend">{items.map((t, i) => <span key={t}><i style={{ background: colors[i % colors.length] }} />{t}</span>)}</div>;
}
