import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { buildIndex, estadoPersona, sinCulpa, horasDisponibles, bloqAplica } from './logic';
import { Sheet, Field } from './ui';
import { WaDot, useFeriadoSet, DEFAULT_TPL } from './classes';
import { addDays, fmtDate, hm, timeToMin, DIAS, parseD } from './util';

// ---- Configuración de avisos a pruebas -------------------------------------------------------------
export const PA_DEF = { previo_hasta: '21:00', desde: '2026-10-10', post_on: true, post1: 1, post2_on: true, post2: 3, reag_on: true, reag1: 1, reag2_on: true, reag2: 3 };
export const paCfg = (cfg: any) => ({ ...PA_DEF, ...(cfg.pruebas_avisos || {}) });


export const TK_LABEL: Record<string, string> = { previo: 'Aviso previo', hoy: 'Aviso de hoy', post1: 'Seguimiento post-prueba', post2: 'Segundo seguimiento', reag1: 'Reagendar (no vino)', reag2: 'Segundo intento de reagendar' };

export type Tarea = { key: string; k: string; c: any; p: any; vencida: boolean; tpl: string; logTipo: string; logRef: string; serie: boolean };

export function useAvisosSet() {
  const { d } = useApp();
  return useMemo(() => { const s = new Set<string>(); d.avisos.forEach((a: any) => s.add(a.tipo + '|' + a.ref + '|' + a.persona_id)); return s; }, [d.avisos]);
}

// Tareas de avisos y seguimiento a personas con clase de prueba
export function usePruebasTareas(): Tarea[] {
  const { d, cfg, hoy } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const set = useAvisosSet();
  const n = new Date(); const ahora = n.getHours() * 60 + n.getMinutes();
  return useMemo(() => {
    const A = paCfg(cfg); const out: Tarea[] = []; const hasta = timeToMin(A.previo_hasta);
    const has = (t: string, r: string, pid: string) => set.has(t + '|' + r + '|' + pid);
    const hoyLocal = (x: string) => new Date(x).toLocaleDateString('sv');
    const push = (t: Tarea) => {
      if (has('nohecho_' + t.logTipo, t.logRef, t.p.id)) return;
      const row = d.avisos.find((a: any) => a.tipo === t.logTipo && a.ref === t.logRef && a.persona_id === t.p.id);
      if (row && !(row.created_at && hoyLocal(row.created_at) === hoy)) return; // lo hecho se ve solo el día que se hizo
      out.push(t);
    };
    const maxAtras = 7;
    d.clases.forEach((c: any) => {
      if (c.tipo !== 'prueba' || c.fecha < A.desde) return;
      const p = idx.personaById.get(c.persona_id); if (!p) return; const st = c.estado;
      const baseKey = (k: string) => k + '|' + c.id;
      if ((st === 'agendada' || st === 'asistio') && c.fecha >= addDays(hoy, -maxAtras)) {
        if (hoy >= addDays(c.fecha, -1)) {
          const venc = hoy >= c.fecha || ahora >= hasta;
          push({ key: baseKey('previo'), k: 'previo', c, p, vencida: venc, tpl: 'prueba_previa', logTipo: 'prueba_previa', logRef: c.fecha, serie: false });
        }
        if (hoy >= c.fecha) {
          const venc = hoy > c.fecha || ahora >= timeToMin(hm(c.hora));
          push({ key: baseKey('hoy'), k: 'hoy', c, p, vencida: venc, tpl: 'prueba_hoy', logTipo: 'confirmacion', logRef: c.fecha, serie: false });
        }
      }
      const cerrado = has('prueba_cerrado', c.id, p.id);
      const mensual = (idx.subsByP.get(p.id) || []).some((s: any) => s.tipo !== 'unica');
      const bloqueado = cerrado || mensual || p.baneado || p.no_contactar;
      const serieDe = (pref: 'post' | 'reag', ks: [string, string]) => {
        const on1 = A[pref + '_on']; if (!on1 || bloqueado) return;
        const d1 = addDays(c.fecha, Number(A[pref === 'post' ? 'post1' : 'reag1'])); const d2 = addDays(c.fecha, Number(A[pref === 'post' ? 'post2' : 'reag2'])); const on2 = A[pref + '2_on'];
        if (hoy >= d1 && hoy <= addDays(d1, 21)) push({ key: baseKey(ks[0]), k: ks[0], c, p, vencida: !!on2 && hoy >= d2, tpl: 'prueba_' + ks[0], logTipo: 'prueba_' + ks[0], logRef: c.id, serie: true });
        if (on2 && hoy >= d2 && hoy <= addDays(d2, 21)) push({ key: baseKey(ks[1]), k: ks[1], c, p, vencida: false, tpl: 'prueba_' + ks[1], logTipo: 'prueba_' + ks[1], logRef: c.id, serie: true });
      };
      if (st === 'asistio') serieDe('post', ['post1', 'post2']);
      if (st === 'ausente' && !sinCulpa(c)) {
        const otra = (idx.clasesByP.get(p.id) || []).some((x: any) => x.tipo === 'prueba' && x.id !== c.id && x.fecha > c.fecha && (x.estado === 'agendada' || x.estado === 'asistio'));
        if (!otra) serieDe('reag', ['reag1', 'reag2']);
      }
    });
    return out.sort((a, b) => (a.c.fecha + a.c.hora).localeCompare(b.c.fecha + b.c.hora));
  }, [d.clases, d.avisos, d.personas, idx, hoy, ahora, cfg]);
}

