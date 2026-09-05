// Preparation locale des apercus Instagram publics. Node >= 20 et sharp.
// Usage : node tools/update-video-posters.cjs [chemin du module sharp]
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

function publicInstagramUrls(projects) {
  const urls = new Set();
  for (const p of Object.values(projects)) {
    // Ne jamais inspecter ni exporter le contenu d'une fiche protegee.
    if (p.protected || p.listing === 'hidden' || p.trailerEmbedDisabled) continue;
    for (const url of p.videoUrls?.length ? p.videoUrls : p.trailerUrl ? [p.trailerUrl] : []) {
      try {
        const u = new URL(url);
        if (u.protocol === 'https:' && /^(www\.)?instagram\.com$/.test(u.hostname) && /^\/(reel|p)\/[\w-]+\/?$/.test(u.pathname)) urls.add(url);
      } catch {}
    }
  }
  return [...urls];
}

function instagramImage(html) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)].map(m => [m[1].toLowerCase(), m[3]]));
    if ((attrs.property || attrs.name) !== 'og:image' || !attrs.content) continue;
    const value = attrs.content.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    const u = new URL(value);
    if (u.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/.test(u.hostname)) return u.href;
  }
  return null;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const context = { window: {} };
  vm.runInNewContext(await fs.readFile(path.join(root, 'data/projects.js'), 'utf8'), context, { timeout: 1000 });
  const urls = publicInstagramUrls(context.window.KP_PROJECTS);
  const registryPath = path.join(root, 'data/video-posters.js');
  vm.runInNewContext(await fs.readFile(registryPath, 'utf8'), context, { timeout: 1000 });
  const previous = context.window.KP_VIDEO_POSTERS || {};
  const posters = {};
  // Le registre final exclut aussi toute source devenue protegee depuis le dernier passage.
  let sharp;
  if (urls.length) sharp = require(process.argv[2] || 'sharp');
  for (const url of urls) {
    if (previous[url]) posters[url] = previous[url];
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Publication inaccessible');
      const imageUrl = instagramImage(await response.text());
      if (!imageUrl) throw new Error('Aucune vignette officielle disponible');
      const image = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
      if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) throw new Error('Image inaccessible');
      const bytes = Buffer.from(await image.arrayBuffer());
      if (bytes.length > 15 * 1024 * 1024) throw new Error('Image trop volumineuse');
      const filename = createHash('sha256').update(url).digest('hex').slice(0, 20) + '.webp';
      const relative = 'assets/video-posters/' + filename;
      await fs.mkdir(path.join(root, 'assets/video-posters'), { recursive: true });
      await sharp(bytes).rotate().resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(root, relative));
      posters[url] = relative;
      console.log('Apercu Instagram prepare.');
    } catch (error) {
      console.warn('Instagram : ' + error.message + '. Apercu precedent ou image de secours conserve.');
    }
  }
  await fs.writeFile(registryPath, '// Apercus Instagram publics prepares localement. Ne jamais y ajouter de source protegee.\nwindow.KP_VIDEO_POSTERS = ' + JSON.stringify(posters, null, 2) + ';\n');
  console.log(urls.length + ' source(s) Instagram publique(s) examinee(s). Fiches protegees ignorees.');
}

module.exports = { publicInstagramUrls, instagramImage };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
