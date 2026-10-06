import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex } from '../logic';
import { Sheet, Field, Seg, useConfirm } from '../ui';
import { adminFn, historial, changeOwnPassword, fetchAll } from '../api';
import { buildXlsx, download } from '../xlsx';
import { fmtDate, gs, hm, monthLabel } from '../util';
import { allMonths } from '../fin';

const SECS: [string, string, string][] = [
  ['general', 'General', 'Horario, cupo, plazos, umbrales de atraso'], ['planes', 'Planes', 'Precios y planes'], ['promos', 'Promos y grupos', 'Descuentos'], ['pagos', 'Métodos de pago', ''],
  ['profes', 'Instructores/as', 'Fijas y suplentes, salario base'], ['plantillas', 'Mensajes de WhatsApp', 'Plantillas editables'], ['usuarios', 'Usuarios', 'Nicks, roles, contraseñas'],
  ['backup', 'Backup en Excel', 'Descargar por mes o completo'], ['historial', 'Historial de cambios', 'Quién cambió qué'], ['accesos', 'Accesos de alumnos/as', 'Quién vio su perfil y cuándo'], ['papelera', 'Papelera', 'Restaurar eliminados'],
];
const DIRTY = { v: false };
function useDirty(flag: boolean) { React.useEffect(() => { DIRTY.v = flag; return () => { DIRTY.v = false; }; }, [flag]); }
function Acciones({ dirty, onSave, onDiscard, label = 'Guardar cambios' }: { dirty: boolean; onSave: () => void; onDiscard: () => void; label?: string }) {
  if (!dirty) return null;
  return <div className="savebar"><span className="small">Cambios sin guardar</span><button className="btn ghost sm" onClick={onDiscard}>Descartar</button><button className="btn sm" onClick={onSave}>{label}</button></div>;
}
export default function Config({ sec = '' }: { sec?: string }) {
  const { ask, node } = useConfirm();
  const volver = async () => { if (DIRTY.v && !(await ask('Tenés cambios sin guardar. ¿Salir y descartarlos?'))) return; DIRTY.v = false; location.hash = 'config'; };
  if (sec && SECS.some((x) => x[0] === sec)) return <div className="page">{node}<header className="page-head"><button className="btn sm ghost" onClick={volver}>‹ Configuración</button><h1>{SECS.find((s) => s[0] === sec)?.[1]}</h1></header>
    {sec === 'general' && <General />}{sec === 'planes' && <Planes />}{sec === 'promos' && <Promos />}{sec === 'pagos' && <Metodos />}{sec === 'profes' && <Profes />}{sec === 'plantillas' && <Plantillas />}
    {sec === 'usuarios' && <Usuarios />}{sec === 'backup' && <Backup />}{sec === 'historial' && <Historial />}{sec === 'accesos' && <Accesos />}{sec === 'papelera' && <Papelera />}</div>;
  return (<div className="page"><header className="page-head"><h1>Configuración</h1></header><div className="list">{SECS.map(([k, t, s]) => <div className="row-card plain" key={k} onClick={() => { location.hash = 'config/' + k; }}><div className="grow"><b>{t}</b><div className="small muted">{s}</div></div><span className="chev">›</span></div>)}</div></div>);
}

function useSave() { const { toast } = useApp(); return async (fn: () => Promise<any>, ok = 'Guardado') => { try { await fn(); toast(ok); } catch (e: any) { toast('Error: ' + e.message); } }; }

