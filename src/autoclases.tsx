import { useEffect, useRef } from 'react';
import { useApp } from './store';
import { buildIndex, estadoPersona } from './logic';
import { fetchAll } from './api';
import { addDays, dowISO, hm, timeToMin } from './util';
import { bloqAplica } from './logic';

// Mantiene el horario fijo visible: mientras la persona sea «Inscripta» (vigente o dentro del plazo de atraso) y no esté marcada
// como «ya no va a renovar», se le agendan las clases de su horario fijo hasta 4 semanas adelante, aunque su suscripción venza antes.
// Cuando pasa a «No renovó» (o se marca que no renueva), se quitan sus clases futuras posteriores al vencimiento.
const HORIZONTE = 28;

export function useAutoClases() {
  const { d, cfg, hoy, ins, upd, isAdmin, loading, me, toast } = useApp();
  const ran = useRef('');
  useEffect(() => {
    if (loading || !isAdmin || !d.personas || !d.horarios || !d.suscripciones || !d.avisos) return;
    if (ran.current === hoy) return; ran.current = hoy;
    (async () => {
      try {
        const raw: any[] = await fetchAll('fp_clases'); const idx = buildIndex(d);
        const profe = me?.profesora_id || d.profesoras.find((p: any) => p.tipo === 'fija')?.id || null;
        const nuevas: any[] = []; let quitadas = 0; const hasta = addDays(hoy, HORIZONTE);
        for (const p of d.personas) {
          if (p.baneado) continue;
          const e = estadoPersona(p, idx, cfg, hoy); const sub = e.sub; if (!sub || sub.tipo === 'unica') continue;
          const marcada = d.avisos.some((a: any) => a.tipo === 'no_renueva' && a.persona_id === p.id && String(a.ref || '').split('|')[0] === sub.id);
          const mias = raw.filter((c) => c.persona_id === p.id);
          if (e.stage === 'inscripta' && !marcada) {
            const hs = (idx.horByP.get(p.id) || []); const reg = mias.filter((c) => c.tipo === 'regular'); if (!hs.length || !reg.length) continue;
            const last = reg.reduce((m: string, c: any) => (c.fecha > m ? c.fecha : m), ''); const vivas = mias.filter((c) => !c.deleted_at);
            const ocupado = new Set<string>(vivas.map((c) => c.fecha)); vivas.forEach((c) => { if (c.fecha_original && c.fecha_original !== c.fecha) ocupado.add(c.fecha_original); });
            for (let f = last >= hoy ? addDays(last, 1) : hoy; f <= hasta; f = addDays(f, 1)) {
              if (ocupado.has(f)) continue;
              for (const h of hs.filter((x: any) => x.dia === dowISO(f))) {
                const bloq = d.bloqueos.some((b: any) => bloqAplica(b, f) && b.hora_desde && timeToMin(hm(b.hora_desde)) <= timeToMin(hm(h.hora)) && timeToMin(hm(b.hora_hasta)) > timeToMin(hm(h.hora)));
                if (bloq) continue;
                nuevas.push({ persona_id: p.id, suscripcion_id: sub.id, fecha: f, hora: h.hora, tipo: 'regular', estado: 'agendada', profesora_id: profe }); ocupado.add(f); break;
              }
            }
          } else if (e.stage === 'no_renovo' || marcada) {
            for (const c of mias) if (!c.deleted_at && c.tipo === 'regular' && c.estado === 'agendada' && c.suscripcion_id === sub.id && c.fecha >= hoy && c.fecha > sub.fin) { await upd('clases', c.id, { deleted_at: new Date().toISOString() }); quitadas++; }
          }
        }
        if (nuevas.length) await ins('clases', nuevas);
        if (nuevas.length || quitadas) toast(`Horarios fijos al día: ${nuevas.length ? nuevas.length + ' clases agendadas' : ''}${nuevas.length && quitadas ? ' · ' : ''}${quitadas ? quitadas + ' quitadas (no renovaron)' : ''}`);
      } catch { /* se reintenta al día siguiente o al recargar */ }
    })();
  }, [loading, isAdmin, hoy, d.personas, d.horarios, d.suscripciones, d.avisos]);
}
