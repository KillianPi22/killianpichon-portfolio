// Integration test in an isolated copy with disposable credentials.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-technical-test-'));
const origin = 'http://localhost:8157';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, browser;
async function main() {
  for (const name of ['index.html', 'privacy.html', 'sitemap.xml', 'CNAME', '.nojekyll', 'data', 'assets', 'projects']) {
    fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true });
  }
  fs.mkdirSync(path.join(fixture, 'tools'));
  for (const name of ['serve.ps1', 'editor.html', 'editor.js', 'editor.css', 'visual-editor.js', 'visual-editor.ps1', 'local-network.ps1', 'launch-editor.html']) {
    if (fs.existsSync(path.join(root, 'tools', name))) fs.copyFileSync(path.join(root, 'tools', name), path.join(fixture, 'tools', name));
  }
  const original = fs.readFileSync(path.join(fixture, 'index.html'), 'utf8');
  const password = crypto.randomBytes(32).toString('base64url');
  const salt = crypto.randomBytes(16);
  fs.writeFileSync(path.join(fixture, 'tools/auth.json'), JSON.stringify({ iter: 310000, salt: salt.toString('base64'), hash: crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('base64') }));
  server = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(fixture, 'tools/serve.ps1'), '-Port', '8157', '-NoBrowser'], { windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/__ping')).ok) break; } catch {}
    if (i === 99) throw Error('Test server unavailable');
    await delay(200);
  }
  const heartbeat = setInterval(() => fetch(origin + '/__ping').catch(() => {}), 5000);
  try {
    assert.equal((await fetch(origin + '/__settings')).status, 401);
    assert.equal((await fetch(origin + '/__settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: { showTechnical: true } }) })).status, 401);
    const auth = await (await fetch(origin + '/__auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })).json();
    assert(auth.ok);
    const headers = { 'X-Auth-Token': auth.token, 'Content-Type': 'application/json' };
    const save = values => fetch(origin + '/__settings', { method: 'POST', headers, body: JSON.stringify({ values }) }).then(r => r.json());
    const settings = await (await fetch(origin + '/__settings', { headers })).json();
    const setting = settings.items.find(s => s.key === 'showTechnical');
    assert.equal(setting.kind, 'boolean');
    assert.equal(setting.value, 'false');
    assert.equal(setting.problem, null);
    assert((await save({ showTechnical: 'invalid' })).rejected.length);
    assert.equal(fs.readFileSync(path.join(fixture, 'index.html'), 'utf8'), original);
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', () => errors.push('request failed'));
    page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status()); });
    for (const enabled of [false, true, false]) {
      if (enabled || fs.readFileSync(path.join(fixture, 'index.html'), 'utf8').includes('KP_SHOW_TECHNICAL = true')) assert((await save({ showTechnical: enabled })).ok);
      for (const lang of ['en', 'fr']) for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 950 });
        await page.goto(origin + '/?lang=' + lang + '#/technical');
        await page.locator('.site-nav-link').first().waitFor();
        await page.waitForFunction(hash => location.hash === hash, enabled ? '#/technical' : '#/work');
        assert.equal(new URL(page.url()).hash, enabled ? '#/technical' : '#/work');
        assert.equal(await page.locator('.site-nav-link[href="#/technical"]').count(), enabled ? 1 : 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.equal((await page.locator('body').innerText()).toLowerCase().includes('three production cases'), enabled && lang === 'en');
      }
    }
    assert.equal(fs.readFileSync(path.join(fixture, 'index.html'), 'utf8'), original, 'toggle roundtrip must preserve all content');
    await page.goto(origin + '/__editor');
    await page.locator('#pw').fill(password);
    await page.locator('#lockform button').click();
    await page.locator('#tabSettings').click();
    const toggle = page.locator('#setting-showTechnical');
    await toggle.waitFor();
    assert(!(await toggle.isChecked()));
    await toggle.check();
    const saved = page.waitForResponse(r => r.url().endsWith('/__settings') && r.request().method() === 'POST');
    await page.locator('#setsave').click();
    assert((await (await saved).json()).ok);
    assert(fs.readFileSync(path.join(fixture, 'index.html'), 'utf8').includes('KP_SHOW_TECHNICAL = true'));
    assert((await save({ showTechnical: false })).ok);
    assert.equal(fs.readFileSync(path.join(fixture, 'index.html'), 'utf8'), original);
    for (const rel of ['tools/auth.json', 'tools/.backups/x', '.git/HEAD', '.claude/settings.json', 'tools/.diagnostic-ping.log']) assert.equal((await fetch(origin + '/' + rel)).status, 404);
    assert.deepEqual(fs.readFileSync(path.join(fixture, 'CNAME')), fs.readFileSync(path.join(root, 'CNAME')));
    assert(fs.existsSync(path.join(fixture, '.nojekyll')));
    assert.deepEqual(errors, []);
    console.log('PASS checkbox save, boolean validation, authentication, on/off routing in two languages at three widths, content preserved and sensitive paths blocked');
  } finally { clearInterval(heartbeat); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  server?.kill();
  // Delete only the disposable authentication file; never access the real one.
  const disposableAuth = path.join(fixture, 'tools/auth.json');
  if (fs.existsSync(disposableAuth)) fs.unlinkSync(disposableAuth);
});
