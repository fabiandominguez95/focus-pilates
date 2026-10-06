import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { buildIndex, ocupacionMap, slotKey, recupRestante } from './logic';
import { Sheet, Field, useConfirm } from './ui';
import { addDays, diffDays, fmtDate, fmtLong, hm, minToTime, normPhone, primerNombre, timeToMin, waLink, fillTpl, phonePretty, today, DIAS3 } from './util';

export const MOTIVOS: [string, string][] = [['aviso', 'Avisó'], ['aviso_tarde', 'Avisó tarde'], ['no_aviso', 'No avisó'], ['clima', 'Clima'], ['justificada', 'Justificada']];
export const motivoLabel = (m?: string) => (MOTIVOS.find((x) => x[0] === m) || [0, m || ''])[1];
export const TIPO_LABEL: Record<string, string> = { regular: 'Clase', prueba: 'Prueba', recuperacion: 'Recuperación', unica: 'Clase única' };

export function horasDisponibles(cfg: any) {
  const a = timeToMin(cfg.apertura), c = timeToMin(cfg.cierre), step = cfg.duracion_min || 60; const out: string[] = [];
  for (let m = a; m + step <= c; m += step) out.push(minToTime(m)); return out;
}

export function useClassOps() {
  const { d, cfg, me, upd, ins, toast } = useApp();
  const profeDefault = me?.profesora_id || d.profesoras.find((p: any) => p.tipo === 'fija' && p.activa !== false)?.id || null;
  const run = async (fn: () => Promise<any>, ok?: string) => { try { await fn(); if (ok) toast(ok); return true; } catch (e: any) { toast('Error: ' + e.message); return false; } };
  return {
    profeDefault,
    asistio: (c: any) => run(() => upd('clases', c.id, { estado: 'asistio', a_confirmar: false, profesora_id: c.profesora_id || profeDefault, motivo_ausencia: null }), 'Clase dada ✓'),
    deshacer: (c: any) => run(() => upd('clases', c.id, { estado: 'agendada', a_confirmar: false, motivo_ausencia: null, ausencia_resolucion: null }), 'Vuelta a agendada'),
    ausente: (c: any, motivo: string) => run(() => upd('clases', c.id, { estado: 'ausente', motivo_ausencia: motivo, a_confirmar: false }), 'Ausencia registrada'),
    aConfirmar: (c: any) => run(() => upd('clases', c.id, { estado: 'no_dada', a_confirmar: true }), 'Pasó a "A confirmar"'),
    reagendar: (c: any, fecha: string, hora: string) => run(() => upd('clases', c.id, { fecha, hora, estado: 'agendada', a_confirmar: false, fecha_original: c.fecha_original || c.fecha, hora_original: c.hora_original || c.hora }), 'Clase reagendada'),
    noRecupera: (c: any) => run(() => upd('clases', c.id, { ausencia_resolucion: 'no_recupera' }), 'Marcada como "no recupera"'),
    recuperar: async (c: any, fecha: string, hora: string, excepcion: boolean) => run(async () => {
      await ins('clases', { persona_id: c.persona_id, fecha, hora, tipo: 'recuperacion', estado: 'agendada', recupera_de: c.id, fecha_original: c.fecha, hora_original: c.hora, excepcion, profesora_id: profeDefault });
      await upd('clases', c.id, { ausencia_resolucion: 'recuperada' });
    }, excepcion ? 'Recuperación con excepción agendada' : 'Recuperación agendada'),
    crear: (row: any) => run(async () => { await ins('clases', { estado: 'agendada', profesora_id: profeDefault, ...row }); }, 'Clase agendada'),
    papelera: (c: any) => run(() => upd('clases', c.id, { deleted_at: new Date().toISOString() }), 'Enviada a papelera'),
    avisoLog: (persona_id: string, tipo: string, ref: string) => run(() => ins('avisos', { persona_id, tipo, ref, usuario: me?.nick })),
  };
}

