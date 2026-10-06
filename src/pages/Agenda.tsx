import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, slotKey } from '../logic';
import { Seg } from '../ui';
import { ClassSheet, NewClassSheet, TIPO_LABEL, horasDisponibles, motivoLabel } from '../classes';
import { addDays, DIAS3, dowISO, fmtDate, fmtLong, hm, monthLabel, parseD, ymd, addMonthKey, normStr } from '../util';

export default function Agenda({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const [fecha, setFecha] = useState(hoy); const [vista, setVista] = useState<'dia' | 'semana' | 'lista'>('dia');
  const [quick, setQuick] = useState('todo'); const [tipo, setTipo] = useState(''); const [estado, setEstado] = useState(''); const [profe, setProfe] = useState(''); const [q, setQ] = useState('');
  const [more, setMore] = useState(false); const [sel, setSel] = useState<any>(null); const [nuevo, setNuevo] = useState<any>(null);

  const filtrar = (c: any) => {
    if (quick === 'rec' && c.tipo !== 'recuperacion') return false;
    if (quick === 'aus' && c.estado !== 'ausente') return false;
    if (quick === 'asis' && c.estado !== 'asistio') return false;
    if (quick === 'prueba' && c.tipo !== 'prueba') return false;
    if (quick === 'todo' && c.estado === 'ausente' && !estado) return false; // la clase original ausente se oculta
    if (tipo && c.tipo !== tipo) return false; if (estado && c.estado !== estado) return false; if (profe && c.profesora_id !== profe) return false;
    if (q && !normStr(idx.personaById.get(c.persona_id)?.nombre || '').includes(normStr(q))) return false;
    return true;
  };
  const horas = horasDisponibles(cfg);
  const dayClases = (f: string) => d.clases.filter((c: any) => c.fecha === f && filtrar(c));
  const mover = (n: number) => setFecha(addDays(fecha, vista === 'semana' ? n * 7 : vista === 'lista' ? 0 : n));
  const inicioSemana = addDays(fecha, 1 - dowISO(fecha));
  const mes = fecha.slice(0, 7);
  const lista = useMemo(() => d.clases.filter((c: any) => c.fecha.startsWith(mes) && filtrar(c)).sort((a: any, b: any) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)), [d.clases, mes, quick, tipo, estado, profe, q]);
  const Chip = ({ v, l }: { v: string; l: string }) => <button className={'chip' + (quick === v ? ' on' : '')} onClick={() => setQuick(v)}>{l}</button>;
  const bloqDe = (f: string, h: string) => d.bloqueos.find((b: any) => b.fecha === f && b.hora_desde && hm(b.hora_desde) <= h && hm(b.hora_hasta) > h);

  return (
    <div className="page">
      <header className="page-head"><h1>Agenda</h1><button className="btn sm" onClick={() => setNuevo({ f: fecha })}>+ Agendar</button></header>
      <Seg value={vista} onChange={setVista} options={[['dia', 'Día'], ['semana', 'Semana'], ['lista', 'Mes']]} />
      <div className="datebar">
        {vista === 'lista' ? <button onClick={() => setFecha(addMonthKey(mes, -1) + '-01')}>‹</button> : <button onClick={() => mover(-1)}>‹</button>}
        <label className="dtitle"><b>{vista === 'lista' ? monthLabel(mes) : vista === 'dia' ? fmtLong(fecha) : `${fmtDate(inicioSemana)} – ${fmtDate(addDays(inicioSemana, 6))}`}</b><input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} /></label>
        {vista === 'lista' ? <button onClick={() => setFecha(addMonthKey(mes, 1) + '-01')}>›</button> : <button onClick={() => mover(1)}>›</button>}
        <button className="chip" onClick={() => setFecha(hoy)}>Hoy</button>
      </div>
      <div className="chips scroll"><Chip v="todo" l="Todo" /><Chip v="asis" l="Asistencias" /><Chip v="aus" l="Ausencias" /><Chip v="rec" l="Recuperaciones" /><Chip v="prueba" l="Pruebas" /><button className={'chip' + (more ? ' on' : '')} onClick={() => setMore(!more)}>Filtros ⚙</button></div>
      {more && <div className="box stack">
        <div className="row2"><select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todo tipo</option>{Object.entries(TIPO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todo estado</option><option value="agendada">Agendada</option><option value="asistio">Asistió</option><option value="ausente">Ausente</option><option value="no_dada">No dada</option></select></div>
        <div className="row2"><select value={profe} onChange={(e) => setProfe(e.target.value)}><option value="">Toda profe</option>{d.profesoras.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          <input placeholder="Persona…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>}

      {vista === 'dia' && (
        <div className="day">
          {horas.map((h) => {
            const cs = dayClases(fecha).filter((c: any) => hm(c.hora) === h); const all = d.clases.filter((c: any) => c.fecha === fecha && hm(c.hora) === h && (c.estado === 'agendada' || c.estado === 'asistio')).length;
            const b = bloqDe(fecha, h);
            return (
              <div className="hour" key={h}>
                <div className="hour-h"><b>{h}</b><small className={all >= cfg.cupo ? 'full' : ''}>{all}/{cfg.cupo}</small></div>
                <div className="hour-b">
                  {b && <div className="blk">⛔ {b.motivo}</div>}
                  {cs.map((c: any) => <ClassPill key={c.id} c={c} idx={idx} onClick={() => setSel(c)} />)}
                  <button className="plus" onClick={() => setNuevo({ f: fecha, h })} aria-label="Agregar">+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {vista === 'semana' && (
        <div className="week-wrap"><table className="week"><thead><tr><th></th>{Array.from({ length: 7 }, (_, i) => { const f = addDays(inicioSemana, i); return <th key={f} className={f === hoy ? 'today' : ''} onClick={() => { setFecha(f); setVista('dia'); }}>{DIAS3[parseD(f).getDay()]}<br /><small>{parseD(f).getDate()}</small></th>; })}</tr></thead>
          <tbody>{horas.map((h) => <tr key={h}><th>{h}</th>{Array.from({ length: 7 }, (_, i) => {
            const f = addDays(inicioSemana, i); const cs = dayClases(f).filter((c: any) => hm(c.hora) === h); const all = d.clases.filter((c: any) => c.fecha === f && hm(c.hora) === h && (c.estado === 'agendada' || c.estado === 'asistio')).length;
            return <td key={f} className={'wc o' + Math.min(all, cfg.cupo) + (bloqDe(f, h) ? ' blk' : '')} onClick={() => { setFecha(f); setVista('dia'); }}>{cs.length ? cs.map((c: any) => <i key={c.id} className={'dot t-' + c.tipo + ' s-' + c.estado} title={idx.personaById.get(c.persona_id)?.nombre} />) : ''}</td>;
          })}</tr>)}</tbody></table>
          <div className="muted small pad">Cada punto es una persona. Tocá un día para ver el detalle.</div></div>
      )}
      {vista === 'lista' && (
        <div className="list">{lista.length === 0 && <div className="muted pad">Sin resultados este mes con estos filtros.</div>}
          {lista.slice(0, 300).map((c: any) => <div key={c.id} className={'row-card ' + (c.estado === 'asistio' ? 'done' : c.estado === 'ausente' ? 'aus' : 't-' + c.tipo)} onClick={() => setSel(c)}>
            <div className="time sm">{fmtDate(c.fecha)}<br />{hm(c.hora)}</div><div className="grow"><b>{idx.personaById.get(c.persona_id)?.nombre}</b><div className="small muted">{TIPO_LABEL[c.tipo]}{c.estado === 'ausente' ? ` · ${motivoLabel(c.motivo_ausencia)}` : ''}</div></div>{c.estado === 'asistio' && <span className="tick">✓</span>}</div>)}
          {lista.length > 300 && <div className="muted small pad">Mostrando 300 de {lista.length}. Afiná los filtros.</div>}</div>
      )}
      {sel && <ClassSheet c={sel} onClose={() => setSel(null)} onOpenPersona={openPersona} />}
      {nuevo && <NewClassSheet onClose={() => setNuevo(null)} presetFecha={nuevo.f} presetHora={nuevo.h} />}
    </div>
  );
}

export function ClassPill({ c, idx, onClick }: { c: any; idx: any; onClick: () => void }) {
  const p = idx.personaById.get(c.persona_id);
  const cls = c.estado === 'asistio' ? 'done' : c.estado === 'ausente' ? 'aus' : c.estado === 'no_dada' ? 't-nodada' : 't-' + c.tipo;
  return <button className={'pill ' + cls} onClick={onClick}>{c.estado === 'asistio' ? '✓ ' : c.tipo === 'recuperacion' ? '↺ ' : ''}{p?.nombre}{c.tipo === 'prueba' ? ' · prueba' : ''}{c.estado === 'ausente' ? ' · ausente' : ''}</button>;
}
