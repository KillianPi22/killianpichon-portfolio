'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { total } = require('../assets/download-counter.js');
const content = require('../data/technical.js');
const view = require('../assets/technical-library.js');
const asset = (id, count, name = 'Select_Similar_Angle.py') => ({ id, name, state: 'uploaded', download_count: count });
const release = (assets, tag = 'select-similar-angle-v1', extra = {}) => ({ tag_name: tag, assets, ...extra });
const pair = [asset(1, 3), asset(2, 4, 'Select_Similar_Angle_EN.py')];
const response = data => ({ ok: true, json: async () => data });
test('adds both languages across versions, ignoring other assets/drafts/prereleases', async () => {
  const data = [release([...pair, asset(9, 999, 'other.zip')]), release([asset(3, 5)], 'select-similar-angle-v2'), release(pair, 'other-v1'), release(pair, undefined, { draft: true }), release(pair, undefined, { prerelease: true })];
  assert.equal(await total(async () => response(data)), 12);
});
test('zero is a valid total only when both downloads exist', async () => {
  assert.equal(await total(async () => response([release(pair.map(a => ({ ...a, download_count: 0 })))])), 0);
  await assert.rejects(total(async () => response([])));
  await assert.rejects(total(async () => response([release([pair[0]])])));
});
test('pagination includes old releases and deduplicates asset IDs', async () => {
  let calls = 0;
  const first = [release(pair), ...Array.from({ length: 99 }, () => release([], 'unrelated'))];
  assert.equal(await total(async (url, options) => {
    calls++;
    assert(url.endsWith('page=' + calls));
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return response(calls === 1 ? first : [release([pair[0], asset(3, 5)], 'select-similar-angle-v0')]);
  }), 12);
  assert.equal(calls, 2);
});
test('network, rate limit and invalid data fail without a false total', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => ({ ok: false }), async () => response({}), async () => response([release([asset(1, -1), pair[1]])]), async () => response([release([asset(1, '7'), pair[1]])])]) await assert.rejects(total(fetcher));
});
test('both static languages contain GitHub links and local fallback without JS', () => {
  for (const lang of ['fr', 'en']) {
    const data = content[lang], tool = data.tools[0];
    const html = view.detail(data, lang, tool, 'code', 'other code');
    assert.equal((html.match(/data-download-count /g) || []).length, 2);
    for (const file of [tool.file, tool.alternate.file]) {
      assert(html.includes('releases/download/' + tool.downloadRelease + '/' + file.split('/').pop()));
      assert(html.includes('href="' + file + '" download='));
    }
    assert(!html.includes('undefined'));
    const staticHTML = fs.readFileSync(require('node:path').join(__dirname, '..', view.route(lang, tool.id), 'index.html'), 'utf8');
    assert(staticHTML.includes('assets/download-counter.js?v=' + content.revision));
  }
});
test('browser updates both counters; focus is throttled and no clicks are tracked', async () => {
  const nodes = [1, 2].map(() => ({ dataset: { downloadLabel: 'téléchargements via GitHub (FR + EN)', downloadUnavailable: 'Compteur indisponible' } }));
  let calls = 0;
  const listeners = {};
  const window = { fetch: async () => { calls++; return response([release(pair)]); }, addEventListener: (event, fn) => { listeners[event] = fn; } };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/download-counter.js'), 'utf8'), { window, document: { querySelectorAll: () => nodes, documentElement: { lang: 'fr' } }, AbortController, Intl, setTimeout, clearTimeout, Date });
  await new Promise(resolve => setImmediate(resolve));
  assert(nodes.every(n => n.textContent === '7 téléchargements via GitHub (FR + EN)' && n.dataset.downloadState === 'ready'));
  await listeners.focus();
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(listeners), ['focus']);
});