export function useWhats() {
  const { cfg, d, me, ins } = useApp();
  return (p: any, tipo: string, vars: Record<string, string>, log?: { tipo: string; ref: string }) => {
    const tel = normPhone(p.celular || '', cfg.pais_tel);
    if (!tel) { alert('Esta persona no tiene celular cargado'); return; }
    const txt = fillTpl(cfg.plantillas[tipo] || '', { nombre: primerNombre(p.nombre), ...vars });
    window.open(waLink(tel, txt), '_blank');
    if (log) ins('avisos', { persona_id: p.id, tipo: log.tipo, ref: log.ref, usuario: me?.nick }).catch(() => {});
  };
}

// Selector de fecha + hora con ocupación
export function SlotPicker({ fecha, hora, onChange, ignoreId }: { fecha: string; hora: string; onChange: (f: string, h: string) => void; ignoreId?: string }) {
  const { d, cfg } = useApp();
  const occ = useMemo(() => {
    const m = new Map<string, number>();
    d.clases.forEach((c: any) => { if (c.id !== ignoreId && (c.estado === 'agendada' || c.estado === 'asistio')) m.set(slotKey(c.fecha, c.hora), (m.get(slotKey(c.fecha, c.hora)) || 0) + 1); });
    return m;
  }, [d.clases, ignoreId]);
  const bloq = d.bloqueos.filter((b: any) => b.fecha === fecha);
  const horas = horasDisponibles(cfg);
  return (
    <div>
      <div className="row"><input type="date" value={fecha} onChange={(e) => onChange(e.target.value, hora)} style={{ flex: 1 }} /><span className="muted small">{fecha && fmtLong(fecha)}</span></div>
      <div className="slots">
        {horas.map((h) => {
          const n = occ.get(slotKey(fecha, h)) || 0; const blocked = bloq.some((b: any) => b.hora_desde && b.hora_hasta && timeToMin(hm(b.hora_desde)) < timeToMin(h) + 60 && timeToMin(hm(b.hora_hasta)) > timeToMin(h));
          return <button key={h} className={'slot' + (h === hora ? ' on' : '') + (n >= cfg.cupo ? ' full' : '') + (blocked ? ' blk' : '')} onClick={() => onChange(fecha, h)}><b>{h}</b><small>{blocked ? 'bloq.' : `${n}/${cfg.cupo}`}</small></button>;
        })}
      </div>
    </div>
  );
}
export function useSlotCheck() {
  const { d, cfg } = useApp(); const { ask, node } = useConfirm();
  const check = async (fecha: string, hora: string, ignoreId?: string) => {
    const n = d.clases.filter((c: any) => c.id !== ignoreId && c.fecha === fecha && hm(c.hora) === hm(hora) && (c.estado === 'agendada' || c.estado === 'asistio')).length;
    if (n >= cfg.cupo) { if (!(await ask(`Ese horario ya tiene ${n}/${cfg.cupo} lugares ocupados. ¿Agendar igual?`))) return false; }
    const b = d.bloqueos.find((x: any) => x.fecha === fecha && x.hora_desde && timeToMin(hm(x.hora_desde)) < timeToMin(hora) + 60 && timeToMin(hm(x.hora_hasta)) > timeToMin(hora));
    if (b) { if (!(await ask(`Hay un bloqueo en ese horario (${b.motivo}). ¿Agendar igual?`))) return false; }
    return true;
  };
  return { check, node };
}

