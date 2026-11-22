/* Shared public HTML for the catalogue and its static pages. No external dependency. */
(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const route = (lang, id = '') => 'technical/' + (id ? id + '/' : '') + (lang === 'fr' ? 'fr/' : '');
  const releases = typeof module === 'object' && module.exports ? require('./tool-releases.js') : root.KPToolReleases;
  const tags = items => '<div class="tool-tags">' + items.map(item => '<span>' + escape(item) + '</span>').join('') + '</div>';
  const paragraph = text => '<p>' + escape(text) + '</p>';
  const list = (items, ordered = false) => {
    const tag = ordered ? 'ol' : 'ul';
    return '<' + tag + '>' + items.map(item => '<li>' + escape(item) + '</li>').join('') + '</' + tag + '>';
  };
  const heading = (title, text) => '<section class="tool-section"><h2>' + escape(title) + '</h2>' + paragraph(text) + '</section>';
  function intro(data) {
    return '<header class="tool-intro"><p class="tool-eyebrow">' + escape(data.labels.technical) + '</p><h1>' + escape(data.title) + '</h1>' + paragraph(data.intro) + '</header>';
  }
  function catalogue(data, lang, anchorBase = '') {
    return '<nav class="tool-categories" aria-label="' + escape(data.labels.nav) + '">' + data.categories.map((category, i) =>
      '<a href="' + escape(anchorBase + '#' + category.id) + '"><span class="tool-number">0' + (i + 1) + '</span><span><strong>' + escape(category.title) + '</strong><small>' + escape(category.subtitle) + '</small></span><span aria-hidden="true">↘</span></a>'
    ).join('') + '</nav>' + data.categories.map((category, i) =>
      '<section class="tool-section tool-category" id="' + category.id + '" tabindex="-1"><p class="tool-eyebrow">0' + (i + 1) + ' / ' + escape(category.subtitle) + '</p><h2>' + escape(category.title) + '</h2>' + paragraph(category.text) +
      (category.empty ? '<p class="tool-note">' + escape(category.empty) + '</p>' : '') + data.tools.filter(tool => tool.category === category.id).map(tool =>
        '<article class="tool-card">' + tags(tool.tags) + '<h3><a href="' + route(lang, tool.id) + '">' + escape(tool.title) + '</a></h3>' + paragraph(tool.summary) + '<a class="tool-text-link" href="' + route(lang, tool.id) + '">' + escape(data.labels.open) + '<span aria-hidden="true"> ↗</span><span class="tool-sr-only"> — ' + escape(tool.title) + '</span></a>' + (tool.github ? '<a class="tool-text-link tool-card-release" href="' + releases.latestURL(tool.id) + '">' + escape(data.labels.releaseLink) + '</a>' : '') + '</article>'
      ).join('') + '</section>'
    ).join('') + '<aside class="tool-reuse"><h2>' + escape(data.reuseTitle) + '</h2>' + paragraph(data.reuse) + paragraph(data.versioning) + paragraph(data.ecology) + '<a class="tool-text-link tool-note" href="https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai">' + escape(data.ecologySource) + ' ↗</a></aside>';
  }

  function releaseSection(data, lang, tool) {
    const labels = data.labels, id = tool.id;
    const latest = releases.latestURL(id), repository = releases.repositoryURL(id);
    const reducer = id === 'keyframe-reducer';
    const keys = reducer ? ['addon'] : (lang === 'fr' ? ['fr', 'en'] : ['en', 'fr']);
    const names = { addon: labels.releaseAddon, fr: labels.releaseFR, en: labels.releaseEN };
    const countLabel = reducer ? labels.releaseCounterReducer : labels.downloadTotal;
    return '<section class="tool-section tool-release" data-tool-release="' + id + '" data-release-language="' + lang + '" aria-labelledby="tool-download-heading">' +
      '<p class="tool-eyebrow">' + escape(labels.releaseEyebrow) + '</p><h2 id="tool-download-heading">' + escape(labels.releaseTitle) + '</h2>' +
      '<p class="tool-release-version" data-release-status data-unavailable="' + escape(labels.releaseUnavailable) + '" aria-live="polite">' + escape(labels.releaseDefault) + '</p>' +
      '<div class="tool-actions"><a class="tool-button tool-button-primary" data-release-fallback href="' + latest + '">' + escape(labels.releaseFallback) + '</a>' +
      keys.map((key,i) => '<a hidden class="tool-button' + (i === 0 ? ' tool-button-primary' : '') + '" data-release-asset="' + key + '" href="' + latest + '">' + escape(names[key]) + '</a>').join('') + '</div>' +
      '<p class="tool-note">' + escape(reducer ? labels.releaseReducerNote : labels.releaseC4DNote) + '</p>' +
      '<nav class="tool-release-links" aria-label="' + escape(labels.releaseTitle) + '">' +
      '<a class="tool-text-link" data-release-guide href="' + latest + '">' + escape(labels.releaseGuide) + '</a>' +
      '<a class="tool-text-link" data-release-notes href="' + latest + '">' + escape(labels.releaseNotes) + '</a>' +
      '<a class="tool-text-link" href="' + repository + '/releases">' + escape(labels.releaseHistory) + '</a>' +
      '<a class="tool-text-link" href="' + repository + '">' + escape(labels.releaseSource) + '</a></nav>' +
      '<p class="tool-note tool-download-total" data-download-count="' + id + '" data-download-label="' + escape(countLabel) + '" data-download-unavailable="' + escape(labels.downloadUnavailable) + '" title="' + escape(labels.releaseCounterNote) + '" aria-live="polite">' + escape(labels.downloadUnavailable) + '</p></section>';
  }
  function detail(data, lang, tool) {
    const labels = data.labels;
    const category = data.categories.find(item => item.id === tool.category);
    let body = '<a class="tool-text-link" href="' + route(lang) + '#' + tool.category + '">← ' + escape(labels.back) + '</a><header class="tool-intro"><p class="tool-eyebrow">' + escape(category.title) + '</p><h1>' + escape(tool.title) + '</h1>' + paragraph(tool.summary) + tags(tool.tags) + '</header>';
    if (tool.github) body += releaseSection(data, lang, tool);
    if (tool.preview) {
      const preview = tool.preview;
      body += '<figure class="tool-interface"><picture><source srcset="' + escape(preview.src) + '" type="image/webp"><img src="' + escape(preview.fallback) + '" width="' + preview.width + '" height="' + preview.height + '" alt="' + escape(preview.alt) + '" decoding="async"></picture><figcaption class="tool-note">' + escape(preview.caption) + '</figcaption></figure>';
    }
    body += '<div class="tool-story">' + heading(labels.need, tool.need) + heading(labels.response, tool.response) + heading(labels.result, tool.result) + '</div>';
    if (tool.features) body += '<section class="tool-section"><h2>' + escape(labels.features) + '</h2>' + list(tool.features) + '</section>';
    if (tool.workflow) body += '<section class="tool-section"><h2>' + escape(labels.workflow) + '</h2>' + list(tool.workflow, true) + '</section>';
    if (tool.limits) body += heading(labels.limits, tool.limits);
    if (tool.compatibility) body += '<p class="tool-note">' + escape(tool.compatibility) + '</p>';
    if (tool.external) body += '<section class="tool-section"><a class="tool-button tool-button-primary" href="' + escape(tool.external) + '">' + escape(tool.externalLabel) + ' ↗</a><p class="tool-note">' + escape(tool.externalNote) + '</p><h2>' + escape(labels.credit) + '</h2>' + paragraph(tool.credits) + '</section>';
    return body;
  }
  const api = { escape, route, intro, catalogue, detail, releaseSection };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KPTechnicalLibrary = api;
})(typeof window === 'object' ? window : globalThis);