function General() {
  const { cfg, setCfg } = useApp(); const save = useSave(); const { ask, node } = useConfirm();
  const [v, setV] = useState<any>({ apertura: cfg.apertura, cierre: cfg.cierre, cupo: cfg.cupo, duracion_min: cfg.duracion_min, recup_dias: cfg.recup_dias, pais: cfg.pais, pais_tel: cfg.pais_tel, aviso_renovacion_dias: cfg.aviso_renovacion_dias, avisos_offsets: (cfg.avisos_offsets || [-3, 0, 2]).join(', '), espera_contacto_dias: cfg.espera_contacto_dias, inactiva_dias: cfg.inactiva_dias, prueba_conv_dias: cfg.prueba_conv_dias, monto_suplente: cfg.monto_suplente, dias_habiles_semana: (cfg.dias_habiles_semana || []).join(','), ...cfg.umbrales_atraso });
  const init = React.useRef(JSON.stringify(v)); const dirty = JSON.stringify(v) !== init.current; useDirty(dirty);
  const set = (k: string, x: any) => setV({ ...v, [k]: x }); const n = (k: string) => <input inputMode="numeric" value={v[k]} onChange={(e) => set(k, e.target.value.replace(/[^\d-]/g, ''))} />;
  const guardar = async () => { if (!(await ask('¿Guardar los cambios de configuración? Se aplican a todo el estudio.'))) return; await save(async () => {
    const N = (k: string) => Number(v[k]);
    await setCfg('apertura', v.apertura); await setCfg('cierre', v.cierre); await setCfg('cupo', N('cupo')); await setCfg('duracion_min', N('duracion_min')); await setCfg('recup_dias', N('recup_dias'));
    await setCfg('pais', String(v.pais).toUpperCase()); await setCfg('pais_tel', String(v.pais_tel)); await setCfg('aviso_renovacion_dias', N('aviso_renovacion_dias'));
    await setCfg('avisos_offsets', String(v.avisos_offsets).split(',').map((x) => Number(x.trim())).filter((x) => !isNaN(x))); await setCfg('espera_contacto_dias', N('espera_contacto_dias'));
    await setCfg('inactiva_dias', N('inactiva_dias')); await setCfg('prueba_conv_dias', N('prueba_conv_dias')); await setCfg('monto_suplente', N('monto_suplente'));
    await setCfg('dias_habiles_semana', String(v.dias_habiles_semana).split(',').map((x) => Number(x.trim())).filter((x) => x >= 1 && x <= 7));
    await setCfg('umbrales_atraso', { amarillo: N('amarillo'), naranja: N('naranja'), naranja2: N('naranja2'), rojo: N('rojo') });
  }); init.current = JSON.stringify(v); setV({ ...v }); };
  return (<div className="stack">{node}
    <div className="row2"><Field label="Apertura"><input type="time" value={v.apertura} onChange={(e) => set('apertura', e.target.value)} /></Field><Field label="Cierre"><input type="time" value={v.cierre} onChange={(e) => set('cierre', e.target.value)} /></Field></div>
    <div className="row2"><Field label="Cupo por clase">{n('cupo')}</Field><Field label="Duración (min)">{n('duracion_min')}</Field></div>
    <Field label="Plazo para recuperar una falta (días)">{n('recup_dias')}</Field>
    <h3>Umbrales de atraso (días tras el vencimiento)</h3>
    <div className="row2"><Field label="🟡 Amarillo">{n('amarillo')}</Field><Field label="🟠 Naranja">{n('naranja')}</Field></div><div className="row2"><Field label="🟠 Naranja fuerte">{n('naranja2')}</Field><Field label="🔴 Rojo">{n('rojo')}</Field></div>
    <h3>Avisos y contactos</h3>
    <Field label="Avisos de renovación (días respecto al vencimiento)" hint="Ej: -3, 0, 2 = 3 días antes, el día y 2 días después"><input value={v.avisos_offsets} onChange={(e) => set('avisos_offsets', e.target.value)} /></Field>
    <Field label="Mostrar renovaciones pendientes desde (días antes)">{n('aviso_renovacion_dias')}</Field>
    <Field label="Esperar entre invitaciones a volver (días)">{n('espera_contacto_dias')}</Field>
    <div className="row2"><Field label="Pasan a 'No renovó' tras (días)">{n('inactiva_dias')}</Field><Field label="Prueba sin inscripción tras (días)">{n('prueba_conv_dias')}</Field></div>
    <h3>Otros</h3>
    <div className="row2"><Field label="País (código)"><input value={v.pais} onChange={(e) => set('pais', e.target.value)} /></Field><Field label="Prefijo telefónico"><input value={v.pais_tel} onChange={(e) => set('pais_tel', e.target.value)} /></Field></div>
    <Field label="Días hábiles de la semana (1=lun … 7=dom)"><input value={v.dias_habiles_semana} onChange={(e) => set('dias_habiles_semana', e.target.value)} /></Field>
    <Field label="Monto por suplencia (Gs)">{n('monto_suplente')}</Field>
    <Acciones dirty={dirty} onSave={guardar} onDiscard={() => setV(JSON.parse(init.current))} /></div>);
}