export function ClassSheet({ c, onClose, onOpenPersona }: { c: any; onClose: () => void; onOpenPersona?: (id: string) => void }) {
  const { d, cfg, hoy, isAdmin } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const ops = useClassOps(); const wa = useWhats(); const { check, node } = useSlotCheck();
  const cur = idx.clasesById.get(c.id) || c; const p = idx.personaById.get(cur.persona_id);
  const [mode, setMode] = useState<'' | 'ausente' | 'mover' | 'recuperar'>('');
  const [f, setF] = useState(cur.fecha); const [h, setH] = useState(hm(cur.hora)); const [exc, setExc] = useState(false);
  const profe = idx.profById.get(cur.profesora_id);
  const left = cur.estado === 'ausente' ? recupRestante(cur, hoy, cfg.recup_dias) : null;
  const done = async (p: Promise<boolean>) => { if (await p) onClose(); };
  const orig = cur.recupera_de ? idx.clasesById.get(cur.recupera_de) : null;
  if (!p) return null;
  const fueraPlazo = mode === 'recuperar' && diffDays(f, cur.fecha) > cfg.recup_dias;
  return (
    <Sheet title={p.nombre} onClose={onClose}>
      {node}
      <div className="kv"><span>{TIPO_LABEL[cur.tipo]}{cur.excepcion ? ' · con excepción' : ''}</span><b>{fmtLong(cur.fecha)} · {hm(cur.hora)}</b></div>
      <div className="kv"><span>Estado</span><b>{({ agendada: 'Agendada', asistio: 'Asistió ✓', ausente: 'Ausente', no_dada: 'No se dio' } as any)[cur.estado]}{cur.motivo_ausencia ? ` · ${motivoLabel(cur.motivo_ausencia)}` : ''}</b></div>
      {profe && <div className="kv"><span>Profe</span><b>{profe.nombre}</b></div>}
      {cur.fecha_original && cur.fecha_original !== cur.fecha && <div className="kv"><span>{cur.tipo === 'recuperacion' ? 'Faltó el' : 'Original'}</span><b>{fmtDate(cur.fecha_original)} {hm(cur.hora_original)}</b></div>}
      {orig && <div className="kv"><span>Ausencia vinculada</span><b>{fmtDate(orig.fecha)} · {motivoLabel(orig.motivo_ausencia)}</b></div>}
      {cur.estado === 'ausente' && cur.ausencia_resolucion === 'recuperada' && <div className="kv"><span>Recuperada</span><b>sí ↺</b></div>}
      {cur.estado === 'ausente' && !cur.ausencia_resolucion && <div className="kv"><span>Plazo para recuperar</span><b>{left! >= 0 ? `${left} días` : 'vencido (solo con excepción)'}</b></div>}

      {mode === '' && (
        <div className="stack" style={{ marginTop: 14 }}>
          {cur.estado === 'agendada' && (<>
            <button className="btn big ok" onClick={() => done(ops.asistio(cur))}>✓ Asistió / se dio la clase</button>
            <div className="row2"><button className="btn" onClick={() => setMode('ausente')}>No vino</button><button className="btn" onClick={() => setMode('mover')}>No se dio · reagendar</button></div>
            <button className="btn ghost" onClick={() => done(ops.aConfirmar(cur))}>No se dio · reagendar después (A confirmar)</button>
          </>)}
          {cur.estado === 'no_dada' && <button className="btn big" onClick={() => setMode('mover')}>Reagendar ahora</button>}
          {cur.estado === 'ausente' && !cur.ausencia_resolucion && (<div className="row2">
            <button className="btn big" onClick={() => { setF(hoy); setH(''); setMode('recuperar'); }}>↺ Recuperar</button>
            <button className="btn ghost" onClick={() => done(ops.noRecupera(cur))}>No recupera</button></div>)}
          {(cur.estado === 'asistio' || cur.estado === 'ausente' || cur.estado === 'no_dada') && <button className="btn ghost" onClick={() => done(ops.deshacer(cur))}>Deshacer (volver a agendada)</button>}
          <div className="row2">
            {cur.estado === 'agendada' && <button className="btn ghost" onClick={() => wa(p, 'confirmacion', { hora: hm(cur.hora) })}>WhatsApp</button>}
            {onOpenPersona && <button className="btn ghost" onClick={() => { onClose(); onOpenPersona(p.id); }}>Ver perfil</button>}
          </div>
          {isAdmin && <button className="btn danger ghost" onClick={() => done(ops.papelera(cur))}>Enviar a papelera</button>}
        </div>
      )}
      {mode === 'ausente' && (
        <div className="stack" style={{ marginTop: 14 }}><b>Motivo de la ausencia</b>
          <div className="chips wrap">{MOTIVOS.map(([k, l]) => <button key={k} className="chip" onClick={() => done(ops.ausente(cur, k))}>{l}</button>)}</div>
          <button className="btn ghost" onClick={() => setMode('')}>Volver</button></div>
      )}
      {(mode === 'mover' || mode === 'recuperar') && (
        <div className="stack" style={{ marginTop: 14 }}><b>{mode === 'recuperar' ? 'Nueva fecha de recuperación' : 'Nueva fecha y hora'}</b>
          <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} ignoreId={cur.id} />
          {fueraPlazo && <label className="check warn"><input type="checkbox" checked={exc} onChange={(e) => setExc(e.target.checked)} /> Fuera del plazo de {cfg.recup_dias} días: recuperar con excepción</label>}
          <div className="row2"><button className="btn ghost" onClick={() => setMode('')}>Volver</button>
            <button className="btn" disabled={!h || (fueraPlazo && !exc)} onClick={async () => { if (!(await check(f, h, cur.id))) return; done(mode === 'recuperar' ? ops.recuperar(cur, f, h, fueraPlazo && exc) : ops.reagendar(cur, f, h)); }}>Guardar</button></div>
        </div>
      )}
    </Sheet>
  );
}

