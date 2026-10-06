import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, estadoPersona, personaStats, squaresForSub, STAGE_LABEL, COLOR_NAME, matchPersona, clasesDeHorario, Square } from '../logic';
import { Sheet, Field, Chips, useConfirm } from '../ui';
import { ClassSheet, NewClassSheet, SlotPicker, useClassOps, useSlotCheck, useWhats, TIPO_LABEL, motivoLabel } from '../classes';
import { RenewSheet, PagoSheet, grupoDe } from '../subs';
import { diffDays, fmtDate, fmtDateY, gs, hm, normPhone, phonePretty, DIAS3, fmtLong } from '../util';
import { historial } from '../api';
import { PersonaPicker } from '../picker';
import { Facts } from './Reportes';
import { horasDisponibles } from '../logic';

export function StageBadge({ e }: { e: any }) {
  return <span className={'badge st-' + e.stage + (e.color ? ' c-' + e.color : '')}>{STAGE_LABEL[e.stage as keyof typeof STAGE_LABEL]}{e.color ? ` · ${e.atraso} d` : ''}</span>;
}

export default function Clientes({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy, isAdmin } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const [q, setQ] = useState(''); const [fil, setFil] = useState('todas'); const [orden, setOrden] = useState('nombre'); const [plan, setPlan] = useState(''); const [nueva, setNueva] = useState(false);
  const rows = useMemo(() => d.personas.map((p: any) => ({ p, e: estadoPersona(p, idx, cfg, hoy), s: personaStats(p, idx, hoy, cfg.recup_dias) })), [d, idx, cfg, hoy]);
  const counts = useMemo(() => { const c: any = { todas: rows.length, inscripta: 0, prueba: 0, no_renovo: 0, no_se_inscribio: 0, atraso: 0 }; rows.forEach((r: any) => { if (c[r.e.stage] !== undefined) c[r.e.stage]++; if (r.e.color) c.atraso++; }); return c; }, [rows]);
  const list = useMemo(() => {
    let r = rows.filter((x: any) => matchPersona(x.p, q));
    if (fil === 'atraso') r = r.filter((x: any) => x.e.color); else if (fil !== 'todas') r = r.filter((x: any) => x.e.stage === fil);
    if (plan) r = r.filter((x: any) => x.e.sub?.plan_id === plan && x.e.stage === 'inscripta');
    const cmp: any = { nombre: (a: any, b: any) => a.p.nombre.localeCompare(b.p.nombre), antiguas: (a: any, b: any) => (a.s.primera || '9').localeCompare(b.s.primera || '9'), nuevas: (a: any, b: any) => (b.s.primera || '').localeCompare(a.s.primera || ''), atraso: (a: any, b: any) => b.e.atraso - a.e.atraso, ticket: (a: any, b: any) => b.s.ticket - a.s.ticket, pagado: (a: any, b: any) => b.s.pagado - a.s.pagado, asistencias: (a: any, b: any) => b.s.asist - a.s.asist };
    return [...r].sort(cmp[orden]);
  }, [rows, q, fil, orden, plan]);
  const F = (v: string, l: string) => <button className={'chip' + (fil === v ? ' on' : '')} onClick={() => setFil(v)}>{l} <small>{counts[v]}</small></button>;
  return (
    <div className="page">
      <header className="page-head"><h1>Clientes</h1>{isAdmin && <button className="btn sm" onClick={() => setNueva(true)}>+ Nuevo cliente</button>}</header>
      <input className="search" placeholder="Buscar por nombre, celular o nota…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll">{F('todas', 'Todos')}{F('inscripta', 'Inscriptos/as')}{F('prueba', 'Prueba')}{F('atraso', 'Con atraso')}{F('no_renovo', 'No renovó')}{F('no_se_inscribio', 'No se inscribió')}</div>
      <div className="row2"><select value={orden} onChange={(e) => setOrden(e.target.value)}><option value="nombre">Orden: nombre</option><option value="antiguas">Más antiguos/as</option><option value="nuevas">Más nuevos/as</option><option value="atraso">Más atraso</option>{isAdmin && <><option value="ticket">Mayor ticket</option><option value="pagado">Más pagó</option></>}<option value="asistencias">Más asistencias</option></select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">Todo plan</option>{d.planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
      <div className="muted small pad">{list.length} personas</div>
      <div className="list">
        {list.slice(0, 200).map(({ p, e, s }: any) => (
          <div key={p.id} className={'row-card plain' + (e.color ? ' c-' + e.color : '')} onClick={() => openPersona(p.id)}>
            <div className="grow"><b>{p.nombre}</b><div className="small muted">{e.sub?.plan_nombre ? e.sub.plan_nombre + ' · ' : ''}{s.asist} asist. {s.ultima ? `· última ${fmtDate(s.ultima)}` : ''}</div></div><StageBadge e={e} /></div>
        ))}
        {list.length > 200 && <div className="muted small pad">Mostrando 200. Usá la búsqueda para afinar.</div>}
      </div>
      {nueva && <NuevaPersona onClose={() => setNueva(false)} onCreated={(id) => { setNueva(false); openPersona(id); }} />}
      <div style={{ marginTop: 28 }}><Facts openPersona={openPersona} embedded /></div>
    </div>
  );
}

