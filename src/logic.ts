import { parseD, addDays, diffDays, hm, minToTime, normStr, nowHM, timeToMin } from './util';

export type Stage = 'prueba' | 'inscripta' | 'no_renovo' | 'no_se_inscribio' | 'nuevo' | 'unica';
export const STAGE_LABEL: Record<Stage, string> = { prueba: 'Prueba', inscripta: 'Inscripto/a', no_renovo: 'No renovó', no_se_inscribio: 'No se inscribió', nuevo: 'Nuevo/a', unica: 'Clase única' };

export function buildIndex(d: any) {
  const personaById = new Map<string, any>(d.personas.map((p: any) => [p.id, p]));
  const subsByP = new Map<string, any[]>(); const clasesByP = new Map<string, any[]>(); const horByP = new Map<string, any[]>(); const clasesBySub = new Map<string, any[]>();
  d.suscripciones.forEach((s: any) => { if (s.cancelada) return; (subsByP.get(s.persona_id) || subsByP.set(s.persona_id, []).get(s.persona_id)!).push(s); });
  subsByP.forEach((a) => a.sort((x, y) => x.inicio.localeCompare(y.inicio)));
  d.clases.forEach((c: any) => {
    (clasesByP.get(c.persona_id) || clasesByP.set(c.persona_id, []).get(c.persona_id)!).push(c);
    if (c.suscripcion_id) (clasesBySub.get(c.suscripcion_id) || clasesBySub.set(c.suscripcion_id, []).get(c.suscripcion_id)!).push(c);
  });
  d.horarios.forEach((h: any) => { if (h.activo === false) return; (horByP.get(h.persona_id) || horByP.set(h.persona_id, []).get(h.persona_id)!).push(h); });
  const planById = new Map<string, any>(d.planes.map((p: any) => [p.id, p]));
  const profById = new Map<string, any>(d.profesoras.map((p: any) => [p.id, p]));
  const metodoById = new Map<string, any>(d.metodos.map((p: any) => [p.id, p]));
  const clasesById = new Map<string, any>(d.clases.map((c: any) => [c.id, c]));
  return { personaById, subsByP, clasesByP, horByP, clasesBySub, planById, profById, metodoById, clasesById };
}
export type Index = ReturnType<typeof buildIndex>;

export function slotKey(fecha: string, hora: string) { return fecha + ' ' + hm(hora); }
export function ocupacionMap(d: any) {
  const m = new Map<string, number>();
  d.clases.forEach((c: any) => { if (c.estado === 'agendada' || c.estado === 'asistio') m.set(slotKey(c.fecha, c.hora), (m.get(slotKey(c.fecha, c.hora)) || 0) + 1); });
  return m;
}

export function claseTerminada(c: any, hoy: string, ahora = nowHM(), dur = 60) {
  if (c.fecha < hoy) return true;
  if (c.fecha > hoy) return false;
  return timeToMin(hm(c.hora)) + dur <= timeToMin(ahora);
}

// Estado de la persona: etapa + color por atraso
export function estadoPersona(p: any, idx: Index, cfg: any, hoy: string) {
  const subs = (idx.subsByP.get(p.id) || []);
  const mensuales = subs.filter((s) => s.tipo !== 'unica');
  const clases = idx.clasesByP.get(p.id) || [];
  const tienePrueba = !!p.prueba_fecha || clases.some((c) => c.tipo === 'prueba');
  const u = cfg.umbrales_atraso;
  let stage: Stage = 'nuevo'; let atraso = 0; let sub: any = null; let vigente = false; let impago = false;
  if (mensuales.length) {
    sub = mensuales[mensuales.length - 1];
    const sinPagar = !sub.pago_fecha;
    if (sub.inicio <= hoy && hoy <= sub.fin) { vigente = true; stage = 'inscripta'; if (sinPagar) { impago = true; atraso = Math.max(0, diffDays(hoy, sub.inicio)); } }
    else if (sub.inicio > hoy) { stage = 'inscripta'; vigente = true; }
    else {
      atraso = diffDays(hoy, sub.fin); // días desde el último día cubierto
      stage = atraso > cfg.inactiva_dias ? 'no_renovo' : 'inscripta';
    }
  } else if (subs.length) { stage = 'unica'; sub = subs[subs.length - 1]; }
  else if (tienePrueba) {
    const pf = p.prueba_fecha || clases.filter((c) => c.tipo === 'prueba').map((c) => c.fecha).sort().pop();
    stage = pf && diffDays(hoy, pf) > cfg.prueba_conv_dias ? 'no_se_inscribio' : 'prueba';
  }
  let color: '' | 'am' | 'na' | 'na2' | 'ro' = '';
  if (stage === 'inscripta' && atraso >= 1) color = atraso >= u.rojo ? 'ro' : atraso >= u.naranja2 ? 'na2' : atraso >= u.naranja ? 'na' : atraso >= u.amarillo ? 'am' : '';
  return { stage, atraso, sub, vigente, impago, color, tienePrueba };
}
export const COLOR_NAME: Record<string, string> = { am: 'Amarillo', na: 'Naranja', na2: 'Naranja fuerte', ro: 'Rojo' };

