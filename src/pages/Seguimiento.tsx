import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, estadoPersona, personaStats, COLOR_NAME } from '../logic';
import { Seg, Empty } from '../ui';
import { useWhats } from '../classes';
import { RenewSheet } from '../subs';
import { addDays, diffDays, fmtDate } from '../util';

// Cálculo compartido con Home (para el check único "Revisar seguimiento")
export function useSeguimiento() {
  const { d, cfg, hoy, isAdmin } = useApp(); const idx = useMemo(() => buildIndex(d), [d]);
  const avisosSet = useMemo(() => { const s = new Set<string>(); d.avisos.forEach((a: any) => s.add(a.tipo + '|' + a.ref + '|' + a.persona_id)); return s; }, [d.avisos]);
  const { pagos, renov } = useMemo(() => {
    const pagos: any[] = [], renov: any[] = []; const offs = [...(cfg.avisos_offsets || [-3, 0, 2])].sort((a: number, b: number) => a - b);
    d.personas.forEach((p: any) => {
      const e = estadoPersona(p, idx, cfg, hoy); const s = e.sub; if (!s || s.tipo === 'unica' || e.stage !== 'inscripta') return;
      const subs = idx.subsByP.get(p.id) || []; if (subs.some((x: any) => x.tipo !== 'unica' && x.inicio > s.inicio)) return;
      const due = addDays(s.fin, 1); const dias = diffDays(hoy, due);
      if (e.impago) renov.push({ p, e, tipo: 'impago', dias: e.atraso });
      else if (dias >= -cfg.aviso_renovacion_dias) renov.push({ p, e, tipo: dias > 0 ? 'vencida' : 'por_vencer', dias });
      const dueOffs = offs.filter((o: number) => diffDays(hoy, addDays(due, o)) >= 0);
      if (dueOffs.length && s.inicio <= hoy) {
        const o = Math.max(...dueOffs); const sent = offs.some((x: number) => x >= o && avisosSet.has('renovacion|' + s.id + ':' + x + '|' + p.id));
        if (!sent && dias <= cfg.inactiva_dias) pagos.push({ p, s, o, dias, due });
      }
    });
    renov.sort((a, b) => b.dias - a.dias); pagos.sort((a, b) => b.dias - a.dias);
    return { pagos, renov };
  }, [d, idx, cfg, hoy, avisosSet]);
  const pendientes = pagos.length + (isAdmin ? renov.length : 0);
  return { idx, pagos, renov, pendientes };
}

export default function Seguimiento({ openPersona }: { openPersona: (id: string) => void }) {
  const { isAdmin } = useApp(); const sg = useSeguimiento();
  const [tab, setTab] = useState<'pagos' | 'renov' | 'react'>('pagos');
  return (
    <div className="page"><header className="page-head"><h1>Seguimiento</h1></header>
      <Seg value={tab} onChange={setTab} options={[['pagos', `Recordar pagos${sg.pagos.length ? ' · ' + sg.pagos.length : ''}`], ...(isAdmin ? [['renov', `Recordar renovaciones${sg.renov.length ? ' · ' + sg.renov.length : ''}`] as [any, string]] : []), ['react', 'Reactivar clientes']]} />
      {tab === 'pagos' && <Pagos sg={sg} />}
      {tab === 'renov' && isAdmin && <Renov sg={sg} openPersona={openPersona} />}
      {tab === 'react' && <Reactivar openPersona={openPersona} />}
    </div>
  );
}

function Pagos({ sg }: { sg: any }) {
  const wa = useWhats();
  return (<div>
    <div className="muted small pad">Clientes a quienes avisar que se acerca o pasó su vencimiento. Al escribir por WhatsApp salen de la lista.</div>
    {sg.pagos.length === 0 && <Empty>Nadie a quien recordarle por ahora.</Empty>}
    <div className="list">{sg.pagos.map(({ p, s, o, dias, due }: any) => (
      <div className="row-card plain" key={p.id}><div className="grow"><b>{p.nombre}</b><div className="small muted">{dias < 0 ? `renueva en ${-dias} día${dias === -1 ? '' : 's'}` : dias === 0 ? 'renueva hoy' : `venció hace ${dias} día${dias === 1 ? '' : 's'}`}</div></div>
        <button className="btn sm" onClick={() => wa(p, o > 0 ? 'atraso' : 'renovacion', { vence: fmtDate(due), plan: s.plan_nombre || 'plan' }, { tipo: 'renovacion', ref: s.id + ':' + o })}>WhatsApp</button></div>))}</div>
  </div>);
}

function Renov({ sg, openPersona }: { sg: any; openPersona: (id: string) => void }) {
  const [renew, setRenew] = useState<any>(null);
  return (<div>
    <div className="muted small pad">Renovaciones por vencer, vencidas y pagos pendientes. Tocá «Renovar» para registrar el nuevo período.</div>
    {sg.renov.length === 0 && <Empty>No hay renovaciones pendientes.</Empty>}
    <div className="list">{sg.renov.map(({ p, e, tipo, dias }: any) => (
      <div className={'row-card plain c-' + (e.color || (tipo === 'por_vencer' ? 'soon' : ''))} key={p.id}>
        <div className="grow" onClick={() => openPersona(p.id)}><b>{p.nombre}</b><div className="small muted">{e.sub.plan_nombre} · {tipo === 'impago' ? `sin pago hace ${dias} d` : tipo === 'por_vencer' ? (dias === 0 ? 'renueva hoy' : `renueva en ${-dias} d`) : `vencida hace ${dias} d`}{e.color ? ` · ${COLOR_NAME[e.color]}` : ''}</div></div>
        <button className="btn sm" onClick={() => setRenew(p)}>Renovar</button></div>))}</div>
    {renew && <RenewSheet persona={renew} onClose={() => setRenew(null)} />}
  </div>);
}