function NuevaPersona({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { d, cfg, hoy, ins, toast } = useApp(); const ops = useClassOps(); const { check, node } = useSlotCheck();
  const [nombre, setNombre] = useState(''); const [cel, setCel] = useState(''); const [tutor, setTutor] = useState(''); const [modo, setModo] = useState<'prueba' | 'directo' | 'datos'>('prueba'); const [f, setF] = useState(hoy); const [h, setH] = useState(''); const [nota, setNota] = useState(''); const [busy, setBusy] = useState(false);
  const [renewP, setRenewP] = useState<any>(null);
  const dup = d.personas.find((p: any) => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const guardar = async () => {
    if (!nombre.trim()) return; if (modo === 'prueba' && h && !(await check(f, h))) return;
    setBusy(true);
    try {
      const p = await ins('personas', { nombre: nombre.trim(), celular: normPhone(cel, cfg.pais_tel) || null, tutor_id: tutor || null, notas: nota || null, origen: 'app', fecha_alta: hoy, prueba_fecha: modo === 'prueba' && h ? f : null, sin_prueba: modo === 'directo' });
      if (modo === 'prueba' && h) await ops.crear({ persona_id: p.id, fecha: f, hora: h, tipo: 'prueba' });
      if (modo === 'directo') { setRenewP(p); return; }
      toast('Cliente creado'); onCreated(p.id);
    } catch (e: any) { toast('Error: ' + e.message); } finally { setBusy(false); }
  };
  if (renewP) return <RenewSheet persona={renewP} onClose={() => { onCreated(renewP.id); }} />;
  return (
    <Sheet title="Nuevo cliente" onClose={onClose}>{node}
      <div className="stack">
        <Field label="Nombre y apellido"><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />{dup && <em className="warn">Ya existe alguien con ese nombre.</em>}</Field>
        <Field label="Celular" hint="Ej: 0981 123 456 — se guarda con código de país"><input inputMode="tel" value={cel} onChange={(e) => setCel(e.target.value)} /></Field>
        <Field label="Tutor (si es menor)" hint="Buscá a la persona; si todavía no está cargada, podés crearla desde acá."><PersonaPicker value={tutor} onChange={setTutor} /></Field>
        <Field label="Notas"><input value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
        <Field label="¿Cómo empieza?"><div className="chips wrap">{([['prueba', 'Clase de prueba'], ['directo', 'Se inscribe directo (sin prueba)'], ['datos', 'Solo guardar datos']] as const).map(([k, l]) => <button type="button" key={k} className={'chip' + (modo === k ? ' on' : '')} onClick={() => setModo(k)}>{l}</button>)}</div></Field>
        {modo === 'prueba' && <SlotPicker fecha={f} hora={h} onChange={(a, b) => { setF(a); setH(b); }} />}
        {modo === 'directo' && <div className="muted small">Al continuar elegís plan, monto, días y horarios.</div>}
        <button className="btn big" disabled={busy || !nombre.trim()} onClick={guardar}>{modo === 'directo' ? 'Continuar a inscripción →' : 'Crear'}</button>
      </div>
    </Sheet>
  );
}

const SQ_SYM: Record<string, string> = { ok: '✓', rec: '↺', rec_pend: '↺', aus: '', perdida: '', pend: '', sin_cerrar: '?', no_dada: '…' };
const SQ_LEGEND: [string, string][] = [['ok', 'Asistió'], ['rec', 'Recuperada'], ['aus', 'Ausente, recuperable'], ['perdida', 'No recuperó'], ['pend', 'Pendiente'], ['no_dada', 'No dada']];
export function Squares({ sq, onPick }: { sq: Square[]; onPick: (c: any) => void }) {
  if (!sq.length) return <div className="muted small">Sin clases en este período.</div>;
  return (<div><div className="squares">{sq.map((s, i) => (
    <button key={i} className={'sq sq-' + s.kind} onClick={() => onPick(s.c)} title={`${fmtDate(s.c.fecha)} ${hm(s.c.hora)}`}>
      <span className="sq-d">{fmtDate(s.c.fecha)}</span><span className="sq-s">{s.kind === 'aus' ? `${s.days} d` : SQ_SYM[s.kind]}</span>
    </button>))}</div></div>);
}

export function PersonaSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, cfg, hoy, isAdmin, upd, toast } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const p = idx.personaById.get(id); const wa = useWhats(); const { ask, node } = useConfirm();
  const [renew, setRenew] = useState(false); const [pago, setPago] = useState<any>(null); const [cls, setCls] = useState<any>(null); const [nuevaClase, setNuevaClase] = useState(false);
  const [portal, setPortal] = useState(false); const [edit, setEdit] = useState(false); const [verTodas, setVerTodas] = useState(false); const [hist, setHist] = useState<any[] | null>(null);
  if (!p) return null;
  const e = estadoPersona(p, idx, cfg, hoy); const s = personaStats(p, idx, hoy, cfg.recup_dias);
  const hor = (idx.horByP.get(p.id) || []).sort((a: any, b: any) => a.dia - b.dia || a.hora.localeCompare(b.hora));
  const subsMens = s.subs.filter((x: any) => x.tipo !== 'unica'); const subsShown = verTodas ? [...subsMens].reverse() : [...subsMens].reverse().slice(0, 1);
  const pruebas = s.clases.filter((c: any) => c.tipo === 'prueba');
  const tutor = p.tutor_id ? idx.personaById.get(p.tutor_id) : null; const pagador = p.pagador_id ? idx.personaById.get(p.pagador_id) : null;
  const grupo = grupoDe(p, d); const menores = d.personas.filter((x: any) => x.tutor_id === p.id);
  const antig = s.primera ? (() => { const m = Math.floor(s.antiguedadDias / 30.4); return m >= 1 ? `${m} mes${m === 1 ? '' : 'es'}` : `${s.antiguedadDias} días`; })() : '—';
  const sinCel = !p.celular;
  const toggle = async (patch: any) => { try { await upd('personas', p.id, patch); } catch (er: any) { toast('Error: ' + er.message); } };
  const archivar = async () => { if (await ask(`¿Enviar a ${p.nombre} a la papelera? Podés restaurarla después.`)) { await toggle({ deleted_at: new Date().toISOString() }); onClose(); } };
  return (
    <Sheet title={p.nombre} onClose={onClose} wide>
      {node}
      <div className="row between"><div><StageBadge e={e} /> {p.no_contactar && <span className="badge">No contactar</span>}<div className="muted small" style={{ marginTop: 4 }}>{phonePretty(p.celular) || 'Sin celular'}{tutor ? ` · Tutor: ${tutor.nombre}` : ''}{menores.length ? ` · Tutor de ${menores.map((m: any) => m.nombre.split(' ')[0]).join(', ')}` : ''}</div></div></div>
      <div className="actions">
        {isAdmin && <button className="btn" onClick={() => setRenew(true)}>{subsMens.length ? 'Renovar' : 'Inscribir'}</button>}
        <button className="btn" onClick={() => setNuevaClase(true)}>Agendar clase</button>
        <button className="btn ghost" disabled={sinCel} onClick={() => wa(p, e.atraso > 0 ? 'atraso' : 'renovacion', { vence: e.sub ? fmtDate(e.sub.fin) : '', plan: e.sub?.plan_nombre || 'plan' })}>WhatsApp</button>
        {isAdmin && <button className="btn ghost" onClick={() => setPortal(true)}>Enlace de alumno/a</button>}
        {isAdmin && <button className="btn ghost" onClick={() => setEdit(!edit)}>{edit ? 'Cerrar edición' : 'Editar'}</button>}
      </div>
      {edit && isAdmin && <EditPersona p={p} onDone={() => setEdit(false)} />}

      <div className="stats">
        <div><b>{s.asist}</b><span>Asistencias</span></div><div><b>{s.ausentes}</b><span>Ausencias</span></div><div><b>{s.recup}</b><span>Recuperadas</span></div><div><b>{antig}</b><span>Antigüedad</span></div>
        {isAdmin && <><div><b>{gs(s.ticket)}</b><span>Ticket prom.</span></div><div><b>{gs(s.pagado)}</b><span>Total pagado</span></div></>}
        <div><b>{s.meses}</b><span>Suscripciones</span></div><div><b>{s.ultima ? fmtDate(s.ultima) : '—'}</b><span>Última clase</span></div>
      </div>

      <h3>Horario fijo</h3>
      <Horarios p={p} hor={hor} />

      <h3>Clases del período</h3>
      {subsShown.length === 0 && <div className="muted small">Todavía no tiene suscripción.</div>}
      {subsShown.map((sub: any) => (
        <div className="period" key={sub.id}>
          <div className="row between"><b>{fmtDate(sub.inicio)} → {fmtDate(sub.fin)} · {sub.plan_nombre}</b>
            {isAdmin && <button className={'badge ' + (sub.pago_fecha ? 'paid' : 'unpaid')} onClick={() => setPago(sub)}>{sub.pago_fecha ? `Pagó ${fmtDate(sub.pago_fecha)}` : 'Pago pendiente'}</button>}</div>
          <Squares sq={squaresForSub(sub, idx, hoy, cfg.recup_dias, cfg.duracion_min)} onPick={setCls} />
        </div>))}
      <div className="legend sq-legend">{SQ_LEGEND.map(([k, l]) => <span key={k}><i className={'sq-dot sq-' + k} />{l}</span>)}</div>
      {subsMens.length > 1 && <button className="btn ghost sm" onClick={() => setVerTodas(!verTodas)}>{verTodas ? 'Ver solo el último período' : `Ver los ${subsMens.length} períodos`}</button>}

      {pruebas.length > 0 && <><h3>Clase de prueba</h3>{pruebas.map((c: any) => <div className="kv" key={c.id} onClick={() => setCls(c)}><span>{fmtDateY(c.fecha)} · {hm(c.hora)}</span><b>{c.estado === 'asistio' ? 'Asistió ✓' : c.estado === 'ausente' ? 'No fue' : 'Agendada'}</b></div>)}{p.sin_prueba && <div className="muted small">Marcada como "no hizo prueba".</div>}</>}

      {isAdmin && <><h3>Suscripciones y pagos</h3>
        {s.subs.length === 0 && <div className="muted small">Sin suscripciones.</div>}
        {[...s.subs].reverse().map((sub: any) => <div className="kv click" key={sub.id} onClick={() => setPago(sub)}><span>{fmtDate(sub.inicio)} → {fmtDate(sub.fin)} · {sub.plan_nombre}{sub.promo_nombre ? ` · ${sub.promo_nombre}` : ''}</span><b>{sub.pago_fecha ? gs(sub.pago_monto) : <i className="warn">pendiente</i>}</b></div>)}</>}

      {(grupo.length > 0 || pagador) && <><h3>Grupo</h3><div className="muted small">{pagador ? `Paga: ${pagador.nombre}` : `Paga ${p.nombre.split(' ')[0]} · ${grupo.map((g: any) => g.nombre).join(', ')}`}</div></>}
      {p.notas && <><h3>Notas</h3><div className="small">{p.notas}</div></>}
      <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
        {isAdmin && <button className="btn ghost sm" onClick={async () => setHist(await historial(60, 'fp_personas', p.id))}>Ver historial de cambios</button>}
        {isAdmin && <button className="btn ghost sm danger" onClick={archivar}>Enviar a papelera</button>}</div>
      {hist && <div className="box small">{hist.length === 0 ? 'Sin cambios registrados.' : hist.map((h: any) => <div key={h.id} className="kv"><span>{new Date(h.ts).toLocaleString('es-PY')} · {h.nick}</span><b>{h.accion}</b></div>)}</div>}

      {portal && <PortalLink p={p} onClose={() => setPortal(false)} />}
      {renew && <RenewSheet persona={p} onClose={() => setRenew(false)} />}
      {pago && <PagoSheet sub={pago} onClose={() => setPago(null)} />}
      {cls && <ClassSheet c={cls} onClose={() => setCls(null)} />}
      {nuevaClase && <NewClassSheet onClose={() => setNuevaClase(false)} presetPersona={p.id} />}
    </Sheet>
  );
}

