import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, claseTerminada } from '../logic';
import { Ring, Empty } from '../ui';
import { ClassSheet, NewClassSheet, TIPO_LABEL, useClassOps, useWhats, SlotPicker, useSlotCheck, motivoLabel } from '../classes';
import { RenewSheet } from '../subs';
import { useSeguimiento } from './Seguimiento';
import { Sheet } from '../ui';
import { WaDot } from '../classes';
import { addDays, diffDays, fmtDate, fmtLong, hm, timeToMin } from '../util';

export default function Home({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const ops = useClassOps(); const wa = useWhats(); const { check, node } = useSlotCheck();
  const [sel, setSel] = useState<any>(null); const [nuevo, setNuevo] = useState(false); const [renew, setRenew] = useState<any>(null);
  const [more, setMore] = useState<Record<string, boolean>>({}); const lim = (k: string, a: any[]) => (more[k] ? a : a.slice(0, 5)); const MoreBtn = ({ k, n }: { k: string; n: number }) => (n > 5 ? <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setMore({ ...more, [k]: !more[k] })}>{more[k] ? 'Ver menos' : `Ver las ${n}`}</button> : null);
  const [fixing, setFixing] = useState<any>(null); const [fx, setFx] = useState({ f: hoy, h: '' });

  const delDia = d.clases.filter((c: any) => c.fecha === hoy && c.estado !== 'no_dada').sort((a: any, b: any) => hm(a.hora).localeCompare(hm(b.hora)) || 0);
  const dadas = delDia.filter((c: any) => c.estado === 'asistio').length;
  const noCuentan = delDia.filter((c: any) => c.estado === 'ausente').length;
  const totalDia = delDia.length - noCuentan;
  const porCerrar = d.clases.filter((c: any) => c.fecha < hoy && c.estado === 'agendada').sort((a: any, b: any) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const aConfirmar = d.clases.filter((c: any) => c.estado === 'no_dada' && c.a_confirmar);

  const avisosSet = useMemo(() => { const s = new Set<string>(); d.avisos.forEach((a: any) => s.add(a.tipo + '|' + a.ref + '|' + a.persona_id)); return s; }, [d.avisos]);
  const sg = useSeguimiento();
  const [inscr, setInscr] = useState<any>(null);
  const sePudo = async (c: any) => { const ok = await ops.asistio(c); if (ok && c.tipo === 'prueba') { const p = idx.personaById.get(c.persona_id); const ya = (idx.subsByP.get(c.persona_id) || []).some((s: any) => s.tipo !== 'unica'); if (p && !ya) setInscr(p); } };
  const sinTareas = !sg.pendientes && !porCerrar.length && !aConfirmar.length && dadas === totalDia;

  return (
    <div className="page">
      {node}
      <header className="home-head">
        <div><div className="eyebrow">Hoy</div><h1>{fmtLong(hoy)}</h1><div className="muted">{totalDia ? `${dadas} de ${totalDia} clases dadas` : 'Sin clases hoy'}</div></div>
        <Ring done={dadas} total={totalDia} />
      </header>

      <section>
        <div className="sec-head"><h2>Clases de hoy</h2><button className="btn sm" onClick={() => setNuevo(true)}>+ Agendar</button></div>
        {delDia.length === 0 && <div className="muted pad">No hay clases agendadas para hoy.</div>}
        <div className="list">
          {delDia.map((c: any) => {
            const p = idx.personaById.get(c.persona_id); const fin = claseTerminada(c, hoy, undefined, cfg.duracion_min);
            const cls = c.estado === 'asistio' ? 'done' : c.estado === 'ausente' ? 'aus' : 't-' + c.tipo;
            return (
              <div key={c.id} className={'row-card ' + cls} onClick={() => setSel(c)}>
                <div className="time">{hm(c.hora)}</div>
                <div className="grow"><b>{p?.nombre}</b><div className="small muted">{TIPO_LABEL[c.tipo]}{c.estado === 'ausente' ? ` · ausente · ${motivoLabel(c.motivo_ausencia)}` : ''}{c.fecha_original && c.fecha_original !== c.fecha ? ` · reagendada` : ''}</div></div>
                {c.estado === 'agendada' && <WaDot done={avisosSet.has('confirmacion|' + hoy + '|' + c.persona_id)} onClick={() => p && wa(p, 'confirmacion', { hora: hm(c.hora) }, { tipo: 'confirmacion', ref: hoy })} />}
                {c.estado === 'asistio' ? <span className="tick">✓</span> : c.estado === 'agendada' && fin ? <button className="btn sm ok" onClick={(e) => { e.stopPropagation(); sePudo(c); }}>Se dio</button> : <span className="chev">›</span>}
              </div>
            );
          })}
        </div>
      </section>

      {porCerrar.length > 0 && (
        <section><div className="sec-head"><h2>Por cerrar</h2><span className="count">{porCerrar.length}</span></div>
          <div className="muted small pad">Clases de días anteriores sin marcar. Tocá para resolver.</div>
          <div className="list">{porCerrar.slice(0, 12).map((c: any) => (
            <div key={c.id} className={'row-card t-' + c.tipo} onClick={() => setSel(c)}>
              <div className="time sm">{fmtDate(c.fecha)}<br />{hm(c.hora)}</div><div className="grow"><b>{idx.personaById.get(c.persona_id)?.nombre}</b></div>
              <button className="btn sm ok" onClick={(e) => { e.stopPropagation(); sePudo(c); }}>Se dio</button></div>))}
            {porCerrar.length > 12 && <div className="muted small pad">y {porCerrar.length - 12} más…</div>}</div></section>
      )}

      <section><div className="sec-head"><h2>Seguimiento</h2></div>
        <div className={'row-card plain check' + (sg.pendientes ? '' : ' done')} onClick={() => { location.hash = 'seguimiento'; }}>
          <span className={'chk' + (sg.pendientes ? '' : ' on')}>{sg.pendientes ? '' : '✓'}</span>
          <div className="grow"><b>Revisar seguimiento</b><div className="small muted">{sg.pendientes ? `${sg.pendientes} por resolver: recordar pagos y renovaciones` : 'Todo revisado'}</div></div><span className="chev">›</span></div>
      </section>

      {aConfirmar.length > 0 && (
        <section><div className="sec-head"><h2>Pendientes de reagendar</h2><span className="count">{aConfirmar.length}</span></div>
          <div className="muted small pad">Clases que no se dieron y esperan nueva fecha. Elegí día y hora para sacarlas de la lista.</div>
          <div className="list">{aConfirmar.map((c: any) => (
            <div key={c.id}><div className="row-card t-nodada" onClick={() => { setFixing(fixing === c.id ? null : c.id); setFx({ f: addDays(hoy, 1), h: '' }); }}>
              <div className="time sm">{fmtDate(c.fecha)}<br />{hm(c.hora)}</div><div className="grow"><b>{idx.personaById.get(c.persona_id)?.nombre}</b><div className="small muted">{TIPO_LABEL[c.tipo]} · a reagendar</div></div><span className="chev">{fixing === c.id ? '⌃' : '⌄'}</span></div>
              {fixing === c.id && <div className="inline-pick"><SlotPicker fecha={fx.f} hora={fx.h} onChange={(f, h) => setFx({ f, h })} ignoreId={c.id} />
                <button className="btn" disabled={!fx.h} onClick={async () => { if (await check(fx.f, fx.h, c.id)) { await ops.reagendar(c, fx.f, fx.h); setFixing(null); } }}>Guardar nueva fecha</button></div>}</div>))}</div></section>
      )}

      {sinTareas && <Empty>Todo al día. No queda nada pendiente.</Empty>}

      {sel && <ClassSheet c={sel} onClose={() => setSel(null)} onOpenPersona={openPersona} />}
      {nuevo && <NewClassSheet onClose={() => setNuevo(false)} />}
      {inscr && <Sheet title={'¿Se inscribió ' + inscr.nombre.split(' ')[0] + '?'} onClose={() => setInscr(null)}><div className="stack"><div className="muted">Elegí plan, días y horarios para dejarlo/a inscripto/a.</div><button className="btn big" onClick={() => { setRenew(inscr); setInscr(null); }}>Sí, inscribir</button><button className="btn ghost" onClick={() => setInscr(null)}>Todavía no</button></div></Sheet>}
      {renew && <RenewSheet persona={renew} onClose={() => setRenew(null)} />}
    </div>
  );
}