function Planes() {
  const { d, ins, upd } = useApp(); const save = useSave(); const [nuevo, setNuevo] = useState(false); const [nm, setNm] = useState(''); const [pr, setPr] = useState(''); const [cs, setCs] = useState('1');
  return (<div className="stack"><div className="list">{d.planes.map((p: any) => <PlanRow key={p.id} p={p} />)}</div>
    {nuevo ? <div className="box stack"><Field label="Nombre"><input value={nm} onChange={(e) => setNm(e.target.value)} /></Field><div className="row2"><Field label="Precio"><input inputMode="numeric" value={pr} onChange={(e) => setPr(e.target.value.replace(/\D/g, ''))} /></Field><Field label="Clases/semana"><input inputMode="numeric" value={cs} onChange={(e) => setCs(e.target.value.replace(/\D/g, ''))} /></Field></div>
      <button className="btn" disabled={!nm} onClick={() => save(async () => { await ins('planes', { nombre: nm, precio: Number(pr) || 0, clases_semana: Number(cs) || 1, tipo: 'mensual', activo: true, orden: d.planes.length + 1 }); setNuevo(false); setNm(''); setPr(''); })}>Agregar plan</button></div>
      : <button className="btn ghost" onClick={() => setNuevo(true)}>+ Nuevo plan</button>}
    <div className="muted small">Cambiar un precio no modifica las suscripciones ya registradas: cada una guarda el precio con el que se cobró.</div></div>);
}
function PlanRow({ p }: { p: any }) {
  const { upd } = useApp(); const save = useSave(); const { ask, node } = useConfirm();
  const [nm, setNm] = useState(p.nombre); const [pr, setPr] = useState(String(Math.round(p.precio))); const [act, setAct] = useState(p.activo !== false);
  const dirty = nm !== p.nombre || Number(pr) !== Math.round(p.precio) || act !== (p.activo !== false); useDirty(dirty);
  const reset = () => { setNm(p.nombre); setPr(String(Math.round(p.precio))); setAct(p.activo !== false); };
  const guardar = async () => {
    const cambios = [nm !== p.nombre && `nombre «${p.nombre}» → «${nm}»`, Number(pr) !== Math.round(p.precio) && `precio ${gs(p.precio)} → ${gs(pr)}`, act !== (p.activo !== false) && (act ? 'pasa a Activo' : 'pasa a Oculto')].filter(Boolean).join('; ');
    if (!(await ask(`¿Guardar cambios en ${p.nombre}? ${cambios}. Las suscripciones ya registradas conservan su precio.`))) return;
    save(() => upd('planes', p.id, { nombre: nm, precio: Number(pr), activo: act }));
  };
  return (<div className="box stack">{node}<div className="egreso"><input className="grow" value={nm} onChange={(e) => setNm(e.target.value)} />
    <input className="num" inputMode="numeric" value={Number(pr).toLocaleString('es-PY')} onChange={(e) => setPr(e.target.value.replace(/\D/g, '') || '0')} />
    <button className={'badge ' + (act ? 'paid' : '')} onClick={() => setAct(!act)}>{act ? 'Activo' : 'Oculto'}</button></div>
    <div className="small muted">{p.clases_semana} clase{p.clases_semana === 1 ? '' : 's'} por semana</div>
    <Acciones dirty={dirty} onSave={guardar} onDiscard={reset} /></div>);
}

