import React, { useEffect, useState } from 'react';
import { rpcAnon } from '../api';
import { diffDays, fmtDate, fmtLong, hm, today, primerNombre, DIAS3, parseD, addDays, addMonthKey, MESES } from '../util';

const TIPO: Record<string, string> = { regular: 'Clase', prueba: 'Prueba', recuperacion: 'Recuperación', unica: 'Clase única' };
const DIASL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const LS_A = 'fp_alumna';
const ua = () => (navigator.userAgent || '').slice(0, 200);
const Boot = ({ children }: any) => <div className="boot"><div className="brand">Focus Pilates</div>{children}</div>;

// Portal de alumnas: enlace personal o ingreso con nombre/apellido + últimos 6 dígitos del celular. Sin dinero.
export default function Portal({ token }: { token?: string }) {
  const [perfiles, setPerfiles] = useState<any[] | null | undefined>(undefined); const [i, setI] = useState(0);
  const [u, setU] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const entrar = async (nombre: string, pin: string, guardar: boolean) => {
    setBusy(true); setErr('');
    try {
      const r = await rpcAnon('fp_portal_login', { p_nombre: nombre, p_pin: pin, p_ua: ua() });
      if (r?.perfiles?.length) { if (guardar) { try { localStorage.setItem(LS_A, JSON.stringify({ u: nombre, p: pin })); } catch { /* */ } } setPerfiles(r.perfiles); return true; }
      setErr(r?.error === 'bloqueado' ? 'Demasiados intentos. Probá de nuevo en unos 15 minutos.' : r?.error === 'datos' ? 'Escribí tu nombre o apellido y los 6 últimos números de tu celular.' : 'No encontramos esos datos. Revisá el apellido y los 6 últimos números del celular con el que te anotaste.');
    } catch { setErr('No se pudo conectar. Probá de nuevo.'); } finally { setBusy(false); }
    return false;
  };
  useEffect(() => {
    if (token) { rpcAnon('fp_portal_enlace', { p_token: token, p_ua: ua() }).then((r) => setPerfiles(r?.length ? r : null)).catch(() => setPerfiles(null)); return; }
    let g: any = null; try { g = JSON.parse(localStorage.getItem(LS_A) || 'null'); } catch { /* */ }
    if (g?.u && g?.p) entrar(g.u, g.p, false).then((ok) => { if (!ok) setPerfiles(null); }); else setPerfiles(null);
  }, [token]);
  const salir = () => { try { localStorage.removeItem(LS_A); } catch { /* */ } location.href = location.pathname; };
  if (perfiles === undefined) return <Boot><div className="muted">Cargando…</div></Boot>;
  if (!perfiles) {
    if (token) return <Boot><div className="muted" style={{ textAlign: 'center', maxWidth: 300 }}>Este enlace no es válido. Podés entrar con tu nombre y celular.</div><button className="btn" style={{ marginTop: 14 }} onClick={() => { location.hash = 'mi'; }}>Entrar con mis datos</button></Boot>;
    return (
      <div className="login"><form className="login-card" onSubmit={(e) => { e.preventDefault(); entrar(u, pw, true); }}>
        <div className="brand">Focus Pilates</div><div className="muted" style={{ marginBottom: 22 }}>Tu perfil de alumno/a</div>
        <label className="field"><span>Tu nombre o apellido</span><input autoCapitalize="none" autoCorrect="off" value={u} onChange={(e) => setU(e.target.value)} placeholder="Tu nombre o tu apellido" /></label>
        <label className="field" style={{ marginTop: 12 }}><span>Últimos 6 números de tu celular</span><input inputMode="numeric" maxLength={6} value={pw} onChange={(e) => setPw(e.target.value.replace(/\D/g, ''))} placeholder="Los últimos 6 números" /></label>
        {err && <div className="warn" style={{ margin: '10px 0' }}>{err}</div>}
        <button className="btn big" style={{ marginTop: 14 }} disabled={busy || u.trim().length < 3 || pw.length !== 6}>{busy ? 'Entrando…' : 'Ver mi perfil'}</button>
        <button type="button" className="btn ghost big" style={{ marginTop: 10 }} onClick={() => { location.hash = ''; }}>Volver</button>
        <div className="muted small" style={{ marginTop: 14, textAlign: 'center' }}>Usá el celular con el que te anotaste en el estudio. Si sos madre o padre, ves también a tus hijos/as.</div></form></div>);
  }
  return (<div style={{ position: 'relative' }}>
    <button className="btn ghost sm" style={{ position: 'absolute', top: 14, right: 14, zIndex: 5 }} onClick={salir}>Salir</button>
    {perfiles.length > 1 && <div className="chips scroll" style={{ padding: '60px 16px 0', marginBottom: -50 }}>{perfiles.map((x, k) => <button key={k} className={'chip' + (k === i ? ' on' : '')} onClick={() => setI(k)}>{primerNombre(x.nombre)}</button>)}</div>}
    <Perfil data={perfiles[Math.min(i, perfiles.length - 1)]} />
    <div style={{ textAlign: 'center', padding: '0 16px 110px' }}><button className="btn ghost" onClick={salir}>Salir</button></div></div>);
}

