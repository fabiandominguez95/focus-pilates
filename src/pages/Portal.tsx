import React, { useEffect, useState } from 'react';
import { rpcAnon } from '../api';
import { diffDays, fmtDate, fmtLong, hm, today, primerNombre, DIAS3, parseD } from '../util';

const TIPO: Record<string, string> = { regular: 'Clase', prueba: 'Prueba', recuperacion: 'Recuperación', unica: 'Clase única' };
const DIASL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Portal de alumnas: se entra con un enlace personal, sin registrarse. No muestra dinero.
export default function Portal({ token }: { token: string }) {
  const [data, setData] = useState<any>(undefined); const hoy = today();
  useEffect(() => { rpcAnon('fp_portal', { p_token: token }).then(setData).catch(() => setData(null)); }, [token]);
  if (data === undefined) return <div className="boot"><div className="brand">Focus Pilates</div><div className="muted">Cargando…</div></div>;
  if (!data) return <div className="boot"><div className="brand">Focus Pilates</div><div className="muted" style={{ textAlign: 'center', maxWidth: 300 }}>Este enlace no es válido o venció. Pedile uno nuevo a tu profesora.</div></div>;
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
        <div className="list">{porRecup.map((c, i) => <div key={i} className="row-card plain"><div className="grow"><b>Faltaste el {fmtDate(c.fecha)}</b><div className="small muted">Te quedan {recup - diffDays(hoy, c.fecha)} días para recuperarla. Escribile a tu profesora.</div></div></div>)}</div></section>}

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
          <div>🏛️ Entre todas, el estudio ya dio <b>{data.estudio?.clases_dadas ?? 0}</b> clases{data.estudio?.desde ? ` desde el ${fmtDate(data.estudio.desde)}` : ''}.</div>
        </div></section>
    </div></main></div>
  );
}
