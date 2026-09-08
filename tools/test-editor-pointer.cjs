// Serve tools/serve.ps1 first. API responses are simulated in this browser only:
// no password, session, editorial write or protected content is used.
// NODE_PATH must include Playwright; optionally set EDITOR_TEST_URL.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = JSON.parse(execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); ' +
    '. ./tools/serve.ps1 -NoServe; ' +
    '@{ items = @(Get-Strings); fr = (ConvertTo-FrPayload (Read-FrDictionary)); fields = @($ProjectFields); project = (Get-ProjectDetail "hurtubise") } | ConvertTo-Json -Depth 20 -Compress'
  ], { cwd:root, encoding:'utf8', maxBuffer:10e6 }));
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
    const errors = [], failed = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('response', r => { if (r.status() >= 400) failed.push(new URL(r.url()).pathname); });
    const base = process.env.EDITOR_TEST_URL || 'http://localhost:8017';
    await page.route('**/__*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__editor' || url.pathname === '/__ping') return route.continue();
      const data = {
        '/__auth':{ ok:true, token:'browser-test-fixture' },
        '/__strings':{ items:source.items, stamp:'test' },
        '/__fr':source.fr,
        '/__changes':{ ok:true, changes:[] },
        '/__meta':{ stamp:'test' },
        '/__projects':{ items:[], fields:source.fields, stamp:'test' },
        '/__project':{ ok:true, ...source.project }
      }[url.pathname];
      assert.ok(data, 'Unexpected API request: ' + url.pathname);
      await route.fulfill({ json:data });
    });
    await page.goto(base + '/__editor');
    await page.locator('#pw').fill('test fixture');
    await page.locator('#lockform button').click();
    await page.locator('#lock').waitFor({ state:'hidden' });
    let frame = page.frameLocator('#site');
    await frame.locator('body').waitFor();

    // Controlled visible targets exercise real pointer coordinates and DOM focus.
    const text = source.items.find(it => it.file === 'projects' && source.fr.ui.some(p => p.k === it.text))
      || source.items.find(it => source.fr.ui.some(p => p.k === it.text));
    assert.ok(text);
    const translated = source.fr.ui.find(p => p.k === text.text).v;
    const mount = async (label, lang='en') => {
      await frame.locator('body').evaluate((body, { label, lang }) => {
        body.ownerDocument.documentElement.lang = lang;
        let target = body.querySelector('#pointer-test-target');
        if (!target) { target = body.ownerDocument.createElement('button'); target.id = 'pointer-test-target'; body.append(target); }
        target.textContent = label;
        target.style.cssText = 'position:fixed;top:150px;left:30px;z-index:2147483647;background:black;color:white;outline:3px solid blue;outline-offset:4px;max-width:400px';
        target.onclick = () => { body.dataset.unwantedClick = 'yes'; };
      }, { label, lang });
    };
    await mount(text.text);
    await page.locator('#pick').click();
    await frame.locator('#pointer-test-target').hover();
    assert.equal(await frame.locator('#pointer-test-target').evaluate(e => getComputedStyle(e).cursor), 'crosshair');
    await frame.locator('#pointer-test-target').click();
    assert.equal(await page.locator('textarea:focus').inputValue(), text.text);
    assert.equal(await frame.locator('body').getAttribute('data-unwanted-click'), null);

    await page.locator('#search').fill('no matching text');
    await page.locator('#frFilters [data-f="manquants"]').click();
    await mount(translated, 'fr');
    await frame.locator('#pointer-test-target').click();
    assert.equal(await page.locator('.ta-fr:focus').inputValue(), translated);
    assert.equal(await page.locator('#search').inputValue(), '');
    assert.equal(await page.locator('#frFilters .on').getAttribute('data-f'), 'tous');
    // Rerendering after a second pick must preserve a pending edit.
    await page.locator('.ta-fr:focus').fill('Traduction en attente');
    await frame.locator('#pointer-test-target').click();
    assert.equal(await page.locator('.ta-fr:focus').inputValue(), 'Traduction en attente');

    const short = source.fr.ui.find(p => !source.items.some(it => it.text === p.k) && p.v);
    await mount(short.v, 'fr');
    await frame.locator('#pointer-test-target').click();
    assert.equal(await page.locator('.ta-fr:focus').inputValue(), short.v);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pick').getAttribute('aria-pressed'), 'false');
    assert.equal(await frame.locator('#pointer-test-target').evaluate(e => e.style.outlineOffset), '4px');
    assert.equal(await frame.locator('#pointer-test-target').evaluate(e => e.style.outline), 'blue solid 3px');

    // Refresh retains the selected page/language and reattaches pointer listeners.
    await page.locator('#site').evaluate(e => { e.src = '/?lang=fr#/about'; });
    await frame.locator('html[lang^="fr"]').waitFor();
    await page.locator('#pick').click();
    await page.locator('#refresh').click();
    await page.waitForFunction(() => document.querySelector('#site').contentWindow.location.hash === '#/about');
    await frame.locator('html[lang^="fr"]').waitFor();
    await mount(text.text, 'en');
    await frame.locator('#pointer-test-target').click();
    assert.equal(await page.locator('.ta-en:focus').inputValue(), text.text);
    await page.keyboard.press('Escape');

    // Real project paragraph: focus its dedicated French form, preserving drafts.
    await page.locator('#site').evaluate(e => { e.src = '/?lang=fr#/project/hurtubise'; });
    const projectText = source.fr.projects.find(p => p.id === 'hurtubise' && p.field === 'overview');
    assert.ok(projectText);
    await frame.getByText(projectText.v[0], { exact:true }).first().waitFor();
    await page.locator('#pick').click();
    await frame.getByText(projectText.v[0], { exact:true }).first().click();
    const projectInput = page.locator('#projects textarea[data-key="overview"][data-lang="fr"]');
    await projectInput.waitFor();
    assert.equal(await projectInput.inputValue(), projectText.v[0]);
    assert.ok(await projectInput.evaluate(e => e === document.activeElement));
    await projectInput.fill('Brouillon du projet');
    await frame.getByText(projectText.v[0], { exact:true }).first().click();
    assert.equal(await projectInput.inputValue(), 'Brouillon du projet');
    await page.keyboard.press('Escape');

    // Public preview navigation/resources at the required viewport widths.
    const preview = await browser.newPage();
    preview.on('pageerror', err => errors.push(err.message));
    for (const width of [390, 768, 1440]) {
      await preview.setViewportSize({ width, height:1000 });
      await preview.goto(base + '/?lang=fr#/about');
      await preview.locator('#root > *').first().waitFor();
      assert.ok(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow at ' + width);
    }
    for (const url of ['/tools/auth.json', '/tools/.backups/', '/.git/config', '/.claude/', '/tools/.diagnostic-ping.log']) {
      const res = await preview.request.get(base + url);
      assert.equal(res.status(), 404, 'Sensitive path must stay blocked');
    }
    assert.equal((await preview.request.get(base + '/__strings')).status(), 401);
    assert.equal((await preview.request.get(base + '/CNAME')).status(), 200);
    assert.equal((await preview.request.get(base + '/.nojekyll')).status(), 200);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed.filter(p => p !== '/favicon.ico'), []);
    console.log('PASS: EN/FR pointer, filters, pending edits, project translations, dictionary-only labels, click interception, cursor restoration, Escape, refresh, responsive preview and local access controls.');
  } finally { await browser.close(); }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