export function useTareaOps() {
  const { me, ins, toast } = useApp();
  const marcar = async (t: Tarea) => { try { await ins('avisos', { persona_id: t.p.id, tipo: 'nohecho_' + t.logTipo, ref: t.logRef, usuario: me?.nick }); toast('Anotado: no se hizo'); } catch (e: any) { toast('Error: ' + e.message); } };
  const cerrar = async (t: Tarea) => { try { await ins('avisos', { persona_id: t.p.id, tipo: 'prueba_cerrado', ref: t.c.id, usuario: me?.nick }); toast('Listo, no se le escribe más'); } catch (e: any) { toast('Error: ' + e.message); } };
  return { marcar, cerrar };
}

export function TareaRow({ t, done, onWa, onUndo, onOpen, onMarcar, onCerrar }: { t: Tarea; done: boolean; onWa: () => void; onUndo: () => void; onOpen: () => void; onMarcar: () => void; onCerrar: () => void }) {
  const sub = t.k === 'previo' ? `${TK_LABEL.previo} · prueba ${fmtDate(t.c.fecha)} ${hm(t.c.hora)}` : t.k === 'hoy' ? `${TK_LABEL.hoy} · ${hm(t.c.hora)}` : `${TK_LABEL[t.k]} · prueba del ${fmtDate(t.c.fecha)}`;
  const puedeWa = t.serie || !t.vencida;
  return (
    <div className={'row-card plain check' + (done ? ' done' : '') + (t.vencida ? ' late' : '')} onClick={onOpen}>
      <span className={'chk' + (done ? ' on' : '')}>{done ? '✓' : ''}</span>
      <div className="grow"><b>{t.p.nombre}</b><div className="small muted">{sub}{t.vencida ? ' · pasó el horario' : ''}</div></div>
      {t.serie && !done && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onCerrar(); }} title="Ya respondió, se inscribió o no hace falta">Ya no hace falta</button>}
      {t.vencida && !done && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); onMarcar(); }}>No se hizo</button>}
      {puedeWa && <WaDot done={done} onUndo={onUndo} onClick={onWa} />}
    </div>
  );
}

// ---- Ofrecer horarios ---------------------------------------------------------------------------------
function fmtHoras(hs: string[]) { const x = hs.map((h) => (h.endsWith(':00') ? String(Number(h.slice(0, 2))) : hm(h))); return x.length > 1 ? x.slice(0, -1).join(', ') + ' y ' + x[x.length - 1] + ' hs' : x[0] + ' hs'; }

