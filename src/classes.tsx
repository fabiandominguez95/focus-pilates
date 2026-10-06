import React, { useMemo, useRef, useState } from 'react';
import { useApp } from './store';
import { buildIndex, slotKey, recupRestante, horasDisponibles } from './logic';
import { Sheet, Field, useConfirm } from './ui';
import { PersonaPicker } from './picker';
import { RenewSheet } from './subs';
import { diffDays, fmtDate, fmtLong, hm, normPhone, primerNombre, timeToMin, waLink, fillTpl, DIAS3, dowISO } from './util';

export { horasDisponibles };
export const MOTIVOS: [string, string][] = [['aviso', 'Avisó'], ['aviso_tarde', 'Avisó tarde'], ['no_aviso', 'No avisó'], ['clima', 'Clima'], ['justificada', 'Justificada']];
export const motivoLabel = (m?: string) => (MOTIVOS.find((x) => x[0] === m) || [0, m || ''])[1];
export const TIPO_LABEL: Record<string, string> = { regular: 'Clase', prueba: 'Prueba', recuperacion: 'Recuperación', unica: 'Clase única' };

export function useClassOps() {
  const { d, me, upd, ins, toast } = useApp();
  const profeDefault = me?.profesora_id || d.profesoras.find((p: any) => p.tipo === 'fija' && p.activa !== false)?.id || null;
  const run = async (fn: () => Promise<any>, ok?: string) => { try { await fn(); if (ok) toast(ok); return true; } catch (e: any) { toast('Error: ' + e.message); return false; } };
  return {
    profeDefault,
    asistio: (c: any) => run(() => upd('clases', c.id, { estado: 'asistio', a_confirmar: false, profesora_id: c.profesora_id || profeDefault, motivo_ausencia: null }), 'Clase dada ✓'),
    deshacer: (c: any) => run(() => upd('clases', c.id, { estado: 'agendada', a_confirmar: false, motivo_ausencia: null, ausencia_resolucion: null }), 'Vuelta a agendada'),
    ausente: (c: any, motivo: string) => run(() => upd('clases', c.id, { estado: 'ausente', motivo_ausencia: motivo, a_confirmar: false }), 'Ausencia registrada'),
    recordarMasTarde: (c: any) => run(() => upd('clases', c.id, { estado: 'no_dada', a_confirmar: true }), 'Quedó pendiente de reagendar'),
    reagendar: (c: any, fecha: string, hora: string) => run(() => upd('clases', c.id, { fecha, hora, estado: 'agendada', a_confirmar: false, fecha_original: c.fecha_original || c.fecha, hora_original: c.hora_original || c.hora }), 'Clase reagendada'),
    noRecupera: (c: any) => run(() => upd('clases', c.id, { ausencia_resolucion: 'no_recupera' }), 'Marcada como "no recupera"'),
    recuperar: async (c: any, fecha: string, hora: string, excepcion: boolean) => run(async () => {
      await ins('clases', { persona_id: c.persona_id, fecha, hora, tipo: 'recuperacion', estado: 'agendada', recupera_de: c.id, fecha_original: c.fecha, hora_original: c.hora, excepcion, profesora_id: profeDefault });
      await upd('clases', c.id, { ausencia_resolucion: 'recuperada' });
    }, excepcion ? 'Recuperación con excepción agendada' : 'Recuperación agendada'),
    crear: (row: any) => run(async () => { await ins('clases', { estado: 'agendada', profesora_id: profeDefault, ...row }); }, 'Clase agendada'),
    papelera: (c: any) => run(() => upd('clases', c.id, { deleted_at: new Date().toISOString() }), 'Enviada a papelera'),
  };
}

