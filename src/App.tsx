import React, { useEffect, useState } from 'react';
import { Provider, useApp } from './store';
import { hasSession, login, logout, changeOwnPassword } from './api';
import Home from './pages/Home';
import Agenda from './pages/Agenda';
import Clientes, { PersonaSheet } from './pages/Clientes';
import Finanzas from './pages/Finanzas';
import Reportes, { Facts } from './pages/Reportes';
import { Productos, Recuperar } from './pages/Otros';
import Config, { Backup } from './pages/Config';
import { Sheet, Field } from './ui';

function Login({ onDone }: { onDone: () => void }) {
  const [nick, setNick] = useState(() => { try { return localStorage.getItem('fp_nick') || ''; } catch { return ''; } }); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(nick, pw); try { localStorage.setItem('fp_nick', nick); } catch { /* */ } onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <div className="login"><form onSubmit={go} className="login-card">
      <div className="brand">Focus Pilates</div><div className="muted" style={{ marginBottom: 22 }}>Gestión del estudio</div>
      <Field label="Usuario"><input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={nick} onChange={(e) => setNick(e.target.value)} autoFocus={!nick} /></Field>
      <Field label="Contraseña"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={!!nick} /></Field>
      {err && <div className="warn" style={{ margin: '8px 0' }}>{err}</div>}
      <button className="btn big" disabled={busy || !nick || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button></form></div>
  );
}

type View = 'hoy' | 'agenda' | 'clientes' | 'finanzas' | 'mas' | 'reporte' | 'facts' | 'productos' | 'recuperar' | 'config' | 'backup';
const ICON: Record<string, string> = { hoy: '◉', agenda: '▦', clientes: '☺', finanzas: '₲', mas: '⋯' };

function Shell() {
  const { me, isAdmin, loading, err, reload } = useApp();
  const [view, setView] = useState<View>(() => (location.hash.slice(1) as View) || 'hoy'); const [pid, setPid] = useState<string | null>(null); const [pwSheet, setPwSheet] = useState(false);
  useEffect(() => { const f = () => setView((location.hash.slice(1) as View) || 'hoy'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (v: View) => { location.hash = v; setView(v); window.scrollTo(0, 0); };
  if (loading) return <div className="boot"><div className="brand">Focus Pilates</div><div className="muted">Cargando…</div></div>;
  if (err) return <div className="boot"><div className="warn">{err}</div><button className="btn" onClick={() => { logout(); location.reload(); }}>Volver a entrar</button><button className="btn ghost" onClick={reload}>Reintentar</button></div>;
  if (!me || me.activo === false) return <div className="boot"><div className="warn">Tu usuario no está habilitado.</div><button className="btn" onClick={() => { logout(); location.reload(); }}>Salir</button></div>;
  const tab = ['hoy', 'agenda', 'clientes', 'finanzas'].includes(view) ? view : 'mas';
  const tabs: View[] = isAdmin ? ['hoy', 'agenda', 'clientes', 'finanzas', 'mas'] : ['hoy', 'agenda', 'clientes', 'mas'];
  const L: Record<string, string> = { hoy: 'Hoy', agenda: 'Agenda', clientes: 'Clientes', finanzas: 'Finanzas', mas: 'Más' };
  const guard = (el: React.ReactNode) => (isAdmin ? el : <div className="page"><div className="muted pad">Esta sección es solo para administradores.</div></div>);
  const MAS: [View, string, string, boolean][] = [['reporte', 'Reporte', 'Números y comparativos', true], ['facts', 'Datos curiosos', 'Mejores, más, menos…', false], ['productos', 'Productos', 'Stock y ventas', false], ['recuperar', 'Recuperar contactos', 'Invitar a volver', false], ['backup', 'Backup en Excel', 'Descargar datos', true], ['config', 'Configuración', 'Planes, usuarios, mensajes, historial, papelera', true]];
  return (
    <div className="app">
      <main>
        {view === 'hoy' && <Home openPersona={setPid} />}
        {view === 'agenda' && <Agenda openPersona={setPid} />}
        {view === 'clientes' && <Clientes openPersona={setPid} />}
        {view === 'finanzas' && guard(<Finanzas />)}
        {view === 'reporte' && guard(<Reportes />)}
        {view === 'facts' && <Facts openPersona={setPid} />}
        {view === 'productos' && <Productos />}
        {view === 'recuperar' && <Recuperar openPersona={setPid} />}
        {view === 'backup' && guard(<div className="page"><header className="page-head"><h1>Backup</h1></header><Backup /></div>)}
        {view === 'config' && guard(<Config />)}
        {view === 'mas' && (
          <div className="page"><header className="page-head"><h1>Más</h1></header>
            <div className="list">{MAS.filter((m) => !m[3] || isAdmin).map(([v, t, s]) => <div className="row-card plain" key={v} onClick={() => go(v)}><div className="grow"><b>{t}</b><div className="small muted">{s}</div></div><span className="chev">›</span></div>)}
              <div className="row-card plain" onClick={() => setPwSheet(true)}><div className="grow"><b>Cambiar mi contraseña</b></div><span className="chev">›</span></div>
              <div className="row-card plain" onClick={() => { logout(); location.reload(); }}><div className="grow"><b>Cerrar sesión</b><div className="small muted">@{me.nick} · {isAdmin ? 'Admin' : 'Profe'}</div></div></div></div></div>)}
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
  const [ok, setOk] = useState(hasSession());
  if (!ok) return <Login onDone={() => setOk(true)} />;
  return <Provider><Shell /></Provider>;
}