const pl = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
const lunes = (f: string) => addDays(f, 1 - (parseD(f).getDay() || 7));
// racha: períodos consecutivos con al menos una clase (el actual cuenta si ya tuvo clase; si no, no corta la racha todavía)
function rachas(keys: string[], actual: string, prev: (k: string) => string) {
  const set = new Set(keys); let cur = 0; let k = set.has(actual) ? actual : prev(actual);
  while (set.has(k)) { cur++; k = prev(k); }
  const sorted = [...set].sort(); let best = 0, run = 0, last = '';
  sorted.forEach((x) => { run = last && prev(x) === last ? run + 1 : 1; last = x; best = Math.max(best, run); });
  return { cur, best };
}
function tiempoJuntos(dias: number) {
  if (dias < 1) return 'Hoy es tu primer día';
  if (dias < 60) return pl(dias, 'día', 'días');
  const m = Math.floor(dias / 30.4); if (dias < 365) return pl(m, 'mes', 'meses') + (dias - Math.round(m * 30.4) > 3 ? ` y ${pl(Math.max(1, dias - Math.round(m * 30.4)), 'día', 'días')}` : '');
  const y = Math.floor(dias / 365); const mm = Math.floor((dias - y * 365) / 30.4); return pl(y, 'año', 'años') + (mm ? ` y ${pl(mm, 'mes', 'meses')}` : '');
}