export function useWhats() {
  const { cfg, me, ins } = useApp();
  return (p: any, tipo: string, vars: Record<string, string>, log?: { tipo: string; ref: string }) => {
    const tel = normPhone(p.celular || '', cfg.pais_tel);
    if (!tel) { alert('Esta persona no tiene celular cargado'); return; }
    const txt = fillTpl(cfg.plantillas[tipo] || '', { nombre: primerNombre(p.nombre), ...vars });
    window.open(waLink(tel, txt), '_blank');
    if (log) ins('avisos', { persona_id: p.id, tipo: log.tipo, ref: log.ref, usuario: me?.nick }).catch(() => {});
  };
}
// Botón discreto, redondo y claro para escribir por WhatsApp
export function WaDot({ onClick, done, title = 'Escribir por WhatsApp' }: { onClick: () => void; done?: boolean; title?: string }) {
  return (
    <button type="button" className={'wadot' + (done ? ' done' : '')} title={title} aria-label={title} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {done ? '✓' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.5 8.5 0 1 1 21 11.5Z" /></svg>}
    </button>
  );
}

// Mantener presionado (celular) o clic derecho (PC)
export function useLongPress(cb: () => void) {
  const t = useRef<any>(); const fired = useRef(false);
  const clear = () => clearTimeout(t.current);
  return {
    onTouchStart: () => { fired.current = false; t.current = setTimeout(() => { fired.current = true; cb(); }, 480); },
    onTouchEnd: (e: any) => { clear(); if (fired.current) e.preventDefault(); },
    onTouchMove: clear, onTouchCancel: clear,
    onContextMenu: (e: any) => { e.preventDefault(); cb(); },
  };
}
export function QuienesSheet({ fecha, hora, onClose }: { fecha: string; hora: string; onClose: () => void }) {
  const { d, cfg } = useApp(); const idx = useMemo(() => buildIndex(d), [d]);
  const cs = d.clases.filter((c: any) => c.fecha === fecha && hm(c.hora) === hora && (c.estado === 'agendada' || c.estado === 'asistio'));
  const dow = dowISO(fecha);
  const fijos = d.horarios.filter((h: any) => h.activo !== false && h.dia === dow && hm(h.hora) === hora && !cs.some((c: any) => c.persona_id === h.persona_id));
  return (
    <Sheet title={`${fmtLong(fecha)} · ${hora}`} onClose={onClose}>
      <div className="muted small" style={{ marginBottom: 6 }}>{cs.length}/{cfg.cupo} lugares ocupados</div>
      {cs.length === 0 && <div className="muted">Nadie agendada en este horario.</div>}
      {cs.map((c: any) => <div className="kv" key={c.id}><b style={{ textAlign: 'left' }}>{idx.personaById.get(c.persona_id)?.nombre}</b><span>{TIPO_LABEL[c.tipo]}{c.estado === 'asistio' ? ' ✓' : ''}</span></div>)}
      {fijos.length > 0 && <><h3>Tienen este horario fijo (sin clase ese día)</h3>{fijos.map((h: any) => <div className="kv" key={h.id}><b style={{ textAlign: 'left' }}>{idx.personaById.get(h.persona_id)?.nombre}</b><span>fija</span></div>)}</>}
    </Sheet>
  );
}

// Selector de fecha + hora (en punto) con ocupación. Mantener presionado en una hora = ver quiénes están.
export function SlotPicker({ fecha, hora, onChange, ignoreId }: { fecha: string; hora: string; onChange: (f: string, h: string) => void; ignoreId?: string }) {
  const { d, cfg } = useApp(); const [who, setWho] = useState<string | null>(null);
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
        {horas.map((h) => <SlotBtn key={h} h={h} on={h === hora} n={occ.get(slotKey(fecha, h)) || 0} cupo={cfg.cupo} blocked={bloq.some((b: any) => b.hora_desde && b.hora_hasta && timeToMin(hm(b.hora_desde)) < timeToMin(h) + 60 && timeToMin(hm(b.hora_hasta)) > timeToMin(h))} onPick={() => onChange(fecha, h)} onWho={() => setWho(h)} />)}
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>Mantené presionada una hora para ver quiénes están.</div>
      {who && <QuienesSheet fecha={fecha} hora={who} onClose={() => setWho(null)} />}
    </div>
  );
}
function SlotBtn({ h, on, n, cupo, blocked, onPick, onWho }: any) {
  const lp = useLongPress(onWho);
  return <button type="button" {...lp} className={'slot' + (on ? ' on' : '') + (n >= cupo ? ' full' : '') + (blocked ? ' blk' : '')} onClick={onPick}><b>{h}</b><small>{blocked ? 'bloq.' : `${n}/${cupo}`}</small></button>;
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
  const [mode, setMode] = useState<'' | 'ausente' | 'mover' | 'recuperar'>(''); const [otros, setOtros] = useState(false); const [inscribir, setInscribir] = useState(false);
  const [f, setF] = useState(cur.fecha); const [h, setH] = useState(hm(cur.hora)); const [exc, setExc] = useState(false);
  const profe = idx.profById.get(cur.profesora_id);
  const left = cur.estado === 'ausente' ? recupRestante(cur, hoy, cfg.recup_dias) : null;
  const done = async (pr: Promise<boolean>) => { if (await pr) onClose(); };
  const orig = cur.recupera_de ? idx.clasesById.get(cur.recupera_de) : null;
  if (!p) return null;
  const fueraPlazo = mode === 'recuperar' && diffDays(f, cur.fecha) > cfg.recup_dias;
  const esPrueba = cur.tipo === 'prueba';
  return (
    <Sheet title={p.nombre} onClose={onClose}>
      {node}
      <div className="kv"><span>{TIPO_LABEL[cur.tipo]}{cur.excepcion ? ' · con excepción' : ''}</span><b>{fmtLong(cur.fecha)} · {hm(cur.hora)}</b></div>
      <div className="kv"><span>Estado</span><b>{({ agendada: 'Agendada', asistio: 'Asistió ✓', ausente: 'Ausente', no_dada: 'Pendiente de reagendar' } as any)[cur.estado]}{cur.motivo_ausencia ? ` · ${motivoLabel(cur.motivo_ausencia)}` : ''}</b></div>
      {profe && <div className="kv"><span>Profe</span><b>{profe.nombre}</b></div>}
      {cur.fecha_original && cur.fecha_original !== cur.fecha && <div className="kv"><span>{cur.tipo === 'recuperacion' ? 'Faltó el' : 'Original'}</span><b>{fmtDate(cur.fecha_original)} {hm(cur.hora_original)}</b></div>}
      {orig && <div className="kv"><span>Ausencia vinculada</span><b>{fmtDate(orig.fecha)} · {motivoLabel(orig.motivo_ausencia)}</b></div>}
      {cur.estado === 'ausente' && cur.ausencia_resolucion === 'recuperada' && <div className="kv"><span>Recuperada</span><b>sí ↺</b></div>}
      {cur.estado === 'ausente' && !cur.ausencia_resolucion && <div className="kv"><span>Plazo para recuperar</span><b>{left! >= 0 ? `${left} días` : 'vencido (solo con excepción)'}</b></div>}

      {mode === '' && (
        <div className="stack" style={{ marginTop: 14 }}>
          {cur.estado === 'agendada' && (<>
            <button className="btn big ok" onClick={() => done(ops.asistio(cur))}>✓ Asistió</button>
            {esPrueba && <button className="btn big" onClick={async () => { if (await ops.asistio(cur)) setInscribir(true); }}>Asistió y se inscribió →</button>}
            <div className="row2"><button className="btn" onClick={() => setMode('ausente')}>No vino</button><button className="btn" onClick={() => setMode('mover')}>Reagendar</button></div>
          </>)}
          {cur.estado === 'asistio' && esPrueba && <button className="btn big" onClick={() => setInscribir(true)}>Se inscribió: elegir plan y horarios →</button>}
          {cur.estado === 'no_dada' && <button className="btn big" onClick={() => setMode('mover')}>Reagendar ahora</button>}
          {cur.estado === 'ausente' && !cur.ausencia_resolucion && (<div className="row2">
            <button className="btn big" onClick={() => { setF(hoy); setH(''); setMode('recuperar'); }}>↺ Recuperar</button>
            <button className="btn ghost" onClick={() => done(ops.noRecupera(cur))}>No recupera</button></div>)}
          {(cur.estado === 'asistio' || cur.estado === 'ausente' || cur.estado === 'no_dada') && <button className="btn ghost" onClick={() => done(ops.deshacer(cur))}>Deshacer (volver a agendada)</button>}
          <div className="row2">
            {cur.estado === 'agendada' && <button className="btn ghost" onClick={() => wa(p, 'confirmacion', { hora: hm(cur.hora) })}>Escribirle</button>}
            {onOpenPersona && <button className="btn ghost" onClick={() => { onClose(); onOpenPersona(p.id); }}>Ver perfil</button>}
          </div>
          {isAdmin && <button className="btn danger ghost" onClick={() => done(ops.papelera(cur))}>Enviar a papelera</button>}
        </div>
      )}
      {mode === 'ausente' && (
        <div className="stack" style={{ marginTop: 14 }}><b>¿Avisó?</b>
          <div className="row2"><button className="btn big" onClick={() => done(ops.ausente(cur, 'aviso'))}>Avisó</button><button className="btn big" onClick={() => done(ops.ausente(cur, 'no_aviso'))}>No avisó</button></div>
          {!otros ? <button className="btn ghost sm" onClick={() => setOtros(true)}>Otro motivo…</button>
            : <div className="chips wrap">{MOTIVOS.filter((m) => m[0] !== 'aviso' && m[0] !== 'no_aviso').map(([k, l]) => <button key={k} className="chip" onClick={() => done(ops.ausente(cur, k))}>{l}</button>)}</div>}
          <button className="btn ghost" onClick={() => setMode('')}>Volver</button></div>
      )}
      {(mode === 'mover' || mode === 'recuperar') && (
        <div className="stack" style={{ marginTop: 14 }}><b>{mode === 'recuperar' ? 'Nueva fecha de recuperación' : 'Nueva fecha y hora'}</b>
          <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} ignoreId={cur.id} />
          {fueraPlazo && <label className="check warn"><input type="checkbox" checked={exc} onChange={(e) => setExc(e.target.checked)} /> Fuera del plazo de {cfg.recup_dias} días: recuperar con excepción</label>}
          <button className="btn big" disabled={!h || (fueraPlazo && !exc)} onClick={async () => { if (!(await check(f, h, cur.id))) return; done(mode === 'recuperar' ? ops.recuperar(cur, f, h, fueraPlazo && exc) : ops.reagendar(cur, f, h)); }}>Guardar</button>
          {mode === 'mover' && cur.estado !== 'no_dada' && <button className="btn ghost" onClick={() => done(ops.recordarMasTarde(cur))}>Todavía no sabe cuándo: recordar más tarde</button>}
          <button className="btn ghost" onClick={() => setMode('')}>Volver</button>
        </div>
      )}
      {inscribir && <RenewSheet persona={p} onClose={() => { setInscribir(false); onClose(); }} />}
    </Sheet>
  );
}

