import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, slotKey, sinCulpa, cambioHora } from '../logic';
import { Seg } from '../ui';
import { NuevaPersona } from '../nueva';
import { ClassSheet, NewClassSheet, TIPO_LABEL, horasDisponibles, motivoLabel, QuienesSheet, useLongPress, useClassOps, useSlotCheck } from '../classes';
import { OfrecerHorarios } from '../pruebas';
import { addDays, DIAS3, dowISO, fmtDate, fmtLong, hm, monthLabel, parseD, ymd, addMonthKey, normStr } from '../util';

export default function Agenda({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const [ofrecer, setOfrecer] = useState(false); const [fecha, setFecha] = useState(hoy); const [vista, setVista] = useState<'dia' | 'semana' | 'lista'>('dia');
  const [quick, setQuick] = useState('todo'); const [tipo, setTipo] = useState(''); const [estado, setEstado] = useState(''); const [profe, setProfe] = useState(''); const [q, setQ] = useState('');
  const ops = useClassOps(); const { check, node: slotNode } = useSlotCheck(); const [full, setFull] = useState(false); const [dragId, setDragId] = useState<string | null>(null); const [over, setOver] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null); const [more, setMore] = useState(false); const [sel, setSel] = useState<any>(null); const [nuevo, setNuevo] = useState<any>(null); const [nuevaP, setNuevaP] = useState(false);

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
  const horasTodas = horasDisponibles(cfg);
  const horas = useMemo(() => {
    if (vista !== 'dia' || full) return horasTodas;
    const hs = d.clases.filter((c: any) => c.fecha === fecha && c.estado !== 'no_dada').map((c: any) => hm(c.hora)).filter((h: string) => horasTodas.includes(h)).sort();
    if (!hs.length) return horasTodas;
    return horasTodas.filter((h) => h >= hs[0] && h <= hs[hs.length - 1]);
  }, [d.clases, fecha, vista, full, horasTodas.join()]);
  const soltar = async (h: string) => {
    const c = d.clases.find((x: any) => x.id === dragId); setDragId(null); setOver(null);
    if (!c || c.estado !== 'agendada' || hm(c.hora) === h) return;
    if (await check(c.fecha, h, c.id)) ops.cambiarHora(c, h);
  };
  const dayClases = (f: string) => d.clases.filter((c: any) => c.fecha === f && filtrar(c));
  const mover = (n: number) => setFecha(addDays(fecha, vista === 'semana' ? n * 7 : vista === 'lista' ? 0 : n));
  const inicioSemana = addDays(fecha, 1 - dowISO(fecha));
  const mes = fecha.slice(0, 7);
  const lista = useMemo(() => d.clases.filter((c: any) => c.fecha.startsWith(mes) && filtrar(c)).sort((a: any, b: any) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)), [d.clases, mes, quick, tipo, estado, profe, q]);
  const Chip = ({ v, l }: { v: string; l: string }) => <button className={'chip' + (quick === v ? ' on' : '')} onClick={() => setQuick(v)}>{l}</button>;
  const bloqDe = (f: string, h: string) => d.bloqueos.find((b: any) => b.fecha === f && b.hora_desde && hm(b.hora_desde) <= h && hm(b.hora_hasta) > h);

  return (
    <div className="page">
      <header className="page-head"><h1>Agenda</h1><div className="row" style={{ gap: 6 }}><button className="btn ghost sm" onClick={() => setOfrecer(true)}>Ofrecer horarios</button><button className="btn sm" onClick={() => setNuevo({ f: fecha })}>+ Agendar</button></div></header>{ofrecer && <OfrecerHorarios onClose={() => setOfrecer(false)} />}
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
        <div className="row2"><select value={profe} onChange={(e) => setProfe(e.target.value)}><option value="">Todo instructor/a</option>{d.profesoras.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          <input placeholder="Persona…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>}

      {vista === 'dia' && (
        <div className="day">
          <label className="check small" style={{ margin: '0 0 6px' }}><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Ver el día completo ({horasTodas[0]} a {horasTodas[horasTodas.length - 1]})</label>
          {horas.map((h) => {
            const cs = dayClases(fecha).filter((c: any) => hm(c.hora) === h); const all = d.clases.filter((c: any) => c.fecha === fecha && hm(c.hora) === h && (c.estado === 'agendada' || c.estado === 'asistio')).length;
            const camas = cs.filter((c: any) => c.estado === 'agendada' || c.estado === 'asistio'); const otras = cs.filter((c: any) => !(c.estado === 'agendada' || c.estado === 'asistio'));
            const b = bloqDe(fecha, h); const vacias = b && b.tipo === 'bloqueo' ? 0 : Math.max(0, cfg.cupo - camas.length);
            return (
              <div className={'hour' + (over === h ? ' dropping' : '')} key={h} onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(h); } }} onDragLeave={() => setOver((o) => (o === h ? null : o))} onDrop={(e) => { e.preventDefault(); soltar(h); }}>
                <HourHead h={h} all={all} cupo={cfg.cupo} onWho={() => setWho(h)} />
                <div className="hour-b">
                  {b && <div className={'blk' + (b.tipo === 'bloqueo' ? ' nod' : '')}>⛔ {b.motivo}</div>}
                  <div className="camas" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.max(cfg.cupo, camas.length))}, minmax(0, 1fr))` }}>
                    {camas.map((c: any) => <ClassPill key={c.id} c={c} idx={idx} onClick={() => setSel(c)} drag={c.estado === 'agendada'} onDragStart={() => setDragId(c.id)} onDragEnd={() => { setDragId(null); setOver(null); }} />)}
                    {Array.from({ length: vacias }, (_, i) => <button key={'v' + i} className="cama-v" onClick={() => setNuevo({ f: fecha, h })} aria-label="Cama libre">+</button>)}
                  </div>
                  {otras.length > 0 && <div className="otras">{otras.map((c: any) => <ClassPill key={c.id} c={c} idx={idx} onClick={() => setSel(c)} />)}</div>}
                </div>
              </div>
            );
          })}
          <div className="muted small pad">Arrastrá a una persona a otra hora para cambiarla solo por ese día (en el celular: tocá la clase → «Cambiar la hora»).</div>
        </div>
      )}
      {vista === 'semana' && (
        <div className="week-wrap"><table className="week"><thead><tr><th></th>{Array.from({ length: 7 }, (_, i) => { const f = addDays(inicioSemana, i); return <th key={f} className={f === hoy ? 'today' : ''} onClick={() => { setFecha(f); setVista('dia'); }}>{DIAS3[parseD(f).getDay()]}<br /><small>{parseD(f).getDate()}</small></th>; })}</tr></thead>
          <tbody>{horas.map((h) => <tr key={h}><th>{h}</th>{Array.from({ length: 7 }, (_, i) => {
            const f = addDays(inicioSemana, i); const cs = dayClases(f).filter((c: any) => hm(c.hora) === h); const all = d.clases.filter((c: any) => c.fecha === f && hm(c.hora) === h && (c.estado === 'agendada' || c.estado === 'asistio')).length;
            return <td key={f} className={'wc o' + Math.min(all, cfg.cupo) + (bloqDe(f, h) ? ' blk' + (bloqDe(f, h).tipo === 'bloqueo' ? ' nod' : '') : '')} onClick={() => { setFecha(f); setVista('dia'); }}>{cs.length ? cs.map((c: any) => <i key={c.id} className={'dot t-' + c.tipo + ' s-' + c.estado} title={idx.personaById.get(c.persona_id)?.nombre} />) : ''}</td>;
          })}</tr>)}</tbody></table>
          <div className="muted small pad">Cada punto es una persona. Tocá un día para ver el detalle.</div></div>
      )}
      {vista === 'lista' && (
        <div className="list">{lista.length === 0 && <div className="muted pad">Sin resultados este mes con estos filtros.</div>}
          {lista.slice(0, 300).map((c: any) => <div key={c.id} className={'row-card ' + (c.estado === 'asistio' ? 'done' : c.estado === 'ausente' ? 'aus' : 't-' + c.tipo)} onClick={() => setSel(c)}>
            <div className="time sm">{fmtDate(c.fecha)}<br />{hm(c.hora)}</div><div className="grow"><b>{idx.personaById.get(c.persona_id)?.nombre}</b><div className="small muted">{TIPO_LABEL[c.tipo]}{c.estado === 'ausente' ? ` · ${motivoLabel(c.motivo_ausencia)}` : ''}</div></div>{c.estado === 'asistio' && <span className="tick">✓</span>}</div>)}
          {lista.length > 300 && <div className="muted small pad">Mostrando 300 de {lista.length}. Afiná los filtros.</div>}</div>
      )}
      {who && <QuienesSheet fecha={fecha} hora={who} onClose={() => setWho(null)} />}
      {slotNode}
      {sel && <ClassSheet c={sel} onClose={() => setSel(null)} onOpenPersona={openPersona} />}
      {nuevo && <NewClassSheet onClose={() => setNuevo(null)} presetFecha={nuevo.f} presetHora={nuevo.h} onNuevo={() => { setNuevo(null); setNuevaP(true); }} />}
      {nuevaP && <NuevaPersona onClose={() => setNuevaP(false)} onCreated={(id) => { setNuevaP(false); openPersona(id); }} />}
    </div>
  );
}

export function ClassPill({ c, idx, onClick, drag, onDragStart, onDragEnd }: { c: any; idx: any; onClick: () => void; drag?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const p = idx.personaById.get(c.persona_id);
  const sc = c.estado === 'ausente' && sinCulpa(c);
  const cls = c.estado === 'asistio' ? 'done' : sc ? 'cancel' : c.estado === 'ausente' ? 'aus' : c.estado === 'no_dada' ? 't-nodada' : 't-' + c.tipo;
  return <button draggable={!!drag} onDragStart={(e) => { e.dataTransfer?.setData('text/plain', c.id); onDragStart && onDragStart(); }} onDragEnd={onDragEnd} className={'pill ' + cls + (p?.baneado ? ' ban' : '')} onClick={onClick}>{c.estado === 'asistio' ? '✓ ' : c.tipo === 'recuperacion' ? '↺ ' : ''}{p?.nombre}{c.tipo === 'prueba' ? ' · prueba' : ''}{sc ? ` · ${c.motivo_ausencia === 'feriado' ? 'feriado' : 'cancelada'}` : c.estado === 'ausente' ? ' · ausente' : ''}{cambioHora(c) && <span className="hmark" title={`Cambio de hora solo ese día (era ${hm(c.hora_original)})`}> ⇄</span>}</button>;
}

function HourHead({ h, all, cupo, onWho }: { h: string; all: number; cupo: number; onWho: () => void }) {
  const lp = useLongPress(onWho);
  return <div className="hour-h" {...lp} title="Mantené presionado (o clic derecho) para ver quiénes están"><b>{h}</b><small className={all >= cupo ? 'full' : ''}>{all}/{cupo}</small></div>;
}
