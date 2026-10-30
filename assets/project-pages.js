/* Shared public-page URLs and metadata; also used by the offline HTML builder. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KPProjectPages = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const origin = 'https://killianpichon.art/';
  const isPublic = project => Boolean(project && !project.protected && project.listing !== 'hidden');
  function path(id, lang) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid public project identifier');
    return 'projects/' + id + '/' + (lang === 'fr' ? 'fr/' : '');
  }
  function parse(pathname, base) {
    if (!pathname.startsWith(base)) return null;
    const match = pathname.slice(base.length).match(/^projects\/([a-z0-9-]+)\/(fr\/)?(?:index\.html)?$/);
    return match ? { id: match[1], lang: match[2] ? 'fr' : 'en' } : null;
  }
  function meta(id, project, lang) {
    const title = project.title + (project.studio ? ' — ' + project.studio : '') + ' | Killian Pichon';
    const description = id === 'traveler'
      ? (lang === 'fr'
        ? 'Traveler’s Introspection, film fulldome du collectif Fantastik Obsolete. Contribution de Killian Pichon : caméra, effets visuels et compositing.'
        : 'Traveler’s Introspection, a fulldome film by the Fantastik Obsolete collective. Killian Pichon’s contribution: camera, visual effects and compositing.')
      : project.desc;
    const image = [project.thumb, project.heroImage, ...(project.galleryImages || [])].find(publicImage) || 'assets/og-image.jpg';
    return { title, description, image: origin + image, imageAlt: project.title + (project.studio ? ' — ' + project.studio : '') };
  }
  function publicImage(value) {
    return typeof value === 'string' && /^(assets|projects)\/[\w./-]+\.(avif|webp|jpe?g|png|gif|svg)$/i.test(value) && !value.split('/').includes('..');
  }
  function graph(id, project, lang) {
    const url = origin + path(id, lang);
    const metadata = meta(id, project, lang);
    return { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': url + '#webpage', url, name: metadata.title, description: metadata.description,
        inLanguage: lang === 'fr' ? 'fr-CA' : 'en-CA', isPartOf: { '@id': origin + '#website' },
        author: { '@type': 'Person', name: 'Killian Pichon', url: origin },
        about: { '@type': 'CreativeWork', name: project.title, genre: project.category },
        primaryImageOfPage: { '@type': 'ImageObject', url: metadata.image } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Portfolio', item: origin + (lang === 'fr' ? '?lang=fr' : '') },
        { '@type': 'ListItem', position: 2, name: project.title, item: url }
      ] }
    ] };
  }
  return { origin, isPublic, path, parse, meta, graph, publicImage };
});
