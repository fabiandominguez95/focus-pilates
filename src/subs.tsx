import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { buildIndex } from './logic';
import { Sheet, Field } from './ui';
import { addDays, diffDays, gs, subFin, uid, fmtDateY, addMonths } from './util';

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
function promoSugerida(personaId: string, idx: any, d: any, inicio: string) {
  const subs = idx.subsByP.get(personaId) || []; const last = [...subs].reverse().find((s: any) => s.promo_id);
  if (!last) return '';
  const promo = d.promos.find((x: any) => x.id === last.promo_id); if (!promo || promo.activa === false) return '';
  if (!promo.duracion_meses) return promo.id; // permanente
  const first = subs.filter((s: any) => s.promo_id === promo.id).sort((a: any, b: any) => a.inicio.localeCompare(b.inicio))[0];
  const meses = subs.filter((s: any) => s.promo_id === promo.id).length;
  return first && meses < promo.duracion_meses ? promo.id : '';
}

export function RenewSheet({ persona, onClose, soloPlan }: { persona: any; onClose: () => void; soloPlan?: boolean }) {
  const { d, cfg, hoy, ins, toast } = useApp();
  const idx = useMemo(() => buildIndex(d), [d]);
  const subs = idx.subsByP.get(persona.id) || []; const prev = [...subs].filter((s: any) => s.tipo !== 'unica').pop();
  const planes = d.planes.filter((p: any) => p.activo !== false);
  const defInicio = prev ? (diffDays(hoy, prev.fin) > 0 && diffDays(hoy, prev.fin) > cfg.inactiva_dias ? hoy : addDays(prev.fin, 1)) : hoy;
  const [inicio, setInicio] = useState(defInicio);
  const [planId, setPlanId] = useState(prev?.plan_id || planes.find((p: any) => p.tipo !== 'unica')?.id || planes[0]?.id);
  const plan = idx.planById.get(planId);
  const [promoId, setPromoId] = useState(promoSugerida(persona.id, idx, d, inicio));
  const promo = d.promos.find((x: any) => x.id === promoId);
  const grupo = useMemo(() => grupoDe(persona, d), [persona, d]);
  const [usarGrupo, setUsarGrupo] = useState(grupo.length > 0);
  const [planesGrupo, setPlanesGrupo] = useState<Record<string, string>>({});
  const [pagarAhora, setPagarAhora] = useState(true); const [pagoFecha, setPagoFecha] = useState(hoy);
  const [metodo, setMetodo] = useState(d.metodos.find((m: any) => m.activo !== false)?.id || '');
  const [precioManual, setPrecioManual] = useState(''); const [busy, setBusy] = useState(false);
  const esUnica = plan?.tipo === 'unica';
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
      let fin = aplicarDescuento(lista, dt, dv); if (!pid && gDesc) fin = Math.round(fin / 1000) * 1000;
      if (precioManual && m.id === persona.id && !usarGrupo) fin = Number(precioManual);
      return { m, pl, lista, dt, dv, pn, pid, final: fin };
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
      await ins('suscripciones', rows);
      toast(filas.length > 1 ? `Suscripciones registradas (${filas.length})` : 'Suscripción registrada ✓'); onClose();
    } catch (e: any) { toast('Error: ' + e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title={prev ? `Renovar · ${persona.nombre}` : `Inscribir · ${persona.nombre}`} onClose={onClose}>
      <div className="stack">
        <Field label="Plan"><select value={planId} onChange={(e) => setPlanId(e.target.value)}>{planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} · {gs(p.precio)}</option>)}</select></Field>
        <Field label="Inicio" hint={`Cubre hasta el ${fmtDateY(fin)}`}><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>
        {!(usarGrupo && grupo.length) && <Field label="Promo"><select value={promoId} onChange={(e) => setPromoId(e.target.value)}><option value="">Sin promo</option>{d.promos.filter((p: any) => p.activa !== false).map((p: any) => <option key={p.id} value={p.id}>{p.nombre}{p.duracion_meses ? ` · ${p.duracion_meses} mes(es)` : ' · permanente'}</option>)}</select></Field>}
        {grupo.length > 0 && <label className="check"><input type="checkbox" checked={usarGrupo} onChange={(e) => setUsarGrupo(e.target.checked)} /> Renovar el grupo completo ({grupo.map((g: any) => g.nombre.split(' ')[0]).join(', ')}){gDesc ? ` · descuento ${gDesc.valor}${gDesc.tipo === 'porcentaje' ? '%' : ' Gs'}` : ''}</label>}
        {usarGrupo && grupo.length > 0 && filas.map((f: any) => f.m.id !== persona.id && (
          <Field key={f.m.id} label={`Plan de ${f.m.nombre}`}><select value={f.pl?.id} onChange={(e) => setPlanesGrupo({ ...planesGrupo, [f.m.id]: e.target.value })}>{planes.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} · {gs(p.precio)}</option>)}</select></Field>))}
        {!usarGrupo && <Field label="Precio final (opcional, para ajustar)"><input inputMode="numeric" placeholder={String(filas[0]?.final || '')} value={precioManual} onChange={(e) => setPrecioManual(e.target.value.replace(/\D/g, ''))} /></Field>}
        <div className="box">{filas.map((f: any) => <div className="kv" key={f.m.id}><span>{f.m.nombre.split(' ')[0]} · {f.pl?.nombre}{f.pn ? ` (${f.pn})` : ''}</span><b>{gs(f.final)}</b></div>)}{filas.length > 1 && <div className="kv"><span>Total</span><b>{gs(total)}</b></div>}</div>
        <label className="check"><input type="checkbox" checked={pagarAhora} onChange={(e) => setPagarAhora(e.target.checked)} /> Registrar el pago ahora</label>
        {pagarAhora && <div className="row2"><Field label="Fecha de pago"><input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} /></Field><Field label="Método"><select value={metodo} onChange={(e) => setMetodo(e.target.value)}>{d.metodos.filter((m: any) => m.activo !== false).map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Field></div>}
        <button className="btn big" disabled={busy || !plan} onClick={guardar}>{pagarAhora ? 'Guardar y registrar pago' : 'Guardar (pago pendiente)'}</button>
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