function Promos() {
  const { d, cfg, ins, upd, setCfg } = useApp(); const save = useSave(); const { ask, node } = useConfirm(); const [nm, setNm] = useState(''); const [tipo, setTipo] = useState('porcentaje'); const [val, setVal] = useState(''); const [dur, setDur] = useState('');
  const [g, setG] = useState<any>(() => Object.fromEntries([2, 3, 4].map((k) => [k, { tipo: 'porcentaje', valor: cfg.descuento_grupo?.[k]?.tipo === 'porcentaje' ? Number(cfg.descuento_grupo[k].valor) : 20 }])));
  const [ref, setRef] = useState<string>(cfg.descuento_ref_plan || d.planes.find((p: any) => p.nombre === 'Plan 2')?.id || d.planes[0]?.id); const refPrecio = Number(d.planes.find((p: any) => p.id === ref)?.precio) || 0;
  const gInit = React.useRef(JSON.stringify([g, ref])); const gDirty = JSON.stringify([g, ref]) !== gInit.current; useDirty(gDirty);
  return (<div className="stack">{node}<h3>Promos</h3>
    <div className="list">{d.promos.map((p: any) => <div className="egreso" key={p.id}><div className="grow"><b>{p.nombre}</b><div className="small muted">{p.tipo === 'porcentaje' ? p.valor + '%' : gs(p.valor)} · {p.duracion_meses ? p.duracion_meses + ' mes(es) desde la inscripción' : 'permanente'}</div></div>
      <button className={'badge ' + (p.activa === false ? '' : 'paid')} onClick={() => save(() => upd('promos', p.id, { activa: p.activa === false }))}>{p.activa === false ? 'Oculta' : 'Activa'}</button></div>)}</div>
    <div className="box stack"><b>Nueva promo</b><Field label="Nombre"><input value={nm} onChange={(e) => setNm(e.target.value)} /></Field>
      <div className="row2"><Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="porcentaje">% descuento</option><option value="monto">Monto fijo</option></select></Field><Field label="Valor"><input inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))} /></Field></div>
      <Field label="Duración en meses" hint="Vacío = permanente"><input inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))} /></Field>
      <button className="btn" disabled={!nm || !val} onClick={() => save(async () => { await ins('promos', { nombre: nm, tipo, valor: Number(val), duracion_meses: dur ? Number(dur) : null, activa: true }); setNm(''); setVal(''); setDur(''); })}>Crear promo</button></div>
    <h3>Descuento de grupo / familia</h3><div className="muted small">Según cuántas personas haya en el grupo (una sola persona paga por todas). Se aplica a cada perfil.</div>
    <Field label="Plan de referencia para calcular los Gs" hint="Solo para mostrar el equivalente en guaraníes; el descuento se guarda como porcentaje y se aplica al plan de cada persona."><select value={ref} onChange={(e) => setRef(e.target.value)}>{d.planes.filter((p: any) => p.tipo !== 'unica').map((p: any) => <option key={p.id} value={p.id}>{p.nombre} · {gs(p.precio)}</option>)}</select></Field>
    {[2, 3, 4].map((k) => { const pct = Number(g[k]?.valor ?? 20); const gsv = Math.round((refPrecio * pct) / 100 / 1000) * 1000; return (
      <div className="row2" key={k}><Field label={`Grupo de ${k}${k === 4 ? ' o más' : ''} · %`}><input inputMode="decimal" value={String(pct)} onChange={(e) => { const v = Math.min(100, Number(e.target.value.replace(/[^\d.]/g, '')) || 0); setG({ ...g, [k]: { tipo: 'porcentaje', valor: v } }); }} /></Field>
        <Field label="Equivale a (Gs por persona)"><input inputMode="numeric" value={gsv ? gsv.toLocaleString('es-PY') : '0'} onChange={(e) => { const m = Number(e.target.value.replace(/\D/g, '')) || 0; const v = refPrecio ? Math.min(100, Math.round((m / refPrecio) * 1000) / 10) : 0; setG({ ...g, [k]: { tipo: 'porcentaje', valor: v } }); }} /></Field></div>); })}
    <Acciones dirty={gDirty} label="Guardar descuentos" onDiscard={() => { const [a, b] = JSON.parse(gInit.current); setG(a); setRef(b); }} onSave={async () => { if (!(await ask('¿Guardar los descuentos de grupo?'))) return; await save(async () => { await setCfg('descuento_grupo', Object.fromEntries([2, 3, 4].map((k) => [k, { tipo: 'porcentaje', valor: Number(g[k]?.valor ?? 20) }]))); await setCfg('descuento_ref_plan', ref); }); gInit.current = JSON.stringify([g, ref]); setG({ ...g }); }} /></div>);
}