function Perfil({ data }: { data: any }) {
  const hoy = today();
  const recup = Number(data.recup_dias) || 15;
  const clases: any[] = data.clases || []; const subs: any[] = data.subs || []; const hor: any[] = data.horarios || [];
  const dadas = clases.filter((c) => c.estado === 'asistio');
  const asist = dadas.filter((c) => c.tipo !== 'prueba'); const proximas = clases.filter((c) => c.estado === 'agendada' && c.fecha >= hoy).slice(0, 6);
  const faltas = clases.filter((c) => c.estado === 'ausente' && c.tipo !== 'prueba');
  const porRecup = faltas.filter((c) => !c.res && diffDays(hoy, c.fecha) <= recup);
  const mens = subs.filter((s) => s.tipo !== 'unica');
  const subVig = [...mens].reverse().find((s) => s.inicio <= hoy && hoy <= s.fin) || [...mens].reverse().find((s) => s.inicio > hoy) || mens[mens.length - 1];
  const delPeriodo = subVig ? clases.filter((c) => c.fecha >= subVig.inicio && c.fecha <= subVig.fin && c.tipo !== 'prueba' && c.tipo !== 'recuperacion').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)) : [];

  const prog = subVig ? Math.max(0, Math.min(1, (diffDays(hoy, subVig.inicio) + 1) / (diffDays(subVig.fin, subVig.inicio) + 1))) : 0;
  // desde cuándo entrena (cuenta desde su primera clase dada, incluida la prueba)
  const primera = dadas[0]?.fecha || data.alta || null; const dias = primera ? Math.max(0, diffDays(hoy, primera)) : 0;
  // rachas
  const sem = rachas(dadas.map((c) => lunes(c.fecha)), lunes(hoy), (k) => addDays(k, -7));
  const mesKey = (f: string) => f.slice(0, 7); const prevMes = (k: string) => addMonthKey(k, -1);
  const mes = rachas(dadas.map((c) => mesKey(c.fecha)), mesKey(hoy), prevMes);
  const diasEntr = new Set(dadas.map((c) => c.fecha)).size; const horas = dadas.length;
  const esteMes = dadas.filter((c) => mesKey(c.fecha) === mesKey(hoy)).length;
  const recuperadas = dadas.filter((c) => c.tipo === 'recuperacion').length;

  // suscripción en tono amable
  let subNode: React.ReactNode = <div className="muted">Todavía no tenés un plan activo. Cuando quieras sumarte, escribinos 💚</div>;
  if (subVig) {
    const renueva = addDays(subVig.fin, 1); const falta = diffDays(renueva, hoy);
    const estado = subVig.inicio > hoy ? `Empieza el ${fmtDate(subVig.inicio)}` : hoy <= subVig.fin ? (falta <= 0 ? 'Tu renovación es hoy' : falta <= 3 ? `Se renueva en ${pl(falta, 'día', 'días')}` : `Te quedan ${pl(diffDays(subVig.fin, hoy) + 1, 'día', 'días')} de este período`) : `Tu período terminó el ${fmtDate(subVig.fin)}`;
    const recordatorio = hoy > subVig.fin ? 'Tu período ya terminó. ¡Te esperamos cuando quieras renovar!' : subVig.inicio <= hoy && falta <= 3 ? `Tu renovación es el ${fmtDate(renueva)}. ¡Gracias por entrenar con nosotros!` : '';
    subNode = (<>
      <div className="sub-top"><b>{subVig.plan}</b>{subVig.clases_semana ? <span className="muted"> · {pl(subVig.clases_semana, 'clase', 'clases')} por semana</span> : null}</div>
      <div className="sub-st">{estado}</div>
      <div className="sub-grid"><div><span>Empezó</span><b>{fmtDate(subVig.inicio)}</b></div><div><span>Termina</span><b>{fmtDate(subVig.fin)}</b></div><div><span>Próxima renovación</span><b>{fmtDate(renueva)}</b></div></div>
      {recordatorio && <div className="reminder">💚 {recordatorio}</div>}
    </>);
  }

  // datos curiosos personales, uno distinto cada día
  const cnt = (f: (c: any) => string) => { const m: Record<string, number> = {}; asist.forEach((c) => { const k = f(c); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]; };
  const diaFav = cnt((c) => String(parseD(c.fecha).getDay() || 7)); const horaFav = cnt((c) => hm(c.hora)); const mesFav = cnt((c) => mesKey(c.fecha));
  const hitos = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000]; const prox = hitos.find((h) => h > dadas.length);
  const facts: string[] = [];
  if (diaFav) facts.push(`📅 Tu día favorito para entrenar es el ${DIASL[Number(diaFav[0])].toLowerCase()}: ${pl(diaFav[1], 'clase', 'clases')} ahí.`);
  if (horaFav) facts.push(`⏰ A las ${horaFav[0]} es cuando más te vemos por acá.`);
  if (horas >= 2) facts.push(`⌛ Ya sumaste ${pl(horas, 'hora', 'horas')} de pilates. ¡Se nota!`);
  if (prox && dadas.length >= 3) facts.push(`🎯 Te ${prox - dadas.length === 1 ? 'falta 1 clase' : `faltan ${prox - dadas.length} clases`} para llegar a tu clase número ${prox}.`);
  if (mesFav && asist.length >= 6) facts.push(`🌟 Tu mes más intenso fue ${MESES[Number(mesFav[0].slice(5)) - 1]}: ${pl(mesFav[1], 'clase', 'clases')}.`);
  if (recuperadas > 0) facts.push(`↺ Recuperaste ${pl(recuperadas, 'clase', 'clases')}. ¡Cero excusas!`);
  if (sem.best >= 2) facts.push(`🔥 Tu mejor racha fue de ${pl(sem.best, 'semana seguida', 'semanas seguidas')}.`);
  if (diasEntr >= 5) facts.push(`🗓️ Entrenaste ${pl(diasEntr, 'día distinto', 'días distintos')} desde que empezaste.`);
  const seed = Math.floor(parseD(hoy).getTime() / 86400000); const mostrar = facts.length ? [0, 1, 2].slice(0, Math.min(3, facts.length)).map((i) => facts[(seed + i) % facts.length]) : [];

  return (
    <div className="app"><main><div className="page">
      <div className="eyebrow">Focus Pilates</div>
      <h1>Hola, {primerNombre(data.nombre)} 👋</h1>
      <div className="muted">{fmtLong(hoy)}</div>

      <section className="card-sub"><div className="sec-head"><h2>Tu suscripción</h2></div><div className="box">{subNode}</div></section>

      {subVig && <section><div className="sec-head"><h2>Tu período</h2><span className="muted small">{fmtDate(subVig.inicio)} → {fmtDate(subVig.fin)}</span></div>
        <div className="prog"><div className="prog-f" style={{ width: Math.round(prog * 100) + '%' }} /></div><div className="muted small" style={{ margin: '4px 0 10px' }}>{hoy > subVig.fin ? 'Período completo' : subVig.inicio > hoy ? 'Todavía no empezó' : `Día ${diffDays(hoy, subVig.inicio) + 1} de ${diffDays(subVig.fin, subVig.inicio) + 1}`}</div>
        <div className="squares">{delPeriodo.map((c, i) => {
          const k = c.estado === 'asistio' ? 'ok' : c.estado === 'ausente' ? (c.res === 'recuperada' ? 'rec' : 'aus') : c.estado === 'no_dada' ? 'no_dada' : 'pend';
          return <div key={i} className={'sq sq-' + k}><span className="sq-d">{fmtDate(c.fecha)}</span><span className="sq-s">{k === 'ok' ? '✓' : k === 'rec' ? '↺' : ''}</span></div>;
        })}</div>
        <div className="legend sq-legend"><span><i className="sq-dot sq-ok" />Fuiste</span><span><i className="sq-dot sq-aus" />Faltaste</span><span><i className="sq-dot sq-rec" />Recuperada</span><span><i className="sq-dot sq-pend" />Pendiente</span></div>
      </section>}

      {primera && dadas.length > 0 && <section><div className="hero">
        <div className="hero-s">{dias < 1 ? '¡Qué lindo empezar!' : 'Hace'}</div>
        <div className="hero-n">{tiempoJuntos(dias)}</div>
        <div className="hero-s">{dias < 1 ? 'Bienvenido/a a Focus Pilates 💚' : 'que hacés pilates con nosotros 💚'}</div></div></section>}

      <section><div className="sec-head"><h2>Tus próximas clases</h2></div>
        {proximas.length === 0 ? <div className="muted pad">No tenés clases agendadas por ahora.</div> :
          <div className="list">{proximas.map((c, i) => <div key={i} className={'row-card plain t-' + c.tipo}><div className="time sm">{DIAS3[parseD(c.fecha).getDay()]}<br />{fmtDate(c.fecha)}</div><div className="grow"><b>{hm(c.hora)} hs</b><div className="small muted">{TIPO[c.tipo]}</div></div></div>)}</div>}
        {hor.length > 0 && <div className="muted small pad">Tu horario fijo: {hor.map((h) => `${DIASL[h.dia]} ${hm(h.hora)}`).join(' · ')}</div>}
      </section>

      {porRecup.length > 0 && <section><div className="sec-head"><h2>Para recuperar</h2></div>
        <div className="list">{porRecup.map((c, i) => <div key={i} className="row-card plain"><div className="grow"><b>Faltaste el {fmtDate(c.fecha)}</b><div className="small muted">Te quedan {pl(recup - diffDays(hoy, c.fecha), 'día', 'días')} para recuperarla. Escribile a tu instructor/a.</div></div></div>)}</div></section>}


      <section><div className="sec-head"><h2>Tus rachas</h2></div>
        <div className="stats">
          <div><b>🔥 {sem.cur}</b><span>{sem.cur === 1 ? 'semana seguida' : 'semanas seguidas'}</span></div>
          <div><b>📆 {mes.cur}</b><span>{mes.cur === 1 ? 'mes seguido' : 'meses seguidos'}</span></div>
          <div><b>{esteMes}</b><span>{esteMes === 1 ? 'clase este mes' : 'clases este mes'}</span></div>
          <div><b>{dadas.length}</b><span>clases en total</span></div></div>
        {sem.best > sem.cur && <div className="muted small pad">Tu récord: {pl(sem.best, 'semana seguida', 'semanas seguidas')}. ¿Lo superamos? 💪</div>}
        {sem.cur >= 2 && sem.best === sem.cur && <div className="small pad" style={{ color: 'var(--sage-d)' }}>¡Es tu mejor racha hasta ahora! 🎉</div>}
      </section>

      {mostrar.length > 0 && <section><div className="sec-head"><h2>Sabías que…</h2></div>
        <div className="box stack small">{mostrar.map((t, i) => <div key={i}>{t}</div>)}</div></section>}

      <section><div className="sec-head"><h2>Tu historial</h2></div>
        <div className="list">{[...clases].reverse().filter((c) => c.estado !== 'agendada' || c.fecha < hoy).slice(0, 30).map((c, i) => (
          <div key={i} className="kv"><span>{fmtDate(c.fecha)} · {hm(c.hora)} · {TIPO[c.tipo]}</span><b>{c.estado === 'asistio' ? 'Fuiste ✓' : c.estado === 'ausente' ? 'Faltaste' : c.estado === 'no_dada' ? 'Reagendada' : 'Sin registrar'}</b></div>))}</div>
      </section>
    </div></main></div>
  );
}
