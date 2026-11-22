/* Public release metadata only. No credentials, analytics or persistent storage. */
(function (root) {
  'use strict';
  // One repository and asset contract per tool, shared by both languages and counters.
  const profiles = {
    'select-similar-angle': {
      repository: 'KillianPi22/c4d-select-similar-angle',
      history: ['KillianPi22/killianpichon-portfolio'],
      tag: value => typeof value === 'string' && /^select-similar-angle-v\d+(?:\.\d+)*$/.test(value),
      files: { fr: /^Select_Similar_Angle\.py$/, en: /^Select_Similar_Angle_EN\.py$/ },
      guides: { fr: 'README.md#français', en: 'README.md#english' }
    },
    'keyframe-reducer': {
      repository: 'KillianPi22/blender-keyframe-reducer',
      history: [],
      tag: value => typeof value === 'string' && /^v\d+\.\d+\.\d+$/.test(value),
      files: { addon: /^keyframe_reducer-\d+\.\d+\.\d+\.zip$/ },
      guides: { fr: 'keyframe_reducer/README_FR.md', en: 'keyframe_reducer/README_EN.md' }
    }
  };
  const profile = id => Object.hasOwn(profiles, id) ? profiles[id] : null;
  const repositoryURL = id => 'https://github.com/' + profile(id).repository;
  const latestURL = id => repositoryURL(id) + '/releases/latest';
  const releaseURL = (id, tag) => repositoryURL(id) + '/releases/tag/' + encodeURIComponent(tag);
  const downloadURL = (id, tag, name) => repositoryURL(id) + '/releases/download/' + encodeURIComponent(tag) + '/' + encodeURIComponent(name);
  function selectRelease(id, release) {
    const config = profile(id);
    if (!config || !release || release.draft !== false || release.prerelease !== false ||
        !config.tag(release.tag_name) || !Array.isArray(release.assets) ||
        !Number.isFinite(Date.parse(release.published_at))) throw new Error('Stable release unavailable');
    const files = {};
    for (const [key, pattern] of Object.entries(config.files)) {
      const matches = release.assets.filter(asset => asset && asset.state === 'uploaded' && pattern.test(asset.name) && Number.isSafeInteger(asset.size) && asset.size > 0);
      if (matches.length !== 1) throw new Error('Release assets incomplete or ambiguous');
      const asset = matches[0];
      // Derive URLs from the allowlisted repository, never from API-provided HTML or URLs.
      files[key] = { name: asset.name, url: downloadURL(id, release.tag_name, asset.name) };
    }
    if (id === 'keyframe-reducer' && files.addon.name !== 'keyframe_reducer-' + release.tag_name.slice(1) + '.zip') throw new Error('Asset version mismatch');
    return { tag: release.tag_name, url: releaseURL(id, release.tag_name), files };
  }
  async function latest(id, fetcher = fetch, signal) {
    const config = profile(id);
    if (!config) throw new Error('Unknown tool');
    const response = await fetcher('https://api.github.com/repos/' + config.repository + '/releases/latest', {
      credentials: 'omit', referrerPolicy: 'no-referrer', signal,
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error('Release unavailable');
    return selectRelease(id, await response.json());
  }
  async function hydrate(section, fetcher = root.fetch.bind(root)) {
    const id = section.dataset.toolRelease;
    const config = profile(id);
    if (!config) return;
    const lang = section.dataset.releaseLanguage === 'fr' ? 'fr' : 'en';
    const status = section.querySelector('[data-release-status]');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const release = await latest(id, fetcher, controller.signal);
      // Prepare every URL before changing the visible state: no partial/mixed release.
      for (const link of section.querySelectorAll('[data-release-asset]')) {
        if (!release.files[link.dataset.releaseAsset]) throw new Error('Unknown asset');
      }
      for (const link of section.querySelectorAll('[data-release-asset]')) {
        link.href = release.files[link.dataset.releaseAsset].url;
        link.hidden = false;
      }
      const guide = section.querySelector('[data-release-guide]');
      guide.href = repositoryURL(id) + '/blob/' + encodeURIComponent(release.tag) + '/' + config.guides[lang];
      section.querySelector('[data-release-notes]').href = release.url;
      status.textContent = status.dataset.ready;
      section.querySelector('[data-release-fallback]').hidden = true;
      section.dataset.releaseState = 'ready';
    } catch (_) {
      status.textContent = status.dataset.unavailable;
      section.dataset.releaseState = 'unavailable';
      // The static latest-release link remains usable with blocked JS, API errors or new naming.
    } finally { clearTimeout(timeout); }
  }
  const api = { profiles, profile, repositoryURL, latestURL, releaseURL, downloadURL, selectRelease, latest, hydrate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.KPToolReleases = api;
    const start = () => { if (typeof document.querySelectorAll === 'function') document.querySelectorAll('[data-tool-release]').forEach(section => hydrate(section)); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window === 'object' ? window : globalThis);