function Metodos() {
  const { d, ins, upd } = useApp(); const save = useSave(); const [nm, setNm] = useState('');
  return (<div className="stack"><div className="list">{d.metodos.map((m: any) => <MetodoRow key={m.id} m={m} />)}</div>
    <div className="row2"><input placeholder="Nuevo método (ej: Tarjeta)" value={nm} onChange={(e) => setNm(e.target.value)} /><button className="btn" disabled={!nm} onClick={() => save(async () => { await ins('metodos', { nombre: nm, activo: true, orden: d.metodos.length + 1 }); setNm(''); })}>Agregar</button></div></div>);
}
function MetodoRow({ m }: { m: any }) { const { upd } = useApp(); const save = useSave(); const { ask, node } = useConfirm(); const [nm, setNm] = useState(m.nombre); const [act, setAct] = useState(m.activo !== false);
  const dirty = nm !== m.nombre || act !== (m.activo !== false); useDirty(dirty);
  return (<div className="box stack">{node}<div className="egreso"><input className="grow" value={nm} onChange={(e) => setNm(e.target.value)} /><button className={'badge ' + (act ? 'paid' : '')} onClick={() => setAct(!act)}>{act ? 'Activo' : 'Oculto'}</button></div>
    <Acciones dirty={dirty} onSave={async () => { if (await ask(`¿Guardar los cambios de «${m.nombre}»?`)) save(() => upd('metodos', m.id, { nombre: nm, activo: act })); }} onDiscard={() => { setNm(m.nombre); setAct(m.activo !== false); }} /></div>); }

function Profes() {
  const { d, ins } = useApp(); const save = useSave(); const [nm, setNm] = useState(''); const [tipo, setTipo] = useState('suplente');
  return (<div className="stack"><div className="list">{d.profesoras.map((p: any) => <ProfeRow key={p.id} p={p} />)}</div>
    <div className="box stack"><b>Agregar instructor/a</b><div className="row2"><input placeholder="Nombre" value={nm} onChange={(e) => setNm(e.target.value)} /><select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="fija">Fija</option><option value="suplente">Suplente</option></select></div>
      <button className="btn" disabled={!nm} onClick={() => save(async () => { await ins('profesoras', { nombre: nm, tipo, activa: true }); setNm(''); })}>Agregar</button></div>
    <div className="muted small">Salario del mes = base ÷ días hábiles ÷ horas del día × horas trabajadas. Las suplencias se pagan con el monto por suplencia de General.</div></div>);
}
function ProfeRow({ p }: { p: any }) { const { upd } = useApp(); const save = useSave(); const { ask, node } = useConfirm();
  const [b, setB] = useState(String(Math.round(p.salario_base || 0))); const [tipo, setTipo] = useState(p.tipo); const [act, setAct] = useState(p.activa !== false);
  const dirty = Number(b) !== Math.round(p.salario_base || 0) || tipo !== p.tipo || act !== (p.activa !== false); useDirty(dirty);
  return (<div className="box stack">{node}<div className="row between"><b>{p.nombre}</b><div className="row" style={{ gap: 6 }}><select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="fija">Fija</option><option value="suplente">Suplente</option></select>
    <button className={'badge ' + (act ? 'paid' : '')} onClick={() => setAct(!act)}>{act ? 'Activa' : 'Inactiva'}</button></div></div>
    {tipo === 'fija' && <Field label="Salario base mensual (Gs)"><input inputMode="numeric" value={Number(b).toLocaleString('es-PY')} onChange={(e) => setB(e.target.value.replace(/\D/g, '') || '0')} /></Field>}
    <Acciones dirty={dirty} onSave={async () => { if (await ask(`¿Guardar los cambios de ${p.nombre}? Salario base: ${gs(b)}.`)) save(() => upd('profesoras', p.id, { salario_base: Number(b), tipo, activa: act })); }} onDiscard={() => { setB(String(Math.round(p.salario_base || 0))); setTipo(p.tipo); setAct(p.activa !== false); }} /></div>); }

