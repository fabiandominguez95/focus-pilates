import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, estadoPersona, personaStats } from '../logic';
import { Sheet, Field, Seg, Empty, useConfirm } from '../ui';
import { useWhats } from '../classes';
import { diffDays, fmtDate, gs, monthOf } from '../util';

export function Productos() {
  const { d, hoy, ins, upd, toast, isAdmin } = useApp(); const { ask, node } = useConfirm();
  const [sell, setSell] = useState<any>(null); const [edit, setEdit] = useState<any>(null);
  const prods = d.productos.filter((p: any) => p.activo !== false); const ventas = [...d.ventas].sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 15);
  const mesTotal = d.ventas.filter((v: any) => v.fecha && monthOf(v.fecha) === monthOf(hoy)).reduce((a: number, v: any) => a + (Number(v.total) || 0), 0);
  const ajustar = (p: any, n: number) => upd('productos', p.id, { stock: Math.max(0, (p.stock || 0) + n) }).catch((e: any) => toast(e.message));
  return (
    <div className="page">{node}
      <header className="page-head"><h1>Productos</h1>{isAdmin && <button className="btn sm" onClick={() => setEdit({})}>+ Producto</button>}</header>
      <div className="muted small pad">Ventas de {monthOf(hoy)}: <b>{gs(mesTotal)}</b>. Entran como ingreso extra aparte de las suscripciones.</div>
      <div className="list">{prods.length === 0 && <div className="muted pad">Sin productos todavía.</div>}
        {prods.map((p: any) => (
          <div className="row-card plain" key={p.id}>
            <div className="grow" onClick={() => isAdmin && setEdit(p)}><b>{p.nombre}</b><div className="small muted">{gs(p.precio)}</div></div>
            <div className="stepper"><button onClick={() => ajustar(p, -1)}>−</button><b className={p.stock <= 0 ? 'warn' : ''}>{p.stock || 0}</b><button onClick={() => ajustar(p, 1)}>+</button></div>
            <button className="btn sm" disabled={!p.stock} onClick={() => setSell(p)}>Vender</button></div>))}</div>
      <h3>Últimas ventas</h3><div className="list">{ventas.map((v: any) => <div className="kv" key={v.id}><span>{fmtDate(v.fecha)} · {v.nombre} × {v.cantidad}</span><b>{gs(v.total)}</b></div>)}</div>
      {sell && <Sheet title={`Vender ${sell.nombre}`} onClose={() => setSell(null)}><VentaForm p={sell} onClose={() => setSell(null)} /></Sheet>}
      {edit && <Sheet title={edit.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setEdit(null)}><ProdForm p={edit} onClose={() => setEdit(null)} /></Sheet>}
    </div>
  );
}
function VentaForm({ p, onClose }: { p: any; onClose: () => void }) {
  const { d, hoy, ins, upd, toast } = useApp(); const [n, setN] = useState(1); const [m, setM] = useState(d.metodos[0]?.id || '');
  return (<div className="stack"><Field label="Cantidad"><div className="stepper big"><button onClick={() => setN(Math.max(1, n - 1))}>−</button><b>{n}</b><button onClick={() => setN(Math.min(p.stock, n + 1))}>+</button></div></Field>
    <Field label="Método de pago"><select value={m} onChange={(e) => setM(e.target.value)}>{d.metodos.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></Field>
    <div className="box big-total"><span>Total</span><b>{gs(n * Number(p.precio))}</b></div>
    <button className="btn big" onClick={async () => { try { await ins('ventas', { producto_id: p.id, nombre: p.nombre, cantidad: n, precio_unit: p.precio, total: n * Number(p.precio), fecha: hoy, metodo_id: m || null }); await upd('productos', p.id, { stock: p.stock - n }); toast('Venta registrada'); onClose(); } catch (e: any) { toast('Error: ' + e.message); } }}>Registrar venta</button></div>);
}
function ProdForm({ p, onClose }: { p: any; onClose: () => void }) {
  const { ins, upd, toast } = useApp(); const [nombre, setNombre] = useState(p.nombre || ''); const [precio, setPrecio] = useState(String(p.precio || '')); const [stock, setStock] = useState(String(p.stock || 0));
  return (<div className="stack"><Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field><div className="row2"><Field label="Precio"><input inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))} /></Field><Field label="Stock"><input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} /></Field></div>
    <button className="btn big" disabled={!nombre.trim()} onClick={async () => { try { const row = { nombre: nombre.trim(), precio: Number(precio) || 0, stock: Number(stock) || 0 }; p.id ? await upd('productos', p.id, row) : await ins('productos', { ...row, activo: true }); onClose(); } catch (e: any) { toast('Error: ' + e.message); } }}>Guardar</button>
    {p.id && <button className="btn ghost danger" onClick={async () => { await upd('productos', p.id, { deleted_at: new Date().toISOString() }); onClose(); }}>Quitar producto</button>}</div>);
}