function Reactivar({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy, isAdmin, upd, toast } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const wa = useWhats();
  const [tab, setTab] = useState<'no_se_inscribio' | 'no_renovo'>('no_se_inscribio');
  const lastContact = useMemo(() => { const m = new Map<string, string>(); d.avisos.forEach((a: any) => { if (!a.tipo.startsWith('invitacion')) return; const f = (a.creado_en || '').slice(0, 10); if (!m.has(a.persona_id) || f > m.get(a.persona_id)!) m.set(a.persona_id, f); }); return m; }, [d.avisos]);
  const rows = useMemo(() => d.personas.map((p: any) => ({ p, e: estadoPersona(p, idx, cfg, hoy), s: personaStats(p, idx, hoy, cfg.recup_dias) })).filter((r: any) => r.e.stage === tab && !r.p.baneado), [d, idx, cfg, hoy, tab]);
  const items = rows.map((r: any) => { const lc = lastContact.get(r.p.id); const since = lc ? diffDays(hoy, lc) : null; const g = r.p.no_contactar ? 'nc' : !r.p.celular ? 'sc' : since !== null && since < cfg.espera_contacto_dias ? 'esp' : 'ok'; return { ...r, lc, since, g }; });
  const listos = items.filter((x: any) => x.g === 'ok').sort((a: any, b: any) => (b.s.ultima || '').localeCompare(a.s.ultima || ''));
  const esperando = items.filter((x: any) => x.g === 'esp'); const sinCel = items.filter((x: any) => x.g === 'sc'); const noCont = items.filter((x: any) => x.g === 'nc');
  const [open, setOpen] = useState<{ sc: boolean; nc: boolean }>({ sc: false, nc: false });
  const escribir = (x: any) => wa(x.p, tab === 'no_se_inscribio' ? 'invitacion_prueba' : 'invitacion_inactiva', {}, { tipo: tab === 'no_se_inscribio' ? 'invitacion_prueba' : 'invitacion_inactiva', ref: hoy });
  const devolverEspera = async (x: any) => { try { for (const a of d.avisos.filter((a: any) => a.persona_id === x.p.id && a.tipo.startsWith('invitacion'))) await upd('avisos', a.id, { deleted_at: new Date().toISOString() }); toast('Volvió a la lista'); } catch (e: any) { toast('Error: ' + e.message); } };
  const devolverNc = (x: any) => upd('personas', x.p.id, { no_contactar: false }).then(() => toast('Volvió a la lista')).catch((e: any) => toast('Error: ' + e.message));
  const Fila = ({ x, sub, btn }: any) => <div className="row-card plain" onClick={() => openPersona(x.p.id)}><div className="grow"><b>{x.p.nombre}</b><div className="small muted">{sub}</div></div>{btn && <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); btn[1](); }}>{btn[0]}</button>}</div>;
  return (<div>
    <div className="muted small pad">Invitá a volver a quienes hicieron la prueba y no siguieron, o dejaron de venir.</div>
    <Seg value={tab} onChange={setTab} options={[['no_se_inscribio', 'Solo hicieron prueba'], ['no_renovo', 'Dejaron de venir']]} />
    <div className="muted small pad">{listos.length} para escribir ahora · espera de {cfg.espera_contacto_dias} días entre mensajes (se cambia en Configuración).</div>
    {listos.length === 0 && <Empty>No hay nadie para contactar ahora.</Empty>}
    <div className="list">{listos.map((x: any) => (
      <div className="row-card plain" key={x.p.id}><div className="grow" onClick={() => openPersona(x.p.id)}><b>{x.p.nombre}</b><div className="small muted">{x.s.ultima ? `última clase ${fmtDate(x.s.ultima)}` : 'sin clases'}{x.lc ? ` · le escribiste hace ${x.since} d` : ''}</div></div>
        <button className="btn sm" onClick={() => escribir(x)}>Invitar</button>
        {isAdmin && <button className="x2" title="No contactar" onClick={() => upd('personas', x.p.id, { no_contactar: true }).then(() => toast('Marcada como no contactar'))}>⊘</button>}</div>))}</div>
    {esperando.length > 0 && <><h3>En espera ({esperando.length})</h3><div className="muted small pad">Ya se les escribió; vuelven solos a los {cfg.espera_contacto_dias} días. Podés devolverlos antes.</div><div className="list dim">{esperando.map((x: any) => <Fila key={x.p.id} x={x} sub={`le escribiste hace ${x.since} d · de nuevo en ${cfg.espera_contacto_dias - x.since} d`} btn={['Devolver a la lista', () => devolverEspera(x)]} />)}</div></>}
    {sinCel.length > 0 && <div style={{ marginTop: 14 }}>
      <button className="btn ghost sm" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => setOpen({ ...open, sc: !open.sc })}>{open.sc ? '▾' : '▸'} Sin celular ({sinCel.length})</button>
      {open.sc && <div className="list dim" style={{ marginTop: 6 }}>{sinCel.map((x: any) => <Fila key={x.p.id} x={x} sub="Sin celular: cargalo en su perfil para poder invitarlo/a" />)}</div>}
    </div>}
    {noCont.length > 0 && <div style={{ marginTop: 14 }}>
      <button className="btn ghost sm" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => setOpen({ ...open, nc: !open.nc })}>{open.nc ? '▾' : '▸'} No contactar ({noCont.length})</button>
      {open.nc && <div className="list dim" style={{ marginTop: 6 }}>{noCont.map((x: any) => <Fila key={x.p.id} x={x} sub="Marcado/a como no contactar" btn={isAdmin ? ['Devolver a la lista', () => devolverNc(x)] : null} />)}</div>}
    </div>}
  </div>);
}
