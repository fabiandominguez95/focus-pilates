import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { buildIndex, horasDisponibles } from './logic';
import { Sheet, Field } from './ui';
import { addDays, diffDays, dowISO, gs, subFin, uid, fmtDateY, addMonths, hm, timeToMin } from './util';

export function aplicarDescuento(precio: number, tipo?: string | null, valor?: number | null) {
  if (!tipo || !valor) return precio;
  return Math.max(0, Math.round(tipo === 'porcentaje' ? precio * (1 - valor / 100) : precio - valor));
}
export function grupoDe(p: any, d: any) {
  const payerId = p.pagador_id || p.id;
  const payer = d.personas.find((x: any) => x.id === payerId);
  const members = d.personas.filter((x: any) => x.pagador_id === payerId && x.id !== payerId);
  return payer && members.length ? [payer, ...members] : [];
}
function promoSugerida(personaId: string, idx: any, d: any) {
  const subs = idx.subsByP.get(personaId) || []; const last = [...subs].reverse().find((s: any) => s.promo_id);
  if (!last) return '';
  const promo = d.promos.find((x: any) => x.id === last.promo_id); if (!promo || promo.activa === false) return '';
  if (!promo.duracion_meses) return promo.id;
  const meses = subs.filter((s: any) => s.promo_id === promo.id).length;
  return meses < promo.duracion_meses ? promo.id : '';
}
const DIA_L = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type Slot = { dia: number; hora: string };
// Crea las clases fijas de un período a partir del horario fijo. Devuelve cuántas agendó y cuántas omitió.
export function filasClases(persona: any, sub: any, horarios: Slot[], d: any, hoy: string, profesoraId: string | null) {
  const out: any[] = []; let omitidas = 0;
  const desde = sub.inicio > hoy ? sub.inicio : hoy;
  const ocupadoDia = new Set(d.clases.filter((c: any) => c.persona_id === persona.id && (c.estado === 'agendada' || c.estado === 'asistio')).map((c: any) => c.fecha));
  for (let f = desde; f <= sub.fin; f = addDays(f, 1)) {
    const dow = dowISO(f);
    horarios.filter((h) => h.dia === dow).forEach((h) => {
      if (ocupadoDia.has(f)) return;
      const bloq = d.bloqueos.some((b: any) => b.fecha === f && b.hora_desde && timeToMin(hm(b.hora_desde)) <= timeToMin(h.hora) && timeToMin(hm(b.hora_hasta)) > timeToMin(h.hora));
      if (bloq) { omitidas++; return; }
      out.push({ persona_id: persona.id, suscripcion_id: sub.id, fecha: f, hora: h.hora, tipo: 'regular', estado: 'agendada', profesora_id: profesoraId });
      ocupadoDia.add(f);
    });
  }
  return { rows: out, omitidas };
}

