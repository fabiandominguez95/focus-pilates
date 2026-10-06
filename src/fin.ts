import { addMonthKey, monthOf } from './util';

export function allMonths(d: any, hoy: string, extraFuture = 0) {
  const keys = new Set<string>();
  d.suscripciones.forEach((s: any) => s.pago_fecha && keys.add(monthOf(s.pago_fecha)));
  d.egresos.forEach((e: any) => keys.add(e.mes)); d.ventas.forEach((v: any) => v.fecha && keys.add(monthOf(v.fecha)));
  keys.add(monthOf(hoy));
  const sorted = [...keys].sort(); let m = sorted[0]; const last = addMonthKey(monthOf(hoy), extraFuture); const out: string[] = [];
  while (m <= last) { out.push(m); m = addMonthKey(m, 1); }
  return out;
}
export const pagosMes = (d: any, m: string) => d.suscripciones.filter((s: any) => s.pago_fecha && monthOf(s.pago_fecha) === m && !s.cancelada);
export const ventasMes = (d: any, m: string) => d.ventas.filter((v: any) => v.fecha && monthOf(v.fecha) === m);
export const egresosMes = (d: any, m: string) => d.egresos.filter((e: any) => e.mes === m);
export function resumenMes(d: any, m: string) {
  const pagos = pagosMes(d, m); const ventas = ventasMes(d, m); const egr = egresosMes(d, m);
  const ingSubs = pagos.reduce((a: number, s: any) => a + (Number(s.pago_monto) || 0), 0); const ingVentas = ventas.reduce((a: number, v: any) => a + (Number(v.total) || 0), 0);
  const egresos = egr.reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0);
  const pend = egr.filter((e: any) => !e.pagado).reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0);
  return { m, pagos, ventas, egr, ingSubs, ingVentas, ingresos: ingSubs + ingVentas, egresos, pend, balance: ingSubs + ingVentas - egresos, nPagos: pagos.length };
}
export function ultimoSaldo(d: any) { return [...d.saldos].sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || '')).pop(); }
export function salario(base: number, dias: number, horas: number, horasDia = 12) { return dias > 0 ? (base / dias / horasDia) * horas : 0; }
