import React, { useMemo, useRef, useState } from 'react';
import { useApp } from './store';
import { buildIndex, slotKey, recupRestante, horasDisponibles, sinCulpa, cambioHora, bloqAplica } from './logic';
import { Sheet, Field, useConfirm } from './ui';
import { PersonaPicker } from './picker';
import { RenewSheet } from './subs';
import { feriados, diffDays, fmtDate, fmtLong, hm, normPhone, primerNombre, timeToMin, waLink, fillTpl, DIAS3, dowISO } from './util';

export { horasDisponibles };
export const MOTIVOS: [string, string][] = [['aviso', 'Avisó'], ['aviso_tarde', 'Avisó tarde'], ['no_aviso', 'No avisó'], ['clima', 'Clima'], ['justificada', 'Justificada'], ['feriado', 'Feriado'], ['cancela_estudio', 'Cancelada por el estudio']];
export const MOTIVOS_NUEVOS: [string, string][] = [['aviso', 'Avisó'], ['no_aviso', 'No avisó'], ['feriado', 'Feriado'], ['cancela_estudio', 'Cancelamos nosotros']];
export const motivoLabel = (m?: string) => (MOTIVOS.find((x) => x[0] === m) || [0, m || ''])[1];
export const TIPO_LABEL: Record<string, string> = { regular: 'Clase', prueba: 'Prueba', recuperacion: 'Recuperación', unica: 'Clase única' };

const FER_CACHE: Record<string, Promise<string[]>> = {};
export function useFeriadoSet() {
  const { cfg, hoy } = useApp(); const [set, setSet] = useState<Set<string>>(new Set());
  React.useEffect(() => {
    let off = false; const y = Number(hoy.slice(0, 4));
    Promise.all([y, y + 1].map((yy) => (FER_CACHE[yy + cfg.pais] ||= feriados(String(yy), cfg.pais).then((r) => r.list.map(([f]) => f)).catch(() => []))))
      .then((a) => { if (!off) setSet(new Set(a.flat())); });
    return () => { off = true; };
  }, [cfg.pais, hoy]);
  return set;
}

export function useClassOps() {
  const { d, me, upd, ins, toast } = useApp();
  const profeDefault = me?.profesora_id || d.profesoras.find((p: any) => p.tipo === 'fija' && p.activa !== false)?.id || null;
  const run = async (fn: () => Promise<any>, ok?: string) => { try { await fn(); if (ok) toast(ok); return true; } catch (e: any) { toast('Error: ' + e.message); return false; } };
  return {
    profeDefault,
    asistio: (c: any) => run(() => upd('clases', c.id, { estado: 'asistio', a_confirmar: false, profesora_id: c.profesora_id || profeDefault, motivo_ausencia: null }), 'Clase dada ✓'),
    deshacer: (c: any) => run(() => upd('clases', c.id, { estado: 'agendada', a_confirmar: false, motivo_ausencia: null, nota_ausencia: null, ausencia_resolucion: null }), 'Vuelta a agendada'),
    ausente: (c: any, motivo: string, nota?: string) => run(() => upd('clases', c.id, { estado: 'ausente', motivo_ausencia: motivo, nota_ausencia: nota?.trim() || null, a_confirmar: false }), 'Clase no dada registrada'),
    cambiarHora: (c: any, hora: string) => run(() => upd('clases', c.id, { hora, fecha_original: c.fecha_original || c.fecha, hora_original: c.hora_original || c.hora }), 'Hora cambiada solo por hoy'),
    reagendar: (c: any, fecha: string, hora: string) => run(() => upd('clases', c.id, { fecha, hora, estado: 'agendada', a_confirmar: false, fecha_original: c.fecha_original || c.fecha, hora_original: c.hora_original || c.hora }), 'Clase reagendada'),
    noRecupera: (c: any) => run(() => upd('clases', c.id, { ausencia_resolucion: 'no_recupera' }), 'Marcada como "no recupera"'),
    recuperar: async (c: any, fecha: string, hora: string, excepcion: boolean) => run(async () => {
      await ins('clases', { persona_id: c.persona_id, fecha, hora, tipo: c.tipo === 'prueba' ? 'prueba' : 'recuperacion', estado: 'agendada', recupera_de: c.id, fecha_original: c.fecha, hora_original: c.hora, excepcion, profesora_id: profeDefault });
      await upd('clases', c.id, { ausencia_resolucion: 'recuperada' });
    }, excepcion ? 'Recuperación con excepción agendada' : 'Recuperación agendada'),
    crear: (row: any) => run(async () => { await ins('clases', { estado: 'agendada', profesora_id: profeDefault, ...row }); }, 'Clase agendada'),
    papelera: (c: any) => run(() => upd('clases', c.id, { deleted_at: new Date().toISOString() }), 'Enviada a papelera'),
  };
}