const TPL: [string, string, string][] = [['confirmacion', 'Confirmar clase de hoy', '{nombre} {hora}'], ['renovacion', 'Aviso de renovación', '{nombre} {vence} {plan}'], ['atraso', 'Suscripción vencida / atraso', '{nombre} {vence} {plan}'], ['invitacion_prueba', 'Invitar: hizo prueba y no siguió', '{nombre}'], ['invitacion_inactiva', 'Invitar: dejó de venir', '{nombre}']];
function Plantillas() {
  const { cfg, setCfg } = useApp(); const save = useSave(); const { ask, node } = useConfirm(); const init = React.useRef(JSON.stringify(cfg.plantillas)); const [t, setT] = useState<any>({ ...cfg.plantillas });
  const dirty = JSON.stringify(t) !== init.current; useDirty(dirty);
  return (<div className="stack">{node}{TPL.map(([k, l, vars]) => <Field key={k} label={l} hint={`Variables: ${vars}`}><textarea rows={3} value={t[k] || ''} onChange={(e) => setT({ ...t, [k]: e.target.value })} /></Field>)}
    <Acciones dirty={dirty} label="Guardar mensajes" onSave={async () => { if (await ask('¿Guardar los mensajes de WhatsApp?')) { await save(() => setCfg('plantillas', t)); init.current = JSON.stringify(t); setT({ ...t }); } }} onDiscard={() => setT(JSON.parse(init.current))} /></div>);
}

