import React, { useMemo, useRef, useState } from 'react';
import { useApp } from './store';
import { matchPersona } from './logic';
import { normPhone } from './util';

// Selector de persona: al elegir, queda un recuadro (no editable). Backspace o ✕ lo quita entero.
export function PersonaPicker({ value, onChange, exclude, placeholder = 'Buscar por nombre…', allowCreate = true, autoFocus }: { value: string; onChange: (id: string) => void; exclude?: string; placeholder?: string; allowCreate?: boolean; autoFocus?: boolean }) {
  const { d, isAdmin, ins, toast, hoy, cfg } = useApp(); const [q, setQ] = useState(''); const box = useRef<HTMLDivElement>(null);
  const sel = d.personas.find((p: any) => p.id === value);
  const list = useMemo(() => (q ? d.personas.filter((p: any) => p.id !== exclude && matchPersona(p, q)).slice(0, 6) : []), [q, d.personas, exclude]);
  const exact = d.personas.some((p: any) => p.nombre.trim().toLowerCase() === q.trim().toLowerCase());
  const crear = async () => {
    try { const p = await ins('personas', { nombre: q.trim(), origen: 'app', fecha_alta: hoy }); onChange(p.id); setQ(''); toast('Persona creada. Completá sus datos después en Clientes.'); } catch (e: any) { toast('Error: ' + e.message); }
  };
  if (sel) return (
    <div ref={box} className="pchip" tabIndex={0} role="group" aria-label={'Seleccionada: ' + sel.nombre} onKeyDown={(e) => { if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onChange(''); } }}>
      <span className="pchip-n">{sel.nombre}</span><button type="button" className="pchip-x" aria-label="Quitar" onClick={() => onChange('')}>✕</button>
    </div>);
  return (
    <div>
      <input placeholder={placeholder} value={q} autoFocus={autoFocus} onChange={(e) => setQ(e.target.value)} />
      {q && (list.length > 0 || (allowCreate && isAdmin && !exact)) && (
        <div className="pick">
          {list.map((p: any) => <button type="button" key={p.id} onClick={() => { onChange(p.id); setQ(''); }}>{p.nombre}{p.celular ? <small className="muted"> · {normPhone(p.celular, cfg.pais_tel).slice(-4).padStart(7, '·')}</small> : null}</button>)}
          {allowCreate && isAdmin && !exact && <button type="button" className="pick-new" onClick={crear}>+ Crear «{q.trim()}» como persona nueva</button>}
        </div>)}
      {q && !list.length && !(allowCreate && isAdmin) && <small className="muted">Sin resultados.</small>}
    </div>
  );
}
