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

