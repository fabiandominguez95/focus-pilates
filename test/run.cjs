const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'); const crypto = require('crypto');
const SCR = '/tmp/claude-0/-home-claude/f77849e9-7340-58a8-b5f5-90a2d25e7dfe/scratchpad/';
const DB = JSON.parse(fs.readFileSync(SCR + 'mock.json'));
const ROLE = process.argv[2] || 'fabian';
const USERID = ROLE === 'fabian' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222';
const log = [];
function filt(rows, q) { for (const [k, v] of q) { if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue; const m = /^eq\.(.*)$/.exec(v); if (m) rows = rows.filter((r) => String(r[k]) === m[1]); } return rows; }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => log.push('PAGEERROR: ' + e.message));
  await page.clock.setFixedTime(new Date('2026-10-05T15:20:00-03:00'));
  await page.route('https://bvnsgzprpazvjukrfnme.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    if (p.startsWith('/auth/v1/token')) { const body = JSON.parse(req.postData() || '{}'); if (body.password === 'bad') return route.fulfill({ status: 400, headers: H, body: JSON.stringify({ error_description: 'Invalid login credentials' }) }); return route.fulfill({ headers: H, body: JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: USERID } }) }); }
    const PERF = { nombre: 'Ana Prueba', clases: [{ fecha: '2026-10-01', hora: '09:00:00', tipo: 'regular', estado: 'asistio' }, { fecha: '2026-10-08', hora: '09:00:00', tipo: 'regular', estado: 'agendada' }, { fecha: '2026-10-02', hora: '09:00:00', tipo: 'regular', estado: 'ausente' }], subs: [{ inicio: '2026-09-20', fin: '2026-10-19', plan: 'Plan 2', tipo: 'mensual' }], horarios: [{ dia: 1, hora: '09:00:00' }], recup_dias: 15, estudio: { clases_dadas: 120, desde: '2025-09-15' } };
    PERF.clases = ['2026-09-14','2026-09-17','2026-09-21','2026-09-28','2026-10-01','2026-10-05'].map((f) => ({ fecha: f, hora: '09:00:00', tipo: f === '2026-09-14' ? 'prueba' : 'regular', estado: 'asistio' })).concat([{ fecha: '2026-09-24', hora: '09:00:00', tipo: 'regular', estado: 'ausente' }, { fecha: '2026-10-12', hora: '09:00:00', tipo: 'regular', estado: 'agendada' }]);
    if (p === '/rest/v1/rpc/fp_portal_enlace') return route.fulfill({ status: 200, headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify([PERF, { ...PERF, nombre: 'Hijo Prueba' }]) });
    if (p === '/rest/v1/rpc/fp_portal_login') { const b = JSON.parse(req.postData() || '{}'); return route.fulfill({ status: 200, headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(b.p_pin === '901134' ? { perfiles: [PERF] } : { error: 'incorrecto' }) }); }
    if (p.startsWith('/rest/v1/')) {
      const t = p.replace('/rest/v1/', ''); const rows = DB[t]; if (!rows) return route.fulfill({ status: 404, headers: H, body: JSON.stringify({ message: 'no table ' + t }) });
      const q = [...u.searchParams.entries()];
      if (req.method() === 'GET') { let r = filt(rows, q); const rg = req.headers()['range']; if (rg) { const [a, z] = rg.split('-').map(Number); r = r.slice(a, z + 1); } return route.fulfill({ headers: H, body: JSON.stringify(r) }); }
      const body = JSON.parse(req.postData() || 'null');
      if (req.method() === 'POST') { const arr = Array.isArray(body) ? body : [body]; const out = arr.map((x) => { const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), deleted_at: null, ...x }; if (t === 'fp_config' || t === 'fp_cierres') { const key = t === 'fp_config' ? 'key' : 'mes'; const i = rows.findIndex((r) => r[key] === x[key]); if (i >= 0) { Object.assign(rows[i], x); return rows[i]; } } rows.push(row); return row; }); log.push('INSERT ' + t + ' ' + JSON.stringify(out).slice(0, 160)); return route.fulfill({ status: 201, headers: H, body: JSON.stringify(out) }); }
      if (req.method() === 'PATCH') { const r = filt(rows, q); r.forEach((x) => Object.assign(x, body)); log.push('PATCH ' + t + ' ' + JSON.stringify(body).slice(0, 160)); return route.fulfill({ headers: H, body: JSON.stringify(r) }); }
    }
    return route.fulfill({ status: 404, headers: H, body: '{}' });
  });
  const base = 'http://localhost:8099/';
  await page.goto(base); await page.waitForTimeout(400);
  await page.screenshot({ path: SCR + 's0_login.png' });
  await page.screenshot({ path: SCR + 's0_elegir.png' }); await page.click('text=Soy instructor/a');
  await page.fill('input[autocomplete=username]', ROLE); await page.fill('input[type=password]', 'x'); await page.click('button.btn.big'); await page.waitForSelector('.tabbar', { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SCR + `s1_home_${ROLE}.png`, fullPage: true });
  for (const [name, hash] of [['agenda', 'agenda'], ['clientes', 'clientes'], ['seguimiento', 'seguimiento'], ['finanzas', 'finanzas'], ['reporte', 'reporte'], ['productos', 'productos'], ['config', 'config'], ['cfgplanes', 'config/planes'], ['cfggeneral', 'config/general']]) {
    await page.evaluate((h) => (location.hash = h), hash); await page.waitForTimeout(400);
    await page.screenshot({ path: SCR + `s_${name}_${ROLE}.png`, fullPage: true });
  }
  await page.evaluate(() => (location.hash = 'hoy')); await page.waitForTimeout(300); await page.click('.opts-b'); await page.waitForTimeout(200); await page.screenshot({ path: SCR + `s_menu_${ROLE}.png` }); await page.keyboard.press('Escape'); await page.mouse.click(10, 400);
  await page.evaluate(() => (location.hash = 'mi/' + 'x'.repeat(24))); await page.waitForTimeout(500); await page.screenshot({ path: SCR + 's_portal.png', fullPage: true });
  await page.evaluate(() => (location.hash = 'mi')); await page.waitForTimeout(400); await page.fill('input[placeholder^="Tu nombre"]', 'Prueba'); await page.fill('input[inputmode=numeric]', '111111'); await page.click('button.btn.big'); await page.waitForTimeout(500); await page.screenshot({ path: SCR + 's_alumna_err.png' }); await page.fill('input[inputmode=numeric]', '901134'); await page.click('button.btn.big'); await page.waitForTimeout(600); await page.screenshot({ path: SCR + 's_alumna_ok.png', fullPage: true });
  fs.writeFileSync(SCR + 'log.txt', log.join('\n'));
  console.log(log.join('\n') || 'sin errores de consola');
  await b.close();
})().catch((e) => { console.error('FAIL', e); fs.writeFileSync(SCR + 'log.txt', log.join('\n')); process.exit(1); });
