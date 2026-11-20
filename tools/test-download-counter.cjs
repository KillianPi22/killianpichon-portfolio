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

const reducerAsset = (id, count, version = '1.1.1') => asset(id, count, 'keyframe_reducer-' + version + '.zip');
const reducerTotal = fetcher => total(fetcher, undefined, 'keyframe-reducer');
test('reducer counts only installable ZIPs across stable releases in its own repository', async () => {
  const versions = [
    release([reducerAsset(10, 4), asset(11, 900, 'Source.zip'), asset(12, 800, 'Keyframe_Reducer_Pack_1.1.1.zip')], 'v1.1.1'),
    release([reducerAsset(13, 6, '1.2.0')], 'v1.2.0'),
    release([reducerAsset(10, 4)], 'v1.1.0'),
    release([reducerAsset(14, 50)], 'v1.3.0', { prerelease: true }),
    release([reducerAsset(15, 50)], 'v1.4.0', { draft: true }),
    release([reducerAsset(16, 50)], 'experimental'),
    release([reducerAsset(17, 50)], 'v1.5.0-beta.1'),
    release(pair)
  ];
  assert.equal(await reducerTotal(async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/KillianPi22/blender-keyframe-reducer/releases?per_page=100&page=1');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return response(versions);
  }), 10);
  assert.equal(await total(async () => response(versions)), 7);
});

test('reducer reports genuine zero, unpublished assets and invalid values distinctly', async () => {
  assert.equal(await reducerTotal(async () => response([release([reducerAsset(10, 0)], 'v1.1.1')])), 0);
  for (const entries of [[], [release(pair, 'v1.1.1')], [release([reducerAsset(10, -1)], 'v1.1.1')], [release([reducerAsset(10, '9')], 'v1.1.1')]]) {
    await assert.rejects(reducerTotal(async () => response(entries)));
  }
  await assert.rejects(reducerTotal(async () => ({ ok: false })));
  await assert.rejects(total(async () => response([]), undefined, 'unknown-tool'));
});

test('reducer history paginates and never reports a partial total as complete', async () => {
  let calls = 0;
  const first = [release([reducerAsset(10, 2)], 'v1.1.1'), ...Array.from({ length: 99 }, () => release([], 'other'))];
  assert.equal(await reducerTotal(async () => response(++calls === 1 ? first : [release([reducerAsset(10, 2), reducerAsset(11, 3, '1.0.0')], 'v1.0.0')])), 5);
  assert.equal(calls, 2);
  await assert.rejects(reducerTotal(async () => response(first)), /Incomplete release list/);
});

test('reducer static pages have one install button, source link, counter and local fallback in both languages', () => {
  const expected = 'https://github.com/KillianPi22/blender-keyframe-reducer/releases/download/v1.1.1/keyframe_reducer-1.1.1.zip';
  for (const lang of ['en', 'fr']) {
    const data = content[lang], tool = data.tools.find(t => t.id === 'keyframe-reducer');
    const html = view.detail(data, lang, tool);
    assert.equal(view.downloadURL(tool.download), expected);
    assert(html.includes('href="' + expected + '"'));
    assert(html.includes('href="https://github.com/KillianPi22/blender-keyframe-reducer"'));
    assert(html.includes('href="' + tool.download.file + '" download='));
    assert.equal((html.match(/data-download-count="keyframe-reducer"/g) || []).length, 1);
    assert.equal((html.match(/class="tool-button/g) || []).length, 1);
    assert(!html.includes('README_'));
    assert(!html.includes('undefined'));
    const staticHTML = fs.readFileSync(require('node:path').join(__dirname, '..', view.route(lang, tool.id), 'index.html'), 'utf8');
    assert(staticHTML.includes('assets/download-counter.js?v=' + content.revision));
    assert(staticHTML.includes('"downloadUrl":"' + expected + '"'));
  }
});

test('mixed browser counters stay independent, share requests per tool and isolate failures', async () => {
  for (const reducerAvailable of [true, false]) {
    const nodes = ['select-similar-angle', 'select-similar-angle', 'keyframe-reducer'].map(id => ({ dataset: { downloadCount: id, downloadLabel: 'downloads', downloadUnavailable: 'Unavailable' } }));
    const requests = [], listeners = {};
    const window = {
      fetch: async url => {
        requests.push(url);
        if (url.includes('/blender-keyframe-reducer/')) {
          if (!reducerAvailable) throw Error('Rate limited');
          return response([release([reducerAsset(20, 12)], 'v1.1.1')]);
        }
        return response([release(pair)]);
      },
      addEventListener: (event, fn) => { listeners[event] = fn; }
    };
    vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/download-counter.js'), 'utf8'), { window, document: { querySelectorAll: () => nodes, documentElement: { lang: 'en' } }, AbortController, Intl, setTimeout, clearTimeout, Date });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 2);
    assert(nodes.slice(0, 2).every(n => n.textContent === '7 downloads' && n.dataset.downloadState === 'ready'));
    assert.equal(nodes[2].textContent, reducerAvailable ? '12 downloads' : 'Unavailable');
    assert.equal(nodes[2].dataset.downloadState, reducerAvailable ? 'ready' : 'unavailable');
    await listeners.focus();
    assert.equal(requests.length, 2);
    assert.deepEqual(Object.keys(listeners), ['focus']);
  }
});
