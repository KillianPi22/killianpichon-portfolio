/* Build static, indexable tool pages. Node only; no packages or network required. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const content = require('../data/technical.js');
const view = require('../assets/technical-library.js');
const { escape: esc, route } = view;
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/fr.js'), 'utf8'), context);
const french = context.window.KP_FR.ui;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => {
  const output = path.join(root, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, value, 'utf8');
};
const origin = 'https://killianpichon.art/';
const assetVersion = content.revision || content.updated;
const css = index.match(/<style>([\s\S]*?)<\/style>/);
if (!css) throw new Error('Portfolio stylesheet not found');
write('assets/technical-base.css', '/* Generated from index.html by tools/build-technical.cjs. */\n' + css[1].trimEnd() + '\n');

function nav(data, lang, id) {
  const l = data.labels;
  const portfolio = '?lang=' + lang;
  return '<nav class="site-nav tool-static-nav" aria-label="' + (lang === 'fr' ? 'Navigation principale' : 'Primary navigation') + '"><a class="site-mark" href="' + portfolio + '#/work" aria-label="Killian Pichon">KP</a><div class="site-nav-links">' + [
    [l.work, portfolio + '#/work'], [l.about, portfolio + '#/about'], [l.technical, route(lang)], [l.contact, portfolio + '#/contact']
  ].map(([label, href], i) => '<a class="site-nav-link" href="' + href + '"' + (i === 2 ? ' aria-current="page"' : '') + '>' + esc(label) + '</a>').join('') + '</div><div class="site-lang" role="group" aria-label="' + (lang === 'fr' ? 'Langue' : 'Language') + '">' + ['en', 'fr'].map((code, i) => (i ? '<span class="site-lang-sep" aria-hidden="true">/</span>' : '') + '<a class="site-lang-link" href="' + route(code, id) + '" hreflang="' + code + '" lang="' + code + '" aria-label="' + (code === 'fr' ? 'Français' : 'English') + '"' + (code === lang ? ' aria-current="true"' : '') + '>' + code.toUpperCase() + '</a>').join('') + '</div></nav>';
}
function footer(data, lang) {
  const l = data.labels;
  return '<footer class="tool-footer"><a class="kp-footer-link" href="?lang=' + lang + '#/demos">' + esc(l.demos) + '</a><button class="kp-footer-link" type="button" data-analytics-choices>' + esc(l.privacyChoices) + '</button><a class="kp-footer-link" href="privacy.html?lang=' + lang + '">' + esc(l.privacy) + '</a><span>' + esc(l.rights) + '</span></footer>';
}
const consentSource = read('assets/analytics-consent.js');
const consentKeys = [...consentSource.matchAll(/\bt\('([^']+)'\)/g)].map(m => m[1]);
const publicURLs = [];
for (const lang of ['en', 'fr']) {
  const data = content[lang];
  for (const tool of [null, ...data.tools]) {
    const id = tool ? tool.id : '';
    const pathname = route(lang, id);
    const canonical = origin + pathname;
    publicURLs.push({ pathname, lang, id });
    const title = tool ? tool.pageTitle || tool.title + ' — Killian Pichon' : data.title + ' — Killian Pichon';
    const description = tool ? tool.meta : data.meta;
    const code = tool?.file ? read(tool.file).replace(/\r\n/g, '\n') : '';
    const body = tool ? view.detail(data, lang, tool, code) : view.intro(data) + view.catalogue(data, lang, pathname);
    const graph = [
      { '@type': tool ? 'WebPage' : 'CollectionPage', '@id': canonical + '#page', url: canonical, name: title, description, inLanguage: lang === 'fr' ? 'fr-CA' : 'en-CA', author: { '@type': 'Person', name: 'Killian Pichon', url: origin }, isPartOf: { '@id': origin + '#website' } },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Portfolio', item: origin }, { '@type': 'ListItem', position: 2, name: data.title, item: origin + route(lang) }, ...(tool ? [{ '@type': 'ListItem', position: 3, name: tool.title, item: canonical }] : [])] }
    ];
    if (!tool) graph.push({ '@type': 'ItemList', itemListElement: data.tools.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.title, url: origin + route(lang, item.id) })) });
    if (tool?.file) graph.push({ '@type': 'SoftwareSourceCode', name: tool.title, description: tool.summary, programmingLanguage: 'Python', runtimePlatform: 'Cinema 4D 2026', codeSampleType: 'full', url: canonical, contentUrl: origin + tool.file, author: { '@type': 'Person', name: 'Killian Pichon', url: origin } });
    const dict = lang === 'fr' ? Object.fromEntries(consentKeys.filter(key => french[key]).map(key => [key, french[key]])) : {};
    const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');
    const base = '../'.repeat(pathname.split('/').filter(Boolean).length);
    write(pathname + 'index.html', `<!doctype html>
<!-- Generated by tools/build-technical.cjs. Edit data/technical.js and the shared renderer. -->
<html lang="${lang === 'fr' ? 'fr-CA' : 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${base}">
  <meta name="theme-color" content="#0a0a0b">
  <meta name="author" content="Killian Pichon">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="${origin + route('en', id)}">
  <link rel="alternate" hreflang="fr-CA" href="${origin + route('fr', id)}">
  <link rel="alternate" hreflang="x-default" href="${origin + route('en', id)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Killian Pichon">
  <meta property="og:locale" content="${lang === 'fr' ? 'fr_CA' : 'en_CA'}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${origin}assets/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${origin}assets/og-image.jpg">
  <link rel="icon" href="assets/icons/favicon-96.png" sizes="96x96" type="image/png">
  <link rel="stylesheet" href="assets/technical-base.css?v=${assetVersion}">
  <link rel="stylesheet" href="assets/technical-library.css?v=${assetVersion}">
  <link rel="stylesheet" href="assets/analytics-consent.css">
  <link rel="stylesheet" href="assets/motion-exploration.css?v=20260917-gallery-height">
  <link rel="stylesheet" href="assets/organic-floating.css?v=20260906">
  <script>window.KP_I18N={lang:${safeJSON(lang)},t:function(s){return ${safeJSON(dict)}[s]||s;}};</script>
  <script defer src="assets/technical-library.js?v=${assetVersion}"></script>
  <script defer src="assets/analytics-consent.js"></script>
  <script defer src="assets/motion-exploration.js?v=20260917-animated-media"></script>
  <script defer src="assets/organic-floating.js?v=20260906"></script>
  <script type="application/ld+json">${safeJSON({ '@context': 'https://schema.org', '@graph': graph })}</script>
</head>
<body><div id="root">${nav(data, lang, id)}<main class="tool-main">${body}</main>${footer(data, lang)}</div></body>
</html>
`);
  }
}
const start = '<!-- technical-library:start -->';
const end = '<!-- technical-library:end -->';
let sitemap = read('sitemap.xml').replace(new RegExp('\\s*' + start + '[\\s\\S]*?' + end), '');
const entries = publicURLs.map(({ pathname, id }) => `  <url>
    <loc>${origin + pathname}</loc>
    <lastmod>${content.updated}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${origin + route('en', id)}"/>
    <xhtml:link rel="alternate" hreflang="fr-CA" href="${origin + route('fr', id)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${origin + route('en', id)}"/>
  </url>`).join('\n');
sitemap = sitemap.replace('</urlset>', `${start}\n${entries}\n${end}\n</urlset>`);
write('sitemap.xml', sitemap);
console.log('Built ' + publicURLs.length + ' bilingual technical pages; sitemap updated.');