export function Recuperar({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy, isAdmin, upd, toast } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const wa = useWhats();
  const [tab, setTab] = useState<'no_se_inscribio' | 'no_renovo'>('no_se_inscribio');
  const lastContact = useMemo(() => { const m = new Map<string, string>(); d.avisos.forEach((a: any) => { if (!a.tipo.startsWith('invitacion')) return; const f = (a.creado_en || '').slice(0, 10); if (!m.has(a.persona_id) || f > m.get(a.persona_id)!) m.set(a.persona_id, f); }); return m; }, [d.avisos]);
  const rows = useMemo(() => d.personas.map((p: any) => ({ p, e: estadoPersona(p, idx, cfg, hoy), s: personaStats(p, idx, hoy, cfg.recup_dias) })).filter((r: any) => r.e.stage === tab), [d, idx, cfg, hoy, tab]);
  const items = rows.map((r: any) => { const lc = lastContact.get(r.p.id); const since = lc ? diffDays(hoy, lc) : null; const ok = !r.p.no_contactar && !!r.p.celular && (since === null || since >= cfg.espera_contacto_dias); return { ...r, lc, since, ok }; });
  const listos = items.filter((x: any) => x.ok).sort((a: any, b: any) => (b.s.ultima || '').localeCompare(a.s.ultima || '')); const esperando = items.filter((x: any) => !x.ok);
  const escribir = (x: any) => wa(x.p, tab === 'no_se_inscribio' ? 'invitacion_prueba' : 'invitacion_inactiva', {}, { tipo: tab === 'no_se_inscribio' ? 'invitacion_prueba' : 'invitacion_inactiva', ref: hoy });
  return (
    <div className="page"><header className="page-head"><h1>Recuperar contactos</h1></header>
      <Seg value={tab} onChange={setTab} options={[['no_se_inscribio', 'Solo hicieron prueba'], ['no_renovo', 'Dejaron de venir']]} />
      <div className="muted small pad">{listos.length} para escribir ahora · espera de {cfg.espera_contacto_dias} días entre mensajes (se cambia en Configuración).</div>
      {listos.length === 0 && <Empty>No hay nadie para contactar ahora.</Empty>}
      <div className="list">{listos.map((x: any) => (
        <div className="row-card plain" key={x.p.id}><div className="grow" onClick={() => openPersona(x.p.id)}><b>{x.p.nombre}</b><div className="small muted">{x.s.ultima ? `última clase ${fmtDate(x.s.ultima)}` : 'sin clases'}{x.lc ? ` · le escribiste hace ${x.since} d` : ''}</div></div>
          <button className="btn sm" onClick={() => escribir(x)}>Invitar</button>
          {isAdmin && <button className="x2" title="No contactar" onClick={() => upd('personas', x.p.id, { no_contactar: true }).then(() => toast('Marcada como no contactar'))}>⊘</button>}</div>))}</div>
      {esperando.length > 0 && <><h3>En espera / no contactar ({esperando.length})</h3><div className="list dim">{esperando.map((x: any) => (
        <div className="row-card plain" key={x.p.id} onClick={() => openPersona(x.p.id)}><div className="grow"><b>{x.p.nombre}</b><div className="small muted">{x.p.no_contactar ? 'No contactar' : !x.p.celular ? 'Sin celular' : `le escribiste hace ${x.since} d · de nuevo en ${cfg.espera_contacto_dias - x.since} d`}</div></div></div>))}</div></>}
    </div>
  );
}
