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
  const [nick, setNick] = useState(() => { try { return localStorage.getItem('fp_nick') || ''; } catch { return ''; } }); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(nick, pw); try { localStorage.setItem('fp_nick', nick); } catch { /* */ } onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <div className="login"><form onSubmit={go} className="login-card">
      <div className="brand">Focus Pilates</div><div className="muted" style={{ marginBottom: 22 }}>Gestión del estudio · acceso del equipo</div>
      <Field label="Usuario"><input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={nick} onChange={(e) => setNick(e.target.value)} autoFocus={!nick} /></Field>
      <Field label="Contraseña"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={!!nick} /></Field>
      {err && <div className="warn" style={{ margin: '8px 0' }}>{err}</div>}
      <button className="btn big" disabled={busy || !nick || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <div className="muted small" style={{ marginTop: 16, textAlign: 'center' }}>¿Sos alumna? Entrá con el enlace personal que te envía tu profesora.</div></form></div>
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
          <div className="opts-who">@{me.nick} · {isAdmin ? 'Administrador' : 'Profesora'}</div>
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

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const [ok, setOk] = useState(hasSession());
  if (hash.startsWith('#mi/')) return <Portal token={hash.slice(4)} />;
  if (!ok) return <Login onDone={() => setOk(true)} />;
  return <Provider><Shell /></Provider>;
}
