/* Shared public HTML for the catalogue and its static pages. No external dependency. */
(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const route = (lang, id = '') => 'technical/' + (id ? id + '/' : '') + (lang === 'fr' ? 'fr/' : '');
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
        '<article class="tool-card">' + tags(tool.tags) + '<h3><a href="' + route(lang, tool.id) + '">' + escape(tool.title) + '</a></h3>' + paragraph(tool.summary) + '<a class="tool-text-link" href="' + route(lang, tool.id) + '">' + escape(data.labels.open) + '<span aria-hidden="true"> ↗</span><span class="tool-sr-only"> — ' + escape(tool.title) + '</span></a></article>'
      ).join('') + '</section>'
    ).join('') + '<aside class="tool-reuse"><h2>' + escape(data.reuseTitle) + '</h2>' + paragraph(data.reuse) + paragraph(data.versioning) + paragraph(data.ecology) + '<a class="tool-text-link tool-note" href="https://www.iea.org/reports/energy-and-ai/energy-demand-from-ai">' + escape(data.ecologySource) + ' ↗</a></aside>';
  }
  function codeSection(labels, file, language, code, alternate = false) {
    const id = alternate ? 'tool-source-alternate' : 'tool-source';
    const headingId = alternate ? 'source-heading-alternate' : 'source-heading';
    const title = labels.code + (language ? ' — ' + language : '');
    const filename = file.split('/').pop();
    return '<section class="tool-section tool-code" aria-labelledby="' + headingId + '"><div class="tool-code-header"><h2 id="' + headingId + '">' + escape(title) + '</h2><div class="tool-actions"><button class="tool-button tool-button-primary" type="button" data-copy-code data-copied="' + escape(labels.copied) + '" data-fallback="' + escape(labels.fallback) + '">' + escape(labels.copy) + '</button><a class="tool-button" href="' + escape(file) + '" download="' + escape(filename) + '">' + escape(labels.download) + '</a></div></div>' + paragraph(labels.codeHint) + '<label class="tool-sr-only" for="' + id + '">' + escape(labels.source + ' — ' + language) + '</label><textarea id="' + id + '" class="tool-source" readonly spellcheck="false" wrap="off" rows="18">' + escape(code) + '</textarea><p class="tool-copy-status" role="status" aria-live="polite"></p></section>';
  }
  function detail(data, lang, tool, code, alternateCode = '') {
    const labels = data.labels;
    const category = data.categories.find(item => item.id === tool.category);
    let body = '<a class="tool-text-link" href="' + route(lang) + '#' + tool.category + '">← ' + escape(labels.back) + '</a><header class="tool-intro"><p class="tool-eyebrow">' + escape(category.title) + '</p><h1>' + escape(tool.title) + '</h1>' + paragraph(tool.summary) + tags(tool.tags) + '</header>';
    if (tool.preview) {
      const preview = tool.preview;
      body += '<figure class="tool-interface"><picture><source srcset="' + escape(preview.src) + '" type="image/webp"><img src="' + escape(preview.fallback) + '" width="' + preview.width + '" height="' + preview.height + '" alt="' + escape(preview.alt) + '" decoding="async"></picture><figcaption class="tool-note">' + escape(preview.caption) + '</figcaption></figure>';
    }
    body += '<div class="tool-story">' + heading(labels.need, tool.need) + heading(labels.response, tool.response) + heading(labels.result, tool.result) + '</div>';
    if (tool.features) body += '<section class="tool-section"><h2>' + escape(labels.features) + '</h2>' + list(tool.features) + '</section>';
    body += '<section class="tool-section"><h2>' + escape(labels.workflow) + '</h2>' + list(tool.workflow, true) + '</section>';
    if (tool.limits) body += heading(labels.limits, tool.limits);
    body += '<p class="tool-note">' + escape(tool.compatibility) + '</p>';
    if (tool.file) {
      body += codeSection(labels, tool.file, tool.scriptLanguage, code);
      if (tool.alternate) body += '<details class="tool-code-alternate"><summary>' + escape(tool.alternate.summary) + '</summary>' + codeSection(labels, tool.alternate.file, tool.alternate.language, alternateCode, true) + '</details>';
    }
    if (tool.external) body += '<section class="tool-section"><a class="tool-button tool-button-primary" href="' + escape(tool.external) + '">' + escape(tool.externalLabel) + ' ↗</a><p class="tool-note">' + escape(tool.externalNote) + '</p><h2>' + escape(labels.credit) + '</h2>' + paragraph(tool.credits) + '</section>';
    return body;
  }
  const api = { escape, route, intro, catalogue, detail };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.KPTechnicalLibrary = api;
    document.addEventListener('click', async event => {
      const button = event.target.closest('[data-copy-code]');
      if (!button) return;
      const section = button.closest('.tool-code');
      const source = section.querySelector('textarea');
      const status = section.querySelector('[role="status"]');
      try {
        if (!navigator.clipboard || !root.isSecureContext) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(source.value);
        status.textContent = button.dataset.copied;
      } catch (_) {
        source.focus();
        source.select();
        status.textContent = button.dataset.fallback;
      }
    });
  }
})(typeof window === 'object' ? window : globalThis);
