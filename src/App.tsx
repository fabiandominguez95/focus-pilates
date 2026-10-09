import React, { useEffect, useState } from 'react';
import { Provider, useApp } from './store';
import { hasSession, login, logout, changeOwnPassword } from './api';
import Home from './pages/Home';
import Agenda from './pages/Agenda';
import Clientes, { PersonaSheet } from './pages/Clientes';
import Finanzas from './pages/Finanzas';
import Reportes from './pages/Reportes';
import { Productos } from './pages/Otros';
import Seguimiento from './pages/Seguimiento';
import Portal from './pages/Portal';
import Config, { Backup } from './pages/Config';
import { Sheet, Field } from './ui';

function Login({ onDone }: { onDone: () => void }) {
  const [modo, setModo] = useState<'' | 'equipo'>(() => { try { return localStorage.getItem('fp_nick') ? 'equipo' : ''; } catch { return ''; } });
  const [nick, setNick] = useState(() => { try { return localStorage.getItem('fp_nick') || ''; } catch { return ''; } }); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(nick, pw); try { localStorage.setItem('fp_nick', nick); } catch { /* */ } onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  if (!modo) return (
    <div className="login"><div className="login-card">
      <div className="brand">Focus Pilates</div><div className="muted" style={{ marginBottom: 26 }}>¿Cómo querés entrar?</div>
      <button className="btn big" onClick={() => { location.hash = 'mi'; }}>Soy alumno/a</button>
      <button className="btn ghost big" style={{ marginTop: 10 }} onClick={() => setModo('equipo')}>Soy instructor/a</button>
      <button className="admin-link" onClick={() => setModo('equipo')}>Administración</button></div></div>);
  return (
    <div className="login"><form onSubmit={go} className="login-card">
      <div className="brand">Focus Pilates</div><div className="muted" style={{ marginBottom: 22 }}>Gestión del estudio · acceso del equipo</div>
      <Field label="Usuario"><input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={nick} onChange={(e) => setNick(e.target.value)} autoFocus={!nick} /></Field>
      <Field label="Contraseña"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={!!nick} /></Field>
      {err && <div className="warn" style={{ margin: '8px 0' }}>{err}</div>}
      <button className="btn big" disabled={busy || !nick || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" className="admin-link" onClick={() => setModo("")}>‹ Volver</button></form></div>
  );
}

type View = 'hoy' | 'agenda' | 'clientes' | 'seguimiento' | 'productos' | 'finanzas' | 'reporte' | 'backup' | 'config';
const ICON: Record<string, string> = { hoy: '◉', agenda: '▦', clientes: '☺', seguimiento: '✉', productos: '▣', finanzas: '₲' };
const L: Record<string, string> = { hoy: 'Hoy', agenda: 'Agenda', clientes: 'Clientes', seguimiento: 'Seguimiento', productos: 'Productos', finanzas: 'Finanzas' };
const parseHash = () => { const [v, sub] = location.hash.slice(1).split('/'); return { v: ((['hoy', 'agenda', 'clientes', 'seguimiento', 'productos', 'finanzas', 'reporte', 'backup', 'config'].includes(v) ? v : 'hoy') as View), sub: sub || '' }; };

function Shell() {
  const { me, isAdmin, loading, err, reload } = useApp();
  const [h, setH] = useState(parseHash); const [pid, setPid] = useState<string | null>(null); const [pwSheet, setPwSheet] = useState(false); const [menu, setMenu] = useState(false);
  useEffect(() => { const f = () => { setH(parseHash()); setMenu(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (v: string) => { location.hash = v; };
  if (loading) return <div className="boot"><div className="brand">Focus Pilates</div><div className="muted">Cargando…</div></div>;
  if (err) return <div className="boot"><div className="warn">{err}</div><button className="btn" onClick={() => { logout(); location.reload(); }}>Volver a entrar</button><button className="btn ghost" onClick={reload}>Reintentar</button></div>;
  if (!me || me.activo === false) return <div className="boot"><div className="warn">Tu usuario no está habilitado.</div><button className="btn" onClick={() => { logout(); location.reload(); }}>Salir</button></div>;
  const view = h.v;
  const tabs: View[] = isAdmin ? ['hoy', 'agenda', 'clientes', 'seguimiento', 'productos', 'finanzas'] : ['hoy', 'agenda', 'clientes', 'seguimiento', 'productos'];
  const guard = (el: React.ReactNode) => (isAdmin ? el : <div className="page"><div className="muted pad">Esta sección es solo para administradores.</div></div>);
  const tab = tabs.includes(view) ? view : '';
  return (
    <div className="app">
      <div className="opts">
        <button className="opts-b" onClick={() => setMenu(!menu)} aria-label="Opciones" aria-expanded={menu}>⋯</button>
        {menu && <><div className="opts-scrim" onClick={() => setMenu(false)} /><div className="opts-m">
          <div className="opts-who">@{me.nick} · {isAdmin ? 'Administrador' : 'Instructor/a'}</div>
          {isAdmin && <button onClick={() => go('config')}>Configuración</button>}
          {isAdmin && <button onClick={() => go('reporte')}>Reporte</button>}
          {isAdmin && <button onClick={() => go('backup')}>Backup en Excel</button>}
          <button onClick={() => { setMenu(false); setPwSheet(true); }}>Cambiar mi contraseña</button>
          <button onClick={() => { logout(); location.reload(); }}>Cerrar sesión</button></div></>}
      </div>
      <main>
        {view === 'hoy' && <Home openPersona={setPid} />}
        {view === 'agenda' && <Agenda openPersona={setPid} />}
        {view === 'clientes' && <Clientes openPersona={setPid} />}
        {view === 'seguimiento' && <Seguimiento openPersona={setPid} />}
        {view === 'productos' && <Productos />}
        {view === 'finanzas' && guard(<Finanzas />)}
        {view === 'reporte' && guard(<Reportes />)}
        {view === 'backup' && guard(<div className="page"><header className="page-head"><h1>Backup</h1></header><Backup /></div>)}
        {view === 'config' && guard(<Config sec={h.sub} />)}
      </main>
      <nav className="tabbar">{tabs.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)}><span>{ICON[t]}</span>{L[t]}</button>)}</nav>
      {pid && <PersonaSheet id={pid} onClose={() => setPid(null)} />}
      {pwSheet && <PwSheet onClose={() => setPwSheet(false)} />}
    </div>
  );
}
function PwSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useApp(); const [pw, setPw] = useState('');
  return <Sheet title="Cambiar contraseña" onClose={onClose}><div className="stack"><Field label="Nueva contraseña (mínimo 6)"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field><button className="btn big" disabled={pw.length < 6} onClick={async () => { try { await changeOwnPassword(pw); toast('Contraseña actualizada'); onClose(); } catch (e: any) { toast(e.message); } }}>Guardar</button></div></Sheet>;
}

// Arrastrar hacia abajo desde arriba de cualquier pantalla para actualizar (datos y versión de la app)
function PullToRefresh() {
  const [dy, setDy] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let y0 = 0; let on = false; let cur = 0; const TH = 80;
    const start = (e: TouchEvent) => { on = false; cur = 0; if (window.scrollY > 0 || document.querySelector('.scrim') || e.touches.length !== 1) return; y0 = e.touches[0].clientY; on = true; };
    const move = (e: TouchEvent) => { if (!on) return; const d = e.touches[0].clientY - y0; if (d <= 0) { cur = 0; setDy(0); return; } if (window.scrollY > 0) { on = false; setDy(0); return; } cur = Math.min(d * 0.5, 120); setDy(cur); };
    const end = async () => { if (!on) return; on = false; if (cur >= TH * 0.6) { setBusy(true); setDy(48); try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); } catch { /* */ } location.reload(); } else setDy(0); };
    document.addEventListener('touchstart', start, { passive: true }); document.addEventListener('touchmove', move, { passive: true }); document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
    return () => { document.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', end); };
  }, []);
  if (!dy && !busy) return null;
  return <div className="ptr" style={{ transform: `translate(-50%, ${dy - 44}px)` }}><span className={busy ? 'spin' : ''} style={{ transform: busy ? undefined : `rotate(${dy * 3}deg)` }}>↻</span></div>;
}

export default function App() {
  return <><PullToRefresh /><AppInner /></>;
}
function AppInner() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const [ok, setOk] = useState(hasSession());
  let guardada = false; try { guardada = !!localStorage.getItem('fp_alumna'); } catch { /* */ }
  if (hash.startsWith('#mi')) return <Portal token={hash.startsWith('#mi/') ? hash.slice(4) : undefined} />;
  if (!ok && guardada && !hash) return <Portal />;
  if (!ok) return <Login onDone={() => setOk(true)} />;
  return <Provider><Shell /></Provider>;
}