function Horarios({ p, hor }: { p: any; hor: any[] }) {
  const { d, cfg, isAdmin, ins, upd, toast } = useApp(); const [add, setAdd] = useState(false); const [dia, setDia] = useState(1); const [h, setH] = useState(horasDisponibles(cfg)[0]);
  const profe = d.profesoras.find((x: any) => x.tipo === 'fija')?.id;
  return (<div>
    <div className="chips wrap">{hor.length === 0 && <span className="muted small">Sin horario fijo cargado.</span>}
      {hor.map((x: any) => <span className="chip on" key={x.id}>{DIAS3[x.dia % 7]} {hm(x.hora)}{isAdmin && <button className="x2" onClick={() => upd('horarios', x.id, { activo: false }).catch((er: any) => toast(er.message))}>✕</button>}</span>)}
      {isAdmin && <button className="chip" onClick={() => setAdd(!add)}>+ horario</button>}</div>
    {add && <div className="row2" style={{ marginTop: 8 }}><select value={dia} onChange={(e) => setDia(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][n]}</option>)}</select>
      <select value={h} onChange={(e) => setH(e.target.value)}>{horasDisponibles(cfg).map((x) => <option key={x}>{x}</option>)}</select>
      <button className="btn sm" onClick={async () => { try { await ins('horarios', { persona_id: p.id, dia, hora: h, profesora_id: profe || null, activo: true }); setAdd(false); } catch (er: any) { toast(er.message); } }}>Agregar</button></div>}
  </div>);
}

