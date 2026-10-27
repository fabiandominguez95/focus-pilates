import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, estadoPersona, personaStats, COLOR_NAME } from '../logic';
import { Seg, Empty } from '../ui';
import { useWhats } from '../classes';
import { RenewSheet } from '../subs';
import { useNoRenueva, NoRenuevaSheet } from '../norenueva';
import { usePromo, PromoBadge, PromoAsk, NotaSheet } from '../promo';
import { addDays, diffDays, fmtDate, hm, diaRel } from '../util';

// Cálculo compartido con Home (para el check único "Revisar seguimiento")
export function useSeguimiento() {
  const { d, cfg, hoy, isAdmin } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const nr = useNoRenueva();
  const avisosSet = useMemo(() => { const s = new Set<string>(); d.avisos.forEach((a: any) => s.add(a.tipo + '|' + a.ref + '|' + a.persona_id)); return s; }, [d.avisos]);
  const { pagos, renov } = useMemo(() => {
    const pagos: any[] = [], renov: any[] = []; const offs = [...(cfg.avisos_offsets || [-3, 0, 2])].sort((a: number, b: number) => a - b);
    d.personas.forEach((p: any) => {
      const e = estadoPersona(p, idx, cfg, hoy); const s = e.sub; if (!s || s.tipo === 'unica' || e.stage !== 'inscripta') return;
      const subs = idx.subsByP.get(p.id) || []; if (subs.some((x: any) => x.tipo !== 'unica' && x.inicio > s.inicio)) return;
      if (nr.marcado(p.id, s)) return;
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
  }, [d, idx, cfg, hoy, avisosSet, nr.map]);
  const pendientes = pagos.length + (isAdmin ? renov.length : 0);
  return { idx, pagos, renov, pendientes };
}

export default function Seguimiento({ openPersona }: { openPersona: (id: string) => void }) {
  const { isAdmin } = useApp(); const sg = useSeguimiento();
  const [tab, setTab] = useState<'pagos' | 'renov' | 'react' | 'pruebas'>('pagos');
  return (
    <div className="page"><header className="page-head"><h1>Seguimiento</h1></header>
      <Seg value={tab} onChange={setTab} options={[['pagos', `Recordar pagos${sg.pagos.length ? ' · ' + sg.pagos.length : ''}`], ...(isAdmin ? [['renov', `Recordar renovaciones${sg.renov.length ? ' · ' + sg.renov.length : ''}`] as [any, string]] : []), ['react', 'Reactivar clientes'], ['pruebas', 'Pruebas']]} />
      {tab === 'pagos' && <Pagos sg={sg} />}
      {tab === 'renov' && isAdmin && <Renov sg={sg} openPersona={openPersona} />}
      {tab === 'react' && <Reactivar openPersona={openPersona} />}
      {tab === 'pruebas' && <Pruebas openPersona={openPersona} />}
    </div>
  );
}

function Pagos({ sg }: { sg: any }) {
  const wa = useWhats(); const [nrT, setNrT] = useState<any>(null);
  return (<div>
    <div className="muted small pad">Clientes a quienes avisar que se acerca o pasó su vencimiento. Al escribir por WhatsApp salen de la lista.</div>
    {sg.pagos.length === 0 && <Empty>Nadie a quien recordarle por ahora.</Empty>}
    <div className="list">{sg.pagos.map(({ p, s, o, dias, due }: any) => (
      <div className="row-card plain" key={p.id}><div className="grow"><b>{p.nombre}</b><div className="small muted">{dias < 0 ? `renueva en ${-dias} día${dias === -1 ? '' : 's'}` : dias === 0 ? 'renueva hoy' : `venció hace ${dias} día${dias === 1 ? '' : 's'}`}</div></div>
        <button className="btn sm ghost" onClick={() => setNrT({ p, sub: s })}>No renovará</button>
        <button className="btn sm" onClick={() => wa(p, o > 0 ? 'atraso' : 'renovacion', { vence: fmtDate(due), plan: s.plan_nombre || 'plan' }, { tipo: 'renovacion', ref: s.id + ':' + o })}>WhatsApp</button></div>))}</div>
    {nrT && <NoRenuevaSheet p={nrT.p} sub={nrT.sub} onClose={() => setNrT(null)} />}
  </div>);
}

function Renov({ sg, openPersona }: { sg: any; openPersona: (id: string) => void }) {
  const [renew, setRenew] = useState<any>(null); const [nrT, setNrT] = useState<any>(null);
  return (<div>
    <div className="muted small pad">Renovaciones por vencer, vencidas y pagos pendientes. Tocá «Renovar» para registrar el nuevo período.</div>
    {sg.renov.length === 0 && <Empty>No hay renovaciones pendientes.</Empty>}
    <div className="list">{sg.renov.map(({ p, e, tipo, dias }: any) => (
      <div className={'row-card plain c-' + (e.color || (tipo === 'por_vencer' ? 'soon' : ''))} key={p.id}>
        <div className="grow" onClick={() => openPersona(p.id)}><b>{p.nombre}</b><div className="small muted">{e.sub.plan_nombre} · {tipo === 'impago' ? `sin pago hace ${dias} d` : tipo === 'por_vencer' ? (dias === 0 ? 'renueva hoy' : `renueva en ${-dias} d`) : `vencida hace ${dias} d`}{e.color ? ` · ${COLOR_NAME[e.color]}` : ''}</div></div>
        <button className="btn sm ghost" onClick={() => setNrT({ p, sub: e.sub })}>No renovará</button>
        <button className="btn sm" onClick={() => setRenew(p)}>Renovar</button></div>))}</div>
    {nrT && <NoRenuevaSheet p={nrT.p} sub={nrT.sub} onClose={() => setNrT(null)} />}
    {renew && <RenewSheet persona={renew} onClose={() => setRenew(null)} />}
  </div>);
}

function Reactivar({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy, isAdmin, upd, toast } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const wa = useWhats(); const nrv = useNoRenueva(); const promo = usePromo(); const [askP, setAskP] = useState<any>(null); const [renewP, setRenewP] = useState<any>(null); const [notaP, setNotaP] = useState<any>(null);
  const [tab, setTab] = useState<'no_se_inscribio' | 'no_vino' | 'no_renovo'>('no_se_inscribio');
  const lastContact = useMemo(() => { const m = new Map<string, string>(); d.avisos.forEach((a: any) => { if (!a.tipo.startsWith('invitacion')) return; const f = (a.creado_en || '').slice(0, 10); if (!m.has(a.persona_id) || f > m.get(a.persona_id)!) m.set(a.persona_id, f); }); return m; }, [d.avisos]);
  const rows = useMemo(() => d.personas.map((p: any) => ({ p, e: estadoPersona(p, idx, cfg, hoy), s: personaStats(p, idx, hoy, cfg.recup_dias) })).filter((r: any) => (tab === 'no_vino' ? r.e.stage === 'no_se_inscribio' && !r.s.ultima : tab === 'no_se_inscribio' ? r.e.stage === 'no_se_inscribio' && !!r.s.ultima : r.e.stage === tab) && !r.p.baneado), [d, idx, cfg, hoy, tab]);
  const items = rows.map((r: any) => { const lc = lastContact.get(r.p.id); const since = lc ? diffDays(hoy, lc) : null; const g = r.p.no_contactar || nrv.map.has(r.p.id) ? 'nc' : !r.p.celular ? 'sc' : since !== null && since < cfg.espera_contacto_dias ? 'esp' : 'ok'; return { ...r, lc, since, g }; });
  const listos = items.filter((x: any) => x.g === 'ok').sort((a: any, b: any) => (b.s.ultima || '').localeCompare(a.s.ultima || ''));
  const esperando = items.filter((x: any) => x.g === 'esp'); const sinCel = items.filter((x: any) => x.g === 'sc'); const noCont = items.filter((x: any) => x.g === 'nc');
  const [open, setOpen] = useState<{ sc: boolean; nc: boolean }>({ sc: false, nc: false });
  const tplT = tab === 'no_se_inscribio' ? 'invitacion_prueba' : tab === 'no_vino' ? 'invitacion_novino' : 'invitacion_inactiva'; const enviar = (x: any) => wa(x.p, tplT, {}, { tipo: tplT, ref: hoy });
  const escribir = (x: any) => { if (isAdmin) setAskP(x); else enviar(x); };
  const devolverEspera = async (x: any) => { try { for (const a of d.avisos.filter((a: any) => a.persona_id === x.p.id && a.tipo.startsWith('invitacion'))) await upd('avisos', a.id, { deleted_at: new Date().toISOString() }); toast('Volvió a la lista'); } catch (e: any) { toast('Error: ' + e.message); } };
  const devolverNc = (x: any) => Promise.all([upd('personas', x.p.id, { no_contactar: false }), nrv.map.has(x.p.id) ? nrv.deshacer(x.p.id) : null]).then(() => toast('Volvió a la lista')).catch((e: any) => toast('Error: ' + e.message));
  const Fila = ({ x, sub, btn, btn2 }: any) => <div className="row-card plain" onClick={() => openPersona(x.p.id)}><div className="grow"><b>{x.p.nombre}</b> <PromoBadge id={x.p.id} /><div className="small muted">{sub}</div></div>{btn2 && <button className="btn sm" onClick={(e) => { e.stopPropagation(); btn2[1](); }}>{btn2[0]}</button>}{btn && <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); btn[1](); }}>{btn[0]}</button>}</div>;
  return (<div>
    <div className="muted small pad">Invitá a volver a quienes hicieron la prueba y no siguieron, o dejaron de venir.</div>
    <Seg value={tab} onChange={setTab} options={[['no_se_inscribio', 'Hicieron prueba'], ['no_vino', 'Agendaron y no vinieron'], ['no_renovo', 'Dejaron de venir']]} />
    <div className="muted small pad">{listos.length} para escribir ahora · espera de {cfg.espera_contacto_dias} días entre mensajes (se cambia en Configuración).</div>
    {listos.length === 0 && <Empty>No hay nadie para contactar ahora.</Empty>}
    <div className="list">{listos.map((x: any) => (
      <div className="row-card plain" key={x.p.id}><div className="grow" onClick={() => openPersona(x.p.id)}><b>{x.p.nombre}</b> <PromoBadge id={x.p.id} /><div className="small muted">{x.s.ultima ? `última clase ${fmtDate(x.s.ultima)}` : 'agendó prueba y no vino'}{x.lc ? ` · le escribiste hace ${x.since} d` : ''}</div></div>
        <button className="btn sm" onClick={() => escribir(x)}>Invitar</button>
        {isAdmin && <button className="x2" title="No contactar" onClick={() => upd('personas', x.p.id, { no_contactar: true }).then(() => toast('Marcada como no contactar'))}>⊘</button>}</div>))}</div>
    {esperando.length > 0 && <><h3>En espera ({esperando.length})</h3><div className="muted small pad">Ya se les escribió; vuelven solos a los {cfg.espera_contacto_dias} días. Podés devolverlos antes.</div><div className="list dim">{esperando.map((x: any) => <Fila key={x.p.id} x={x} sub={`le escribiste hace ${x.since} d · de nuevo en ${cfg.espera_contacto_dias - x.since} d`} btn={['Devolver a la lista', () => devolverEspera(x)]} btn2={isAdmin ? ['Renovar', () => setRenewP(x.p)] : null} />)}</div></>}
    {sinCel.length > 0 && <div style={{ marginTop: 14 }}>
      <button className="btn ghost sm" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => setOpen({ ...open, sc: !open.sc })}>{open.sc ? '▾' : '▸'} Sin celular ({sinCel.length})</button>
      {open.sc && <div className="list dim" style={{ marginTop: 6 }}>{sinCel.map((x: any) => <Fila key={x.p.id} x={x} sub="Sin celular: cargalo en su perfil para poder invitarlo/a" />)}</div>}
    </div>}
    {noCont.length > 0 && <div style={{ marginTop: 14 }}>
      <button className="btn ghost sm" style={{ display: 'block', width: '100%', textAlign: 'left' }} onClick={() => setOpen({ ...open, nc: !open.nc })}>{open.nc ? '▾' : '▸'} No contactar ({noCont.length})</button>
      {open.nc && <div className="list dim" style={{ marginTop: 6 }}>{noCont.map((x: any) => <Fila key={x.p.id} x={x} sub={nrv.map.get(x.p.id) ? `Ya no va a renovar${nrv.map.get(x.p.id)!.motivo ? ': ' + nrv.map.get(x.p.id)!.motivo : ''}` : x.p.nocont_nota ? 'No contactar: ' + x.p.nocont_nota : 'Marcado/a como no contactar'} btn2={isAdmin ? ['Nota', () => setNotaP(x.p)] : null} btn={isAdmin ? ['Devolver a la lista', () => devolverNc(x)] : null} />)}</div>}
    </div>}
    {askP && <PromoAsk p={askP.p} onClose={() => setAskP(null)} onChoose={async (si) => { const x = askP; setAskP(null); if (si) await promo.ofrecer(x.p); enviar(x); }} />}
    {renewP && <RenewSheet persona={renewP} onClose={() => setRenewP(null)} />}
    {notaP && <NotaSheet title={`Nota · ${notaP.nombre}`} value={notaP.nocont_nota || ''} hint="Por qué no se la contacta. Solo la ve el admin." onSave={(v) => upd('personas', notaP.id, { nocont_nota: v || null })} onClose={() => setNotaP(null)} />}
  </div>);
}

