/* Read-only HTTP/browser checks. Start tools/serve.ps1 first. Requires Playwright. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const origin = process.env.KP_TEST_ORIGIN || 'http://localhost:8000';
const content = require('../data/technical.js');
const { route } = require('../assets/technical-library.js');
const artifacts = process.env.KP_TEST_ARTIFACTS;
const http = url => fetch(url, { signal: AbortSignal.timeout(8000) });
const source = fs.readFileSync(path.join(root, 'downloads/Select_Similar_Angle.py'), 'utf8').replace(/\r\n/g, '\n');
async function main() {
  await (await http(origin + '/__ping')).text();
  const files = ['index.html', 'data/fr.js', 'data/technical.js', 'assets/technical-library.js'];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.js')) new vm.Script(text, { filename: file });
    else for (const script of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/application\/ld\+json/.test(script[1])) new vm.Script(script[2]);
    }
  }
  const localLinks = new Set();
  const browser = await chromium.launch({ channel: process.env.KP_TEST_BROWSER || 'chrome', headless: true, timeout: 20000 });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(15000);
    const errors = [], analytics = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', request => errors.push(request.failure()?.errorText + ': ' + request.url()));
    page.on('response', response => { if (response.status() >= 400) errors.push('HTTP ' + response.status() + ': ' + response.url()); });
    page.on('request', request => { if (/google-analytics|googletagmanager/.test(request.url())) analytics.push(request.url()); });
    for (const lang of ['en', 'fr']) {
      for (const tool of [null, ...content[lang].tools]) {
        const pathname = route(lang, tool?.id);
        const response = await page.goto(origin + '/' + pathname, { waitUntil: 'networkidle' });
        console.log('Checking ' + pathname);
        assert.equal(response.status(), 200, pathname);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.getByRole('heading', { name: /^(Immersive Production Systems|Three Production Cases|Systèmes de production immersive|Trois cas de production)$/i }).count(), 0);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://killianpichon.art/' + pathname);
        assert.equal(await page.locator('html').getAttribute('lang'), lang === 'fr' ? 'fr-CA' : 'en');
        const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
        assert(schema['@graph'].some(item => item.url === 'https://killianpichon.art/' + pathname));
        for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => link.href))) {
          if (href.startsWith(origin)) localLinks.add(href);
        }
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(() => document.fonts.ready);
          const overflow = await page.evaluate(() => [...document.querySelectorAll('main *,nav.site-nav *')].filter(el => {
            const box = el.getBoundingClientRect();
            return box.width && (box.right > innerWidth + 1 || box.left < -1) && !el.closest('.tool-sr-only');
          }).map(el => el.tagName + '.' + el.className));
          assert.deepEqual(overflow, [], pathname + ' at ' + width);
          if (artifacts && lang === 'fr' && ((!tool && width === 1440) || (tool?.id === 'select-similar-angle' && width === 390) || (tool?.id === 'denon-sc2000-traktor' && width === 768))) {
            const decline = page.getByRole('button', { name: 'Refuser', exact: true });
            if (await decline.isVisible()) await decline.click();
            await page.evaluate(async () => {
              for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .75) {
                scrollTo({ top: y, behavior: 'instant' });
                await new Promise(resolve => setTimeout(resolve, 90));
              }
              scrollTo({ top: 0, behavior: 'instant' });
            });
            await page.waitForTimeout(800);
            await page.screenshot({ path: path.join(artifacts, (tool?.id || 'catalogue') + '-' + width + '.png'), fullPage: true });
          }
        }
        if (!tool) {
          for (const category of content[lang].categories) {
            await page.locator('.tool-categories a[href$="#' + category.id + '"]').click();
            assert.equal(new URL(page.url()).hash, '#' + category.id);
            assert(await page.locator('#' + category.id).isVisible());
          }
        }
        if (tool?.file) {
          const preview = page.locator('.tool-interface img');
          await preview.scrollIntoViewIfNeeded();
          await preview.evaluate(image => image.decode());
          assert.equal(await preview.evaluate(image => image.naturalWidth), 425);
          assert.equal(await preview.evaluate(image => image.naturalHeight), 275);
          assert((await preview.evaluate(image => image.currentSrc)).endsWith('.webp'));
          // Simulate an unsupported WebP source, then restore the real page before navigation.
          await page.locator('.tool-interface source').evaluate(source => { source.type = 'image/x-unsupported'; });
          await page.waitForFunction(() => document.querySelector('.tool-interface img').currentSrc.endsWith('.png'));
          await preview.evaluate(image => image.decode());
          assert.equal(await preview.evaluate(image => image.naturalWidth), 425);
          await page.locator('.tool-interface source').evaluate(source => { source.type = 'image/webp'; });
          await page.waitForFunction(() => document.querySelector('.tool-interface img').currentSrc.endsWith('.webp'));
          await preview.evaluate(image => image.decode());
          assert.equal(await page.locator('#tool-source').inputValue(), source);
          await page.getByRole('button', { name: content[lang].labels.copy, exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.length > 0);
          assert.equal((await page.evaluate(() => Promise.race([navigator.clipboard.readText(), new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard read timeout')), 8000))]))).replace(/\r\n/g, '\n'), source);
          const downloaded = await (await http(origin + '/' + tool.file)).text();
          assert.equal(downloaded.replace(/\r\n/g, '\n'), source);
          await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('Denied'); } }));
          await page.locator('[data-copy-code]').click();
          await page.waitForFunction(() => document.activeElement.id === 'tool-source');
          assert.equal(await page.locator('#tool-source').evaluate(el => el.selectionEnd - el.selectionStart), source.length);
          await page.evaluate(() => delete navigator.clipboard.writeText);
        }
        const other = lang === 'fr' ? 'en' : 'fr';
        await page.locator('.site-lang-link[hreflang="' + other + '"]').click();
        await page.waitForURL(origin + '/' + route(other, tool?.id));
        await page.waitForLoadState('networkidle');
      }
    }
    // Old links still work; the primary navigation leads to the indexable catalogue.
    for (const lang of ['en', 'fr']) {
      console.log('Checking legacy route ' + lang);
      await page.goto(origin + '/?lang=' + lang + '#/technical', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('h1').textContent(), content[lang].title);
      assert.equal(await page.getByRole('heading', { name: /^(Immersive Production Systems|Three Production Cases|Systèmes de production immersive|Trois cas de production)$/i }).count(), 0);
      await page.locator('.site-nav-link').filter({ hasText: content[lang].labels.technical }).click();
      await page.waitForURL(origin + '/' + route(lang));
      await page.locator('.site-nav-link').filter({ hasText: content[lang].labels.about }).click();
      await page.waitForURL(origin + '/?lang=' + lang + '#/about');
      await page.locator('h1').waitFor();
    }
    // Static content remains usable without JavaScript; no code loading dependency.
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    console.log('Checking no-JS and HTTP links');
    const plain = await noJS.newPage();
    await plain.goto(origin + '/' + route('fr', 'select-similar-angle'));
    assert.equal(await plain.locator('#tool-source').inputValue(), source);
    assert(await plain.getByRole('link', { name: content.fr.labels.download }).isVisible());
    await noJS.close();
    // All local links resolve, including case-sensitive filenames and section anchors.
    for (const href of localLinks) {
      const url = new URL(href);
      const response = await http(url);
      assert.equal(response.status, 200, url.pathname);
      const decoded = decodeURIComponent(url.pathname).replace(/^\//, '');
      let cursor = root;
      for (const segment of decoded.split('/').filter(Boolean)) {
        assert(fs.readdirSync(cursor).includes(segment), 'Path case: ' + decoded);
        cursor = path.join(cursor, segment);
      }
      const body = await response.text();
      if (url.hash && !url.hash.startsWith('#/')) assert(body.includes('id="' + url.hash.slice(1) + '"'), 'Anchor: ' + href);
    }
    for (const sensitive of ['tools/auth.json', 'tools/.backups/', 'tools/.diagnostic-ping.log', '.git/config', '.claude/', 'assets/../tools/auth.json', 'tools/%61uth.json']) {
      const response = await http(origin + '/' + sensitive);
      assert.equal(response.status, 404, 'Sensitive path: ' + sensitive);
      await response.text();
    }
    assert.equal((await http(origin + '/__settings')).status, 401);
    assert.equal(fs.readFileSync(path.join(root, 'CNAME'), 'utf8').trim(), 'killianpichon.art');
    assert(fs.existsSync(path.join(root, '.nojekyll')));
    assert.deepEqual(analytics, [], 'No Analytics before consent');
    assert.deepEqual(errors, [], 'Browser console/network');
    console.log('PASS: six static pages, EN/FR, 320/390/768/1440 px, navigation/anchors, copy/download/fallback, no-JS, metadata, local paths, consent and sensitive paths.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
