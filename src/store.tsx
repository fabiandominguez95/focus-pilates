import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { fetchAll, dbInsert, dbUpdate, dbUpsert, sessionUserId } from './api';
import { today } from './util';

export const TABLES: Record<string, [string, string]> = {
  personas: ['fp_personas', 'nombre'], suscripciones: ['fp_suscripciones', 'inicio'], clases: ['fp_clases', 'fecha'], horarios: ['fp_horarios', 'dia'],
  bloqueos: ['fp_bloqueos', 'fecha'], productos: ['fp_productos', 'nombre'], ventas: ['fp_ventas', 'fecha'], egresos: ['fp_egresos', 'mes'],
  cierres: ['fp_cierres', 'mes'], saldos: ['fp_saldos', 'created_at'], planes: ['fp_planes', 'orden'], promos: ['fp_promos', 'nombre'],
  metodos: ['fp_metodos_pago', 'orden'], profesoras: ['fp_profesoras', 'nombre'], conceptos: ['fp_egreso_conceptos', 'orden'], avisos: ['fp_avisos', 'creado_en'],
  users: ['fp_users', 'nick'], config: ['fp_config', 'key'],
};
export const DEFAULT_CFG: any = {
  apertura: '08:00', cierre: '20:00', cupo: 4, duracion_min: 60, pais: 'PY', pais_tel: '595', dias_habiles_semana: [1, 2, 3, 4, 5], recup_dias: 15,
  aviso_renovacion_dias: 3, aviso_atraso_dias: 2, avisos_offsets: [-3, 0, 2], espera_contacto_dias: 30, prueba_conv_dias: 14, inactiva_dias: 30, monto_suplente: 0,
  umbrales_atraso: { amarillo: 1, naranja: 4, naranja2: 8, rojo: 15 },
  descuento_grupo: { 2: { tipo: 'porcentaje', valor: 10 }, 3: { tipo: 'porcentaje', valor: 15 }, 4: { tipo: 'porcentaje', valor: 20 } },
  plantillas: {},
};

type Ctx = {
  d: any; cfg: any; me: any; isAdmin: boolean; loading: boolean; err: string; reload: () => Promise<void>;
  ins: (k: string, row: any) => Promise<any>; upd: (k: string, id: string, patch: any) => Promise<any>; setCfg: (key: string, value: any) => Promise<void>;
  toast: (m: string) => void; hoy: string; refreshTick: number;
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

const live = (rows: any[]) => rows.filter((r) => !r.deleted_at);

export function Provider({ children }: { children: React.ReactNode }) {
  const [d, setD] = useState<any>({}); const [loading, setLoading] = useState(true); const [err, setErr] = useState('');
  const [msg, setMsg] = useState(''); const [tick, setTick] = useState(0); const [hoy, setHoy] = useState(today());
  const tm = useRef<any>();
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(tm.current); tm.current = setTimeout(() => setMsg(''), 2600); }, []);

  const reload = useCallback(async () => {
    try {
      const keys = Object.keys(TABLES);
      const res = await Promise.all(keys.map((k) => fetchAll(TABLES[k][0], k === 'config' ? 'key' : k === 'cierres' ? 'mes' : 'id')));
      const nd: any = {}; keys.forEach((k, i) => (nd[k] = res[i]));
      setD(nd); setErr(''); setHoy(today());
    } catch (e: any) { setErr(e.message || String(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible') reload(); }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, [reload]);

  const ins = useCallback(async (k: string, row: any) => {
    const r = await dbInsert(TABLES[k][0], row); const arr = Array.isArray(r) ? r : [r];
    setD((p: any) => ({ ...p, [k]: [...(p[k] || []), ...arr] })); setTick((t) => t + 1); return Array.isArray(row) ? arr : arr[0];
  }, []);
  const upd = useCallback(async (k: string, id: string, patch: any) => {
    const r = await dbUpdate(TABLES[k][0], 'id', id, patch);
    if (!r.length) throw new Error('No se pudo guardar (sin permiso o no existe)');
    setD((p: any) => ({ ...p, [k]: p[k].map((x: any) => (x.id === id ? r[0] : x)) })); setTick((t) => t + 1); return r[0];
  }, []);
  const setCfg = useCallback(async (key: string, value: any) => {
    const r = await dbUpsert('fp_config', { key, value, updated_at: new Date().toISOString() }, 'key');
    setD((p: any) => ({ ...p, config: [...(p.config || []).filter((x: any) => x.key !== key), ...r] })); setTick((t) => t + 1);
  }, []);

  const cfg = useMemo(() => { const o: any = { ...DEFAULT_CFG }; (d.config || []).forEach((r: any) => (o[r.key] = r.value)); o.plantillas = { ...(o.plantillas || {}) }; return o; }, [d.config]);
  const me = useMemo(() => (d.users || []).find((u: any) => u.id === sessionUserId()) || null, [d.users]);
  // datos vivos (sin papelera)
  const dv = useMemo(() => {
    const o: any = { ...d };
    ['personas', 'suscripciones', 'clases', 'bloqueos', 'productos', 'ventas', 'egresos'].forEach((k) => { o[k + 'All'] = d[k] || []; o[k] = live(d[k] || []); });
    o.avisos = live(d.avisos || []);
    ['horarios', 'planes', 'promos', 'metodos', 'profesoras', 'conceptos', 'users', 'cierres', 'saldos', 'config'].forEach((k) => (o[k] = d[k] || []));
    return o;
  }, [d]);

  return (
    <C.Provider value={{ d: dv, cfg, me, isAdmin: me?.rol === 'admin', loading, err, reload, ins, upd, setCfg, toast, hoy, refreshTick: tick }}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </C.Provider>
  );
}