export function NewClassSheet({ onClose, presetFecha, presetHora, presetPersona }: { onClose: () => void; presetFecha?: string; presetHora?: string; presetPersona?: string }) {
  const { d, hoy, upd } = useApp(); const ops = useClassOps(); const { check, node } = useSlotCheck(); const { ask, node: node2 } = useConfirm();
  const [q, setQ] = useState(''); const [pid, setPid] = useState(presetPersona || ''); const [tipo, setTipo] = useState('regular');
  const [f, setF] = useState(presetFecha || hoy); const [h, setH] = useState(presetHora || '');
  const idx = useMemo(() => buildIndex(d), [d]);
  const list = useMemo(() => { const n = q.toLowerCase(); return d.personas.filter((p: any) => !n || p.nombre.toLowerCase().includes(n)).slice(0, 8); }, [q, d.personas]);
  const p = pid ? idx.personaById.get(pid) : null;
  const save = async () => {
    if (!p || !h) return;
    if (tipo === 'prueba' && !p.sin_prueba && (p.prueba_fecha || (idx.clasesByP.get(p.id) || []).some((c: any) => c.tipo === 'prueba' && c.estado === 'asistio'))) {
      if (!(await ask('Esta persona ya hizo su clase de prueba. ¿Agendar otra igual?'))) return;
    }
    if (!(await check(f, h))) return;
    if (await ops.crear({ persona_id: p.id, fecha: f, hora: h, tipo })) { if (tipo === 'prueba' && !p.prueba_fecha) upd('personas', p.id, { prueba_fecha: f }).catch(() => {}); onClose(); }
  };
  return (
    <Sheet title="Agendar clase" onClose={onClose}>
      {node}{node2}
      <div className="stack">
        {!presetPersona && <Field label="Persona"><input placeholder="Buscar nombre…" value={p ? p.nombre : q} onChange={(e) => { setQ(e.target.value); setPid(''); }} />
          {!p && q && <div className="pick">{list.map((x: any) => <button key={x.id} onClick={() => { setPid(x.id); setQ(''); }}>{x.nombre}</button>)}{!list.length && <small className="muted">Sin resultados. Creala primero en Clientes.</small>}</div>}</Field>}
        <Field label="Tipo"><div className="chips">{([['regular', 'Clase'], ['prueba', 'Prueba'], ['unica', 'Clase única']] as const).map(([k, l]) => <button key={k} className={'chip' + (tipo === k ? ' on' : '')} onClick={() => setTipo(k)}>{l}</button>)}</div></Field>
        <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} />
        <button className="btn big" disabled={!p || !h} onClick={save}>Agendar</button>
      </div>
    </Sheet>
  );
}
export { DIAS3, addDays, phonePretty, today };