function EditPersona({ p, onDone }: { p: any; onDone: () => void }) {
  const { cfg, upd, toast } = useApp();
  const [nombre, setNombre] = useState(p.nombre); const [cel, setCel] = useState(p.celular || ''); const [notas, setNotas] = useState(p.notas || ''); const [tutor, setTutor] = useState(p.tutor_id || ''); const [pagador, setPagador] = useState(p.pagador_id || '');
  const [sinPrueba, setSinPrueba] = useState(!!p.sin_prueba); const [noCont, setNoCont] = useState(!!p.no_contactar); const [pf, setPf] = useState(p.prueba_fecha || '');
  return (
    <div className="box stack">
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="Celular"><input inputMode="tel" value={cel} onChange={(e) => setCel(e.target.value)} /></Field>
      <Field label="Tutor (si es menor)"><PersonaPicker value={tutor} onChange={setTutor} exclude={p.id} /></Field>
      <Field label="Paga otra persona (grupo / familia)"><PersonaPicker value={pagador} onChange={setPagador} exclude={p.id} /></Field>
      <Field label="Fecha de prueba"><input type="date" value={pf} onChange={(e) => setPf(e.target.value)} /></Field>
      <label className="check"><input type="checkbox" checked={sinPrueba} onChange={(e) => setSinPrueba(e.target.checked)} /> Excepción: no hizo clase de prueba</label>
      <label className="check"><input type="checkbox" checked={noCont} onChange={(e) => setNoCont(e.target.checked)} /> No contactar (no invitar a volver)</label>
      <Field label="Notas"><textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      <button className="btn" onClick={async () => { try { await upd('personas', p.id, { nombre: nombre.trim(), celular: normPhone(cel, cfg.pais_tel) || null, notas: notas || null, tutor_id: tutor || null, pagador_id: pagador || null, sin_prueba: sinPrueba, no_contactar: noCont, prueba_fecha: pf || null }); toast('Guardado'); onDone(); } catch (er: any) { toast('Error: ' + er.message); } }}>Guardar cambios</button>
    </div>
  );
}
export { Chips, TIPO_LABEL, motivoLabel, COLOR_NAME, clasesDeHorario, diffDays, fmtLong };

function PortalLink({ p, onClose }: { p: any; onClose: () => void }) {
  const { cfg, toast } = useApp(); const url = `${location.origin}${location.pathname}#mi/${p.portal_token}`;
  const msg = `Hola ${p.nombre.split(' ')[0]}! Acá podés ver tus clases, asistencias y recuperaciones en Focus Pilates (guardá el enlace): ${url}`;
  const tel = normPhone(p.celular || '', cfg.pais_tel);
  return (<Sheet title={'Enlace de ' + p.nombre.split(' ')[0]} onClose={onClose}><div className="stack">
    <div className="muted small">Es personal: quien lo tenga ve las clases y asistencias de esta persona (nunca montos). No necesita usuario ni contraseña.</div>
    <input readOnly value={url} onFocus={(e) => e.target.select()} />
    <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast('Copialo manualmente'); } }}>Copiar enlace</button>
    <button className="btn ghost" disabled={!tel} onClick={() => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')}>{tel ? 'Enviar por WhatsApp' : 'Sin celular cargado'}</button>
  </div></Sheet>);
}
