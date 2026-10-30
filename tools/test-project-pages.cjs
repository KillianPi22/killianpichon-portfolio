/* Read-only browser/HTTP regression checks. Start tools/serve.ps1 first. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const pages = require('../assets/project-pages.js');
const root = path.resolve(__dirname, '..');
const origin = process.env.KP_TEST_ORIGIN || 'http://localhost:8158';
const artifacts = process.env.KP_TEST_ARTIFACTS;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = { window: {} };
for (const file of ['data/projects.js', 'data/fr.js']) vm.runInNewContext(read(file), context);
const projects = context.window.KP_PROJECTS, french = context.window.KP_FR;
const ids = Object.keys(projects).filter(id => pages.isPublic(projects[id]));
const errors = [], analytics = [], resources = new Set(), localLinks = new Set();
const request = url => fetch(url, { signal: AbortSignal.timeout(15000) });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function pathCase(url) {
  let cursor = root;
  for (const segment of decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean)) {
    assert(fs.readdirSync(cursor).includes(segment), 'Case-sensitive path: ' + new URL(url).pathname);
    cursor = path.join(cursor, segment);
  }
}
async function ready(page) {
  await page.locator('h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(180);
}
async function scrollPage(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .8) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(180);
}
async function main() {
  const beat = setInterval(() => request(origin + '/__ping').catch(() => {}), 5000);
  const browser = await chromium.launch({ channel: process.env.KP_TEST_BROWSER || 'chrome', headless: true });
  try {
    const browserContext = await browser.newContext({ reducedMotion: 'reduce', locale: 'en-CA' });
    const page = await browserContext.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', req => {
      if (/googletagmanager|google-analytics/.test(req.url())) analytics.push(req.url());
      if (req.url().startsWith(origin) && ['image', 'font', 'script', 'stylesheet'].includes(req.resourceType())) resources.add(req.url());
    });
    page.on('requestfailed', req => errors.push(req.failure()?.errorText + ' ' + new URL(req.url()).hostname + new URL(req.url()).pathname));
    page.on('response', res => { if (res.status() >= 400) errors.push('HTTP ' + res.status() + ' ' + new URL(res.url()).pathname); });
    const plainContext = await browser.newContext({ javaScriptEnabled: false, locale: 'fr-CA' });
    const plain = await plainContext.newPage();
    const sitemap = await (await request(origin + '/sitemap.xml')).text();
    for (const id of (process.argv.includes('--navigation-only') ? [] : ids)) for (const lang of ['en', 'fr']) {
      const route = pages.path(id, lang), url = origin + '/' + route;
      const project = { ...projects[id], ...(lang === 'fr' ? french.projects[id] : {}) };
      const expected = pages.meta(id, project, lang);
      assert(sitemap.includes('<loc>' + pages.origin + route + '</loc>'));
      const response = await page.goto(url);
      assert.equal(response.status(), 200);
      await ready(page);
      assert.equal(await page.locator('h1').textContent(), project.title);
      assert.equal(await page.title(), expected.title);
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), expected.description);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), pages.origin + route);
      assert.equal(await page.locator('html').getAttribute('lang'), lang === 'fr' ? 'fr-CA' : 'en');
      assert.equal(new URL(page.url()).hash, '');
      const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
      assert(schema['@graph'].some(item => item.url === pages.origin + route));
      assert.equal(await page.locator('iframe').count(), 0, 'No video mounted before a click');
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await scrollPage(page);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + ' overflows at ' + width);
        const broken = await page.locator('img').evaluateAll(images => images.filter(i => i.getBoundingClientRect().width && (!i.complete || !i.naturalWidth)).map(i => i.getAttribute('src')));
        assert.deepEqual(broken, [], route + ' images');
        if (artifacts && lang === 'fr' && ['traveler', 'banquet', 'cabotage'].includes(id)) {
          await page.screenshot({ path: path.join(artifacts, id + '-' + width + '.png'), fullPage: true });
        }
      }
      for (const href of await page.locator('a[href]').evaluateAll(links => links.map(a => a.href))) if (href.startsWith(origin)) localLinks.add(href);
      // Every related project is a real, crawlable link and retains the requested language.
      for (const href of await page.locator('.related-project-button').evaluateAll(links => links.map(a => a.href))) {
        assert(new URL(href).pathname.endsWith(lang === 'fr' ? '/fr/' : '/'));
        assert.equal(new URL(href).hash, '');
      }
      await plain.goto(url);
      assert.equal(await plain.locator('h1').textContent(), project.title);
      assert((await plain.locator('body').innerText()).includes(project.overview));
      assert.equal(await plain.title(), expected.title);
      assert.equal(await plain.locator('link[rel="canonical"]').getAttribute('href'), pages.origin + route);
      assert.equal(await plain.locator('iframe').count(), 0);
      const other = lang === 'fr' ? 'en' : 'fr';
      assert.equal(await plain.locator('.site-lang-link[hreflang="' + other + '"]').evaluate(a => a.href), origin + '/' + pages.path(id, other));
      await page.locator('.site-lang-link[hreflang="' + other + '"]').click();
      await page.waitForURL(origin + '/' + pages.path(id, other));
      await ready(page);
      assert.equal(await page.locator('html').getAttribute('lang'), other === 'fr' ? 'fr-CA' : 'en');
      console.log('PASS ' + route);
    }
    await plainContext.close();
    // Legacy links, language persistence, history and reloads.
    for (const lang of ['en', 'fr']) {
      await page.goto(origin + '/?lang=' + lang + '&explore=2#/project/traveler');
      await ready(page);
      assert.equal(new URL(page.url()).pathname, '/' + pages.path('traveler', lang));
      assert.equal(new URL(page.url()).searchParams.get('explore'), '2');
      assert.equal(new URL(page.url()).hash, '');
      await page.locator('.related-project-button').first().click();
      await ready(page);
      assert.equal(new URL(page.url()).pathname, '/' + pages.path('hurtubise', lang));
      await page.goBack();
      await ready(page);
      assert.equal(await page.locator('h1').textContent(), projects.traveler.title);
      await page.reload();
      await ready(page);
      assert.equal(await page.locator('h1').textContent(), projects.traveler.title);
      await page.locator('.project-back').click();
      await ready(page);
      assert.equal(new URL(page.url()).pathname, '/');
      assert.equal(new URL(page.url()).hash, '#/work');
      assert(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'].some(item => item['@type'] === 'Person'));
      const first = page.locator('.project-grid-featured a[href*="/projects/"]').first();
      assert(!new URL(await first.getAttribute('href'), origin).hash);
      await first.click();
      await ready(page);
      assert(new URL(page.url()).pathname.startsWith('/projects/'));
    }
    // Existing protection has no static page, no sitemap entry and no unlocked media.
    for (const [id, source] of Object.entries(projects).filter(([, p]) => !pages.isPublic(p))) {
      assert(!sitemap.includes('<loc>' + pages.origin + pages.path(id, 'en')));
      assert(!fs.existsSync(path.join(root, pages.path(id, 'en'), 'index.html')));
      await page.goto(origin + '/?lang=fr#/project/' + id);
      await ready(page);
      assert.equal(await page.locator('iframe').count(), 0);
      assert.equal(await page.locator('input[type="password"]').count(), source.protected ? 1 : 0);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,follow');
    }
    await page.goto(origin + '/projects/traveler/fr/');
    await ready(page);
    await page.locator('.kp-protected-access button').click();
    assert.equal(await page.locator('input[type="password"]').count(), 1);
    await page.locator('.kp-protected-close').click();
    // Gallery still opens, supports keyboard navigation and closes.
    await page.locator('[aria-label^="Ouvrir"]').filter({ has: page.locator('img') }).first().click();
    assert.equal(await page.locator('.modal-backdrop').count(), 1);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal-backdrop').count(), 0);
    for (const href of [...localLinks, ...resources]) {
      const response = await request(href);
      assert.equal(response.status, 200, new URL(href).pathname);
      await response.arrayBuffer();
      pathCase(href);
    }
    for (const sensitive of ['tools/auth.json', 'tools/.backups/', 'tools/.diagnostic-ping.log', '.git/config', '.claude/', 'tools/%61uth.json', 'assets/../tools/auth.json']) {
      assert.equal((await request(origin + '/' + sensitive)).status, 404, 'Sensitive path remains blocked');
    }
    assert.equal((await request(origin + '/__settings')).status, 401);
    assert.equal(read('CNAME').trim(), 'killianpichon.art');
    assert(fs.existsSync(path.join(root, '.nojekyll')));
    assert.deepEqual(analytics, [], 'No Analytics before consent');
    assert.deepEqual(errors, [], 'No browser console/network errors');
    console.log(process.argv.includes('--navigation-only') ? 'PASS: navigation, history, gallery, protected access, resources, consent and server restrictions.' : 'PASS: 26 pages, 2 languages, mobile/tablet/desktop, no-JS, metadata, links, history, gallery, protected access, resources, consent and server restrictions.');
  } finally { clearInterval(beat); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
