// Cliente mínimo de Supabase (Auth + PostgREST + Functions) sin dependencias.
export const SB_URL = 'https://bvnsgzprpazvjukrfnme.supabase.co';
// Clave anónima pública (la seguridad real está en RLS).
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bnNnenBycGF6dmp1a3Jmbm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTA0NDAsImV4cCI6MjEwNjc4NjQ0MH0.-yAVBIgL-WwPG5egmqg0Ncqm51dVCHDV5OpgKEMc1ts';
const DOM = '@focuspilates.app';
const LS = 'fp_session';

type Session = { access_token: string; refresh_token: string; expires_at: number; user_id: string };
let session: Session | null = null;
try { const s = localStorage.getItem(LS); if (s) session = JSON.parse(s); } catch { /* */ }
const save = (s: Session | null) => { session = s; try { s ? localStorage.setItem(LS, JSON.stringify(s)) : localStorage.removeItem(LS); } catch { /* */ } };
export const hasSession = () => !!session;
export const sessionUserId = () => session?.user_id;

async function authCall(path: string, body: any) {
  const r = await fetch(`${SB_URL}/auth/v1/${path}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Error de autenticación');
  return j;
}
const toSession = (j: any): Session => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600) - 30, user_id: j.user?.id || session?.user_id || '' });

export async function login(nick: string, password: string) {
  const n = nick.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
  try { save(toSession(await authCall('token?grant_type=password', { email: n + DOM, password }))); }
  catch (e: any) { throw new Error(/invalid/i.test(e.message) ? 'Usuario o contraseña incorrectos' : e.message); }
}
export function logout() { save(null); }
async function token() {
  if (!session) throw new Error('Sin sesión');
  if (session.expires_at < Date.now() / 1000) {
    try { save(toSession(await authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token }))); }
    catch { save(null); location.reload(); throw new Error('Sesión vencida'); }
  }
  return session!.access_token;
}
export async function changeOwnPassword(password: string) {
  const r = await fetch(`${SB_URL}/auth/v1/user`, { method: 'PUT', headers: { apikey: SB_KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).msg || 'No se pudo cambiar');
}

async function rest(method: string, table: string, query = '', body?: any, extra: Record<string, string> = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
    method, headers: { apikey: SB_KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) { let m = txt; try { m = JSON.parse(txt).message || txt; } catch { /* */ } throw new Error(m); }
  return txt ? JSON.parse(txt) : [];
}

export async function fetchAll(table: string, order = 'id') {
  const out: any[] = []; const step = 1000;
  for (let from = 0; ; from += step) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=*&order=${order}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${await token()}`, Range: `${from}-${from + step - 1}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(`${table}: ${(await r.json().catch(() => ({}))).message || r.status}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}
export const dbInsert = (table: string, rows: any) => rest('POST', table, '', rows, { Prefer: 'return=representation' });
export const dbUpdate = (table: string, col: string, val: string, patch: any) => rest('PATCH', table, `?${col}=eq.${encodeURIComponent(val)}`, patch, { Prefer: 'return=representation' });
export const dbUpsert = (table: string, rows: any, onConflict: string) => rest('POST', table, `?on_conflict=${onConflict}`, rows, { Prefer: 'return=representation,resolution=merge-duplicates' });
export const dbDelete = (table: string, col: string, val: string) => rest('DELETE', table, `?${col}=eq.${encodeURIComponent(val)}`, undefined, { Prefer: 'return=representation' });
export async function historial(limit = 200, tabla?: string, registro?: string) {
  let q = `?select=*&order=ts.desc&limit=${limit}`;
  if (tabla) q += `&tabla=eq.${tabla}`;
  if (registro) q += `&registro_id=eq.${registro}`;
  return rest('GET', 'fp_historial', q);
}
export async function adminFn(body: any) {
  const r = await fetch(`${SB_URL}/functions/v1/fp-admin`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error');
  return j;
}

// Llamada pública (sin sesión) a una función de la base: portal de alumnas
export async function rpcAnon(fn: string, args: any) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error('No se pudo cargar');
  return r.json();
}