export function RenewSheet({ persona, onClose, onDone }: { persona: any; onClose: () => void; onDone?: () => void }) {
  const { d, cfg, hoy, ins, upd, toast, me } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const subs = idx.subsByP.get(persona.id) || []; const prev = [...subs].filter((s: any) => s.tipo !== 'unica').pop();
  const planes = d.planes.filter((p: any) => p.activo !== false);
  const defInicio = prev ? (diffDays(hoy, prev.fin) > cfg.inactiva_dias ? hoy : addDays(prev.fin, 1)) : hoy;
  const [inicio, setInicio] = useState(defInicio);
  const [planId, setPlanId] = useState(prev?.plan_id || planes.find((p: any) => p.tipo !== 'unica')?.id || planes[0]?.id);
  const plan = idx.planById.get(planId);
  const esUnica = plan?.tipo === 'unica'; const nSlots = esUnica ? 0 : Math.max(1, Number(plan?.clases_semana) || 1);
  const [promoId, setPromoId] = useState(promoSugerida(persona.id, idx, d));
  const promo = d.promos.find((x: any) => x.id === promoId);
  const grupo = useMemo(() => grupoDe(persona, d), [persona, d]);
  const [usarGrupo, setUsarGrupo] = useState(grupo.length > 0);
  const [planesGrupo, setPlanesGrupo] = useState<Record<string, string>>({});
  const [pagarAhora, setPagarAhora] = useState(true); const [pagoFecha, setPagoFecha] = useState(hoy);
  const [metodo, setMetodo] = useState(d.metodos.find((m: any) => m.activo !== false)?.id || '');
  const [precioManual, setPrecioManual] = useState(''); const [busy, setBusy] = useState(false);
  const hayPrueba = !!persona.prueba_fecha || (idx.clasesByP.get(persona.id) || []).some((c: any) => c.tipo === 'prueba');
  const [sinPrueba, setSinPrueba] = useState(!hayPrueba && !persona.sin_prueba && !prev);
  // horario fijo
  const actuales: any[] = (idx.horByP.get(persona.id) || []).slice().sort((a: any, b: any) => a.dia - b.dia || hm(a.hora).localeCompare(hm(b.hora)));
  const horasOk = horasDisponibles(cfg);
  const defSlots = (n: number, base: Slot[]): Slot[] => { const o = base.slice(0, n); const dd = [1, 3, 5, 2, 4, 6]; while (o.length < n) o.push({ dia: dd[o.length % 6], hora: horasOk[Math.min(10, horasOk.length - 1)] || '18:00' }); return o; };
  const [slotsRaw, setSlots] = useState<Slot[]>(() => defSlots(nSlots, actuales.map((h) => ({ dia: h.dia, hora: hm(h.hora) }))));
  const [sinHorario, setSinHorario] = useState(false);
  const slots = defSlots(nSlots, slotsRaw);
  const setSlot = (i: number, patch: Partial<Slot>) => setSlots(slots.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const fijasEn = (dia: number, hora: string) => d.horarios.filter((h: any) => h.activo !== false && h.persona_id !== persona.id && h.dia === dia && hm(h.hora) === hora).length;
  const dupSlots = new Set(slots.map((s) => s.dia + s.hora)).size !== slots.length;

  const fin = esUnica ? inicio : subFin(inicio);
  const gKey = String(Math.min(4, grupo.length));
  const gDesc = usarGrupo && grupo.length ? cfg.descuento_grupo[gKey] : null;
  const filas = useMemo(() => {
    const miembros = usarGrupo && grupo.length ? grupo : [persona];
    return miembros.map((m: any) => {
      const pl = idx.planById.get(m.id === persona.id ? planId : planesGrupo[m.id] || (idx.subsByP.get(m.id) || []).filter((s: any) => s.tipo !== 'unica').pop()?.plan_id || planId);
      const lista = Number(pl?.precio) || 0;
      let dt: string | null = null, dv: number | null = null, pn = '', pid: string | null = null;
      if (promo && m.id === persona.id) { dt = promo.tipo; dv = Number(promo.valor); pn = promo.nombre; pid = promo.id; }
      else if (gDesc) { dt = gDesc.tipo; dv = Number(gDesc.valor); pn = `Grupo de ${grupo.length}`; }
      let final = aplicarDescuento(lista, dt, dv); if (!pid && gDesc) final = Math.round(final / 1000) * 1000;
      if (precioManual && m.id === persona.id && !usarGrupo) final = Number(precioManual);
      return { m, pl, lista, dt, dv, pn, pid, final };
    });
  }, [usarGrupo, grupo, persona, planId, planesGrupo, promo, gDesc, precioManual, idx]);
  const total = filas.reduce((a: number, f: any) => a + f.final, 0);

  const guardar = async () => {
    setBusy(true);
    try {
      const gid = filas.length > 1 ? uid() : null;
      const rows = filas.map((f: any) => ({
        persona_id: f.m.id, plan_id: f.pl?.id, plan_nombre: f.pl?.nombre, clases_semana: f.pl?.clases_semana, tipo: f.pl?.tipo === 'unica' ? 'unica' : 'mensual',
        precio_lista: f.lista, promo_id: f.pid, promo_nombre: f.pn || null, descuento_tipo: f.dt, descuento_valor: f.dv, precio_final: f.final,
        inicio, fin: f.pl?.tipo === 'unica' ? inicio : subFin(inicio), pago_fecha: pagarAhora ? pagoFecha : null, pago_metodo_id: pagarAhora ? metodo || null : null, pago_monto: pagarAhora ? f.final : null, grupo_pago: gid,
      }));
      const creadas: any[] = await ins('suscripciones', rows);
      if (sinPrueba) await upd('personas', persona.id, { sin_prueba: true });
      // horario fijo de quien se inscribe
      let horariosFinal: Slot[] = actuales.map((h) => ({ dia: h.dia, hora: hm(h.hora) }));
      if (!esUnica && !sinHorario) {
        const nuevos = slots; const key = (s: Slot) => s.dia + '|' + s.hora;
        for (const h of actuales) if (!nuevos.some((n) => key(n) === h.dia + '|' + hm(h.hora))) await upd('horarios', h.id, { activo: false });
        const profe = me?.profesora_id || d.profesoras.find((p: any) => p.tipo === 'fija')?.id || null;
        const aInsertar = nuevos.filter((n) => !actuales.some((h) => h.dia + '|' + hm(h.hora) === key(n))).map((n) => ({ persona_id: persona.id, dia: n.dia, hora: n.hora, profesora_id: profe, activo: true }));
        if (aInsertar.length) await ins('horarios', aInsertar);
        horariosFinal = nuevos;
      }
      // clases del período
      const profe = me?.profesora_id || d.profesoras.find((p: any) => p.tipo === 'fija')?.id || null; let total = 0, omit = 0;
      for (let i = 0; i < filas.length; i++) {
        const m = filas[i].m; const sub = creadas[i]; if (filas[i].pl?.tipo === 'unica') continue;
        const hs: Slot[] = m.id === persona.id ? horariosFinal : (idx.horByP.get(m.id) || []).map((h: any) => ({ dia: h.dia, hora: hm(h.hora) }));
        if (!hs.length || (m.id === persona.id && sinHorario)) continue;
        const { rows: cl, omitidas } = filasClases(m, sub, hs, d, hoy, profe); omit += omitidas;
        if (cl.length) { await ins('clases', cl); total += cl.length; }
      }
      toast(`Inscripción guardada${total ? ` · ${total} clases agendadas` : ''}${omit ? ` · ${omit} omitidas por bloqueos` : ''}`); onDone?.(); onClose();
    } catch (e: any) { toast('Error: ' + e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title={prev ? `Renovar · ${persona.nombre}` : `Inscribir · ${persona.nombre}`} onClose={onClose} wide>
      <div className="stack">
        <Field label="Plan"><select value={planId} onChange={(e) => setPlanId(e.target.value)}>{planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} · {gs(p.precio)}{p.tipo !== 'unica' ? ` · ${p.clases_semana} clase${p.clases_semana === 1 ? '' : 's'}/sem` : ''}</option>)}</select></Field>
        {!esUnica && (<div className="box stack">
          <b>Días y horarios fijos <span className="muted small">({nSlots} por semana)</span></b>
          {!sinHorario && slots.map((s, i) => (
            <div className="row2" key={i}>
              <select value={s.dia} onChange={(e) => setSlot(i, { dia: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{DIA_L[n]}</option>)}</select>
              <select value={s.hora} onChange={(e) => setSlot(i, { hora: e.target.value })}>{horasOk.map((h) => <option key={h} value={h}>{h} · {fijasEn(s.dia, h)}/{cfg.cupo} fijas</option>)}</select>
            </div>))}
          {dupSlots && <span className="warn small">Hay dos horarios repetidos.</span>}
          <label className="check"><input type="checkbox" checked={sinHorario} onChange={(e) => setSinHorario(e.target.checked)} /> Definir el horario después (no agenda clases todavía)</label>
        </div>)}
        <Field label="Inicio" hint={`Cubre hasta el ${fmtDateY(fin)}`}><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
        {!(usarGrupo && grupo.length) && <Field label="Promo"><select value={promoId} onChange={(e) => setPromoId(e.target.value)}><option value="">Sin promo</option>{d.promos.filter((p: any) => p.activa !== false).map((p: any) => <option key={p.id} value={p.id}>{p.nombre}{p.duracion_meses ? ` · ${p.duracion_meses} mes(es)` : ' · permanente'}</option>)}</select></Field>}
        {grupo.length > 0 && <label className="check"><input type="checkbox" checked={usarGrupo} onChange={(e) => setUsarGrupo(e.target.checked)} /> Renovar el grupo completo ({grupo.map((g: any) => g.nombre.split(' ')[0]).join(', ')}){gDesc ? ` · descuento ${gDesc.valor}%` : ''}</label>}
        {usarGrupo && grupo.length > 0 && filas.map((f: any) => f.m.id !== persona.id && (
          <Field key={f.m.id} label={`Plan de ${f.m.nombre}`}><select value={f.pl?.id} onChange={(e) => setPlanesGrupo({ ...planesGrupo, [f.m.id]: e.target.value })}>{planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} · {gs(p.precio)}</option>)}</select></Field>))}
        {!usarGrupo && <Field label="Precio final (opcional, para ajustar)"><input inputMode="numeric" placeholder={String(filas[0]?.final || '')} value={precioManual} onChange={(e) => setPrecioManual(e.target.value.replace(/\D/g, ''))} /></Field>}
        <div className="box">{filas.map((f: any) => <div className="kv" key={f.m.id}><span>{f.m.nombre.split(' ')[0]} · {f.pl?.nombre}{f.pn ? ` (${f.pn})` : ''}</span><b>{gs(f.final)}</b></div>)}{filas.length > 1 && <div className="kv"><span>Total</span><b>{gs(total)}</b></div>}</div>
        {!hayPrueba && !prev && <label className="check"><input type="checkbox" checked={sinPrueba} onChange={(e) => setSinPrueba(e.target.checked)} /> Entra directo, sin clase de prueba</label>}
        <label className="check"><input type="checkbox" checked={pagarAhora} onChange={(e) => setPagarAhora(e.target.checked)} /> Registrar el pago ahora</label>
        {pagarAhora && <div className="row2"><Field label="Fecha de pago"><input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} /></Field><Field label="Método"><select value={metodo} onChange={(e) => setMetodo(e.target.value)}>{d.metodos.filter((m: any) => m.activo !== false).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Field></div>}
        <button className="btn big" disabled={busy || !plan || (!esUnica && !sinHorario && dupSlots)} onClick={guardar}>{pagarAhora ? 'Guardar y registrar pago' : 'Guardar (pago pendiente)'}</button>
      </div>
    </Sheet>
  );
}

