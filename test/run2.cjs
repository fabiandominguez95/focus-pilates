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
  await page.fill('input[autocomplete=username]', ROLE); await page.fill('input[type=password]', 'x'); await page.click('button.btn.big'); await page.waitForSelector('.tabbar', { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SCR + `s1_home_${ROLE}.png`, fullPage: true });
  const shot = (n) => page.screenshot({ path: SCR + n + '.png' });
  // clase de hoy -> sheet -> ausente
  await page.click('.row-card.t-regular >> nth=1'); await page.waitForSelector('.sheet'); await shot('i1_class');
  await page.click('text=No vino'); await page.click('text=Avisó tarde'); await page.waitForTimeout(300);
  // a confirmar
  await page.click('.row-card.t-regular >> nth=1'); await page.click('text=A confirmar'); await page.waitForTimeout(300); await shot('i2_home_after');
  // perfil
  await page.evaluate(() => (location.hash = 'clientes')); await page.waitForTimeout(300);
  await page.fill('.search', 'alejandra d'); await page.click('.row-card >> nth=0'); await page.waitForSelector('.sheet'); await page.waitForTimeout(300);
  await page.screenshot({ path: SCR + 'i3_persona.png' });
  await page.click('text=Renovar >> nth=0'); await page.waitForTimeout(300); await shot('i4_renew');
  await page.click('text=Guardar y registrar pago'); await page.waitForTimeout(500); await shot('i5_after_renew');
  fs.writeFileSync(SCR + 'log.txt', log.join('\n'));
  console.log(log.join('\n') || 'sin errores de consola');
  await b.close();
})().catch((e) => { console.error('FAIL', e); fs.writeFileSync(SCR + 'log.txt', log.join('\n')); process.exit(1); });