function Usuarios() {
  const { d, me, reload, toast } = useApp(); const { ask, node } = useConfirm(); const [form, setForm] = useState<any>(null); const [pw, setPw] = useState(''); const save = useSave();
  return (<div className="stack">{node}<div className="list">{d.users.map((u: any) => (<div className="row-card plain" key={u.id} onClick={() => setForm({ ...u, edit: true, password: '' })}><div className="grow"><b>{u.nombre}</b><div className="small muted">@{u.nick} · {u.rol === 'admin' ? 'Administrador' : 'Instructor/a'}{u.profesora_id ? (u.rol === 'admin' ? ' + profesora' : ' · profesora') : ''}{u.activo === false ? ' · desactivado' : ''}</div></div><span className="chev">›</span></div>))}</div>
    <button className="btn" onClick={() => setForm({ nick: '', nombre: '', rol: 'profe', password: '', profesora_id: '', activo: true })}>+ Nuevo usuario</button>
    <h3>Mi contraseña</h3><div className="row2"><input type="password" placeholder="Nueva contraseña" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn" disabled={pw.length < 6} onClick={() => save(async () => { await changeOwnPassword(pw); setPw(''); }, 'Contraseña actualizada')}>Cambiar</button></div>
    {form && <Sheet title={form.edit ? `Editar @${form.nick}` : 'Nuevo usuario'} onClose={() => setForm(null)}><div className="stack">
      {!form.edit && <Field label="Nick (sin espacios)"><input value={form.nick} onChange={(e) => setForm({ ...form, nick: e.target.value })} /></Field>}
      <Field label="Nombre"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
      <Field label="Rol"><select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="profe">Instructor/a (sin finanzas)</option><option value="admin">Administrador (ve todo)</option></select></Field>
      <Field label="Da clases (instructor/a)"><select value={form.profesora_id || ''} onChange={(e) => setForm({ ...form, profesora_id: e.target.value || null })}><option value="">—</option>{d.profesoras.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label={form.edit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña (mín. 6)'}><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
      {form.edit && <label className="check"><input type="checkbox" checked={form.activo !== false} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>}
      <button className="btn big" onClick={() => save(async () => {
        if (form.edit) { await adminFn({ action: 'update', id: form.id, nombre: form.nombre, rol: form.rol, profesora_id: form.profesora_id, activo: form.activo !== false }); if (form.password) await adminFn({ action: 'password', id: form.id, password: form.password }); }
        else await adminFn({ action: 'create', nick: form.nick, nombre: form.nombre, rol: form.rol, profesora_id: form.profesora_id, password: form.password });
        await reload(); setForm(null);
      })}>Guardar</button></div></Sheet>}</div>);
}

export function buildBackup(d: any, mes?: string) {
  const idx = buildIndex(d); const pn = (id: string) => idx.personaById.get(id)?.nombre || '';
  const inMes = (f?: string) => !mes || (f || '').startsWith(mes);
  const personas = [['Nombre', 'Celular', 'Tutor', 'Paga', 'Fecha de prueba', 'Sin prueba', 'No contactar', 'Alta', 'Notas'], ...d.personas.map((p: any) => [p.nombre, p.celular, pn(p.tutor_id), pn(p.pagador_id), p.prueba_fecha, !!p.sin_prueba, !!p.no_contactar, p.fecha_alta, p.notas])];
  const subs = [['Persona', 'Plan', 'Inicio', 'Fin', 'Precio lista', 'Promo', 'Precio final', 'Fecha de pago', 'Método', 'Monto pagado'], ...d.suscripciones.filter((s: any) => (mes ? inMes(s.pago_fecha) : true)).map((s: any) => [pn(s.persona_id), s.plan_nombre, s.inicio, s.fin, Number(s.precio_lista), s.promo_nombre, Number(s.precio_final), s.pago_fecha, idx.metodoById.get(s.pago_metodo_id)?.nombre, Number(s.pago_monto) || ''])];
  const clases = [['Fecha', 'Hora', 'Persona', 'Tipo', 'Estado', 'Motivo ausencia', 'Instructor/a', 'Fecha original', 'Excepción'], ...d.clases.filter((c: any) => inMes(c.fecha)).sort((a: any, b: any) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).map((c: any) => [c.fecha, hm(c.hora), pn(c.persona_id), c.tipo, c.estado, c.motivo_ausencia, idx.profById.get(c.profesora_id)?.nombre, c.fecha_original, !!c.excepcion])];
  const egresos = [['Mes', 'Concepto', 'Tipo', 'Monto', 'Pagado'], ...d.egresos.filter((e: any) => !mes || e.mes === mes).map((e: any) => [e.mes, e.concepto, e.tipo, Number(e.monto), !!e.pagado])];
  const ventas = [['Fecha', 'Producto', 'Cantidad', 'Precio', 'Total'], ...d.ventas.filter((v: any) => inMes(v.fecha)).map((v: any) => [v.fecha, v.nombre, v.cantidad, Number(v.precio_unit), Number(v.total)])];
  const cierres = [['Mes', 'Estado', 'Días hábiles', 'Cerrado por'], ...d.cierres.filter((c: any) => !mes || c.mes === mes).map((c: any) => [c.mes, c.estado, c.dias_habiles, c.cerrado_por])];
  return buildXlsx([{ name: 'Personas', rows: personas }, { name: 'Suscripciones y pagos', rows: subs }, { name: 'Clases', rows: clases }, { name: 'Egresos', rows: egresos }, { name: 'Ventas', rows: ventas }, { name: 'Cierres', rows: cierres }]);
}
export function Backup() {
  const { d, hoy } = useApp(); const meses = useMemo(() => allMonths(d, hoy), [d, hoy]); const [m, setM] = useState('');
  return (<div className="stack"><Field label="Qué descargar"><select value={m} onChange={(e) => setM(e.target.value)}><option value="">Todo el historial</option>{[...meses].reverse().map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select></Field>
    <button className="btn big" onClick={() => download(buildBackup(d, m || undefined), `focus-pilates-${m || 'completo'}-${hoy}.xlsx`)}>Descargar Excel</button>
    <div className="muted small">Incluye personas, suscripciones y pagos, clases, egresos, ventas y cierres. En el iPhone se guarda desde la hoja de compartir (“Guardar en Archivos”).</div></div>);
}

function Historial() {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  React.useEffect(() => { historial(200).then(setRows).catch((e) => setErr(e.message)); }, []);
  const diff = (a: any, b: any) => (a && b ? Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]) && !['created_at', 'updated_at'].includes(k)).slice(0, 4).join(', ') : '');
  if (err) return <div className="warn">{err}</div>; if (!rows) return <div className="muted pad">Cargando…</div>;
  return (<div className="list">{rows.map((h) => <div className="hrow" key={h.id}><div className="small muted">{new Date(h.ts).toLocaleString('es-PY')} · @{h.nick}</div><div><b>{h.accion}</b> en {h.tabla.replace('fp_', '')} <span className="muted small">{h.accion === 'editar' ? diff(h.antes, h.despues) : (h.despues?.nombre || h.despues?.concepto || h.antes?.nombre || '')}</span></div></div>)}</div>);
}

