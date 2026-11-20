/* Public GitHub release totals. No click tracking, cookies, storage or credentials. */
(function (root) {
  'use strict';
  const profiles = {
    'select-similar-angle': {
      repository: 'KillianPi22/killianpichon-portfolio',
      tag: value => typeof value === 'string' && value.startsWith('select-similar-angle-'),
      asset: value => ['Select_Similar_Angle.py', 'Select_Similar_Angle_EN.py'].includes(value),
      complete: names => names.size === 2
    },
    'keyframe-reducer': {
      repository: 'KillianPi22/blender-keyframe-reducer',
      tag: value => typeof value === 'string' && /^v\d+\.\d+\.\d+$/.test(value),
      asset: value => typeof value === 'string' && /^keyframe_reducer-\d+\.\d+\.\d+\.zip$/.test(value),
      complete: names => names.size > 0
    }
  };
  async function total(fetcher = fetch, signal, profileId = 'select-similar-angle') {
    const profile = Object.hasOwn(profiles, profileId) ? profiles[profileId] : null;
    if (!profile) throw new Error('Unknown download counter');
    let count = 0;
    const seen = new Set(), found = new Set();
    for (let page = 1; page <= 20; page++) {
      const response = await fetcher('https://api.github.com/repos/' + profile.repository + '/releases?per_page=100&page=' + page, {
        credentials: 'omit', referrerPolicy: 'no-referrer', signal,
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error('Download total unavailable');
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error('Invalid release list');
      for (const release of releases) {
        if (!release || release.draft || release.prerelease || !profile.tag(release.tag_name)) continue;
        if (!Array.isArray(release.assets)) throw new Error('Missing release assets');
        for (const asset of release.assets) {
          if (!asset || !profile.asset(asset.name) || asset.state !== 'uploaded') continue;
          if (!Number.isSafeInteger(asset.id) || !Number.isSafeInteger(asset.download_count) || asset.download_count < 0) throw new Error('Invalid download total');
          found.add(asset.name);
          if (seen.has(asset.id)) continue;
          seen.add(asset.id);
          count += asset.download_count;
          if (!Number.isSafeInteger(count)) throw new Error('Invalid download total');
        }
      }
      if (releases.length < 100) {
        if (!profile.complete(found)) throw new Error('Downloads not published');
        return count;
      }
    }
    throw new Error('Incomplete release list');
  }
  if (typeof module === 'object' && module.exports) { module.exports = { total }; return; }
  const counters = [...document.querySelectorAll('[data-download-count]')];
  if (!counters.length) return;
  const groups = new Map();
  for (const node of counters) {
    const id = node.dataset.downloadCount || 'select-similar-angle';
    if (!groups.has(id)) groups.set(id, { nodes: [], pending: false, lastAttempt: 0 });
    groups.get(id).nodes.push(node);
  }
  async function refreshGroup(id, group) {
    if (group.pending || Date.now() - group.lastAttempt < 60000) return;
    group.pending = true;
    group.lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const count = await total(root.fetch.bind(root), controller.signal, id);
      for (const node of group.nodes) {
        node.textContent = new Intl.NumberFormat(document.documentElement.lang).format(count) + ' ' + node.dataset.downloadLabel;
        node.dataset.downloadState = 'ready';
      }
    } catch (_) {
      for (const node of group.nodes) {
        node.textContent = node.dataset.downloadUnavailable;
        node.dataset.downloadState = 'unavailable';
      }
    } finally { clearTimeout(timeout); group.pending = false; }
  }
  const refresh = () => Promise.all([...groups].map(([id, group]) => refreshGroup(id, group)));
  refresh();
  root.addEventListener('focus', refresh);
})(typeof window === 'object' ? window : globalThis);
