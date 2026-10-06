// Utilidades de fecha, formato y WhatsApp. Hora de pared de Asunción (el navegador del estudio ya está en esa zona).
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const addDays = (s: string, n: number) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a: string, b: string) => Math.round((parseD(a).getTime() - parseD(b).getTime()) / 86400000); // a - b
export const addMonths = (s: string, n: number) => {
  const d = parseD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return ymd(d);
};
export const subFin = (inicio: string) => addDays(addMonths(inicio, 1), -1);
export const monthOf = (s: string) => s.slice(0, 7);
export const addMonthKey = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const monthLabel = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MESES[mo - 1]} ${y}`; };
export const monthShort = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${MESES3[mo - 1]} ${String(y).slice(2)}`; };
export const dowISO = (s: string) => { const d = parseD(s).getDay(); return d === 0 ? 7 : d; }; // 1=lun..7=dom
export const fmtDate = (s?: string | null) => { if (!s) return '—'; const d = parseD(s); return `${d.getDate()} ${MESES3[d.getMonth()]}`; };
export const fmtDateY = (s?: string | null) => { if (!s) return '—'; const d = parseD(s); return `${d.getDate()} ${MESES3[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtLong = (s: string) => { const d = parseD(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const hm = (t?: string | null) => (t ? t.slice(0, 5) : '');
export const gs = (n: any) => { const v = Math.round(Number(n) || 0); return (v < 0 ? '−' : '') + 'Gs ' + Math.abs(v).toLocaleString('es-PY'); };
export const num = (n: any) => Math.round(Number(n) || 0).toLocaleString('es-PY');
export const gsShort = (n: number) => { const a = Math.abs(n); const s = a >= 1e6 ? (a / 1e6).toFixed(1).replace('.0', '') + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'k' : String(Math.round(a)); return (n < 0 ? '−' : '') + s; };
export const uid = () => (crypto as any).randomUUID();
export const timeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const minToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const daysInMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };

export const normStr = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function normPhone(raw: string, cc = '595') {
  let d = (raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if ((raw || '').trim().startsWith('+')) return d;
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return cc + d.slice(1);
  if (d.startsWith(cc) && d.length >= 11) return d;
  if (d.length <= 9) return cc + d;
  return d;
}
export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
export const fillTpl = (tpl: string, v: Record<string, string>) => (tpl || '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
export const primerNombre = (n: string) => (n || '').split(' ')[0];
export const phonePretty = (p?: string | null) => { if (!p) return ''; if (p.startsWith('595') && p.length === 12) return '0' + p.slice(3, 6) + ' ' + p.slice(6, 9) + ' ' + p.slice(9); return '+' + p; };

export const FERIADOS_PY: Record<string, [string, string][]> = {
  '2025': [['2025-01-01', 'Año Nuevo'], ['2025-03-01', 'Día de los Héroes'], ['2025-04-17', 'Jueves Santo'], ['2025-04-18', 'Viernes Santo'], ['2025-05-01', 'Día del Trabajador'], ['2025-05-14', 'Independencia'], ['2025-05-15', 'Independencia'], ['2025-06-12', 'Paz del Chaco'], ['2025-08-15', 'Fundación de Asunción'], ['2025-09-29', 'Victoria de Boquerón'], ['2025-12-08', 'Virgen de Caacupé'], ['2025-12-25', 'Navidad']],
  '2026': [['2026-01-01', 'Año Nuevo'], ['2026-03-01', 'Día de los Héroes'], ['2026-04-02', 'Jueves Santo'], ['2026-04-03', 'Viernes Santo'], ['2026-05-01', 'Día del Trabajador'], ['2026-05-14', 'Independencia'], ['2026-05-15', 'Independencia'], ['2026-06-12', 'Paz del Chaco'], ['2026-08-15', 'Fundación de Asunción'], ['2026-09-29', 'Victoria de Boquerón'], ['2026-12-08', 'Virgen de Caacupé'], ['2026-12-25', 'Navidad']],
  '2027': [['2027-01-01', 'Año Nuevo'], ['2027-03-01', 'Día de los Héroes'], ['2027-03-25', 'Jueves Santo'], ['2027-03-26', 'Viernes Santo'], ['2027-05-01', 'Día del Trabajador'], ['2027-05-14', 'Independencia'], ['2027-05-15', 'Independencia'], ['2027-06-12', 'Paz del Chaco'], ['2027-08-15', 'Fundación de Asunción'], ['2027-09-29', 'Victoria de Boquerón'], ['2027-12-08', 'Virgen de Caacupé'], ['2027-12-25', 'Navidad']],
};
const holCache: Record<string, [string, string][]> = {};
export async function feriados(year: string, pais: string): Promise<{ list: [string, string][]; fuente: string }> {
  const key = year + pais;
  if (holCache[key]) return { list: holCache[key], fuente: 'online' };
  try {
    const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${pais}`);
    if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) { holCache[key] = j.map((x: any) => [x.date, x.localName || x.name]); return { list: holCache[key], fuente: 'online' }; } }
  } catch { /* usa respaldo */ }
  return { list: pais === 'PY' ? FERIADOS_PY[year] || [] : [], fuente: 'respaldo' };
}
export function diasHabilesMes(m: string, semana: number[], feriadosMes: string[]) {
  let n = 0; const total = daysInMonth(m);
  for (let d = 1; d <= total; d++) { const s = `${m}-${pad(d)}`; if (semana.includes(dowISO(s)) && !feriadosMes.includes(s)) n++; }
  return n;
}