function Papelera() {
  const { d, upd } = useApp(); const save = useSave();
  const idx = useMemo(() => buildIndex({ ...d, personas: d.personasAll }), [d]); const pn = (id: string) => idx.personaById.get(id)?.nombre || '';
  const items = [
    ...d.personasAll.filter((x: any) => x.deleted_at).map((x: any) => ({ k: 'personas', x, t: 'Persona', n: x.nombre })),
    ...d.suscripcionesAll.filter((x: any) => x.deleted_at).map((x: any) => ({ k: 'suscripciones', x, t: 'Suscripción', n: `${pn(x.persona_id)} · ${x.plan_nombre}` })),
    ...d.clasesAll.filter((x: any) => x.deleted_at).map((x: any) => ({ k: 'clases', x, t: 'Clase', n: `${pn(x.persona_id)} · ${fmtDate(x.fecha)} ${hm(x.hora)}` })),
    ...d.egresosAll.filter((x: any) => x.deleted_at).map((x: any) => ({ k: 'egresos', x, t: 'Egreso', n: `${x.concepto} · ${x.mes}` })),
    ...d.ventasAll.filter((x: any) => x.deleted_at).map((x: any) => ({ k: 'ventas', x, t: 'Venta', n: x.nombre })),
    ...d.productosAll.filter((x: any) => x.deleted_at).map((x: any) => ({ k: 'productos', x, t: 'Producto', n: x.nombre })),
  ].sort((a, b) => b.x.deleted_at.localeCompare(a.x.deleted_at));
  if (!items.length) return <div className="muted pad">La papelera está vacía.</div>;
  return (<div className="list">{items.map((i) => <div className="row-card plain" key={i.k + i.x.id}><div className="grow"><b>{i.n}</b><div className="small muted">{i.t} · eliminado {fmtDate(i.x.deleted_at)}</div></div><button className="btn sm" onClick={() => save(() => upd(i.k, i.x.id, { deleted_at: null }), 'Restaurado')}>Restaurar</button></div>)}</div>);
}

function Accesos() {
  const { d } = useApp(); const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  React.useEffect(() => { fetchAll('fp_portal_accesos', 'ts.desc').then((r) => setRows(r.slice(0, 300))).catch((e) => setErr(e.message)); }, []);
  const nm = (id: string) => d.personasAll.find((p: any) => p.id === id)?.nombre || '—';
  if (err) return <div className="warn">{err}</div>; if (!rows) return <div className="muted pad">Cargando…</div>;
  return (<div className="list"><div className="muted small pad">Cada vez que un alumno/a (o su madre/padre) abre su perfil se anota una vez cada 30 minutos.</div>
    {rows.length === 0 && <div className="muted pad">Todavía nadie entró a su perfil.</div>}
    {rows.map((h) => <div className="hrow" key={h.id}><div className="small muted">{new Date(h.ts).toLocaleString('es-PY')} · {h.via}</div><div><b>{nm(h.persona_id)}</b></div></div>)}</div>);
}
