import React, { useEffect, useState } from 'react';
import { rpcAnon } from '../api';
import { diffDays, fmtDate, fmtLong, hm, today, primerNombre, DIAS3, parseD } from '../util';

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

function Perfil({ data }: { data: any }) {
  const hoy = today();
  const recup = Number(data.recup_dias) || 15;
  const clases: any[] = data.clases || []; const subs: any[] = data.subs || []; const hor: any[] = data.horarios || [];
  const asist = clases.filter((c) => c.estado === 'asistio' && c.tipo !== 'prueba'); const proximas = clases.filter((c) => c.estado === 'agendada' && c.fecha >= hoy).slice(0, 6);
  const faltas = clases.filter((c) => c.estado === 'ausente' && c.tipo !== 'prueba');
  const porRecup = faltas.filter((c) => !c.res && diffDays(hoy, c.fecha) <= recup);
  const subVig = [...subs].reverse().find((s) => s.tipo !== 'unica' && s.inicio <= hoy && hoy <= s.fin) || [...subs].reverse().find((s) => s.tipo !== 'unica');
  const delPeriodo = subVig ? clases.filter((c) => c.fecha >= subVig.inicio && c.fecha <= subVig.fin && c.tipo !== 'prueba' && c.tipo !== 'recuperacion').sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)) : [];
  // datos curiosos personales
  const cnt = (f: (c: any) => string) => { const m: Record<string, number> = {}; asist.forEach((c) => { const k = f(c); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]; };
  const diaFav = cnt((c) => String(parseD(c.fecha).getDay() || 7)); const horaFav = cnt((c) => hm(c.hora));
  const semanas = new Set(asist.map((c) => { const d = parseD(c.fecha); const lun = new Date(d); lun.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return lun.toDateString(); })).size;
  const desde = asist[0]?.fecha;
  return (
    <div className="app"><main><div className="page">
      <div className="eyebrow">Focus Pilates</div>
      <h1>Hola, {primerNombre(data.nombre)} 👋</h1>
      <div className="muted">{fmtLong(hoy)}</div>

      <section><div className="sec-head"><h2>Tus próximas clases</h2></div>
        {proximas.length === 0 ? <div className="muted pad">No tenés clases agendadas por ahora.</div> :
          <div className="list">{proximas.map((c, i) => <div key={i} className={'row-card plain t-' + c.tipo}><div className="time sm">{DIAS3[parseD(c.fecha).getDay()]}<br />{fmtDate(c.fecha)}</div><div className="grow"><b>{hm(c.hora)} hs</b><div className="small muted">{TIPO[c.tipo]}</div></div></div>)}</div>}
        {hor.length > 0 && <div className="muted small pad">Tu horario fijo: {hor.map((h) => `${DIASL[h.dia]} ${hm(h.hora)}`).join(' · ')}</div>}
      </section>

      {porRecup.length > 0 && <section><div className="sec-head"><h2>Para recuperar</h2></div>
        <div className="list">{porRecup.map((c, i) => <div key={i} className="row-card plain"><div className="grow"><b>Faltaste el {fmtDate(c.fecha)}</b><div className="small muted">Te quedan {recup - diffDays(hoy, c.fecha)} días para recuperarla. Escribile a tu instructor/a.</div></div></div>)}</div></section>}

      {subVig && <section><div className="sec-head"><h2>Tu período</h2></div>
        <div className="muted small pad">{fmtDate(subVig.inicio)} → {fmtDate(subVig.fin)}</div>
        <div className="squares">{delPeriodo.map((c, i) => {
          const k = c.estado === 'asistio' ? 'ok' : c.estado === 'ausente' ? (c.res === 'recuperada' ? 'rec' : 'aus') : c.estado === 'no_dada' ? 'no_dada' : 'pend';
          return <div key={i} className={'sq sq-' + k}><span className="sq-d">{fmtDate(c.fecha)}</span><span className="sq-s">{k === 'ok' ? '✓' : k === 'rec' ? '↺' : ''}</span></div>;
        })}</div>
        <div className="legend sq-legend"><span><i className="sq-dot sq-ok" />Asististe</span><span><i className="sq-dot sq-aus" />Faltaste</span><span><i className="sq-dot sq-rec" />Recuperada</span><span><i className="sq-dot sq-pend" />Pendiente</span></div>
      </section>}

      <section><div className="sec-head"><h2>Tu recorrido</h2></div>
        <div className="stats"><div><b>{asist.length}</b><span>Clases</span></div><div><b>{faltas.length}</b><span>Faltas</span></div><div><b>{semanas}</b><span>Semanas con clase</span></div><div><b>{desde ? fmtDate(desde) : '—'}</b><span>Primera clase</span></div></div>
        <h3>Historial</h3>
        <div className="list">{[...clases].reverse().filter((c) => c.estado !== 'agendada' || c.fecha < hoy).slice(0, 30).map((c, i) => (
          <div key={i} className="kv"><span>{fmtDate(c.fecha)} · {hm(c.hora)} · {TIPO[c.tipo]}</span><b>{c.estado === 'asistio' ? 'Asististe ✓' : c.estado === 'ausente' ? 'Faltaste' : c.estado === 'no_dada' ? 'Reagendada' : 'Sin registrar'}</b></div>))}</div>
      </section>

      <section><div className="sec-head"><h2>Datos curiosos</h2></div>
        <div className="box stack small">
          {diaFav && <div>📅 Tu día favorito para entrenar: <b>{DIASL[Number(diaFav[0])]}</b> ({diaFav[1]} clases).</div>}
          {horaFav && <div>⏰ Tu horario más frecuente: <b>{horaFav[0]} hs</b>.</div>}
          <div>🏛️ Entre todos/as, el estudio ya dio <b>{data.estudio?.clases_dadas ?? 0}</b> clases{data.estudio?.desde ? ` desde el ${fmtDate(data.estudio.desde)}` : ''}.</div>
        </div></section>
    </div></main></div>
  );
}