export function PagoSheet({ sub, onClose }: { sub: any; onClose: () => void }) {
  const { d, hoy, upd, toast } = useApp();
  const [f, setF] = useState(sub.pago_fecha || hoy); const [m, setM] = useState(sub.pago_metodo_id || d.metodos[0]?.id || ''); const [monto, setMonto] = useState(String(sub.pago_monto ?? sub.precio_final ?? ''));
  return (
    <Sheet title="Pago de la suscripción" onClose={onClose}>
      <div className="stack">
        <div className="row2"><Field label="Fecha"><input type="date" value={f} onChange={(e) => setF(e.target.value)} /></Field><Field label="Método"><select value={m} onChange={(e) => setM(e.target.value)}>{d.metodos.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></Field></div>
        <Field label="Monto"><input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} /></Field>
        <button className="btn big" onClick={async () => { try { await upd('suscripciones', sub.id, { pago_fecha: f, pago_metodo_id: m || null, pago_monto: Number(monto) || 0 }); toast('Pago guardado'); onClose(); } catch (e: any) { toast('Error: ' + e.message); } }}>Guardar pago</button>
        {sub.pago_fecha && <button className="btn ghost danger" onClick={async () => { await upd('suscripciones', sub.id, { pago_fecha: null, pago_monto: null, pago_metodo_id: null }); onClose(); }}>Quitar pago</button>}
      </div>
    </Sheet>
  );
}
export { addMonths };