export function personaStats(p: any, idx: Index, hoy: string, recupDias: number) {
  const clases = (idx.clasesByP.get(p.id) || []).slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const subs = idx.subsByP.get(p.id) || [];
  const asist = clases.filter((c) => c.estado === 'asistio' && c.tipo !== 'prueba');
  const ausentes = clases.filter((c) => esFalta(c) && c.tipo !== 'prueba');
  const canceladas = clases.filter((c) => c.estado === 'ausente' && sinCulpa(c) && c.tipo !== 'prueba');
  const recup = clases.filter((c) => c.tipo === 'recuperacion' && c.estado === 'asistio');
  const pagado = subs.reduce((a, s) => a + (Number(s.pago_monto) || 0), 0);
  const pagos = subs.filter((s) => s.pago_fecha);
  const firstSub = subs.filter((x: any) => x.tipo !== 'unica')[0]?.inicio; const firstReal = clases.find((c: any) => c.tipo !== 'prueba')?.fecha;
  const cand = [firstSub, firstReal].filter(Boolean).sort(); // la antigüedad cuenta desde que se inscribió, no desde la prueba
  const primera = cand[0] || clases[0]?.fecha || p.fecha_alta || null;
  const ant = primera ? diffDays(hoy, primera) : 0;
  const ultima = clases.filter((c) => c.estado === 'asistio').map((c) => c.fecha).sort().pop() || null;
  return { clases, subs, asist: asist.length, ausentes: ausentes.length, canceladas: canceladas.length, recup: recup.length, pagado, nPagos: pagos.length, ticket: pagos.length ? pagado / pagos.length : 0, primera, antiguedadDias: ant, ultima, meses: subs.filter((s) => s.tipo !== 'unica').length };
}

// ausencia recuperable: días restantes
export const SIN_CULPA = ['feriado', 'cancela_estudio'];
export const sinCulpa = (c: any) => SIN_CULPA.includes(c.motivo_ausencia);
export const esFalta = (c: any) => c.estado === 'ausente' && !sinCulpa(c);
export const cambioHora = (c: any) => !!c.hora_original && !!c.fecha_original && c.fecha_original === c.fecha && hm(c.hora_original) !== hm(c.hora);
// Si la clase se canceló por feriado o por el estudio, no vence el plazo
export function recupRestante(c: any, hoy: string, recupDias: number) { return sinCulpa(c) ? 999 : recupDias - diffDays(hoy, c.fecha); }

// Cuadros del período de una suscripción
export type Square = { c: any; kind: 'ok' | 'rec' | 'rec_pend' | 'aus' | 'perdida' | 'pend' | 'sin_cerrar' | 'no_dada' | 'cancel'; days?: number; recup?: any };
export function squaresForSub(sub: any, idx: Index, hoy: string, recupDias: number, dur = 60): Square[] {
  const all = (idx.clasesByP.get(sub.persona_id) || []).filter((c) => c.fecha >= sub.inicio && c.fecha <= sub.fin && c.tipo !== 'prueba');
  const regs = all.filter((c) => c.tipo === 'regular' || c.tipo === 'unica');
  const recs = all.filter((c) => c.tipo === 'recuperacion');
  const used = new Set<string>(); const out: Square[] = [];
  regs.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).forEach((c) => {
    if (c.estado === 'asistio') out.push({ c, kind: 'ok' });
    else if (c.estado === 'no_dada') out.push({ c, kind: 'no_dada' });
    else if (c.estado === 'ausente') {
      const rc = (idx.clasesByP.get(sub.persona_id) || []).find((x) => x.recupera_de === c.id && !x.deleted_at);
      if (rc) { used.add(rc.id); out.push({ c, kind: rc.estado === 'asistio' ? 'rec' : 'rec_pend', recup: rc }); }
      else if (c.ausencia_resolucion === 'no_recupera') out.push({ c, kind: sinCulpa(c) ? 'cancel' : 'perdida' });
      else if (sinCulpa(c)) out.push({ c, kind: 'cancel' });
      else { const left = recupRestante(c, hoy, recupDias); out.push(left >= 0 ? { c, kind: 'aus', days: left } : { c, kind: 'perdida' }); }
    } else out.push({ c, kind: claseTerminada(c, hoy, '23:59', dur) && c.fecha < hoy ? 'sin_cerrar' : 'pend' });
  });
  recs.forEach((rc) => { if (!used.has(rc.id) && !rc.recupera_de) out.push({ c: rc, kind: rc.estado === 'asistio' ? 'rec' : 'rec_pend', recup: rc }); });
  return out;
}

export function clasesDeHorario(h: any[]) { return h.map((x) => `${['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][x.dia]} ${hm(x.hora)}`).join(' · '); }

export function matchPersona(p: any, q: string) {
  const n = normStr(q); if (!n) return true;
  const hay = normStr(p.nombre + ' ' + (p.celular || '') + ' ' + (p.notas || ''));
  return n.split(/\s+/).every((t) => hay.includes(t));
}
export { addDays };

export function horasDisponibles(cfg: any) {
  const a = timeToMin(cfg.apertura), c = timeToMin(cfg.cierre); const out: string[] = [];
  for (let m = Math.ceil(a / 60) * 60; m + 60 <= c; m += 60) out.push(minToTime(m)); // siempre en punto
  return out;
}

// ¿El bloqueo/no disponibilidad aplica a esa fecha? (día suelto, rango, o indefinido; opcionalmente solo ciertos días de semana)
export function bloqAplica(b: any, f: string) {
  if (b.deleted_at) return false;
  const dow = parseD(f).getDay() || 7; const okDia = !b.dias || !b.dias.length || b.dias.includes(dow);
  if (b.indefinido) return f >= b.fecha && okDia;
  if (b.fecha_hasta) return f >= b.fecha && f <= b.fecha_hasta && okDia;
  return b.fecha === f;
}