export function OfrecerHorarios({ onClose }: { onClose: () => void }) {
  const { d, cfg, hoy, toast } = useApp(); const idx = useMemo(() => buildIndex(d), [d]); const fer = useFeriadoSet();
  const habiles: number[] = cfg.dias_habiles_semana || [1, 2, 3, 4, 5]; const horas = horasDisponibles(cfg);
  const ahora = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const [dias, setDias] = useState<number[]>([]); const [pers, setPers] = useState(1); const [desde, setDesde] = useState(horas[0] || '08:00'); const [hasta, setHasta] = useState(horas[horas.length - 1] || '19:00');
  const [off, setOff] = useState<Record<string, boolean>>({}); const [manual, setManual] = useState<string | null>(null);
  const inscriptasFijas = useMemo(() => d.personas.filter((p: any) => !p.deleted_at && p.id && estadoPersona(p, idx, cfg, hoy).stage === 'inscripta'), [d.personas, idx, cfg, hoy]);
  // Quien se inscribe se queda con un lugar fijo cada semana: miramos las próximas 4 semanas y tomamos la peor.
  const proximas = (dow: number) => { const out: string[] = []; for (let i = 0; i < 35 && out.length < 4; i++) { const f = addDays(hoy, i); if ((parseD(f).getDay() || 7) === dow) out.push(f); } return out; };
  const ocupados = (f: string, h: string) => {
    const dow = parseD(f).getDay() || 7; const conClase = new Set<string>(); let ocup = 0;
    d.clases.forEach((c: any) => { if (c.fecha !== f) return; conClase.add(c.persona_id); if (hm(c.hora) === h && (c.estado === 'agendada' || c.estado === 'asistio')) ocup++; });
    inscriptasFijas.forEach((p: any) => { if (conClase.has(p.id)) return; if ((idx.horByP.get(p.id) || []).some((x: any) => x.dia === dow && hm(x.hora) === h)) ocup++; });
    return ocup;
  };
  const bloqEn = (f: string, h: string) => d.bloqueos.find((b: any) => bloqAplica(b, f) && b.hora_desde && timeToMin(hm(b.hora_desde)) < timeToMin(h) + 60 && timeToMin(hm(b.hora_hasta)) > timeToMin(h));
  const porDia = useMemo(() => dias.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((dow) => {
    const fs = proximas(dow);
    const slots = horas.filter((h) => timeToMin(h) >= timeToMin(desde) && timeToMin(h) <= timeToMin(hasta)).map((h) => {
      const bl = fs.map((f) => bloqEn(f, h)); const fijo = bl.every(Boolean) ? bl[0] : null; // bloqueado todas las semanas
      const n = Math.max(0, cfg.cupo - Math.max(...fs.map((f) => ocupados(f, h))));
      return { h, n, bloq: fijo ? (fijo.motivo || 'No disponible') : '' };
    });
    return { dow, slots: slots.filter((x) => x.bloq || x.n >= pers) };
  }), [dias, desde, hasta, pers, d.clases, d.bloqueos, hoy, inscriptasFijas]);
  const plural = (dow: number) => { const n = DIAS[dow % 7]; return 'los ' + n + (n.endsWith('s') ? '' : 's'); };
  const lineas = porDia.map((x) => ({ x, hs: x.slots.filter((s) => !s.bloq && !off[x.dow + s.h]).map((s) => s.h) })).filter((l) => l.hs.length);
  const horariosTxt = lineas.map((l) => `${plural(l.x.dow)} a las ${fmtHoras(l.hs)}`).join('; ');
  const tpl = cfg.plantillas?.ofrecer_horarios || DEFAULT_TPL.ofrecer_horarios;
  const gen = horariosTxt ? tpl.replace('{personas}', pers > 1 ? ` para ${pers} personas` : '').replace('{horarios}', horariosTxt) : '';
  const txt = manual ?? gen;
  const copiar = async () => { try { await navigator.clipboard.writeText(txt); toast('Mensaje copiado'); } catch { toast('No se pudo copiar, seleccionalo y copialo'); } };
  return (
    <Sheet title="Ofrecer horarios" onClose={onClose} wide>
      <div className="stack">
        <div className="muted small">Quien se inscribe se queda con un lugar fijo en su horario, cada semana. Elegí los días que le interesan: te muestro los horarios con lugar (mirando las próximas 4 semanas) y armo el mensaje. Tocá un horario para sacarlo.</div>
        <div className="chips">{habiles.map((dw) => <button key={dw} className={'chip' + (dias.includes(dw) ? ' on' : '')} onClick={() => { setManual(null); setDias(dias.includes(dw) ? dias.filter((x) => x !== dw) : [...dias, dw]); }}>{DIAS[dw % 7].slice(0, 3)}</button>)}</div>
        <div className="row2"><Field label="Desde"><select value={desde} onChange={(e) => { setManual(null); setDesde(e.target.value); }}>{horas.map((h) => <option key={h} value={h}>{hm(h)}</option>)}</select></Field>
          <Field label="Hasta"><select value={hasta} onChange={(e) => { setManual(null); setHasta(e.target.value); }}>{horas.map((h) => <option key={h} value={h}>{hm(h)}</option>)}</select></Field></div>
        <div className="chips"><span className="small muted" style={{ alignSelf: 'center' }}>Personas</span>{[1, 2, 3].map((n) => <button key={n} className={'chip' + (pers === n ? ' on' : '')} onClick={() => { setManual(null); setPers(n); }}>{n}</button>)}</div>
        {porDia.map((x) => (
          <div key={x.dow} className="box"><b>{plural(x.dow)}</b> <span className="small muted">(lugar fijo cada semana)</span>
            {x.slots.length === 0 ? <div className="small muted">Sin lugar en ese rango.</div> : <div className="chips" style={{ marginTop: 6 }}>{x.slots.map((s) => s.bloq
              ? <span key={s.h} className="chip nod" title={s.bloq}>{hm(s.h)} · {s.bloq}</span>
              : <button key={s.h} className={'chip' + (off[x.dow + s.h] ? '' : ' on')} onClick={() => { setManual(null); setOff({ ...off, [x.dow + s.h]: !off[x.dow + s.h] }); }}>{hm(s.h)} <span className="small muted">· {s.n} libre{s.n === 1 ? '' : 's'}</span></button>)}</div>}
          </div>))}
        {dias.length > 0 && <Field label="Mensaje" hint="Podés editarlo antes de copiar"><textarea rows={5} value={txt} onChange={(e) => setManual(e.target.value)} /></Field>}
        {dias.length > 0 && !horariosTxt && <div className="muted small">No hay lugar libre en esos días y horarios.</div>}
        <button className="btn big" disabled={!txt} onClick={copiar}>Copiar mensaje</button>
        <div className="muted small">Los lugares libres salen de las clases agendadas y de los horarios fijos de quienes están inscriptas. En ámbar, los horarios que no están disponibles de forma permanente.</div>
      </div>
    </Sheet>
  );
}