export function NewClassSheet({ onClose, presetFecha, presetHora, presetPersona }: { onClose: () => void; presetFecha?: string; presetHora?: string; presetPersona?: string }) {
  const { d, hoy, upd, cfg } = useApp(); const ops = useClassOps(); const { check, node } = useSlotCheck(); const { ask, node: node2 } = useConfirm();
  const [pid, setPid] = useState(presetPersona || ''); const [tipo, setTipo] = useState('prueba'); const [aus, setAus] = useState(''); const [sinFalta, setSinFalta] = useState(false);
  const [f, setF] = useState(presetFecha || hoy); const [h, setH] = useState(presetHora || ''); const [exc, setExc] = useState(false);
  const idx = useMemo(() => buildIndex(d), [d]);
  const p = pid ? idx.personaById.get(pid) : null;
  const faltas = useMemo(() => (p ? (idx.clasesByP.get(p.id) || []).filter((c: any) => c.estado === 'ausente' && !c.ausencia_resolucion && c.tipo !== 'prueba').sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)) : []), [p, idx]);
  const falta = faltas.find((x: any) => x.id === aus);
  const fueraPlazo = tipo === 'recuperacion' && falta && diffDays(f, falta.fecha) > cfg.recup_dias;
  const listo = !!p && !!h && (tipo !== 'recuperacion' || sinFalta || (falta && (!fueraPlazo || exc)));
  const save = async () => {
    if (!p || !h) return;
    if (tipo === 'prueba' && !p.sin_prueba && (p.prueba_fecha || (idx.clasesByP.get(p.id) || []).some((c: any) => c.tipo === 'prueba' && c.estado === 'asistio'))) {
      if (!(await ask('Esta persona ya hizo su clase de prueba. ¿Agendar otra igual?'))) return;
    }
    if (!(await check(f, h))) return;
    let ok = false;
    if (tipo === 'recuperacion' && falta) ok = await ops.recuperar(falta, f, h, !!fueraPlazo && exc);
    else ok = await ops.crear({ persona_id: p.id, fecha: f, hora: h, tipo });
    if (ok) { if (tipo === 'prueba' && !p.prueba_fecha) upd('personas', p.id, { prueba_fecha: f }).catch(() => {}); onClose(); }
  };
  return (
    <Sheet title="Agendar clase" onClose={onClose}>
      {node}{node2}
      <div className="stack">
        {!presetPersona && <Field label="Persona"><PersonaPicker value={pid} onChange={(v) => { setPid(v); setAus(''); }} allowCreate={tipo === 'prueba'} autoFocus /></Field>}
        <Field label="Tipo de clase"><div className="chips wrap">{([['prueba', 'Prueba (primera vez)'], ['recuperacion', 'Recuperación'], ['unica', 'Clase única (excepcional)']] as const).map(([k, l]) => <button type="button" key={k} className={'chip' + (tipo === k ? ' on' : '')} onClick={() => setTipo(k)}>{l}</button>)}</div></Field>
        {tipo === 'recuperacion' && p && (
          <Field label="¿Qué falta recupera?">
            {faltas.length === 0 ? <div className="muted small">No tiene faltas pendientes de recuperar.</div>
              : <div className="stack" style={{ gap: 6 }}>{faltas.map((x: any) => { const l = recupRestante(x, hoy, cfg.recup_dias); return <button type="button" key={x.id} className={'opt' + (aus === x.id ? ' on' : '')} onClick={() => { setAus(x.id); setSinFalta(false); }}><b>{fmtDate(x.fecha)} · {hm(x.hora)}</b><span className="muted small">{motivoLabel(x.motivo_ausencia)} · {l >= 0 ? `quedan ${l} días` : 'plazo vencido (excepción)'}</span></button>; })}</div>}
            <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={sinFalta} onChange={(e) => { setSinFalta(e.target.checked); if (e.target.checked) setAus(''); }} /> Recuperación sin falta registrada</label>
          </Field>)}
        <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} />
        {fueraPlazo && <label className="check warn"><input type="checkbox" checked={exc} onChange={(e) => setExc(e.target.checked)} /> Fuera del plazo de {cfg.recup_dias} días: recuperar con excepción</label>}
        <button className="btn big" disabled={!listo} onClick={save}>Agendar</button>
      </div>
    </Sheet>
  );
}
export { DIAS3 };