const RANGOS: [number, string][] = [[7, '7 días'], [15, '15 días'], [30, '30 días'], [60, '60 días'], [90, '90 días'], [365, '1 año'], [0, 'Personalizado']];
// Una fila por persona: cuenta la fecha en que agendó originalmente (para medir conversión de pauta), no sus reagendamientos.
function Pruebas({ openPersona }: { openPersona: (id: string) => void }) {
  const { d, cfg, hoy } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const wa = useWhats();
  const [dias, setDias] = useState(30); const [desde, setDesde] = useState(addDays(hoy, -30)); const [hasta, setHasta] = useState(hoy); const [fil, setFil] = useState('todas');
  const todas = useMemo(() => {
    const by = new Map<string, any[]>(); d.clases.forEach((c: any) => { if (c.tipo === 'prueba') (by.get(c.persona_id) || by.set(c.persona_id, []).get(c.persona_id)!).push(c); });
    const out: any[] = [];
    by.forEach((cs, pid) => {
      const p = idx.personaById.get(pid); if (!p) return;
      const orig = cs.map((c) => c.fecha_original || c.fecha).sort()[0];
      const asis = cs.filter((c) => c.estado === 'asistio').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      const prox = cs.filter((c) => c.estado === 'agendada' && c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      const last = [...cs].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))[0];
      const ref = asis || prox || last; const st = asis ? 'asistio' : prox ? 'agendada' : last.estado === 'ausente' ? 'ausente' : last.estado === 'agendada' ? 'sin_marcar' : 'no_dada';
      out.push({ p, c: ref, orig, st, n: cs.length, reag: cs.length > 1 || cs.some((c) => c.fecha_original && c.fecha_original !== c.fecha), e: estadoPersona(p, idx, cfg, hoy) });
    });
    return out;
  }, [d.clases, idx, cfg, hoy]);
  const lo = dias ? addDays(hoy, -dias) : desde; const hi = dias ? '9999-12-31' : hasta;
  const enRango = todas.filter((x) => x.orig >= lo && x.orig <= hi);
  const conv = (x: any) => x.e.stage === 'inscripta' || x.e.stage === 'unica' || x.e.stage === 'no_renovo';
  const FIL: [string, string, (x: any) => boolean][] = [
    ['todas', 'Todas', () => true], ['insc', 'Se inscribieron', (x) => x.st === 'asistio' && conv(x)], ['seg', 'En seguimiento', (x) => x.st === 'asistio' && x.e.stage === 'prueba'],
    ['noinsc', 'No se inscribieron', (x) => x.st === 'asistio' && x.e.stage === 'no_se_inscribio'], ['novino', 'No vinieron', (x) => x.st === 'ausente' || x.st === 'sin_marcar'], ['agen', 'Agendadas', (x) => x.st === 'agendada']];
  const f = FIL.find((z) => z[0] === fil)![2]; const rows = enRango.filter(f);
  const prox = rows.filter((x) => x.st === 'agendada').sort((a, b) => (a.c.fecha + a.c.hora).localeCompare(b.c.fecha + b.c.hora));
  const pasadas = rows.filter((x) => x.st !== 'agendada').sort((a, b) => b.orig.localeCompare(a.orig));
  const nAg = enRango.length; const nVin = enRango.filter((x) => x.st === 'asistio').length; const nIns = enRango.filter((x) => x.st === 'asistio' && conv(x)).length;
  const pc = (a: number, b: number) => (b ? ` (${Math.round((a / b) * 100)}%)` : '');
  const estado = (x: any) => x.st === 'asistio' ? ['Asistió ✓', ''] : x.st === 'ausente' ? ['No vino', 'neg'] : x.st === 'agendada' ? ['Agendada', ''] : x.st === 'sin_marcar' ? ['Sin marcar', 'neg'] : ['No se dio', ''];
  const despues = (x: any) => x.st !== 'asistio' ? '' : x.e.stage === 'inscripta' ? 'Se inscribió ✓' : x.e.stage === 'unica' ? 'Clase única' : x.e.stage === 'no_renovo' ? 'Se inscribió y dejó' : x.e.stage === 'no_se_inscribio' ? 'No se inscribió' : 'En seguimiento';
  const Fila = ({ x }: { x: any }) => { const [lb, tone] = estado(x); const dsp = despues(x); const difiere = x.c.fecha !== x.orig;
    return (<div className="row-card plain" onClick={() => openPersona(x.p.id)}>
      <div className="grow"><b>{x.p.nombre}</b>
        <div className="small muted">Agendó para {fmtDate(x.orig)} · <span style={tone ? { color: 'var(--neg)' } : undefined}>{lb}{difiere && x.st !== 'ausente' && x.st !== 'sin_marcar' ? ' ' + fmtDate(x.c.fecha) + ' ' + hm(x.c.hora) : ''}</span>{x.reag ? ' · reagendó' : ''}{dsp ? ' · ' + dsp : ''}</div></div>
      {x.p.celular && (x.st === 'asistio' || x.st === 'ausente') && !conv(x) && <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); wa(x.p, x.st === 'asistio' ? 'prueba_post1' : 'prueba_reag1', { dia: diaRel(x.c.fecha, hoy), hora: hm(x.c.hora), fecha: fmtDate(x.c.fecha) }); }}>WhatsApp</button>}
    </div>); };
  return (<div>
    <div className="chips scroll">{RANGOS.map(([n, l]) => <button key={n} className={'chip' + (dias === n ? ' on' : '')} onClick={() => setDias(n)}>{l}</button>)}</div>
    {dias === 0 && <div className="row2"><label className="small muted">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label><label className="small muted">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label></div>}
    <div className="chips scroll">{FIL.map(([k, l, fn]) => <button key={k} className={'chip' + (fil === k ? ' on' : '')} onClick={() => setFil(k)}>{l} <small>{enRango.filter(fn).length}</small></button>)}</div>
    <div className="muted small pad">Por fecha en que agendaron: {nAg} personas · {nVin} vinieron{pc(nVin, nAg)} · {nIns} se inscribieron{pc(nIns, nAg)}. Una fila por persona, aunque haya reagendado.</div>
    {rows.length === 0 && <Empty>No hay pruebas con este filtro.</Empty>}
    {prox.length > 0 && <><h3 className="pad">Próximas · {prox.length}</h3><div className="list">{prox.map((x) => <Fila key={x.p.id} x={x} />)}</div></>}
    {pasadas.length > 0 && <><h3 className="pad">Realizadas / pasadas · {pasadas.length}</h3><div className="list">{pasadas.map((x) => <Fila key={x.p.id} x={x} />)}</div></>}
  </div>);
}
