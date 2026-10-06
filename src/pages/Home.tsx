import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, estadoPersona, claseTerminada, COLOR_NAME } from '../logic';
import { Ring, Empty } from '../ui';
import { ClassSheet, NewClassSheet, TIPO_LABEL, useClassOps, useWhats, SlotPicker, useSlotCheck, motivoLabel } from '../classes';
import { RenewSheet } from '../subs';
import { addDays, diffDays, fmtDate, fmtLong, hm, timeToMin } from '../util';

export default function Home({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy, isAdmin, me } = useApp();
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

  // avisos y renovaciones
  const avisosSet = useMemo(() => { const s = new Set<string>(); d.avisos.forEach((a: any) => s.add(a.tipo + '|' + a.ref + '|' + a.persona_id)); return s; }, [d.avisos]);
  const confirmar = useMemo(() => {
    const seen = new Set<string>(); const out: any[] = [];
    delDia.filter((c: any) => c.estado === 'agendada').forEach((c: any) => {
      if (seen.has(c.persona_id) || avisosSet.has('confirmacion|' + hoy + '|' + c.persona_id)) return; seen.add(c.persona_id);
      const p = idx.personaById.get(c.persona_id); if (p) out.push({ p, c });
    }); return out;
  }, [delDia, avisosSet, idx, hoy]);

  const { avisos, renov } = useMemo(() => {
    const avisos: any[] = [], renov: any[] = []; const offs = [...(cfg.avisos_offsets || [-3, 0, 2])].sort((a: number, b: number) => a - b);
    d.personas.forEach((p: any) => {
      const e = estadoPersona(p, idx, cfg, hoy); const s = e.sub; if (!s || s.tipo === 'unica' || e.stage !== 'inscripta') return;
      const subs = idx.subsByP.get(p.id) || []; if (subs.some((x: any) => x.tipo !== 'unica' && x.inicio > s.inicio)) return;
      const due = addDays(s.fin, 1); const dias = diffDays(hoy, due); // >0 vencida
      if (e.impago) renov.push({ p, e, tipo: 'impago', dias: e.atraso });
      else if (dias >= -cfg.aviso_renovacion_dias) renov.push({ p, e, tipo: dias > 0 ? 'vencida' : 'por_vencer', dias });
      // avisos
      const dueOffs = offs.filter((o: number) => diffDays(hoy, addDays(due, o)) >= 0);
      if (dueOffs.length && s.inicio <= hoy) {
        const o = Math.max(...dueOffs); const sent = offs.some((x: number) => x >= o && avisosSet.has('renovacion|' + s.id + ':' + x + '|' + p.id));
        if (!sent && dias <= cfg.inactiva_dias) avisos.push({ p, s, o, dias, due });
      }
    });
    renov.sort((a, b) => b.dias - a.dias); avisos.sort((a, b) => b.dias - a.dias);
    return { avisos, renov };
  }, [d, idx, cfg, hoy, avisosSet]);

  const sinTareas = !confirmar.length && !avisos.length && !renov.length && !porCerrar.length && !aConfirmar.length && dadas === totalDia;
  const profeMode = !isAdmin;

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
                {c.estado === 'asistio' ? <span className="tick">✓</span> : c.estado === 'agendada' && fin ? <button className="btn sm ok" onClick={(e) => { e.stopPropagation(); ops.asistio(c); }}>Se dio</button> : <span className="chev">›</span>}
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
              <button className="btn sm ok" onClick={(e) => { e.stopPropagation(); ops.asistio(c); }}>Se dio</button></div>))}
            {porCerrar.length > 12 && <div className="muted small pad">y {porCerrar.length - 12} más…</div>}</div></section>
      )}

      {(confirmar.length > 0) && (
        <section><div className="sec-head"><h2>Confirmar clases de hoy</h2><span className="count">{confirmar.length}</span></div>
          <div className="list">{confirmar.map(({ p, c }: any) => (
            <div className="row-card plain" key={p.id}><div className="time sm">{hm(c.hora)}</div><div className="grow"><b>{p.nombre}</b></div>
              <button className="btn sm" onClick={() => wa(p, 'confirmacion', { hora: hm(c.hora) }, { tipo: 'confirmacion', ref: hoy })}>WhatsApp</button></div>))}</div></section>
      )}

      {avisos.length > 0 && (
        <section><div className="sec-head"><h2>Avisos a clientes</h2><span className="count">{avisos.length}</span></div>
          <div className="list">{lim('av', avisos).map(({ p, s, o, dias, due }: any) => (
            <div className="row-card plain" key={p.id}><div className="grow"><b>{p.nombre}</b><div className="small muted">{dias < 0 ? `renueva en ${-dias} día${dias === -1 ? '' : 's'}` : dias === 0 ? 'renueva hoy' : `venció hace ${dias} día${dias === 1 ? '' : 's'}`}</div></div>
              <button className="btn sm" onClick={() => wa(p, o > 0 ? 'atraso' : 'renovacion', { vence: fmtDate(due), plan: s.plan_nombre || 'plan' }, { tipo: 'renovacion', ref: s.id + ':' + o })}>WhatsApp</button></div>))}</div><MoreBtn k="av" n={avisos.length} /></section>
      )}

      {!profeMode && renov.length > 0 && (
        <section><div className="sec-head"><h2>Renovaciones y pagos</h2><span className="count">{renov.length}</span></div>
          <div className="list">{lim('rn', renov).map(({ p, e, tipo, dias }: any) => (
            <div className={'row-card plain c-' + (e.color || (tipo === 'por_vencer' ? 'soon' : ''))} key={p.id}>
              <div className="grow" onClick={() => openPersona(p.id)}><b>{p.nombre}</b><div className="small muted">{e.sub.plan_nombre} · {tipo === 'impago' ? `sin pago hace ${dias} d` : tipo === 'por_vencer' ? (dias === 0 ? 'renueva hoy' : `renueva en ${-dias} d`) : `vencida hace ${dias} d`}{e.color ? ` · ${COLOR_NAME[e.color]}` : ''}</div></div>
              <button className="btn sm" onClick={() => setRenew(p)}>Renovar</button></div>))}</div><MoreBtn k="rn" n={renov.length} /></section>
      )}

      {aConfirmar.length > 0 && (
        <section><div className="sec-head"><h2>A confirmar</h2><span className="count">{aConfirmar.length}</span></div>
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
      {renew && <RenewSheet persona={renew} onClose={() => setRenew(null)} />}
    </div>
  );
}