export function useUndoAviso() {
  const { d, upd, toast } = useApp();
  return async (personaId: string, tipo: string, ref: string) => {
    const rows = d.avisos.filter((a: any) => a.persona_id === personaId && a.tipo === tipo && a.ref === ref);
    try { for (const a of rows) await upd('avisos', a.id, { deleted_at: new Date().toISOString() }); toast('Marca quitada'); } catch (e: any) { toast('Error: ' + e.message); }
  };
}
export const DEFAULT_TPL: Record<string, string> = {
  recuperar_pendientes: 'Hola {nombre}! Tenés pendiente recuperar {fechas}.{plazo} ¿Me avisás para cuándo las agendamos? 🙌',
  prueba_post1: 'Hola {nombre}! ¿Cómo te fue en tu clase de prueba del {fecha}? Nos encantaría saber qué te pareció y ayudarte a elegir tu plan 💛',
  prueba_post2: 'Hola {nombre}! Te escribimos de Focus Pilates: todavía tenemos lugares disponibles para que arranques. ¿Querés que te reservemos un horario? 🤍',
  prueba_reag1: 'Hola {nombre}! Ayer te esperamos en tu clase de prueba y no pudiste venir. ¿Querés que la reagendemos para otro día? Contanos qué horario te queda cómodo 🙌',
  prueba_reag2: 'Hola {nombre}! Seguimos con un lugar para tu clase de prueba cuando quieras. ¿Te guardamos un horario esta semana? 😊',
  ofrecer_horarios: 'Hola! Tenemos lugar{personas} en estos horarios fijos: {horarios}. ¿Cuál te queda mejor?',
  prueba_previa: 'Hola {nombre}! Te recordamos que mañana {fecha} a las {hora} tenés tu clase de prueba en Focus Pilates 💛 ¿Nos confirmás que venís? Cualquier cambio avisanos.',
  prueba_hoy: 'Hola {nombre}! Hoy a las {hora} te esperamos para tu clase de prueba en Focus Pilates 🙌 Recordá venir con ropa cómoda. ¿Nos confirmás?',
};
export function useWhats() {
  const { cfg, me, ins } = useApp();
  return (p: any, tipo: string, vars: Record<string, string>, log?: { tipo: string; ref: string }) => {
    const tel = normPhone(p.celular || '', cfg.pais_tel);
    if (!tel) { alert('Esta persona no tiene celular cargado'); return; }
    const txt = fillTpl(cfg.plantillas[tipo] || DEFAULT_TPL[tipo] || '', { nombre: primerNombre(p.nombre), ...vars });
    window.open(waLink(tel, txt), '_blank');
    if (log) ins('avisos', { persona_id: p.id, tipo: log.tipo, ref: log.ref, usuario: me?.nick }).catch(() => {});
  };
}
// Botón discreto, redondo y claro para escribir por WhatsApp
export function WaDot({ onClick, done, onUndo, title = 'Escribir por WhatsApp' }: { onClick: () => void; done?: boolean; onUndo?: () => void; title?: string }) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <button type="button" className={'wadot' + (done ? ' done' : '')} title={done ? 'Ya le escribiste' : title} aria-label={done ? 'Ya le escribiste' : title} onClick={(e) => { e.stopPropagation(); if (done && onUndo) setMenu(true); else onClick(); }}>
        {done ? '✓' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.5 8.5 0 1 1 21 11.5Z" /></svg>}
      </button>
      {menu && <div onClick={(e) => e.stopPropagation()}><Sheet title="Ya le escribiste" onClose={() => setMenu(false)}>
        <div className="stack"><div className="muted">Quedó marcado que ya le escribiste. Si fue sin querer, podés sacar la marca.</div>
          <button className="btn big" onClick={() => { setMenu(false); onClick(); }}>Escribirle de nuevo</button>
          <button className="btn ghost" onClick={() => { setMenu(false); onUndo && onUndo(); }}>Quitar la marca ✓</button></div></Sheet></div>}
    </>
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
export function SlotPicker({ fecha, hora, onChange, ignoreId, lockFecha }: { fecha: string; hora: string; onChange: (f: string, h: string) => void; ignoreId?: string; lockFecha?: boolean }) {
  const { d, cfg } = useApp(); const [who, setWho] = useState<string | null>(null);
  const occ = useMemo(() => {
    const m = new Map<string, number>();
    d.clases.forEach((c: any) => { if (c.id !== ignoreId && (c.estado === 'agendada' || c.estado === 'asistio')) m.set(slotKey(c.fecha, c.hora), (m.get(slotKey(c.fecha, c.hora)) || 0) + 1); });
    return m;
  }, [d.clases, ignoreId]);
  const bloq = d.bloqueos.filter((b: any) => bloqAplica(b, fecha));
  const horas = horasDisponibles(cfg);
  return (
    <div>
      {lockFecha ? <div className="muted small">{fmtLong(fecha)}</div> : <div className="row"><input type="date" value={fecha} onChange={(e) => onChange(e.target.value, hora)} style={{ flex: 1 }} /><span className="muted small">{fecha && fmtLong(fecha)}</span></div>}
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
    const b = d.bloqueos.find((x: any) => bloqAplica(x, fecha) && x.hora_desde && timeToMin(hm(x.hora_desde)) < timeToMin(hora) + 60 && timeToMin(hm(x.hora_hasta)) > timeToMin(hora));
    if (b) { if (!(await ask(`Hay un bloqueo en ese horario (${b.motivo}). ¿Agendar igual?`))) return false; }
    return true;
  };
  return { check, node };
}

export function ClassSheet({ c, onClose, onOpenPersona, startMode = '' }: { c: any; onClose: () => void; onOpenPersona?: (id: string) => void; startMode?: '' | 'ausente' }) {
  const { d, cfg, hoy, isAdmin } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const ops = useClassOps(); const wa = useWhats(); const { check, node } = useSlotCheck(); const fer = useFeriadoSet();
  const cur = idx.clasesById.get(c.id) || c; const p = idx.personaById.get(cur.persona_id);
  const [mode, setMode] = useState<'' | 'ausente' | 'mover' | 'recuperar' | 'hora'>(startMode); const [inscribir, setInscribir] = useState(false);
  const [mot, setMot] = useState(fer.has(cur.fecha) ? 'feriado' : ''); const [nota, setNota] = useState('');
  const [f, setF] = useState(cur.fecha); const [h, setH] = useState(hm(cur.hora)); const [exc, setExc] = useState(false);
  React.useEffect(() => { if (!mot && fer.has(cur.fecha)) setMot('feriado'); }, [fer]);
  const profe = idx.profById.get(cur.profesora_id);
  const sc = sinCulpa(cur);
  const left = cur.estado === 'ausente' ? recupRestante(cur, hoy, cfg.recup_dias) : null;
  const done = async (pr: Promise<boolean>) => { if (await pr) onClose(); };
  const esPrueba = cur.tipo === 'prueba';
  const orig = cur.recupera_de ? idx.clasesById.get(cur.recupera_de) : null;
  if (!p) return null;
  const fueraPlazo = mode === 'recuperar' && !sc && diffDays(f, cur.fecha) > cfg.recup_dias;
  const seguir = async () => { if (!mot) return; if (await ops.ausente(cur, mot, nota)) { setF(hoy); setH(''); setMode('recuperar'); } };
  const estadoTxt = cur.estado === 'ausente' ? (sc ? 'No se dio' : 'Ausente') : ({ agendada: 'Agendada', asistio: 'Asistió ✓', no_dada: 'No dada' } as any)[cur.estado];
  return (
    <Sheet title={p.nombre} onClose={onClose}>
      {node}
      <div className="kv"><span>{TIPO_LABEL[cur.tipo]}{cur.excepcion ? ' · con excepción' : ''}</span><b>{fmtLong(cur.fecha)} · {hm(cur.hora)}</b></div>
      <div className="kv"><span>Estado</span><b>{estadoTxt}{cur.motivo_ausencia ? ` · ${motivoLabel(cur.motivo_ausencia)}` : ''}</b></div>
      {cur.nota_ausencia && <div className="kv"><span>Argumento</span><b style={{ fontWeight: 500 }}>{cur.nota_ausencia}</b></div>}
      {sc && cur.estado === 'ausente' && <div className="muted small" style={{ margin: '4px 0' }}>Esta clase se canceló ({cur.motivo_ausencia === 'feriado' ? 'feriado' : 'por el estudio'}). No es una falta ni corta su asistencia: se recupera sin plazo.</div>}
      {profe && <div className="kv"><span>Instructor/a</span><b>{profe.nombre}</b></div>}
      {cambioHora(cur) && <div className="kv"><span>Cambio de hora (solo ese día)</span><b>{hm(cur.hora_original)} → {hm(cur.hora)}</b></div>}
      {cur.fecha_original && cur.fecha_original !== cur.fecha && <div className="kv"><span>{cur.tipo === 'recuperacion' ? 'Faltó el' : 'Original'}</span><b>{fmtDate(cur.fecha_original)} {hm(cur.hora_original)}</b></div>}
      {orig && <div className="kv"><span>Clase que recupera</span><b>{fmtDate(orig.fecha)} · {motivoLabel(orig.motivo_ausencia)}</b></div>}
      {cur.estado === 'ausente' && cur.ausencia_resolucion === 'recuperada' && <div className="kv"><span>Recuperada</span><b>sí ↺</b></div>}
      {cur.estado === 'ausente' && !cur.ausencia_resolucion && !sc && <div className="kv"><span>Plazo para recuperar</span><b>{left! >= 0 ? `${left} días` : 'vencido (solo con excepción)'}</b></div>}

      {mode === '' && (
        <div className="stack" style={{ marginTop: 14 }}>
          {cur.estado === 'agendada' && (<>
            <div className="row2"><button className="btn big ok" onClick={() => done(ops.asistio(cur))}>✓ Se dio</button>
              <button className="btn big" onClick={() => setMode('ausente')}>No se dio</button></div>
            {esPrueba && <button className="btn big" onClick={async () => { if (await ops.asistio(cur)) setInscribir(true); }}>Se dio y se inscribió →</button>}
            <button className="btn ghost" onClick={() => { setF(cur.fecha); setH(hm(cur.hora)); setMode('hora'); }}>Cambiar la hora solo por hoy</button>
          </>)}
          {cur.estado === 'asistio' && esPrueba && <button className="btn big" onClick={() => setInscribir(true)}>Se inscribió: elegir plan y horarios →</button>}
          {cur.estado === 'ausente' && !cur.ausencia_resolucion && (<div className="row2">
            <button className="btn big" onClick={() => { setF(hoy); setH(''); setMode('recuperar'); }}>↺ Elegir fecha</button>
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
        <div className="stack" style={{ marginTop: 14 }}><b>¿Por qué no se dio?</b>
          <div className="row2">{MOTIVOS_NUEVOS.slice(0, 2).map(([k, l]) => <button key={k} className={'btn big' + (mot === k ? ' ok' : ' ghost')} onClick={() => setMot(k)}>{l}</button>)}</div>
          <div className="row2">{MOTIVOS_NUEVOS.slice(2).map(([k, l]) => <button key={k} className={'btn' + (mot === k ? ' ok' : ' ghost')} onClick={() => setMot(k)}>{l}</button>)}</div>
          {(mot === 'aviso' || mot === 'no_aviso') && <input placeholder="Argumento (opcional)" maxLength={140} value={nota} onChange={(e) => setNota(e.target.value)} />}
          {(mot === 'feriado' || mot === 'cancela_estudio') && <div className="muted small">No cuenta como falta de la persona; se recupera sin plazo.</div>}
          <button className="btn big" disabled={!mot} onClick={seguir}>{esPrueba ? 'Seguir: elegir nueva fecha de la prueba →' : 'Seguir: elegir fecha de recuperación →'}</button>
          <button className="btn ghost" onClick={() => setMode('')}>Volver</button></div>
      )}
      {mode === 'hora' && (
        <div className="stack" style={{ marginTop: 14 }}><b>Cambiar hora solo ese día</b>
          <SlotPicker fecha={cur.fecha} hora={h} lockFecha onChange={(_a, b) => setH(b)} ignoreId={cur.id} />
          <button className="btn big" disabled={!h || h === hm(cur.hora)} onClick={async () => { if (!(await check(cur.fecha, h, cur.id))) return; done(ops.cambiarHora(cur, h)); }}>Guardar</button>
          <button className="btn ghost" onClick={() => setMode('')}>Volver</button></div>
      )}
      {(mode === 'mover' || mode === 'recuperar') && (
        <div className="stack" style={{ marginTop: 14 }}><b>{cur.estado === 'ausente' ? 'Fecha de la clase de recuperación' : 'Nueva fecha y hora'}</b>
          <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} ignoreId={cur.id} />
          {fueraPlazo && <label className="check warn"><input type="checkbox" checked={exc} onChange={(e) => setExc(e.target.checked)} /> Fuera del plazo de {cfg.recup_dias} días: recuperar con excepción</label>}
          <button className="btn big" disabled={!h || (fueraPlazo && !exc)} onClick={async () => { if (!(await check(f, h, cur.id))) return; done(mode === 'recuperar' ? ops.recuperar(cur, f, h, fueraPlazo && exc) : ops.reagendar(cur, f, h)); }}>{esPrueba ? 'Guardar nueva fecha de la prueba' : 'Guardar recuperación'}</button>
          {mode === 'recuperar' && <button className="btn" onClick={onClose}>A confirmar: todavía sin fecha</button>}
          {mode === 'recuperar' && <button className="btn ghost" onClick={() => done(ops.noRecupera(cur))}>No recupera</button>}
          {mode === 'recuperar' && <div className="muted small">«A confirmar» la deja en el inicio como pendiente hasta que se defina una fecha.</div>}
        </div>
      )}
      {inscribir && <RenewSheet persona={p} onClose={() => { setInscribir(false); onClose(); }} />}
    </Sheet>
  );
}

export function NewClassSheet({ onClose, presetFecha, presetHora, presetPersona, onNuevo }: { onClose: () => void; presetFecha?: string; presetHora?: string; presetPersona?: string; onNuevo?: () => void }) {
  const { d, hoy, upd, cfg } = useApp(); const ops = useClassOps(); const { check, node } = useSlotCheck(); const { ask, node: node2 } = useConfirm();
  const [pid, setPid] = useState(presetPersona || ''); const [tipo, setTipo] = useState('prueba'); const [aus, setAus] = useState(''); const [sinFalta, setSinFalta] = useState(false);
  const [f, setF] = useState(presetFecha || hoy); const [h, setH] = useState(presetHora || ''); const [exc, setExc] = useState(false);
  const idx = useMemo(() => buildIndex(d), [d]);
  const p = pid ? idx.personaById.get(pid) : null;
  const faltas = useMemo(() => (p ? (idx.clasesByP.get(p.id) || []).filter((c: any) => c.estado === 'ausente' && !c.ausencia_resolucion && c.tipo !== 'prueba').sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)) : []), [p, idx]);
  const falta = faltas.find((x: any) => x.id === aus);
  const fueraPlazo = tipo === 'recuperacion' && falta && !sinCulpa(falta) && diffDays(f, falta.fecha) > cfg.recup_dias;
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
        {!presetPersona && <Field label="Persona"><PersonaPicker value={pid} onChange={(v) => { setPid(v); setAus(''); }} allowCreate={false} autoFocus />{onNuevo && !pid && <button type="button" className="btn ghost sm" style={{ marginTop: 6 }} onClick={onNuevo}>+ Cliente nuevo (con celular, prueba o inscripción)</button>}</Field>}
        <Field label="Tipo de clase"><div className="chips wrap">{([['prueba', 'Prueba (primera vez)'], ['recuperacion', 'Recuperación'], ['unica', 'Clase única (excepcional)']] as const).map(([k, l]) => <button type="button" key={k} className={'chip' + (tipo === k ? ' on' : '')} onClick={() => setTipo(k)}>{l}</button>)}</div></Field>
        {tipo === 'recuperacion' && p && (
          <Field label="¿Qué falta recupera?">
            {faltas.length === 0 ? <div className="muted small">No tiene faltas pendientes de recuperar.</div>
              : <div className="stack" style={{ gap: 6 }}>{faltas.map((x: any) => { const l = recupRestante(x, hoy, cfg.recup_dias); return <button type="button" key={x.id} className={'opt' + (aus === x.id ? ' on' : '')} onClick={() => { setAus(x.id); setSinFalta(false); }}><b>{fmtDate(x.fecha)} · {hm(x.hora)}</b><span className="muted small">{motivoLabel(x.motivo_ausencia)} · {sinCulpa(x) ? 'sin vencimiento' : l >= 0 ? `quedan ${l} días` : 'plazo vencido (excepción)'}</span></button>; })}</div>}
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
