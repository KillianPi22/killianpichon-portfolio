/* Public GitHub release totals. No click tracking, cookies, storage or credentials. */
(function (root) {
  'use strict';
  const repository = 'KillianPi22/killianpichon-portfolio';
  const prefix = 'select-similar-angle-';
  const names = ['Select_Similar_Angle.py', 'Select_Similar_Angle_EN.py'];
  async function total(fetcher = fetch, signal) {
    let count = 0;
    const seen = new Set(), found = new Set();
    for (let page = 1; page <= 20; page++) {
      const response = await fetcher('https://api.github.com/repos/' + repository + '/releases?per_page=100&page=' + page, {
        credentials: 'omit', referrerPolicy: 'no-referrer', signal,
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error('Download total unavailable');
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error('Invalid release list');
      for (const release of releases) {
        if (release.draft || release.prerelease || !release.tag_name?.startsWith(prefix)) continue;
        if (!Array.isArray(release.assets)) throw new Error('Missing release assets');
        for (const asset of release.assets) {
          if (!names.includes(asset.name) || asset.state !== 'uploaded') continue;
          if (!Number.isSafeInteger(asset.id) || !Number.isSafeInteger(asset.download_count) || asset.download_count < 0) throw new Error('Invalid download total');
          found.add(asset.name);
          if (seen.has(asset.id)) continue;
          seen.add(asset.id);
          count += asset.download_count;
          if (!Number.isSafeInteger(count)) throw new Error('Invalid download total');
        }
      }
      if (releases.length < 100) {
        if (found.size !== names.length) throw new Error('Downloads not published');
        return count;
      }
    }
    throw new Error('Incomplete release list');
  }
  if (typeof module === 'object' && module.exports) { module.exports = { total }; return; }
  const counters = [...document.querySelectorAll('[data-download-count]')];
  if (!counters.length) return;
  let pending = false, lastAttempt = 0;
  async function refresh() {
    if (pending || Date.now() - lastAttempt < 60000) return;
    pending = true;
    lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const count = await total(root.fetch.bind(root), controller.signal);
      for (const node of counters) {
        node.textContent = new Intl.NumberFormat(document.documentElement.lang).format(count) + ' ' + node.dataset.downloadLabel;
        node.dataset.downloadState = 'ready';
      }
    } catch (_) {
      for (const node of counters) {
        node.textContent = node.dataset.downloadUnavailable;
        node.dataset.downloadState = 'unavailable';
      }
    } finally { clearTimeout(timeout); pending = false; }
  }
  refresh();
  root.addEventListener('focus', refresh);
})(typeof window === 'object' ? window : globalThis);
