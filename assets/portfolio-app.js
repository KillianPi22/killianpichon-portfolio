/* Generated from index.html by tools/build-projects.cjs. */
window.__asset = function (assetPath) { return assetPath; };
const SITE_ROOT = new URL('./', document.baseURI).pathname;
// Freeze the base before pushState changes the document URL (also works below a repository prefix).
document.querySelector('base').setAttribute('href', SITE_ROOT);
const HOME_SCHEMA = window.KP_HOME_SCHEMA || JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || '{}');

/* ==================================================================== i18n ==
   L'anglais est la source unique et reste ecrit en clair dans les composants.
   Le francais est une couche posee par-dessus, dans data/fr.js, dont la cle
   est la phrase anglaise elle-meme.

   Le point d'accroche est unique : React.createElement. Les textes enfants
   d'un element HTML passent par le dictionnaire, et seulement s'ils y ont une
   entree exacte. Le dictionnaire etant une liste ecrite a la main, une chaine
   sans entree traverse intacte : rien ne peut etre traduit par accident, et
   les composants n'ont pas une ligne a changer.

   La langue se resout avant l'evaluation de l'application, donc avant que
   PROJECT_LIST ne soit construit et avant le premier rendu. Changer de langue
   recharge la page : les constantes de module se reconstruisent proprement,
   plutot que de laisser un arbre a moitie traduit.
   ========================================================================= */
window.KP_I18N = (function () {
  var DICT = window.KP_FR || {};
  var STORAGE_KEY = 'kp-lang';

  // Ordre de decision : l'adresse d'abord, parce qu'un lien partage doit
  // s'ouvrir dans la langue de celui qui l'a envoye ; puis le choix deja fait
  // sur cet appareil ; puis la langue du navigateur ; puis l'anglais.
  function resolve() {
    const page = window.KPProjectPages.parse(window.location.pathname, SITE_ROOT);
    if (page) return { lang: page.lang, explicit: true };
    var param = null;
    try {
      param = new URLSearchParams(window.location.search).get('lang');
    } catch (e) { /* navigateur sans URLSearchParams : on passe a la suite */ }
    if (param === 'fr' || param === 'en') return { lang: param, explicit: true };

    var stored = null;
    try { stored = window.localStorage.getItem(STORAGE_KEY); } catch (e) { /* stockage refuse */ }
    if (stored === 'fr' || stored === 'en') return { lang: stored, explicit: false };

    var nav = (window.navigator.language || '').toLowerCase();
    return { lang: nav.indexOf('fr') === 0 ? 'fr' : 'en', explicit: false };
  }

  var resolved = resolve();
  var lang = resolved.lang;

  // L'adresse, l'attribut lang et l'URL canonique doivent toujours dire la
  // meme chose. En francais on inscrit donc ?lang=fr meme quand la langue
  // vient du navigateur. Un robot d'indexation n'a ni stockage local ni
  // preference francaise : il atterrit en anglais sur la racine, ce qui est
  // exactement ce que declare la canonique.
  if (lang === 'fr' && !resolved.explicit) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('lang', 'fr');
      window.history.replaceState(null, '', url.toString());
    } catch (e) { /* sans history, l'adresse reste nue : sans consequence */ }
  }

  document.documentElement.setAttribute('lang', lang === 'fr' ? 'fr-CA' : 'en');

  var ui = DICT.ui || {};
  var uiSection = DICT.uiSection || {};

  /* Traduit une phrase. section ne sert qu'aux rares cas ou la meme phrase
     anglaise doit diverger selon l'endroit ; les appels ordinaires l'omettent. */
  function t(text, section) {
    if (lang === 'en' || typeof text !== 'string') return text;
    if (section) {
      var keyed = uiSection[section + '::' + text];
      if (typeof keyed === 'string') return keyed;
    }
    var hit = ui[text];
    return typeof hit === 'string' ? hit : text;
  }

  /* Phrases construites avec une valeur : t.f('Wait {n}s', { n: 12 }).
     Le gabarit anglais reste la cle, et les reperes {…} se remplacent apres
     traduction, donc le francais peut les remettre dans un autre ordre. */
  t.f = function (template, values, section) {
    var out = t(template, section);
    return out.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(values || {}, name)
        ? String(values[name])
        : whole;
    });
  };

  /* Surcharge une fiche projet champ par champ. Un champ absent garde
     l'anglais, ce qui permet de traduire une fiche par morceaux. */
  function project(id, source) {
    if (lang === 'en') return source;
    var over = (DICT.projects || {})[id];
    if (!over) return source;
    return Object.assign({}, source, over);
  }

  function head(screen) {
    if (lang === 'en') return null;
    return (DICT.head || {})[screen] || null;
  }

  function set(next) {
    if (next !== 'fr' && next !== 'en') return;
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* stockage refuse */ }
    var url = new URL(languageHref(next), window.location.href);
    if (window.KPProjectPages.parse(url.pathname, SITE_ROOT)) {
      window.location.href = url.toString();
      return;
    }
    if (next === 'fr') url.searchParams.set('lang', 'fr');
    else url.searchParams.delete('lang');
    // Rechargement volontaire : voir l'entete de ce bloc.
    window.location.href = url.toString();
  }

  return { lang: lang, t: t, project: project, head: head, set: set };
})();

function projectHref(id, lang = window.KP_I18N.lang) {
  return window.KPProjectPages.isPublic(window.KP_PROJECTS[id])
    ? SITE_ROOT + window.KPProjectPages.path(id, lang)
    : SITE_ROOT + '?lang=' + lang + '#/project/' + encodeURIComponent(id);
}
function screenHref(screen, lang = window.KP_I18N.lang) {
  return SITE_ROOT + '?lang=' + lang + '#/' + screen;
}
function languageHref(lang) {
  const route = routeFromHash();
  const url = new URL(window.location.href);
  if (route.screen === 'project') {
    const target = new URL(projectHref(route.projectId, lang), url);
    url.pathname = target.pathname;
    url.hash = target.hash;
    if (window.KPProjectPages.isPublic(window.KP_PROJECTS[route.projectId])) url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
  } else {
    url.searchParams.set('lang', lang);
  }
  return url.pathname + url.search + url.hash;
}
function followInternal(event, action) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  action();
}

/* Le point d'accroche. Seuls les elements HTML sont traites : un texte confie
   a un composant finit toujours par atterrir dans l'un d'eux, donc le prendre
   ici suffit et evite de toucher aux proprietes des composants.
   style et script sont ecartes explicitement : leur contenu est du code. */
(function () {
  if (window.KP_I18N.lang === 'en') return;

  var t = window.KP_I18N.t;
  var natif = React.createElement;
  var OPAQUES = { style: 1, script: 1 };
  var PROPS_TEXTE = ['aria-label', 'alt', 'title', 'placeholder', 'aria-placeholder'];

  React.createElement = function (type, props) {
    var args = Array.prototype.slice.call(arguments);

    if (typeof type === 'string' && !OPAQUES[type]) {
      for (var i = 2; i < args.length; i++) {
        if (typeof args[i] === 'string') args[i] = t(args[i]);
      }
      if (props) {
        var copie = null;
        for (var j = 0; j < PROPS_TEXTE.length; j++) {
          var nom = PROPS_TEXTE[j];
          var valeur = props[nom];
          if (typeof valeur !== 'string') continue;
          var traduit = t(valeur);
          if (traduit === valeur) continue;
          if (!copie) copie = Object.assign({}, props);
          copie[nom] = traduit;
        }
        if (copie) args[1] = copie;
      }
    }

    return natif.apply(React, args);
  };
})();
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  href,
  onClick,
  disabled,
  type = 'button',
  style: customStyle
}) {
  const Tag = href ? 'a' : 'button';
  const pad = size === 'sm' ? '8px 18px' : '12px 26px';
  const fontSize = size === 'sm' ? 'var(--text-small)' : 'var(--color-text-body)';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: pad,
    fontFamily: 'var(--font-body)',
    fontWeight: 'var(--weight-medium)',
    fontSize,
    letterSpacing: 'var(--tracking-wide)',
    textTransform: 'uppercase',
    borderRadius: 'var(--radius-pill)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color var(--duration-base) var(--ease-out), background var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)',
    opacity: disabled ? 0.4 : 1,
    border: '1px solid transparent',
    background: 'none'
  };
  const variants = {
    primary: {
      color: 'var(--void-950)',
      background: 'var(--white-100)',
      borderColor: 'var(--white-100)'
    },
    outline: {
      color: 'var(--text-heading)',
      borderColor: 'var(--line-default)'
    },
    ghost: {
      color: 'var(--text-heading)',
      borderColor: 'transparent'
    },
    accent: {
      color: 'var(--text-heading)',
      borderColor: 'var(--accent)'
    }
  };
  const style = {
    ...base,
    ...variants[variant],
    ...customStyle
  };
  return React.createElement(Tag, {
    href: href,
    type: Tag === 'button' ? type : undefined,
    onClick: onClick,
    disabled: Tag === 'button' ? disabled : undefined,
    style: style,
    onMouseEnter: e => {
      if (variant !== 'primary') {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
      }
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = variants[variant].borderColor;
      e.currentTarget.style.boxShadow = 'none';
    }
  }, icon, children);
}
function Tag({
  children,
  tone = 'neutral'
}) {
  const tones = {
    neutral: {
      color: 'var(--text-muted)',
      border: '1px solid var(--line-default)',
      background: 'transparent'
    },
    accent: {
      color: 'var(--accent-hover)',
      border: '1px solid var(--accent-dim)',
      background: 'var(--accent-dim)'
    }
  };
  return React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      ...tones[tone]
    }
  }, children);
}
/* Deux langues seulement : une paire visible vaut mieux qu'un menu deroulant,
   qui demanderait un clic de plus pour montrer une seule autre option.
   De vrais liens, pas des boutons : l'adresse est partageable, le clic du
   milieu ouvre dans un onglet, et un robot d'indexation peut suivre le lien
   vers la version francaise. Le clic ordinaire passe quand meme par set(),
   qui memorise le choix avant de naviguer. */
function LanguageSwitch() {
  const current = window.KP_I18N.lang;
  const langs = [{
    code: 'en',
    label: 'EN',
    full: 'English'
  }, {
    code: 'fr',
    label: 'FR',
    full: 'Français'
  }];
  return React.createElement("div", {
    className: "site-lang",
    role: "group",
    "aria-label": "Language"
  }, langs.map((l, i) => React.createElement(React.Fragment, {
    key: l.code
  }, i > 0 && React.createElement("span", {
    className: "site-lang-sep",
    "aria-hidden": "true"
  }, "/"), React.createElement("a", {
    className: "site-lang-link",
    href: languageHref(l.code),
    hrefLang: l.code,
    lang: l.code,
    "aria-current": current === l.code ? 'true' : undefined,
    "aria-label": l.full,
    onClick: e => {
      followInternal(e, () => window.KP_I18N.set(l.code));
    },
    style: {
      color: current === l.code ? 'var(--text-heading)' : 'var(--text-muted)',
      borderBottom: current === l.code ? '1px solid var(--accent)' : '1px solid transparent'
    }
  }, l.label))));
}
function Navbar({
  mark = 'KP',
  links = ['Work', 'About', 'Technical', 'Contact'],
  activeLink,
  onLinkClick
}) {
  const hrefs = {
    Work: screenHref('work'),
    About: screenHref('about'),
    Technical: window.KPTechnicalLibrary.route(window.KP_I18N.lang),
    Contact: screenHref('contact')
  };
  return React.createElement("nav", {
    className: "site-nav",
    "aria-label": "Primary navigation",
    style: {
      display: 'flex',
      alignItems: 'center',
      // Le choix de langue est un troisieme enfant, pas un cinquieme lien.
      // space-between le centrerait ; l'alignement au debut plus une marge
      // automatique sur les liens redonne exactement la barre d'origine, tout
      // en laissant le telephone deplacer le bloc par un simple ordre.
      justifyContent: 'flex-start',
      padding: '28px var(--container-pad)',
      fontFamily: 'var(--font-body)'
    }
  }, React.createElement("a", {
    className: "site-mark",
    href: screenHref('work'),
    "aria-label": "Killian Pichon \u2014 Work",
    onClick: e => {
      if (onLinkClick) {
        followInternal(e, () => onLinkClick('Work'));
      }
    },
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: '18px',
      color: 'var(--text-heading)',
      letterSpacing: '-0.02em'
    }
  }, mark), React.createElement("div", {
    className: "site-nav-links",
    style: {
      display: 'flex',
      gap: '32px',
      marginLeft: 'auto'
    }
  }, links.filter(l => l !== 'Technical' || window.KP_SHOW_TECHNICAL === true).map(l => React.createElement("a", {
    className: "site-nav-link",
    key: l,
    href: hrefs[l] || '#/work',
    onClick: e => {
      if (onLinkClick && l !== 'Technical') {
        followInternal(e, () => onLinkClick(l));
      }
    },
    style: {
      fontSize: 'var(--text-micro)',
      letterSpacing: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: activeLink === l ? 'var(--text-heading)' : 'var(--text-muted)',
      borderBottom: activeLink === l ? '1px solid var(--accent)' : '1px solid transparent',
      paddingBottom: '4px'
    }
  }, l))), React.createElement(LanguageSwitch, null));
}
function ProjectCard({
  title,
  category,
  year,
  thumbAlt,
  thumbImage,
  animatedThumb = false,
  href = '#/work',
  onClick,
  locked = false
}) {
  return React.createElement("a", {
    href: href,
    onClick: onClick,
    style: {
      display: 'block',
      color: 'inherit'
    }
  }, React.createElement("div", {
    style: {
      aspectRatio: '4 / 3',
      borderRadius: 'var(--radius-sm)',
      marginBottom: '14px',
      background: thumbImage ? `url(${thumbImage}) center/cover` : 'linear-gradient(150deg,rgba(28,29,34,.55) 0%,rgba(17,17,20,.4) 55%,rgba(36,22,16,.35) 100%)',
      border: thumbImage ? 'none' : '1px solid var(--line-subtle)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow var(--duration-base) var(--ease-out)'
    },
    className: "thumb" + (locked && thumbImage ? ' thumb-locked' : ''),
    "data-animated-image": animatedThumb ? "true" : undefined,
    "aria-label": thumbAlt,
    onMouseEnter: e => {
      e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--accent), 0 0 20px var(--accent-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.boxShadow = 'none';
    }
  }, !locked && thumbImage && React.createElement("img", {
    src: thumbImage,
    alt: thumbAlt || `${title} — ${category}`,
    loading: "lazy",
    decoding: "async",
    style: {position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'}
  }), locked && React.createElement("span", {
    className: "project-card-lock",
    "aria-hidden": "true"
  })), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-h3)',
      color: 'var(--text-heading)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, title), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-muted)',
      marginTop: '6px',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, category, " \xB7 ", year));
}
function Hero({
  name = 'Killian Pichon',
  role = 'Immersive Artist',
  tagline = 'Technical Art & Visual Storytelling',
  tools = 'Asset Production · Unreal · Pipelines',
  eyebrow = '3D Artist Generalist / Real-Time',
  onWatchReel,
  glowPattern = true,
  showReel = false,
  reelUrl = 'https://vimeo.com/1201960449',
  reelLabel = 'Showreel · 2026'
}) {
  const sectionRef = React.useRef(null);
  const artRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const leftColRef = React.useRef(null);
  const scrollIndRef = React.useRef(null);
  const pointerRef = React.useRef({
    x: -9999,
    y: -9999
  });
  const titleWrapRef = React.useRef(null);
  const wireRef = React.useRef(null);
  const reelCloseRef = React.useRef(null);
  const [reelOpen, setReelOpen] = React.useState(false);
  const reelOpenRef = React.useRef(false);
  React.useEffect(() => {
    reelOpenRef.current = reelOpen;
  }, [reelOpen]);
  React.useEffect(() => {
    if (!reelOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    reelCloseRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') setReelOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [reelOpen]);
  React.useEffect(() => {
    if (!reelOpen) return;
    const startY = window.scrollY;
    let raf;
    function poll() {
      if (!reelOpenRef.current) return;
      if (Math.abs(window.scrollY - startY) > 40) {
        setReelOpen(false);
        return;
      }
      raf = requestAnimationFrame(poll);
    }
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [reelOpen]);
  let reelPlayer = null;
  try {
    const url = new URL(reelUrl);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    const host = url.hostname.replace(/^www\./, '');
    const vimeo = /^(?:\/video)?\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/.exec(url.pathname);
    if (['vimeo.com', 'player.vimeo.com'].includes(host) && vimeo) {
      const params = new URLSearchParams({ autoplay: '1' });
      const hash = vimeo[2] || url.searchParams.get('h');
      if (hash) params.set('h', hash);
      reelPlayer = { src: `https://player.vimeo.com/video/${vimeo[1]}?${params}`, type: 'iframe' };
    } else if (['youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? url.pathname.slice(1).replace(/\/$/, '') :
        url.pathname === '/watch' ? url.searchParams.get('v') :
        /^\/(?:embed|shorts)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
      if (/^[\w-]{11}$/.test(id || '')) reelPlayer = { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, type: 'iframe' };
    } else if (/\.(mp4|webm)$/i.test(url.pathname)) {
      reelPlayer = { src: url.href, type: 'video' };
    }
  } catch (_) { /* The existing placeholder handles empty or invalid URLs. */ }
  React.useEffect(() => {
    const wrap = titleWrapRef.current,
      wire = wireRef.current;
    if (!wrap || !wire) return;
    function onMove(e) {
      const rect = wrap.getBoundingClientRect();
      wire.style.setProperty('--mx', e.clientX - rect.left + 'px');
      wire.style.setProperty('--my', e.clientY - rect.top + 'px');
    }
    function onLeave() {
      wire.style.setProperty('--mx', '-9999px');
      wire.style.setProperty('--my', '-9999px');
    }
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
    return () => {
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
    };
  }, []);
  React.useEffect(() => {
    if (!glowPattern) return;
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    const ctx = canvas.getContext('2d');
    let raf,
      dots = [],
      w = 0,
      h = 0;
    function isoProject(i, j, k, s, ox, oy) {
      const cos30 = 0.866,
        sin30 = 0.5;
      return {
        x: ox + (i - k) * cos30 * s,
        y: oy + (i + k) * sin30 * s - j * s
      };
    }
    function addCube(ox, oy, s, n, depth, twinkleSeed) {
      for (let i = 0; i <= n; i++) {
        for (let k = 0; k <= n; k++) {
          const p = isoProject(i, 0, k, s, ox, oy);
          dots.push({
            x: p.x,
            y: p.y,
            depth,
            twinkle: (i * 13 + k * 7 + twinkleSeed) % 97 / 97
          });
        }
      }
      for (let j = 0; j <= n; j++) {
        for (let k = 0; k <= n; k++) {
          const p = isoProject(0, j, k, s, ox, oy);
          dots.push({
            x: p.x,
            y: p.y,
            depth: depth * 0.75,
            twinkle: (j * 11 + k * 5 + twinkleSeed + 5) % 97 / 97
          });
        }
      }
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) {
          const p = isoProject(i, j, n, s, ox, oy);
          dots.push({
            x: p.x,
            y: p.y,
            depth: depth * 0.9,
            twinkle: (i * 9 + j * 17 + twinkleSeed + 11) % 97 / 97
          });
        }
      }
    }
    function buildDots() {
      const rect = section.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const cell = Math.min(w, h) * 0.052;
      addCube(w * 0.68, h * 0.48, cell, 6, 1, 0);
      addCube(w * 0.28, h * 0.22, cell * 0.6, 3, 0.55, 41);
      addCube(w * 0.32, h * 0.8, cell * 0.75, 4, 0.7, 83);
      addCube(w * 0.9, h * 0.2, cell * 0.45, 3, 0.4, 127);
      addCube(w * 0.52, h * 0.86, cell * 0.5, 3, 0.5, 169);
      addCube(w * 0.88, h * 0.72, cell * 0.55, 4, 0.6, 211);
      const sectionRect = section.getBoundingClientRect();
      const excludeRects = [];
      if (leftColRef.current) {
        const r = leftColRef.current.getBoundingClientRect();
        excludeRects.push({
          x0: r.left - sectionRect.left - 16,
          y0: r.top - sectionRect.top - 16,
          x1: r.right - sectionRect.left + 16,
          y1: r.bottom - sectionRect.top + 16
        });
      }
      if (scrollIndRef.current) {
        const r = scrollIndRef.current.getBoundingClientRect();
        excludeRects.push({
          x0: r.left - sectionRect.left - 40,
          y0: r.top - sectionRect.top - 40,
          x1: r.right - sectionRect.left + 40,
          y1: r.bottom - sectionRect.top + 40
        });
      }
      dots = dots.filter(d => {
        if (d.x < -30 || d.x > w + 30 || d.y < -30 || d.y > h + 30) return false;
        for (const r of excludeRects) {
          if (d.x > r.x0 && d.x < r.x1 && d.y > r.y0 && d.y < r.y1) return false;
        }
        return true;
      });
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const px = pointerRef.current.x,
        py = pointerRef.current.y;
      const active = [];
      for (const d of dots) {
        const dist = Math.hypot(d.x - px, d.y - py);
        const proximity = Math.max(0, 1 - dist / 260);
        const flicker = 0.75 + 0.25 * Math.sin(t / 1400 + d.twinkle * 20);
        const base = (0.14 + d.depth * 0.24) * flicker;
        const alpha = Math.min(1, base + proximity * 0.85);
        const size = 0.9 + d.depth * 2.1 + proximity * 2;
        const warm = proximity > 0.35;
        ctx.beginPath();
        ctx.shadowBlur = 5 + d.depth * 6 + proximity * 12;
        ctx.shadowColor = warm ? 'rgba(255,183,120,0.9)' : 'rgba(255,110,55,0.5)';
        ctx.fillStyle = warm ? `rgba(255,200,140,${alpha})` : `rgba(255,120,60,${alpha})`;
        ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
        ctx.fill();
        if (proximity > 0.06) active.push(d);
      }
      ctx.shadowBlur = 0;
      const connectR = 70;
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i],
            b = active[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > connectR) continue;
          const distA = Math.hypot(a.x - px, a.y - py),
            distB = Math.hypot(b.x - px, b.y - py);
          const prox = Math.max(0, 1 - Math.min(distA, distB) / 260);
          const edgeAlpha = (1 - d / connectR) * prox * 0.45;
          if (edgeAlpha <= 0.01) continue;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,170,110,${edgeAlpha})`;
          ctx.lineWidth = 1;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    function onMove(e) {
      const rect = section.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      pointerRef.current = {
        x: p.clientX - rect.left,
        y: p.clientY - rect.top
      };
    }
    function onLeave() {
      pointerRef.current = {
        x: -9999,
        y: -9999
      };
    }
    buildDots();
    const rebuildTimer = setTimeout(buildDots, 60);
    raf = requestAnimationFrame(draw);
    const resizeObs = new ResizeObserver(buildDots);
    resizeObs.observe(section);
    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerleave', onLeave);
    section.addEventListener('touchmove', onMove, {
      passive: true
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(rebuildTimer);
      resizeObs.disconnect();
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
      section.removeEventListener('touchmove', onMove);
    };
  }, [glowPattern]);
  return React.createElement("section", {
    className: "hero",
    ref: sectionRef,
    style: {
      position: 'relative',
      overflow: 'hidden',
      padding: '140px var(--container-pad) 0',
      display: 'flex',
      flexDirection: 'column'
    }
  }, glowPattern && React.createElement("canvas", {
    ref: canvasRef,
    style: {
      position: 'absolute',
      inset: 0
    }
  }), React.createElement("div", {
    className: "hero-main",
    style: {
      position: 'relative',
      display: 'flex',
      gap: 'var(--space-8)',
      flex: 1,
      minHeight: 0
    }
  }, React.createElement("div", {
    className: "hero-left",
    ref: leftColRef,
    style: {
      width: '440px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: 'var(--space-4)'
    }
  }, React.createElement("span", {
    style: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'var(--accent)',
      flexShrink: 0
    }
  }), React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      letterSpacing: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, eyebrow)), React.createElement("div", {
    className: "hero-title-wrap",
    ref: titleWrapRef,
    style: {
      position: 'relative'
    }
  }, React.createElement("h1", {
    style: {
      position: 'relative',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-display-xl)',
      color: 'var(--text-heading)',
      lineHeight: 'var(--leading-tight)',
      textTransform: 'uppercase',
      margin: 0
    }
  }, name), React.createElement("div", {
    className: "hero-title-wire",
    ref: wireRef,
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      margin: 0,
      pointerEvents: 'none',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-display-xl)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      textTransform: 'uppercase',
      color: 'transparent',
      WebkitTextStrokeWidth: '1px',
      WebkitTextStrokeColor: 'var(--ember-400)',
      backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,130,89,.45) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, rgba(255,130,89,.3) 0 1px, transparent 1px 7px)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      '--mx': '-9999px',
      '--my': '-9999px',
      WebkitMaskImage: 'radial-gradient(circle 120px at var(--mx) var(--my), black 55%, transparent 100%)',
      maskImage: 'radial-gradient(circle 120px at var(--mx) var(--my), black 55%, transparent 100%)'
    }
  }, name)), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-small)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginTop: 'var(--space-4)'
    }
  }, tools), showReel && React.createElement("button", {
    className: "hero-reel",
    type: "button",
    "aria-label": "Open showreel",
    onClick: () => {
      setReelOpen(true);
      if (onWatchReel) onWatchReel();
    },
    style: {
      marginTop: 'var(--space-6)',
      width: '280px',
      maxWidth: '100%',
      cursor: 'pointer',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '1px solid var(--line-default)',
      aspectRatio: '16 / 9',
      background: 'linear-gradient(160deg,#232128 0%,#141316 55%,#2c1610 100%)',
      position: 'relative',
      padding: 0,
      transition: 'transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'scale(1.02)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement("span", {
    style: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: 'rgba(10,10,11,.55)',
      border: '1px solid var(--line-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      color: 'var(--text-heading)'
    }
  }, "\u25B6")), React.createElement("div", {
    style: {
      position: 'absolute',
      left: '12px',
      bottom: '10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, reelLabel))), React.createElement("div", {
    className: "hero-art",
    ref: artRef,
    style: {
      position: 'relative',
      flex: 1,
      minHeight: '420px'
    }
  })), React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '0 0 var(--space-4)'
    }
  }, React.createElement("div", {
    className: "hero-scroll-indicator",
    ref: scrollIndRef,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 'calc(var(--text-small) * 1.15)',
      letterSpacing: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)'
    }
  }, React.createElement("span", {
    className: "kp-scroll-label"
  }, "Scroll to Explore"), React.createElement("span", {
    className: "kp-scroll-arrow",
    "aria-hidden": "true",
    style: {
      color: 'var(--accent)',
      fontSize: 'calc(var(--text-small) * 3)'
    }
  }, "\u2193"))), showReel && reelOpen && React.createElement("div", {
    className: "modal-backdrop",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Showreel",
    onClick: () => setReelOpen(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'rgba(10,10,11,.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px'
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 'min(960px, 100%)',
      aspectRatio: '16 / 9',
      position: 'relative'
    }
  }, React.createElement("button", {
    ref: reelCloseRef,
    onClick: () => setReelOpen(false),
    "aria-label": "Close",
    style: {
      position: 'absolute',
      top: '-44px',
      right: 0,
      background: 'none',
      border: 'none',
      color: 'var(--text-heading)',
      fontSize: '28px',
      lineHeight: 1,
      cursor: 'pointer'
    }
  }, "\xD7"), reelPlayer ? React.createElement(reelPlayer.type, {
    src: reelPlayer.src,
    title: reelLabel,
    ...(reelPlayer.type === 'iframe' ? {
      allow: 'autoplay; fullscreen; picture-in-picture', allowFullScreen: true
    } : { controls: true, autoPlay: true, playsInline: true }),
    style: { width: '100%', height: '100%', border: 0, borderRadius: 'var(--radius-md)', background: 'var(--void-900)' }
  }) : !reelUrl ? React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--line-subtle)',
      background: 'linear-gradient(160deg,#232128 0%,#141316 55%,#2c1610 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      textAlign: 'center',
      padding: '40px'
    }
  }, React.createElement("span", {
    style: {
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      border: '1px solid var(--line-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      color: 'var(--text-heading)'
    }
  }, "\u25B6"), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-h2)',
      color: 'var(--text-heading)',
      textTransform: 'uppercase'
    }
  }, "Coming Soon"), React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      maxWidth: '360px'
    }
  }, "The showreel is currently in production. Check back soon.")) : React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--line-subtle)',
      background: 'var(--void-900)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-small)'
    }
  }, "Invalid reel URL"))));
}
function Gallery({
  items = []
}) {
  return React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 'var(--space-4)'
    }
  }, items.map((it, i) => React.createElement("div", {
    key: i,
    style: {
      aspectRatio: '4 / 3',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--line-subtle)',
      background: i % 2 ? 'linear-gradient(160deg,#1b1c20,#0e0e10)' : 'linear-gradient(160deg,#221a15,#0e0e10)'
    },
    "aria-label": it.alt || window.KP_I18N.t.f('Gallery still {n}', {
      n: i + 1
    })
  })));
}
function Awards({
  awards = []
}) {
  return React.createElement("div", {
    className: "awards-row",
    style: {
      borderTop: '1px solid var(--line-subtle)',
      borderBottom: '1px solid var(--line-subtle)'
    }
  }, awards.map((a, i) => React.createElement("div", {
    key: i,
    className: "awards-cell",
    style: {
      padding: 'var(--space-5) var(--space-4)',
      textAlign: 'center',
      transition: 'transform var(--duration-base) var(--ease-out)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'translateY(-3px)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'translateY(0)';
    }
  }, a.image ? React.createElement("img", {
    src: a.image,
    alt: `${window.KP_I18N.t(a.type)} — ${window.KP_I18N.t(a.festival)}`,
    style: {
      width: '100%',
      maxWidth: '220px',
      height: 'auto'
    }
  }) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-h3)',
      color: 'var(--text-heading)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, a.type), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      marginTop: 'var(--space-3)'
    }
  }, a.festival)), React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      marginTop: 'var(--space-2)'
    }
  }, a.project))));
}
const LOGO_BASE = 'assets/logos/';
const DEFAULT_LOGOS = [{
  name: 'SAT',
  src: window.__asset(LOGO_BASE + 'sat.png')
}, {
  name: 'Transversal',
  src: window.__asset(LOGO_BASE + 'transversal.png'),
  studio: true
}, {
  name: 'Cité Sciences et Industrie',
  src: window.__asset(LOGO_BASE + 'cite-sciences-industrie.png')
}, {
  name: 'Sépaq — Aquarium du Québec',
  src: window.__asset(LOGO_BASE + 'sepaq-aquarium-quebec.png')
}, {
  name: 'Épernay',
  src: window.__asset(LOGO_BASE + 'epernay.png')
}, {
  name: 'Lumifest',
  src: window.__asset(LOGO_BASE + 'lumifest.png')
}, {
  name: 'Lumin-Art Productions',
  src: window.__asset(LOGO_BASE + 'lumin-art.png'),
  studio: true
}, {
  name: 'Montreal Museum of Fine Arts',
  src: window.__asset(LOGO_BASE + 'mbam.png')
}, {
  name: 'Musée de la Civilisation',
  src: window.__asset(LOGO_BASE + 'mcq.png')
}, {
  name: 'Melanie Martinez',
  src: window.__asset(LOGO_BASE + 'melanie-martinez.png')
}, {
  name: 'Normal Studio',
  src: window.__asset(LOGO_BASE + 'normal.png'),
  studio: true
}, {
  name: 'Colosseum',
  src: window.__asset(LOGO_BASE + 'colosseum.png')
}, {
  name: 'XYZ Technologies',
  src: window.__asset(LOGO_BASE + 'xyz.png'),
  studio: true
}, {
  name: 'Graphics eMotion',
  src: window.__asset(LOGO_BASE + 'graphics-emotion.png'),
  studio: true
}];
const CLIENTS_PHONE_QUERY = '(max-width: 767px)';
function useClientsPhoneLayout() {
  const [isPhone, setIsPhone] = React.useState(() => window.matchMedia(CLIENTS_PHONE_QUERY).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(CLIENTS_PHONE_QUERY);
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
  return isPhone;
}
function Clients({
  logos = DEFAULT_LOGOS
}) {
  const trackRef = React.useRef(null);
  const scoped = React.useRef('clients-' + Math.random().toString(36).slice(2));
  const isPhone = useClientsPhoneLayout();
  const loopLogos = [...logos, ...logos, ...logos];
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const setWidth = () => track.scrollWidth / 3;
    track.scrollLeft = setWidth();
    function onScroll() {
      const w = setWidth();
      if (track.scrollLeft < w * 0.5) track.scrollLeft += w;else if (track.scrollLeft > w * 1.5) track.scrollLeft -= w;
    }
    track.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => track.removeEventListener('scroll', onScroll);
  }, [logos, isPhone]);
  function scroll(dir) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: dir * 340,
      behavior: 'smooth'
    });
  }
  const arrowStyle = {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1px solid var(--line-default)',
    background: 'rgba(19,19,22,.7)',
    backdropFilter: 'blur(8px)',
    color: 'var(--text-heading)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: '18px',
    flexShrink: 0,
    transition: 'border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)'
  };
  const tileRestShadow = 'inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(0,0,0,.5), 0 10px 24px rgba(0,0,0,.35)';
  const tileHoverShadow = 'inset 0 1px 0 rgba(255,255,255,.1), inset 0 -1px 0 rgba(0,0,0,.5), 0 0 20px var(--accent-glow)';
  function logoTile(l, i, extraStyle) {
    return React.createElement("div", {
      key: l.name + i,
      title: l.name,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--line-subtle)',
        background: 'linear-gradient(155deg, var(--void-700) 0%, var(--void-800) 45%, var(--void-900) 100%)',
        boxShadow: tileRestShadow,
        transition: 'box-shadow var(--duration-base) var(--ease-out)',
        ...extraStyle
      },
      onMouseEnter: e => {
        e.currentTarget.style.boxShadow = tileHoverShadow;
      },
      onMouseLeave: e => {
        e.currentTarget.style.boxShadow = tileRestShadow;
      }
    }, l.src ? React.createElement("img", {
      src: l.src,
      alt: l.name,
      style: {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        filter: l.name === 'SAT' || l.name === 'Cité Sciences et Industrie' || l.name === 'Graphics eMotion' || l.name === 'Lumin-Art Productions' ? 'none' : 'grayscale(1) invert(1)',
        mixBlendMode: 'screen',
        opacity: 0.9,
        transition: 'opacity var(--duration-base) var(--ease-out)'
      }
    }) : React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 'var(--text-h3)',
        color: 'var(--text-muted)',
        textAlign: 'center',
        letterSpacing: 'var(--tracking-tight)'
      }
    }, l.name));
  }
  if (isPhone) {
    return React.createElement("ul", {
      className: "clients-grid",
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px',
        width: '100%',
        margin: 0,
        padding: 0,
        listStyle: 'none'
      }
    }, logos.map((l, i) => React.createElement("li", {
      key: l.name + i,
      style: {
        minWidth: 0
      }
    }, logoTile(l, i, {
      width: '100%',
      height: '76px',
      padding: '14px 16px'
    }))));
  }
  return React.createElement("div", {
    className: "clients-carousel",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      width: '100%',
      overflow: 'visible'
    }
  }, React.createElement("style", null, `.${scoped.current}::-webkit-scrollbar{display:none}`), React.createElement("button", {
    "aria-label": "Previous clients",
    onClick: () => scroll(-1),
    style: arrowStyle,
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--line-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: 'rotate(180deg)'
    }
  }, React.createElement("path", {
    d: "M8 4l8 8-8 8"
  }))), React.createElement("div", {
    ref: trackRef,
    className: `${scoped.current} clients-track`,
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      scrollbarWidth: 'none',
      flex: 1,
      minWidth: 0
    }
  }, loopLogos.map((l, i) => logoTile(l, i, {
    flex: '0 0 auto',
    width: '168px',
    height: '96px',
    scrollSnapAlign: 'start',
    padding: '20px'
  }))), React.createElement("button", {
    "aria-label": "Next clients",
    onClick: () => scroll(1),
    style: arrowStyle,
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--line-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M8 4l8 8-8 8"
  }))));
}
function Footer() {
  return React.createElement("footer", {
    style: {
      borderTop: '1px solid var(--line-subtle)',
      padding: 'var(--space-7) var(--container-pad)',
      display: 'flex',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 'var(--space-5)'
    }
  }, React.createElement("a", {
    href: screenHref('demos'),
    className: "kp-footer-link",
    "aria-current": window.location.hash === '#/demos' ? 'page' : undefined,
    style: { fontSize: 'var(--text-micro)' }
  }, "Other demos"), React.createElement("button", {
    type: "button",
    className: "kp-footer-link",
    "data-analytics-choices": true,
    style: {
      fontSize: 'var(--text-micro)'
    }
  }, "Privacy choices"), React.createElement("a", {
    href: "privacy.html",
    className: "kp-footer-link",
    style: {
      fontSize: 'var(--text-micro)'
    }
  }, "Privacy"), React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)'
    }
  }, "\xA9 2026 \xB7 All rights reserved"));
}
window.KillianPichonDesignSystem_16387b = {
  Button,
  Tag,
  Navbar,
  ProjectCard,
  Hero,
  Gallery,
  Awards,
  Clients,
  Footer,
  DEFAULT_LOGOS
};
function ScrollBulb() {
  const rootRef = React.useRef(null);
  const [lit, setLit] = React.useState(false);
  React.useEffect(() => {
    const el = rootRef.current;
    const section = el && el.closest('section');
    if (!section) return;
    const io = new IntersectionObserver(([entry]) => setLit(entry.isIntersecting), {
      threshold: 0.5
    });
    io.observe(section);
    return () => io.disconnect();
  }, []);
  const t = 'opacity 900ms var(--ease-out)';
  return React.createElement("div", {
    ref: rootRef,
    style: {
      position: 'absolute',
      left: '50%',
      top: '-70px',
      width: 0,
      height: 0,
      pointerEvents: 'none'
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: 0,
      width: '2400px',
      height: '780px',
      transform: 'translate(-50%, 70px)',
      background: 'radial-gradient(ellipse 42% 100% at 50% 0%, rgba(255,206,166,.95) 0%, rgba(255,166,116,.6) 12%, rgba(255,133,80,.32) 26%, rgba(255,106,52,.16) 42%, rgba(255,90,42,.07) 60%, transparent 80%)',
      mixBlendMode: 'screen',
      filter: 'blur(18px)',
      opacity: lit ? 1 : 0,
      transition: t,
      willChange: 'opacity',
      backfaceVisibility: 'hidden'
    }
  }), React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: 0,
      width: '150px',
      height: '36px',
      transform: 'translate(-50%, 76px)',
      background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,224,196,.7) 0%, rgba(255,160,105,.25) 60%, transparent 100%)',
      mixBlendMode: 'screen',
      filter: 'blur(4px)',
      opacity: lit ? 1 : 0,
      transition: t,
      willChange: 'opacity',
      backfaceVisibility: 'hidden'
    }
  }), React.createElement("img", {
    src: "assets/illustrations/lightbulb.png",
    alt: "",
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      left: '50%',
      top: 0,
      transform: 'translate(-50%, 76px)',
      width: '230px',
      height: 'auto',
      opacity: lit ? 1 : 0,
      transition: t,
      mixBlendMode: 'screen',
      filter: lit ? 'drop-shadow(0 0 12px rgba(255,150,90,.7)) blur(0.4px)' : 'blur(0.4px)',
      willChange: 'opacity',
      backfaceVisibility: 'hidden'
    }
  }));
}
function HomeScreen({
  onOpenProject,
  onNav,
  onViewAll
}) {
  const {
    Navbar,
    Hero,
    ProjectCard,
    Awards,
    Clients,
    Footer
  } = window.KillianPichonDesignSystem_16387b;
  const [showAll, setShowAll] = React.useState(false);
  // Sur telephone, la suite des projets s'affiche en index deroulant, limite
  // aux premieres lignes pour ne pas occuper la page. Ce second etat ouvre
  // l'index en entier.
  const [indexOuvert, setIndexOuvert] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add('kp-snap');
    return () => root.classList.remove('kp-snap');
  }, []);
  React.useEffect(() => {
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let settling = false;
    let lastJump = 0;
    let timer = 0;
    function stops() {
      const vh = window.innerHeight;
      const max = Math.max(0, document.documentElement.scrollHeight - vh);
      const list = [];
      ['.hero', '.featured-projects', '.clients-section', '.awards-section'].forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const top = Math.round(rect.top + window.scrollY);
        const bottom = top + Math.round(rect.height);
        list.push(top);
        // Une section plus haute que l'ecran recoit des arrets intermediaires,
        // sinon son milieu serait enjambe d'un seul cran de molette. Le dernier
        // est cale sur la fin de la section pour ne rien couper.
        for (let y = top + vh; y < bottom - 8; y += vh) {
          list.push(Math.min(y, bottom - vh));
        }
      });
      const clamped = list.map(v => Math.min(max, Math.max(0, v))).sort((a, b) => a - b);
      const merged = [];
      clamped.forEach((v, i) => {
        if (merged.length === 0) {
          merged.push(v);
          return;
        }
        const last = merged[merged.length - 1];
        if (v - last <= 8) return;
        // Un arret trop proche du precedent produit un a-coup. On ne l'ecarte
        // que si le suivant reste atteignable en un ecran, sans quoi on
        // recreerait un saut par-dessus du contenu.
        const next = clamped[i + 1];
        if (v - last < vh * 0.3 && next !== undefined && next - last <= vh) return;
        merged.push(v);
      });
      return merged;
    }
    function onWheel(e) {
      if (e.ctrlKey) return;
      if (document.body.style.overflow === 'hidden') return;
      if (Math.abs(e.deltaY) < 4) return;
      const now = Date.now();
      if (settling || now - lastJump < 620) {
        e.preventDefault();
        return;
      }
      const list = stops();
      if (list.length < 2) return;
      const y = window.scrollY;
      let current = 0;
      let best = Infinity;
      list.forEach((t, i) => {
        const d = Math.abs(t - y);
        if (d < best) {
          best = d;
          current = i;
        }
      });
      const target = current + (e.deltaY > 0 ? 1 : -1);
      if (target < 0 || target >= list.length) return;
      e.preventDefault();
      settling = true;
      lastJump = now;
      window.scrollTo({
        top: list[target],
        behavior: 'smooth'
      });
      clearTimeout(timer);
      timer = setTimeout(() => {
        settling = false;
      }, 620);
    }
    window.addEventListener('wheel', onWheel, {
      passive: false
    });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);
  // Les deux grilles decoupent la meme liste triee : rien a maintenir a la
  // main quand un projet arrive ou change de date.
  const PROJECTS = VISIBLE_PROJECTS.slice(0, FEATURED_COUNT);
  const MORE_PROJECTS = VISIBLE_PROJECTS.slice(FEATURED_COUNT);
  const AWARDS = [{
    image: window.__asset('assets/awards/public-award-sat-fest.png'),
    type: 'Public Award',
    festival: 'SAT Fest 2026',
    project: "Traveler's Introspection"
  }, {
    image: window.__asset('assets/awards/official-selection-fduk.png'),
    type: 'Official Selection',
    festival: 'FDUK 2026',
    project: "Traveler's Introspection"
  }, {
    image: window.__asset('assets/awards/official-selection-dome-under.png'),
    type: 'Official Selection',
    festival: 'Dome Under Film Festival 2026 (Australia)',
    project: "Traveler's Introspection"
  }, {
    image: window.__asset('assets/awards/official-selection-macon.png'),
    type: 'Official Selection',
    festival: 'Macon Film Festival 2026',
    project: "Traveler's Introspection"
  }, {
    image: window.__asset(window.KP_I18N.lang === 'fr' ? 'assets/awards/award-innovation-dome-fr.png' : 'assets/awards/award-innovation-dome-en.png'),
    type: 'Winner',
    festival: 'Innovation Award, Full Dome — PFCAT 2026',
    project: "Traveler's Introspection"
  }, {
    image: window.__asset('assets/awards/nominee-innovation-animation.png'),
    type: 'Official Nominee',
    festival: 'Innovation Award, Animation — PFCAT 2026',
    project: "Traveler's Introspection"
  }, {
    image: window.__asset(window.KP_I18N.lang === 'fr' ? 'assets/awards/winner-prix-numix-fr.png' : 'assets/awards/winner-prix-numix-en.png'),
    type: 'Winner',
    festival: 'Prix NUMIX 2026 — International Exhibition',
    project: 'Into the Volcano'
  }];
  return React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: 'linear-gradient(180deg, rgba(10,10,11,.9), transparent)'
    }
  }, React.createElement(Navbar, {
    activeLink: "Work",
    onLinkClick: onNav
  })), React.createElement("div", {
    style: {
      marginTop: '-90px',
      position: 'relative',
      zIndex: 2
    }
  }, React.createElement(Hero, null)), React.createElement("section", {
    className: "featured-projects" + (showAll ? ' projects-expanded' : ''),
    id: "featured-projects",
    style: {
      padding: '96px var(--container-pad)',
      position: 'relative',
      zIndex: 2
    }
  }, React.createElement(ScrollBulb, null), React.createElement("div", {
    className: "section-heading",
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 'var(--space-6)'
    }
  }, React.createElement("h2", {
    style: {
      fontSize: 'var(--text-h1)',
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase'
    }
  }, "Featured Projects"), React.createElement("button", {
    className: "view-all-button",
    type: "button",
    "aria-expanded": showAll,
    onClick: () => setShowAll(v => !v)
  }, React.createElement("span", {
    className: "view-all-toggle-icon",
    "aria-hidden": "true"
  }), showAll ? 'Hide Projects' : 'CLICK HERE FOR MORE PROJECTS')), React.createElement("div", {
    className: "project-grid project-grid-featured",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 'var(--space-5)'
    }
  }, PROJECTS.map(p => React.createElement("div", {
    key: p.id
  }, React.createElement(ProjectCard, {
    href: projectHref(p.id),
    onClick: e => {
      followInternal(e, () => onOpenProject(p.id));
    },
    title: p.title,
    category: p.cardCategory || p.category,
    locked: p.locked,
    year: p.year,
    thumbImage: p.thumbImage,
    animatedThumb: p.animatedImages?.includes(p.thumbImage)
  })))), showAll && React.createElement("div", {
    className: "project-grid project-grid-more",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 'var(--space-5)',
      marginTop: 'var(--space-5)'
    }
  }, MORE_PROJECTS.map(p => React.createElement("div", {
    key: p.id
  }, React.createElement(ProjectCard, {
    href: projectHref(p.id),
    onClick: e => {
      followInternal(e, () => onOpenProject(p.id));
    },
    title: p.title,
    category: p.cardCategory || p.category,
    locked: p.locked,
    year: p.year,
    thumbImage: p.thumbImage,
    animatedThumb: p.animatedImages?.includes(p.thumbImage)
  })))),
  // Sous 768 px, le bouton ne deplie pas une seconde grille : il bascule
  // l'apercu de quatre vers l'index complet, une ligne par projet. Six cartes
  // pleine largeur en plus demandaient deux ecrans et demi de defilement.
  showAll && React.createElement("div", {
    className: "project-index" + (indexOuvert ? ' project-index-open' : '')
  }, React.createElement("div", {
    className: "project-index-scroll"
  }, VISIBLE_PROJECTS.map(p => React.createElement("a", {
    key: p.id,
    className: "project-index-row",
    href: projectHref(p.id),
    onClick: e => {
      followInternal(e, () => onOpenProject(p.id));
    }
  }, React.createElement("span", {
    className: "project-index-thumb" + (p.locked ? ' thumb-locked' : ''),
    style: p.thumbImage ? {
      backgroundImage: `url(${p.thumbImage})`
    } : null
  }, p.locked && React.createElement("span", {
    className: "project-card-lock",
    "aria-hidden": "true"
  })), React.createElement("span", {
    className: "project-index-body"
  }, React.createElement("span", {
    className: "project-index-title"
  }, p.title), React.createElement("span", {
    className: "project-index-meta"
  }, p.cardCategory || p.category, " · ", p.year)), React.createElement("span", {
    className: "project-index-go",
    "aria-hidden": "true"
  }, "→")))), VISIBLE_PROJECTS.length > 3 && React.createElement("button", {
    className: "project-index-toggle",
    type: "button",
    "aria-expanded": indexOuvert,
    onClick: () => setIndexOuvert(v => !v)
  }, indexOuvert ? 'Reduce the list' : window.KP_I18N.t.f('Show all ({n})', {
    n: VISIBLE_PROJECTS.length
  })))), React.createElement("section", {
    className: "clients-section",
    style: {
      padding: '0 var(--container-pad) 64px',
      position: 'relative',
      zIndex: 2
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      marginBottom: '20px'
    }
  }, "Selected Clients & Collaborators"), React.createElement(Clients, null)), React.createElement("section", {
    className: "awards-section",
    style: {
      padding: '0 var(--container-pad) 96px',
      position: 'relative',
      zIndex: 2
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      marginBottom: '20px'
    }
  }, "Awards & Recognition"), React.createElement(Awards, {
    awards: AWARDS
  })), React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2
    }
  }, React.createElement(Footer, null)));
}
window.HomeScreen = HomeScreen;
// ------------------------------------------------------------------- projets
// Les fiches vivent dans data/projects.js. Ici on ne fait que les preparer :
// chemins de medias resolus, annee deduite de la date, puis tri.
//
// Ce tri est la seule source d'ordre du site. Il vaut pour les deux grilles
// de l'accueil comme pour la navigation entre fiches : un projet ajoute se
// place tout seul, sans aucune liste a remettre a jour.
// La meme preparation sert aux fiches du fichier et aux fiches dechiffrees a
// l'ecran : une fiche protegee doit s'afficher exactement comme les autres une
// fois le code saisi.
function prepareProject(id, p) {
  // La traduction s'applique avant tout le reste : l'annee deduite, les
  // vignettes, les voisins precedent/suivant et le titre de l'onglet en
  // decoulent tous, et doivent donc partir de la fiche deja traduite.
  // Le titre d'origine est mis de cote : relatedProjects designe encore
  // certains projets par leur titre anglais, et ces renvois doivent continuer
  // de tomber juste une fois les titres traduits.
  const sourceTitle = p.title;
  p = window.KP_I18N.project(id, p);
  const project = Object.assign({
    id
  }, p);
  project.sourceTitle = sourceTitle;
  project.year = Number(String(p.date || '').slice(0, 4)) || p.year;
  // Fiche protegee : seuls la date, le mode d'affichage et le libelle de la
  // tuile sont en clair. Tout le reste attend le code d'acces.
  project.locked = Boolean(p.protected);
  if (project.locked) {
    // Traduits ici et non au rendu : ces deux libelles alimentent aussi le
    // titre de l'onglet et la description de la page, qui ne passent pas par
    // les composants.
    project.title = window.KP_I18N.t(p.lockedTitle || 'Protected project');
    project.category = window.KP_I18N.t('Access code required');
  }
  // La fiche attend ces trois listes. Vides, elle affiche une section sans
  // contenu ; absentes, elle ne s'affiche pas du tout. L'editeur les exige a
  // la creation, mais une modification faite a la main ne doit pas pouvoir
  // faire tomber la page.
  project.tools = p.tools || [];
  project.contribution = p.contribution || [];
  project.pipeline = p.pipeline || [];
  if (p.thumb) project.thumbImage = window.__asset(p.thumb);
  if (p.heroImage) project.heroImage = window.__asset(p.heroImage);
  if (p.videoPoster) project.videoPoster = window.__asset(p.videoPoster);
  if (p.videoPosters) project.videoPosters = p.videoPosters.map(src => src ? window.__asset(src) : null);
  if (p.galleryImages) project.galleryImages = p.galleryImages.map(src => window.__asset(src));
  if (p.animatedImages) project.animatedImages = p.animatedImages.map(src => window.__asset(src));
  return project;
}
const PROJECT_LIST = Object.entries(window.KP_PROJECTS || {}).map(([id, p]) => prepareProject(id, p)).sort((a, b) => String(b.date).localeCompare(String(a.date)));

// Un projet marque hidden sort des grilles et de la navigation. Il reste
// atteignable par son adresse directe, et par elle seule.
const VISIBLE_PROJECTS = PROJECT_LIST.filter(p => p.listing !== 'hidden');

// prev et next ne s'ecrivent plus dans chaque fiche : ils suivent l'ordre
// chronologique et bouclent aux deux extremites.
// L'identifiant sert de reference, le titre seulement d'affichage : deux
// fiches protegees peuvent porter le meme libelle de tuile, et la navigation
// ne doit pas avoir a les distinguer par leur nom.
if (VISIBLE_PROJECTS.length > 1) {
  VISIBLE_PROJECTS.forEach((p, i) => {
    const before = VISIBLE_PROJECTS[(i - 1 + VISIBLE_PROJECTS.length) % VISIBLE_PROJECTS.length];
    const after = VISIBLE_PROJECTS[(i + 1) % VISIBLE_PROJECTS.length];
    p.prev = before.title;
    p.prevId = before.id;
    p.next = after.title;
    p.nextId = after.id;
  });

  // Une fiche masquee reste hors de la chaine : personne n'y arrive par les
  // fleches. Mais qui l'ouvre par son adresse doit pouvoir en sortir, donc on
  // lui donne les voisins qu'elle aurait eus a sa date. Elle n'apparait dans
  // le parcours de personne d'autre.
  PROJECT_LIST.filter(p => p.listing === 'hidden').forEach(p => {
    const suivant = VISIBLE_PROJECTS.findIndex(v => String(v.date) < String(p.date));
    const iAfter = suivant === -1 ? 0 : suivant;
    const iBefore = (iAfter - 1 + VISIBLE_PROJECTS.length) % VISIBLE_PROJECTS.length;
    const before = VISIBLE_PROJECTS[iBefore];
    const after = VISIBLE_PROJECTS[iAfter];
    p.prev = before.title;
    p.prevId = before.id;
    p.next = after.title;
    p.nextId = after.id;
  });
}

// La grille du haut montre les projets les plus recents ; les suivants
// attendent derriere le bouton de l'accueil.
const FEATURED_COUNT = 4;
const PROJECT_DATA = Object.fromEntries(PROJECT_LIST.map(p => [p.id, p]));
// Indexe le titre affiche et le titre d'origine. En anglais les deux sont
// identiques et la table ne change pas ; en francais, un renvoi ecrit avec le
// titre anglais continue de trouver sa fiche.
const TITLE_TO_ID = Object.fromEntries(Object.values(PROJECT_DATA).flatMap(v => [v.title, v.sourceTitle].filter(Boolean).map(nom => [nom, v.id])));
// Suggestions editoriales communes aux deux langues, referencees par identifiant.
const RELATED_PROJECT_DEFAULTS = {
  'ihf-2021': ['banquet', 'epernay', 'colosseum'],
  banquet: ['epernay', 'colosseum', 'batiscan'],
  cabotage: ['paralleles', 'traveler', 'melanie'],
  celestia: ['hurtubise', 'volcano', 'melanie'],
  hurtubise: ['traveler', 'volcano', 'memoire-eau'],
  volcano: ['hurtubise', 'traveler', 'batiscan'],
  melanie: ['ihf-2021', 'banquet', 'luminart'],
  traveler: ['hurtubise', 'volcano', 'cabotage'],
  paralleles: ['batiscan', 'cabotage', 'banquet'],
  batiscan: ['epernay', 'colosseum', 'paralleles'],
  epernay: ['colosseum', 'batiscan', 'memoire-eau'],
  colosseum: ['epernay', 'batiscan', 'memoire-eau'],
  luminart: ['melanie', 'ihf-2021', 'banquet'],
  'memoire-eau': ['epernay', 'colosseum', 'banquet']
};
function getRelatedProjectIds(project) {
  // Les choix de la fiche restent prioritaires. Completer jusqu'a trois liens
  // publics, distincts et valides, sans renvoi vers soi ni projet masque.
  const candidates = [
    ...(project.relatedProjects || []),
    ...(RELATED_PROJECT_DEFAULTS[project.id] || []),
    ...VISIBLE_PROJECTS.map(candidate => candidate.id)
  ];
  return [...new Set(candidates.map(value => PROJECT_DATA[value] ? value : TITLE_TO_ID[value]))]
    .filter(id => id && id !== project.id && PROJECT_DATA[id].listing !== 'hidden' && !PROJECT_DATA[id].locked)
    .slice(0, 3);
}
function ProtectedAccess({
  resource
}) {
  const {
    Button
  } = window.KillianPichonDesignSystem_16387b;
  const [open, setOpen] = React.useState(false);
  const [accessCode, setAccessCode] = React.useState('');
  const [status, setStatus] = React.useState('idle');
  const [message, setMessage] = React.useState('');
  const [retryAfter, setRetryAfter] = React.useState(0);
  const [unlockedUrl, setUnlockedUrl] = React.useState('');
  const dialogRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const openLinkRef = React.useRef(null);
  const previousFocusRef = React.useRef(null);

  function resetAndClose() {
    setOpen(false);
    setAccessCode('');
    setStatus('idle');
    setMessage('');
    setRetryAfter(0);
    setUnlockedUrl('');
  }

  React.useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        resetAndClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || status !== 'unlocked') return;
    const frame = window.requestAnimationFrame(() => openLinkRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, status]);

  React.useEffect(() => {
    if (!open || retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter(seconds => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setStatus('idle');
          setMessage('');
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, retryAfter > 0]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === 'checking' || retryAfter > 0) return;
    if (!window.KPProtectedContent || typeof window.KPProtectedContent.unlock !== 'function') {
      setStatus('error');
      setMessage('Secure access is unavailable in this browser.');
      return;
    }
    setStatus('checking');
    setMessage('');
    try {
      const target = await window.KPProtectedContent.unlock(resource, accessCode);
      setUnlockedUrl(target.url);
      setAccessCode('');
      setStatus('unlocked');
    } catch (error) {
      const wait = Number(error && error.retryAfter) || 0;
      setRetryAfter(wait);
      setStatus(wait > 0 ? 'limited' : 'error');
      setMessage(error && error.code === 'UNSUPPORTED' ? 'Secure access is unavailable in this browser.' : wait > 0 ? window.KP_I18N.t.f('Too many attempts. Try again in {n}s.', {
        n: wait
      }) : error && error.code === 'INVALID_RESOURCE' ? 'This protected link is not configured correctly.' : 'Access code not recognized.');
    }
  }

  async function copyLink() {
    if (!unlockedUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(unlockedUrl);
      } else {
        const field = dialogRef.current?.querySelector('.kp-protected-link-input');
        field?.focus();
        field?.select();
        if (!document.execCommand('copy')) throw new Error('copy failed');
      }
      setMessage('Link copied.');
    } catch (_error) {
      setMessage('Copy failed. Select the link and copy it manually.');
    }
  }

  const checking = status === 'checking';
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "kp-protected-access"
  }, React.createElement(Button, {
    variant: "accent",
    size: "sm",
    onClick: () => setOpen(true),
    icon: React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, React.createElement("rect", {
      x: "4",
      y: "10",
      width: "16",
      height: "11",
      rx: "2"
    }), React.createElement("path", {
      d: "M8 10V7a4 4 0 018 0v3"
    }))
  }, resource.label || 'Open protected content'), React.createElement("span", {
    className: "kp-protected-access-note"
  }, "Access code required")), open && React.createElement("div", {
    className: "kp-protected-backdrop",
    onMouseDown: event => {
      if (event.target === event.currentTarget) resetAndClose();
    }
  }, React.createElement("section", {
    ref: dialogRef,
    className: "kp-protected-dialog",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": `protected-title-${resource.id}`,
    "aria-describedby": `protected-description-${resource.id}`
  }, React.createElement("button", {
    type: "button",
    className: "kp-protected-close",
    onClick: resetAndClose,
    "aria-label": "Close protected access"
  }, "\xD7"), React.createElement("p", {
    className: "kp-protected-eyebrow"
  }, "Restricted preview"), React.createElement("h2", {
    className: "kp-protected-title",
    id: `protected-title-${resource.id}`
  }, status === 'unlocked' ? 'Access granted' : 'Full film access'), React.createElement("p", {
    className: "kp-protected-description",
    id: `protected-description-${resource.id}`
  }, status === 'unlocked' ? 'The film link is ready to open or copy into another browser.' : 'Enter the access code provided to you. The film link is revealed only after verification on this device.'), React.createElement("p", {
    className: "kp-protected-confidentiality"
  }, "Please do not redistribute this restricted preview link."), status !== 'unlocked' ? React.createElement("form", {
    className: "kp-protected-form",
    onSubmit: handleSubmit
  }, React.createElement("label", {
    className: "kp-protected-label",
    htmlFor: `protected-code-${resource.id}`
  }, "Access code"), React.createElement("input", {
    ref: inputRef,
    className: "kp-protected-input",
    id: `protected-code-${resource.id}`,
    type: "password",
    value: accessCode,
    onChange: event => setAccessCode(event.target.value),
    maxLength: 256,
    autoComplete: "off",
    autoCapitalize: "none",
    spellCheck: false,
    disabled: checking || retryAfter > 0,
    "aria-invalid": status === 'error' || status === 'limited' ? 'true' : 'false',
    "aria-describedby": `protected-message-${resource.id}`
  }), React.createElement("p", {
    className: "kp-protected-error",
    id: `protected-message-${resource.id}`,
    role: "alert",
    "aria-live": "polite"
  }, retryAfter > 0 ? window.KP_I18N.t.f('Too many attempts. Try again in {n}s.', {
    n: retryAfter
  }) : message), React.createElement("div", {
    className: "kp-protected-actions"
  }, React.createElement(Button, {
    type: "submit",
    variant: "accent",
    disabled: checking || retryAfter > 0 || !accessCode
  }, checking ? 'Checking…' : retryAfter > 0 ? window.KP_I18N.t.f('Wait {n}s', {
    n: retryAfter
  }) : 'Unlock film'))) : React.createElement("div", {
    className: "kp-protected-success"
  }, React.createElement("label", {
    className: "kp-protected-label",
    htmlFor: `protected-link-${resource.id}`
  }, window.KP_I18N.t.f('{provider} link', {
    provider: resource.provider || 'Protected'
  })), React.createElement("div", {
    className: "kp-protected-link-row"
  }, React.createElement("input", {
    className: "kp-protected-input kp-protected-link-input",
    id: `protected-link-${resource.id}`,
    value: unlockedUrl,
    readOnly: true,
    onFocus: event => event.currentTarget.select(),
    "aria-label": "Unlocked film link"
  }), React.createElement(Button, {
    variant: "outline",
    size: "sm",
    onClick: copyLink
  }, "Copy link")), React.createElement("p", {
    className: "kp-protected-copy-status",
    role: "status",
    "aria-live": "polite"
  }, message), React.createElement("div", {
    className: "kp-protected-actions"
  }, React.createElement("a", {
    ref: openLinkRef,
    href: unlockedUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '12px 26px',
      border: '1px solid var(--white-100)',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--white-100)',
      color: 'var(--void-950)',
      fontFamily: 'var(--font-body)',
      fontWeight: 'var(--weight-medium)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, "Open film \u2197"))))));
}
// Fiches deverrouillees pendant la visite. Rien n'est conserve d'une visite a
// l'autre : fermer l'onglet redemande le code.
const UNLOCKED_PROJECTS = new Map();

// Fleches de bord entre projets. Extraites de la fiche pour que la page
// verrouillee les porte aussi : sans elles, un projet protege etait un
// cul-de-sac, il fallait revenir en arriere pour continuer a naviguer.
function ProjectNavEdges({
  prevId,
  nextId,
  prevTitle,
  nextTitle,
  onOpenProject
}) {
  return React.createElement(React.Fragment, null, prevId && React.createElement("a", {
    className: "project-nav-edge project-nav-edge-prev",
    href: projectHref(prevId),
    "aria-label": "Previous project",
    onClick: e => followInternal(e, () => onOpenProject(prevId)),
    onMouseEnter: e => {
      e.currentTarget.querySelector('.pn-label').style.opacity = '1';
      e.currentTarget.querySelector('.pn-label').style.transform = 'translateX(0)';
    },
    onMouseLeave: e => {
      e.currentTarget.querySelector('.pn-label').style.opacity = '0';
      e.currentTarget.querySelector('.pn-label').style.transform = 'translateX(-8px)';
    },
    style: {
      position: 'fixed',
      left: '20px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      cursor: 'pointer'
    }
  }, React.createElement("span", {
    className: "project-nav-button",
    "aria-label": "Previous project",
    style: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: '1px solid var(--line-default)',
      background: 'rgba(19,19,22,.7)',
      backdropFilter: 'blur(8px)',
      color: 'var(--text-heading)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--line-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transform: 'rotate(180deg)'
    }
  }, React.createElement("path", {
    d: "M8 4l8 8-8 8"
  }))), React.createElement("div", {
    className: "pn-label",
    style: {
      opacity: 0,
      transform: 'translateX(-8px)',
      transition: 'opacity var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out)',
      width: '180px',
      pointerEvents: 'none',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'rgba(10,10,11,.7)',
      backdropFilter: 'blur(6px)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Prev Project"), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-small)',
      color: 'var(--text-heading)',
      marginTop: '2px'
    }
  }, prevTitle))), nextId && React.createElement("a", {
    className: "project-nav-edge project-nav-edge-next",
    href: projectHref(nextId),
    "aria-label": "Next project",
    onClick: e => followInternal(e, () => onOpenProject(nextId)),
    onMouseEnter: e => {
      e.currentTarget.querySelector('.pn-label').style.opacity = '1';
      e.currentTarget.querySelector('.pn-label').style.transform = 'translateX(0)';
    },
    onMouseLeave: e => {
      e.currentTarget.querySelector('.pn-label').style.opacity = '0';
      e.currentTarget.querySelector('.pn-label').style.transform = 'translateX(8px)';
    },
    style: {
      position: 'fixed',
      right: '20px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      cursor: 'pointer',
      flexDirection: 'row-reverse'
    }
  }, React.createElement("span", {
    className: "project-nav-button",
    "aria-label": "Next project",
    style: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: '1px solid var(--line-default)',
      background: 'rgba(19,19,22,.7)',
      backdropFilter: 'blur(8px)',
      color: 'var(--text-heading)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--line-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M8 4l8 8-8 8"
  }))), React.createElement("div", {
    className: "pn-label",
    style: {
      opacity: 0,
      transform: 'translateX(8px)',
      transition: 'opacity var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out)',
      width: '180px',
      pointerEvents: 'none',
      textAlign: 'right',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'rgba(10,10,11,.7)',
      backdropFilter: 'blur(6px)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Next Project"), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-small)',
      color: 'var(--text-heading)',
      marginTop: '2px'
    }
  }, nextTitle))));
}
// Ecran d'attente d'une fiche protegee. Il ne masque pas la page : la page
// n'existe pas encore. Tant que le code n'est pas saisi, le navigateur ne
// detient que du texte chiffre.
function ProjectGate({
  project,
  onUnlocked,
  onBack,
  onNav,
  onOpenProject
}) {
  const {
    Navbar,
    Footer,
    Button
  } = window.KillianPichonDesignSystem_16387b;
  const [accessCode, setAccessCode] = React.useState('');
  const [status, setStatus] = React.useState('idle');
  const [message, setMessage] = React.useState('');
  const inputRef = React.useRef(null);
  const prevId = project.prevId;
  const nextId = project.nextId;
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  // Memes raccourcis que sur une fiche ouverte, sauf pendant la saisie du code
  // ou les fleches servent a se deplacer dans le champ.
  React.useEffect(() => {
    function onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') onBack();
      if (e.key === 'ArrowLeft' && prevId) onOpenProject(prevId);
      if (e.key === 'ArrowRight' && nextId) onOpenProject(nextId);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevId, nextId, onOpenProject, onBack]);
  async function handleSubmit(event) {
    event.preventDefault();
    if (status === 'checking') return;
    if (!window.KPProtectedContent || typeof window.KPProtectedContent.unlock !== 'function') {
      setStatus('error');
      setMessage('Secure access is unavailable in this browser.');
      return;
    }
    setStatus('checking');
    setMessage('');
    try {
      const target = await window.KPProtectedContent.unlock(project.protected, accessCode);
      if (!target.project) throw new Error('INVALID_RESOURCE');
      onUnlocked(prepareProject(project.id, Object.assign({}, target.project, {
        date: project.date,
        prev: project.prev,
        prevId: project.prevId,
        next: project.next,
        nextId: project.nextId
      })));
    } catch (error) {
      setStatus('error');
      if (error && error.code === 'RATE_LIMITED') {
        setMessage(window.KP_I18N.t.f('Too many attempts. Try again in {n} seconds.', {
          n: error.retryAfter || 15
        }));
      } else {
        setMessage('Incorrect access code.');
      }
    }
  }
  return React.createElement("div", {
    style: {
      background: 'var(--surface-page)',
      minHeight: '100vh'
    }
  }, React.createElement(Navbar, {
    onNav: onNav
  }), React.createElement(ProjectNavEdges, {
    prevId: prevId,
    nextId: nextId,
    prevTitle: project.prev,
    nextTitle: project.next,
    onOpenProject: onOpenProject
  }), React.createElement("main", {
    className: "project-gate"
  }, React.createElement("div", {
    className: "project-gate-panel"
  }, React.createElement("p", {
    className: "kp-protected-eyebrow"
  }, "Protected project"), React.createElement("h1", {
    className: "kp-protected-title"
  }, project.title), React.createElement("p", {
    className: "kp-protected-description"
  }, "This project is covered by a confidentiality agreement. Enter the access code to open it."), React.createElement("form", {
    className: "kp-protected-form",
    onSubmit: handleSubmit
  }, React.createElement("label", {
    className: "kp-protected-label",
    htmlFor: "project-access-code"
  }, "Access code"), React.createElement("input", {
    id: "project-access-code",
    ref: inputRef,
    className: "kp-protected-input",
    type: "password",
    autoComplete: "off",
    value: accessCode,
    "aria-invalid": status === 'error',
    "aria-describedby": "project-access-error",
    onChange: e => setAccessCode(e.target.value)
  }), React.createElement("p", {
    className: "kp-protected-error",
    id: "project-access-error",
    role: "status"
  }, message), React.createElement("div", {
    className: "kp-protected-actions"
  }, React.createElement(Button, {
    type: "submit",
    disabled: status === 'checking' || !accessCode
  }, status === 'checking' ? 'Checking…' : 'Unlock'), React.createElement(Button, {
    variant: "outline",
    onClick: onBack
  }, "All projects"))))), React.createElement(Footer, null));
}
function ProjectScreen(props) {
  const base = PROJECT_DATA[props.id] || PROJECT_DATA.volcano;
  const [unlocked, setUnlocked] = React.useState(() => UNLOCKED_PROJECTS.get(base.id) || null);
  React.useEffect(() => {
    setUnlocked(UNLOCKED_PROJECTS.get(base.id) || null);
  }, [base.id]);
  if (base.locked && !unlocked) {
    return React.createElement(ProjectGate, {
      project: base,
      onBack: props.onBack,
      onNav: props.onNav,
      onOpenProject: props.onOpenProject,
      onUnlocked: fiche => {
        UNLOCKED_PROJECTS.set(base.id, fiche);
        setUnlocked(fiche);
      }
    });
  }
  return React.createElement(ProjectScreenContent, Object.assign({}, props, {
    project: unlocked || base
  }));
}
// Adresse d'integration d'une video, et son format. Le vertical se decide a
// l'adresse : un reel Instagram et un Short YouTube ne se cadrent pas comme un
// 16/9, et les etirer les rendrait illisibles.
function videoEmbed(url) {
  if (!url) return null;
  const ig = url.match(/instagram\.com\/(?:reel|p)\/([\w-]+)/);
  if (ig) return {
    src: `https://www.instagram.com/reel/${ig[1]}/embed`,
    poster: window.KP_VIDEO_POSTERS?.[url] ? window.__asset(window.KP_VIDEO_POSTERS[url]) : null,
    vertical: true
  };
  const gdrive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (gdrive) return {
    src: `https://drive.google.com/file/d/${gdrive[1]}/preview`,
    provider: 'drive',
    minHeight: 300,
    vertical: false
  };
  if (url.includes('facebook.com')) return {
    src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&autoplay=1`,
    vertical: false
  };
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]+)/);
  if (yt) return {
    src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1`,
    poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    vertical: url.includes('/shorts/')
  };
  return null;
}
function ProjectScreenContent({
  id = 'volcano',
  project,
  onBack,
  onOpenProject,
  onNav
}) {
  const {
    Navbar,
    Gallery,
    Tag,
    Footer,
    Button
  } = window.KillianPichonDesignSystem_16387b;
  const p = project || PROJECT_DATA[id] || PROJECT_DATA.volcano;
  const prevId = p.prevId || TITLE_TO_ID[p.prev];
  const nextId = p.nextId || TITLE_TO_ID[p.next];
  // Une entree qui ne designe aucun projet ne donne aucun bouton. Filtre en
  // aval, la rubrique s'affichait quand meme, vide sous son intitule.
  // Identifiant ou titre : l'editeur ecrit des identifiants, les fiches ecrites
  // avant lui portent des titres.
  const relatedIds = getRelatedProjectIds(p);
  // Lecteur en place : la tuile de la galerie reste une affiche tant qu'on ne
  // clique pas. Seule la vignette officielle YouTube peut charger avant le clic.
  // Ce composant n'est monte qu'apres deverrouillage des fiches protegees.
  const [playingVideo, setPlayingVideo] = React.useState(null);
  // videoUrls porte plusieurs videos ; trailerUrl reste la forme a une seule
  // video, celle que l'editeur ecrit et que portent les autres fiches.
  const videoEmbeds = p.trailerEmbedDisabled ? [] : (p.videoUrls && p.videoUrls.length ? p.videoUrls : p.trailerUrl ? [p.trailerUrl] : []).map(videoEmbed).filter(Boolean);
  // Essai volontaire sur appareil reel ; aucune incidence sur les URLs normales.
  const stableDriveFrame = videoEmbeds[playingVideo]?.provider === 'drive' && new URLSearchParams(window.location.search).get('drive-fit') === 'stable';
  const [lightbox, setLightbox] = React.useState(null);
  const modalCloseRef = React.useRef(null);
  const headingRef = React.useRef(null);
  const playerRef = React.useRef(null);
  const collageImages = p.galleryImages || [null, null, null, null];
  const galleryImages = collageImages.filter(Boolean);
  const galleryCount = galleryImages.length;
  const lightboxOpen = lightbox !== null;
  const tiles = [...videoEmbeds.map((embed, n) => ({
    video: true,
    embed: embed,
    index: n,
    poster: embed.poster || p.videoPosters?.[n] || (n === 0 ? p.videoPoster : null),
    fallbackPoster: p.videoPosters?.[n] || (n === 0 ? p.videoPoster : null) || p.heroImage || galleryImages[0] || p.thumbImage || null
  })), ...collageImages.map((src, n) => ({
    src,
    animated: p.animatedImages?.includes(src),
    alt: p.galleryAlts?.[n]
  })), ...(p.externalTile && p.externalUrl ? [{
    external: true,
    src: typeof p.externalTile === 'string' ? p.externalTile : null
  }] : []), ...Array.from({
    length: p.placeholderTiles || 0
  }, () => ({
    comingSoon: true
  }))];
  React.useLayoutEffect(() => {
    headingRef.current?.focus({
      preventScroll: true
    });
    window.scrollTo(0, 0);
    setPlayingVideo(null);
  }, [id]);
  React.useLayoutEffect(() => {
    const frame = playerRef.current;
    const iframe = frame?.querySelector('iframe');
    if (!iframe) return;
    const compact = window.matchMedia('(max-width:1024px)');
    const fit = () => {
      if (!stableDriveFrame || !compact.matches) {
        iframe.style.minWidth = iframe.style.maxWidth = '';
        iframe.style.minHeight = iframe.style.maxHeight = '';
      }
      // Sur iOS, fixer le viewport du lecteur a la taille du cadre, sans laisser
      // le document externe agrandir l'iframe. Ne pas recharger ni changer sa source.
      if (compact.matches) {
        const width = frame.clientWidth, height = frame.clientHeight;
        if (!width || !height) return;
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
        iframe.setAttribute('width', String(width));
        iframe.setAttribute('height', String(height));
        if (stableDriveFrame) {
          iframe.style.minWidth = iframe.style.maxWidth = `${width}px`;
          iframe.style.minHeight = iframe.style.maxHeight = `${height}px`;
        }
      } else {
        iframe.style.width = iframe.style.height = '100%';
        iframe.removeAttribute('width');
        iframe.removeAttribute('height');
      }
    };
    fit();
    if (stableDriveFrame) {
      // La navigation commence seulement apres la fixation du viewport. Conserver
      // exactement la meme URL Drive et ne pas recharger pendant une rotation.
      iframe.addEventListener('load', fit);
      iframe.src = videoEmbeds[playingVideo].src;
    }
    const observer = window.ResizeObserver ? new ResizeObserver(fit) : null;
    observer?.observe(frame);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fit);
      iframe.removeEventListener('load', fit);
    };
  }, [playingVideo, id, stableDriveFrame]);
  React.useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);
  React.useEffect(() => {
    function onKey(e) {
      if (document.querySelector('.kp-protected-backdrop')) return;
      if (e.key === 'Escape') {
        if (lightbox !== null) setLightbox(null);else if (playingVideo !== null) setPlayingVideo(null);else onBack();
        return;
      }
      if (lightbox !== null) {
        if (galleryCount > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          const step = e.key === 'ArrowLeft' ? -1 : 1;
          setLightbox(i => (i + step + galleryCount) % galleryCount);
        }
        return;
      }
      if (playingVideo !== null) return;
      if (e.key === 'ArrowLeft' && prevId) onOpenProject(prevId);
      if (e.key === 'ArrowRight' && nextId) onOpenProject(nextId);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevId, nextId, onOpenProject, onBack, playingVideo, lightbox, galleryCount]);
  return React.createElement("div", null, React.createElement(Navbar, {
    activeLink: "Work",
    onLinkClick: onNav
  }), React.createElement(ProjectNavEdges, {
    prevId: prevId,
    nextId: nextId,
    prevTitle: p.prev,
    nextTitle: p.next,
    onOpenProject: onOpenProject
  }), React.createElement("div", {
    className: "project-page-container",
    style: {
      padding: '0 88px'
    }
  }, React.createElement("a", {
    className: "project-back",
    href: screenHref('work'),
    onClick: e => followInternal(e, onBack),
    style: {
      display: 'inline-block',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      cursor: 'pointer'
    }
  }, "\u2039 All Projects"), React.createElement("div", {
    className: "project-hero-grid",
    style: {
      display: 'grid',
      gridTemplateColumns: '340px 1fr',
      gap: 'var(--space-7)',
      marginTop: '24px'
    }
  }, React.createElement("div", {
    className: "project-summary"
  }, React.createElement("h1", {
    ref: headingRef,
    tabIndex: -1,
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-display-md)',
      textTransform: 'uppercase',
      outline: 'none'
    }
  }, p.title), React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      marginTop: '8px'
    }
  }, p.category, React.createElement("br", null), p.year), (p.studio || p.venue) && React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      marginTop: '10px'
    }
  }, p.studio && React.createElement("div", null, p.studio, p.roleTitle ? ` — ${p.roleTitle}` : ''), p.venue && React.createElement("div", null, p.venue)), React.createElement("p", {
    style: {
      fontSize: 'var(--font-size-body)',
      color: 'var(--color-text-body)',
      marginTop: '20px',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, p.desc), React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      marginTop: '24px'
    }
  }, "Role"), React.createElement("div", {
    style: {
      fontSize: 'var(--font-size-body)',
      marginTop: '4px'
    }
  }, p.role), React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      marginTop: '20px'
    }
  }, "Tools"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
      flexWrap: 'wrap'
    }
  }, p.tools.map(t => React.createElement(Tag, {
    key: t
  }, t))), p.trailerEmbedDisabled && p.trailerUrl && React.createElement(Button, {
    variant: "outline",
    size: "sm",
    href: p.trailerUrl,
    icon: React.createElement("span", null, "\u2197"),
    style: {
      marginTop: 'var(--space-6)'
    }
  }, "Watch on YouTube"), p.protectedMedia && React.createElement(ProtectedAccess, {
    resource: p.protectedMedia
  })), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      alignSelf: 'start',
      gap: 'var(--space-3)'
    }
  }, playingVideo !== null && videoEmbeds[playingVideo] && React.createElement("div", {
    ref: playerRef,
    className: "project-video-player",
    "data-drive-fit": stableDriveFrame ? 'stable' : undefined,
    style: {
      // Ajouter les deux pixels de bordure a la hauteur utile du lecteur.
      "--project-player-min-height": `${(videoEmbeds[playingVideo].minHeight || 200) + 2}px`,
      position: 'relative',
      // Le lecteur vit hors de la grille : une source verticale peut donc
      // prendre son format sans etirer les rangees de vignettes.
      aspectRatio: videoEmbeds[playingVideo].vertical ? '9 / 16' : '16 / 9',
      width: videoEmbeds[playingVideo].vertical ? 'min(320px, 100%)' : undefined,
      alignSelf: videoEmbeds[playingVideo].vertical ? 'center' : undefined,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--line-subtle)',
      overflow: 'hidden',
      background: 'var(--void-900)'
    }
  }, React.createElement("iframe", {
    src: stableDriveFrame ? undefined : videoEmbeds[playingVideo].src,
    scrolling: stableDriveFrame ? 'no' : undefined,
    title: window.KP_I18N.t.f('{title} video', {
      title: p.videoTitles?.[playingVideo] || p.title
    }),
    allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
    allowFullScreen: true,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      border: 'none'
    }
  })), React.createElement("div", {
    className: "project-media-grid",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, max(180px, calc((100% - 2 * var(--space-3)) / 3))), 1fr))',
      gap: 'var(--space-3)'
    }
  }, tiles.map((t, i) => React.createElement(t.external ? "a" : "button", {
    className: "project-media-tile",
    "data-animated-image": t.animated ? "true" : undefined,
    "aria-pressed": t.video ? playingVideo === t.index : undefined,
    type: t.external ? undefined : "button",
    disabled: t.external ? undefined : !t.video && !t.src,
    // Une tuile qui quitte le site est un lien, pas un bouton : le clic du
    // milieu, l'ouverture dans un onglet et le menu contextuel doivent marcher.
    href: t.external ? p.externalUrl : undefined,
    target: t.external ? "_blank" : undefined,
    rel: t.external ? "noopener noreferrer" : undefined,
    "aria-label": t.external ? p.externalLabel || p.studio : t.video ? window.KP_I18N.t.f('Play {title} video', {
      title: p.videoTitles?.[t.index] || p.title
    }) : t.src ? window.KP_I18N.t.f('Open {title} image {n}', {
      title: p.title,
      n: t.alt ? galleryImages.indexOf(t.src) + 1 : i + 1
    }) + (t.alt ? ` — ${t.alt}` : '') : undefined,
    key: i,
    onClick: t.external ? undefined : () => {
      if (t.video) setPlayingVideo(playingVideo === t.index ? null : t.index);else if (t.src) setLightbox(galleryImages.indexOf(t.src));
    },
    style: {
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--line-subtle)',
      overflow: 'hidden',
      position: 'relative',
      cursor: t.video || t.src || t.external ? 'pointer' : 'default',
      textDecoration: t.external ? 'none' : undefined,
      background: t.src ? `url(${t.src}) center/cover` : t.video ? t.fallbackPoster ? `url(${t.fallbackPoster}) center/cover` : 'linear-gradient(150deg,#2a2723,#151417 40%,#3a1c10)' : 'linear-gradient(150deg,rgba(28,29,34,.55),rgba(17,17,20,.4) 55%,rgba(36,22,16,.35))',
      transition: 'box-shadow var(--duration-base) var(--ease-out)'
    }
  }, t.src && !t.video && !t.external && !window.KP_PROJECTS[p.id]?.protected && React.createElement("img", {
    src: t.src,
    alt: t.alt ? `${p.title} — ${t.alt}` : p.title,
    loading: "lazy",
    decoding: "async",
    style: {position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'}
  }), t.video && t.poster && React.createElement("img", {
    key: t.poster,
    className: "project-video-poster",
    src: t.poster,
    alt: "",
    width: 480,
    height: 360,
    loading: "lazy",
    referrerPolicy: "no-referrer",
    onError: e => { e.currentTarget.hidden = true; }
  }), t.video && React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement("span", {
    className: "project-video-play",
    "aria-hidden": true
  }, "\u25B6")), t.external && React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: t.src ? 'flex-end' : 'center',
      justifyContent: t.src ? 'flex-end' : 'center',
      gap: '6px',
      padding: '10px',
      textAlign: 'center'
    }
    // Sur un visuel, le libelle est porte par l'image elle-meme : n'en
    // rajouter qu'une fleche, sinon deux titres se superposent. Le lien reste
    // annonce aux lecteurs d'ecran par son aria-label.
  }, !t.src && React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-heading)'
    }
  }, p.externalLabel || p.studio), React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: t.src ? '26px' : undefined,
      height: t.src ? '26px' : undefined,
      borderRadius: t.src ? '50%' : undefined,
      background: t.src ? 'rgba(10,10,11,.62)' : undefined,
      border: t.src ? '1px solid var(--line-strong)' : undefined,
      fontSize: '14px',
      color: 'var(--accent)'
    }
  }, "\u2197")), t.comingSoon && React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-faint)'
    }
  }, "Coming Soon"))))))), React.createElement("div", {
    className: "project-details-grid",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 'var(--space-6)',
      marginTop: 'var(--space-9)',
      borderTop: '1px solid var(--line-subtle)',
      paddingTop: 'var(--space-6)'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Overview"), React.createElement("p", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      marginTop: '10px',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, p.overview)), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "My Contribution"), React.createElement("ul", {
    style: {
      margin: '10px 0 0',
      paddingLeft: '18px',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, p.contribution.map(c => React.createElement("li", {
    key: c
  }, c))), p.contributionNote && React.createElement("p", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-faint)',
      marginTop: '10px',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, p.contributionNote)), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Pipeline"), React.createElement("ul", {
    style: {
      margin: '10px 0 0',
      paddingLeft: '18px',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, p.pipeline.map(c => React.createElement("li", {
    key: c
  }, c))))), p.technicalChallenges && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Technical Challenges"), React.createElement("ul", {
    style: {
      margin: '10px 0 0',
      paddingLeft: '18px',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)',
      maxWidth: '720px'
    }
  }, p.technicalChallenges.map(c => React.createElement("li", {
    key: c
  }, c)))), p.designIntent && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Design Intent"), React.createElement("p", {
    style: {
      margin: '10px 0 0',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)',
      maxWidth: '720px'
    }
  }, p.designIntent)), p.rnd && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Research & Development"), React.createElement("ul", {
    style: {
      margin: '10px 0 0',
      paddingLeft: '18px',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)',
      maxWidth: '720px'
    }
  }, p.rnd.map(c => React.createElement("li", {
    key: c
  }, c)))), p.recognition && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Recognition"), React.createElement("ul", {
    style: {
      margin: '10px 0 0',
      paddingLeft: '18px',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)',
      maxWidth: '720px'
    }
  }, p.recognition.map(c => React.createElement("li", {
    key: c
  }, c)))), p.impact && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Project Impact"), React.createElement("p", {
    style: {
      margin: '10px 0 0',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      lineHeight: 'var(--leading-relaxed)',
      maxWidth: '720px'
    }
  }, p.impact)), (p.creditsNote || p.externalUrl) && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)',
      paddingTop: 'var(--space-6)',
      borderTop: '1px solid var(--line-subtle)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Project Credits"), p.creditsNote && React.createElement("p", {
    style: {
      margin: '10px 0 0',
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)'
    }
  }, p.creditsNote), p.externalUrl && React.createElement("a", {
    href: p.externalUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      marginTop: '10px',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.color = 'var(--accent-hover)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.color = 'var(--text-muted)';
    }
  }, p.externalLabel || 'See more', " \u2197")), relatedIds.length > 0 && React.createElement("div", {
    style: {
      marginTop: 'var(--space-7)',
      paddingTop: 'var(--space-6)',
      borderTop: '1px solid var(--line-subtle)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)',
      marginBottom: '14px'
    }
  }, "Related Projects"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap'
    }
  }, relatedIds.map(relatedId => React.createElement("a", {
    className: "related-project-button",
    href: projectHref(relatedId),
    key: relatedId,
    onClick: e => followInternal(e, () => onOpenProject(relatedId)),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid var(--line-default)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-heading)',
      cursor: 'pointer'
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--line-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, (PROJECT_DATA[relatedId] || {}).title || relatedId))))), lightbox !== null && React.createElement("div", {
    className: "modal-backdrop",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": window.KP_I18N.t.f('{title} image preview', {
      title: p.title
    }),
    onClick: () => setLightbox(null),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'rgba(10,10,11,.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      cursor: 'zoom-out'
    }
  }, React.createElement("button", {
    ref: modalCloseRef,
    onClick: () => setLightbox(null),
    "aria-label": "Close",
    style: {
      position: 'absolute',
      top: '24px',
      right: '32px',
      background: 'none',
      border: 'none',
      color: 'var(--text-heading)',
      fontSize: '28px',
      lineHeight: 1,
      cursor: 'pointer'
    }
  }, "\xD7"), galleryCount > 1 && [-1, 1].map(dir => React.createElement("button", {
    key: dir,
    type: "button",
    "aria-label": dir < 0 ? 'Previous image' : 'Next image',
    onClick: e => {
      e.stopPropagation();
      setLightbox(i => (i + dir + galleryCount) % galleryCount);
    },
    style: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      [dir < 0 ? 'left' : 'right']: '20px',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: '1px solid var(--line-default)',
      background: 'rgba(19,19,22,.7)',
      backdropFilter: 'blur(8px)',
      color: 'var(--text-heading)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      zIndex: 1,
      transition: 'border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--line-default)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: dir < 0 ? {
      transform: 'rotate(180deg)'
    } : undefined
  }, React.createElement("path", {
    d: "M8 4l8 8-8 8"
  })))), React.createElement("img", {
    src: galleryImages[lightbox],
    alt: p.galleryAlts?.[collageImages.indexOf(galleryImages[lightbox])] || window.KP_I18N.t.f('{title} project image {n} of {total}', {
      title: p.title,
      n: lightbox + 1,
      total: galleryCount
    }),
    style: {
      maxWidth: '90vw',
      maxHeight: '90vh',
      borderRadius: 'var(--radius-md)',
      objectFit: 'contain'
    }
  }), galleryCount > 1 && React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, `${lightbox + 1} / ${galleryCount}`)), React.createElement(Footer, null));
}
window.ProjectScreen = ProjectScreen;
// Deux fichiers : le CV telecharge suit la langue affichee, comme les badges
// de prix. La langue est fixee au chargement, donc une seule lecture suffit.
const CV_PDF_EN = 'https://drive.google.com/file/d/1PTHsGhPivU5w3pQKRpSCrGZCv-uND0l5/view?usp=sharing';
const CV_PDF_FR = 'https://drive.google.com/file/d/1wWxFd2IbL0sQ_LPO9_Ule0_SRgu6mWgV/view?usp=sharing';
const CV_PDF = window.KP_I18N.lang === 'fr' ? CV_PDF_FR : CV_PDF_EN;
const CORE_EXPERTISE = ['3D Asset Production', 'Unreal Engine Integration', 'Real-Time Optimization', 'Technical Art', 'Production Workflow Design', 'Immersive Experience Production', 'Realtime Rendering', 'Camera & Motion', 'Fulldome Compositing', 'Projection Mapping Design', 'Cross-disciplinary Collaboration', 'R&D & Previsualization', 'Visual Storytelling'];
const SPECIALIZATIONS = ['Fulldome Cinema', 'Immersive Experiences', 'Projection Mapping', 'Virtual Production', 'Realtime Visual Systems', 'Immersive Storytelling', 'Electronic Music & AV Performance'];
const LANGUAGES = ['French (native)', 'English (professional)', 'German (elementary)'];
const TOOLKIT = {
  'Realtime & Game Engines': ['Unreal Engine 5', 'Unity (basic)', 'TouchDesigner', 'Notch'],
  '3D & Look Development': ['Cinema 4D', 'Blender', '3ds Max', 'Maya', 'Substance 3D Painter', 'Substance Designer', 'SpeedTree', 'Embergen'],
  'Compositing & Motion': ['After Effects', 'DaVinci Resolve', 'Photoshop', 'Illustrator', 'Adobe Creative Cloud'],
  'Technical': ['Blueprints', 'Builds', 'Perforce', 'Git', 'Diversion', 'Custom Shaders', 'Unreal Media Player', '']
};
const EXPERIENCE = [{
  period: '2024 — Present',
  start: 2024,
  end: null,
  role: 'Co-founder / Realtime Artist',
  org: 'Fantastik Obsolete — Montréal, QC',
  desc: "Co-founded an independent collective for immersive cinema and real-time storytelling with Pascal Lavallé and Nicolas Lachance-Brais. I set up the structure we use to coordinate scenes, shared assets and technical decisions, and I take part in the artistic and technical choices and in following projects from early studies through fulldome delivery. We work as peers, each of us driving where availability and experience allow, and creative choices stay connected to how an audience experiences the work inside the dome.",
  productions: ["Traveler's Introspection — Public Award, SATFest 2026. Winner: Innovation Award, Full Dome, PFCAT 2026. Official Nominee: Innovation Award, Animation, PFCAT 2026. Official Selection: Dome Under Film Festival, Macon Film Festival, FDUK."]
}, {
  period: '2023 — Present',
  start: 2023,
  end: null,
  role: 'Realtime 3D Generalist / Motion Designer',
  org: 'Freelance — Montréal, QC',
  desc: 'Develop immersive visuals, cinematic environments and interactive content for entertainment, cultural and live-event productions. The work combines image-making with practical production decisions: clarifying handoffs, protecting iteration time and adapting content to the display system where it will be experienced.',
  productions: ['Clients & Projects: Melanie Martinez Tour (Normal Studio), Lac Batiscan (XYZ Technologies), Lumin-Art, Transversal.', 'Van Gogh and King Tut exhibitions — Freelance After Effects reformat passes on existing exhibition content for Normal Studio, before I joined the studio.']
}, {
  period: '2025 — Present',
  start: 2025,
  end: null,
  role: 'Realtime 3D Generalist / Motion Designer',
  org: 'Normal Studio — Montréal, QC',
  desc: 'Contribute to immersive installations, traveling shows and fulldome productions alongside artists, designers and developers. My work focuses on animation systems, projection-scale look development, compositing handoffs and preview studies that help teams review spatial content earlier in production. I track my own time and tasks in Monday.com and Timely, which keeps the production floor informed of where each piece stands.',
  productions: ['Celestia — Developed scalable flock animation, a projection-readable visual treatment and separated compositing passes; also delivered a first working VR review application so artists, production and the client could test the scenes before installation.', 'Hurtubise — Built reusable neon-animation systems and synchronized layered artwork with music for a fulldome presentation.', 'Volcano — Winner, Prix NUMIX 2026 (International · Exhibition). Structured the cleaning, repair and integration of 16K geological textures for a large-format immersive environment.', 'Unannounced project — a projected interactive game controlled from a mobile interface. I produced the animated assets, including sprite-atlas generation, and created the environments. Details to follow once the project is announced.']
}, {
  period: '2018 — 2022',
  start: 2018,
  end: 2022,
  role: '3D Generalist / Motion Designer',
  org: 'Graphics eMotion — Montréal, QC',
  desc: 'Contributed to projection mapping, museum installations and live-event productions for international clients, inside a small and autonomous team. The work required adapting animation, compositing and visual effects to architectural surfaces, public viewing distances and the shared delivery needs of multidisciplinary teams — and planning it: I used Gantter and shared spreadsheets to break the stages down, follow projects and connect artistic deliverables to production needs. I also ran the projector simulations and coverage calculations that went into tender submissions and project files.',
  productions: ['Sangue e Arena — Permanent projection mapping experience, Colosseum, Rome.', 'IHF World Handball Championship Opening Ceremony — Large-scale live event visuals, Cairo.', 'Le Banquet — Immersive multi-sensory projection mapping experience, Cité des Sciences, Paris.', 'Habits de Lumière – 1858 — Architectural projection mapping, Épernay.', 'Le Livre de la Chasse — Museum installation at the château de Foix, 2019. Projection plans, modeling, equipment placement and projection simulation, plus the camera rig and the boar animation.', 'Art Explora — Projection simulation prepared for a bid submission, not the content itself.']
}];
const EDUCATION = [{
  period: '2023',
  title: 'Unreal Engine Intensive Program',
  org: 'NAD-UQAC — Montréal, QC',
  desc: 'Intensive specialization in Unreal Engine covering modern CG pipelines, virtual production, procedural world building and collaborative workflows.'
}, {
  period: '2013 — 2016',
  title: "Bachelor's Degree in Real-Time 3D",
  org: 'Laval 3Di — Laval, France',
  desc: 'Real-time 3D production for interactive media and video games — 3D content creation, game engine integration, optimization, modeling, animation, level design and visual scripting.'
}, {
  period: '2010 — 2013',
  title: 'Baccalauréat in Applied Arts',
  org: 'Lycée Joseph Savina — Tréguier, France',
  desc: 'Multidisciplinary art and design curriculum — composition, drawing, color theory and design thinking.'
}];
function AboutSection({
  title,
  children
}) {
  return React.createElement("div", {
    style: {
      marginTop: 'var(--space-8)',
      paddingTop: 'var(--space-6)',
      borderTop: '1px solid var(--line-subtle)'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-widest)',
      marginBottom: 'var(--space-5)'
    }
  }, title), children);
}
function computeExperienceLanes(items) {
  // Sans bornes explicites, on retombe sur le rail unique d'origine.
  if (items.some(it => typeof it.start !== 'number')) {
    return {
      laneOf: items.map(() => 0),
      tracks: []
    };
  }
  const endOf = it => it.end == null ? Infinity : it.end;
  const overlap = (a, b) => a.start <= endOf(b) && b.start <= endOf(a);
  // Placement glouton : chaque poste prend la voie libre la plus a gauche.
  const laneOf = [];
  items.forEach((it, i) => {
    let lane = 0;
    while (laneOf.some((l, j) => l === lane && overlap(items[j], it))) lane++;
    laneOf[i] = lane;
  });
  const laneCount = laneOf.reduce((m, l) => Math.max(m, l + 1), 1);
  // Etendue verticale de chaque branche. La voie 0 est le rail principal,
  // deja rendu au niveau du conteneur.
  const tracks = [];
  for (let lane = 1; lane < laneCount; lane++) {
    const owner = laneOf.indexOf(lane);
    if (owner < 0) continue;
    const it = items[owner];
    let to = owner;
    items.forEach((other, j) => {
      if (j > to && overlap(other, it)) to = j;
    });
    tracks.push({
      lane: lane,
      // Un poste en cours remonte jusqu'au haut de la carte : il touche
      // le present. Un poste termine demarre a sa propre rangee.
      from: it.end == null ? 0 : owner,
      to: to,
      ongoing: it.end == null
    });
  }
  return {
    laneOf: laneOf,
    tracks: tracks
  };
}
function experienceLaneLeft(lane) {
  return 'calc(var(--exp-lane-0) + ' + lane + ' * var(--exp-lane-gap))';
}
function ExperienceTimeline({
  items
}) {
  const wrapRef = React.useRef(null);
  const fillRef = React.useRef(null);
  const rowRefs = React.useRef([]);
  const dotRefs = React.useRef([]);
  const yearRefs = React.useRef([]);
  const [revealed, setRevealed] = React.useState(() => items.map(() => false));
  const [armed, setArmed] = React.useState(false);
  const staticRef = React.useRef(false);
  const layout = React.useMemo(() => computeExperienceLanes(items), [items]);
  React.useEffect(() => {
    staticRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (staticRef.current) {
      if (fillRef.current) fillRef.current.style.height = '100%';
      setRevealed(items.map(() => true));
      return;
    }
    let raf = 0;
    function update() {
      raf = 0;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      const head = vh * 0.55;
      const progress = Math.max(0, Math.min(1, (head - rect.top) / Math.max(1, rect.height)));
      if (fillRef.current) fillRef.current.style.height = (progress * 100).toFixed(2) + '%';
      const headAbsolute = rect.top + progress * rect.height;
      for (let i = 0; i < rowRefs.current.length; i++) {
        const row = rowRefs.current[i];
        if (!row) continue;
        const rowRect = row.getBoundingClientRect();
        const dot = dotRefs.current[i];
        if (dot) {
          const reached = rowRect.top + 14 <= headAbsolute;
          dot.style.background = reached ? 'var(--accent)' : 'var(--void-900)';
          dot.style.borderColor = reached ? 'var(--accent)' : 'var(--line-strong)';
          dot.style.boxShadow = reached ? '0 0 12px var(--accent-glow)' : 'none';
        }
        const year = yearRefs.current[i];
        if (year) {
          const offset = (rowRect.top + rowRect.height / 2 - vh / 2) / vh;
          year.style.transform = 'translateY(' + Math.max(-1, Math.min(1, offset)) * 20 + 'px)';
        }
      }
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);
  React.useEffect(() => {
    if (staticRef.current) return;
    if (typeof IntersectionObserver !== 'function') return;
    setArmed(true);
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const index = Number(entry.target.dataset.index);
        setRevealed(prev => {
          if (prev[index]) return prev;
          const next = prev.slice();
          next[index] = true;
          return next;
        });
        io.unobserve(entry.target);
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px'
    });
    rowRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [items]);
  const railFade = 'linear-gradient(180deg, transparent 0, #000 72px, #000 calc(100% - 72px), transparent 100%)';
  const branchFade = 'linear-gradient(180deg, transparent 0, #000 72px)';
  const branchStartFade = 'linear-gradient(180deg, transparent 0, #000 28px)';
  return React.createElement("div", {
    className: "exp-timeline",
    ref: wrapRef,
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      '--exp-lane-0': '14px',
      '--exp-lane-gap': '16px'
    }
  }, React.createElement("div", {
    className: "exp-rail",
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: '134px',
      width: '1px',
      background: 'var(--line-subtle)',
      WebkitMaskImage: railFade,
      maskImage: railFade
    }
  }, React.createElement("div", {
    ref: fillRef,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '0%',
      background: 'linear-gradient(180deg, var(--accent-dim) 0%, var(--accent) 100%)',
      boxShadow: '0 0 10px var(--accent-glow)'
    }
  })), items.map((e, i) => React.createElement("div", {
    key: e.role + e.period,
    className: "exp-row",
    ref: el => rowRefs.current[i] = el,
    "data-index": i,
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '120px 56px 1fr',
      alignItems: 'start'
    }
  }, React.createElement("div", {
    className: "exp-year",
    ref: el => yearRefs.current[i] = el,
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-faint)',
      willChange: 'transform',
      opacity: !armed || revealed[i] ? 1 : 0,
      transition: 'opacity 700ms var(--ease-out)'
    }
  }, e.period), React.createElement("div", {
    className: "exp-dot-cell",
    "aria-hidden": "true",
    style: {
      position: 'relative',
      alignSelf: 'stretch'
    }
  }, layout.tracks.filter(t => i >= t.from && i <= t.to).map(t => {
    const isTop = i === t.from;
    const isBottom = i === t.to;
    const parts = [React.createElement("div", {
      key: "seg",
      style: {
        position: 'absolute',
        top: 0,
        bottom: isBottom ? 'calc(' + t.lane + ' * var(--exp-lane-gap))' : 0,
        left: experienceLaneLeft(t.lane),
        width: '1px',
        background: 'var(--line-default)',
        WebkitMaskImage: isTop ? t.ongoing ? branchFade : branchStartFade : 'none',
        maskImage: isTop ? t.ongoing ? branchFade : branchStartFade : 'none'
      }
    })];
    // Raccordement a 45 degres vers la voie de gauche.
    if (isBottom) parts.push(React.createElement("div", {
      key: "merge",
      style: {
        position: 'absolute',
        bottom: 'calc(' + t.lane + ' * var(--exp-lane-gap))',
        left: experienceLaneLeft(t.lane),
        width: 'calc(var(--exp-lane-gap) * 1.4143)',
        height: '1px',
        background: 'var(--line-default)',
        transformOrigin: '0 50%',
        transform: 'rotate(135deg)'
      }
    }));
    return React.createElement(React.Fragment, {
      key: t.lane
    }, parts);
  }), React.createElement("div", {
    ref: el => dotRefs.current[i] = el,
    style: {
      position: 'absolute',
      top: '9px',
      left: experienceLaneLeft(layout.laneOf[i]),
      transform: 'translateX(-50%)',
      width: '9px',
      height: '9px',
      borderRadius: '50%',
      border: '1px solid var(--line-strong)',
      background: 'var(--void-900)',
      transition: 'background 300ms var(--ease-out), border-color 300ms var(--ease-out), box-shadow 300ms var(--ease-out)'
    }
  })), React.createElement("div", {
    className: "exp-body",
    style: {
      paddingBottom: i === items.length - 1 ? 0 : 'var(--space-7)',
      opacity: !armed || revealed[i] ? 1 : 0,
      transform: !armed || revealed[i] ? 'none' : 'translateY(24px)',
      transition: 'opacity 700ms var(--ease-out), transform 700ms var(--ease-out)',
      transitionDelay: revealed[i] ? i % 2 === 0 ? '0ms' : '60ms' : '0ms'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-h3)',
      color: 'var(--text-heading)'
    }
  }, e.role), React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      marginTop: '2px'
    }
  }, e.org), React.createElement("p", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      marginTop: '10px',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, e.desc), e.productions.length > 0 && React.createElement("ul", {
    style: {
      margin: '10px 0 0',
      paddingLeft: '18px',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, e.productions.map(p => React.createElement("li", {
    key: p
  }, p)))))));
}
function AboutAvatar() {
  const stage = React.useRef(null);
  const viewer = React.useRef(null);
  const [state, setState] = React.useState({ ready: false, paused: false, reduced: false });
  React.useEffect(() => {
    const controller = new AbortController();
    let observer;
    const start = async () => {
      observer?.disconnect();
      try {
        const module = await import(new URL(window.__asset('assets/avatar-viewer.js?v=20261031-native'), document.baseURI).href);
        if (controller.signal.aborted) return;
        viewer.current = await module.mountAvatar(stage.current, {
          modelURL: window.__asset('assets/profile/killian-native-metahuman.glb?v=20261031-native-fit'),
          signal: controller.signal,
          onState: next => { if (!controller.signal.aborted) setState(next); }
        });
        if (!viewer.current && !controller.signal.aborted && stage.current) stage.current.dataset.avatarState = 'fallback';
      } catch {
        // A static portrait remains readable if loading or WebGL is unavailable.
        if (!controller.signal.aborted && stage.current) stage.current.dataset.avatarState = 'fallback';
      }
    };
    if (window.IntersectionObserver) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) start();
      }, { rootMargin: '180px' });
      observer.observe(stage.current);
    } else start();
    return () => { observer?.disconnect(); controller.abort(); viewer.current = null; };
  }, []);
  return React.createElement('figure', { className: 'about-profile-figure', 'data-animated-image': 'true' },
    React.createElement('div', { ref: stage, className: 'about-profile-image about-avatar-stage', role: 'img', 'aria-label': 'MetaHuman of Killian Pichon with recreated clothes and glasses.', 'aria-describedby': 'about-avatar-hint' },
      React.createElement('img', {
        src: window.__asset('assets/profile/killian-native-metahuman-web-poster.webp?v=20261031-web-poster'),
        alt: 'MetaHuman of Killian Pichon with recreated clothes and glasses.', width: 720, height: 960, decoding: 'async', loading: 'lazy'
      })),
    React.createElement('figcaption', { className: 'about-profile-caption about-avatar-caption' },
      React.createElement('span', null, 'My digital double'),
      state.ready && !state.reduced && React.createElement('button', {
        type: 'button', onClick: () => viewer.current?.togglePaused(),
        'aria-pressed': state.paused
      }, state.paused ? 'Resume avatar' : 'Pause avatar')),
    React.createElement('span', { id: 'about-avatar-hint', className: 'about-avatar-hint' },
      'Walking in place. The head follows your mouse, then looks ahead at rest. On a phone, use the tilt controls to enable motion.'));
}
function AboutScreen({
  onNav
}) {
  const {
    Navbar,
    Tag,
    Button,
    Footer
  } = window.KillianPichonDesignSystem_16387b;
  return React.createElement("div", null, React.createElement(Navbar, {
    activeLink: "About",
    onLinkClick: onNav
  }), React.createElement("section", {
    style: {
      padding: '64px var(--container-pad) 0'
    }
  }, React.createElement("div", {
    className: "about-intro"
  }, React.createElement("div", {
    className: "about-intro-copy"
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "About"), React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-display-lg)',
      marginTop: '12px',
      textTransform: 'uppercase'
    }
  }, "Immersive Experiences"), React.createElement("p", {
    style: {
      fontSize: 'var(--color-text-body-lg)',
      color: 'var(--color-text-body)',
      marginTop: '20px',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, "I build 3D assets and environments for real-time productions and follow them through to engine integration: modeling, sculpting, texturing, optimization and scene assembly in Unreal. The work moves across disciplines — interactive scenography, pre-rendered film, and interactive tools built inside the engine — where the image often has to hold at architectural scale. Based in Montréal, I shape both the visuals and the workflow that carries them, and I look for the answer inside the constraints a production sets as readily as outside them when the usual path doesn't hold.")), React.createElement(AboutAvatar))), React.createElement("section", {
    style: {
      padding: '0 var(--container-pad) 96px'
    }
  }, React.createElement(AboutSection, {
    title: "Core Expertise"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, CORE_EXPERTISE.map(t => React.createElement(Tag, {
    key: t
  }, t)))), React.createElement(AboutSection, {
    title: "Specializations"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, SPECIALIZATIONS.map(t => React.createElement(Tag, {
    key: t,
    tone: "accent"
  }, t)))), React.createElement(AboutSection, {
    title: "Work Experience"
  }, React.createElement(ExperienceTimeline, {
    items: EXPERIENCE
  })), React.createElement(AboutSection, {
    title: "Education"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, EDUCATION.map(e => React.createElement("div", {
    key: e.title,
    style: {
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: 'var(--space-5)'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-faint)'
    }
  }, e.period), React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-h3)',
      color: 'var(--text-heading)'
    }
  }, e.title), React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      marginTop: '2px'
    }
  }, e.org), React.createElement("p", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--color-text-body)',
      marginTop: '8px',
      lineHeight: 'var(--leading-relaxed)'
    }
  }, e.desc)))))), React.createElement(AboutSection, {
    title: "Technical Toolkit"
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 'var(--space-6)'
    }
  }, Object.entries(TOOLKIT).map(([group, tools]) => React.createElement("div", {
    key: group
  }, React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-heading)',
      fontWeight: 'var(--weight-medium)',
      marginBottom: '10px'
    }
  }, group), React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, tools.map(t => React.createElement(Tag, {
    key: t
  }, t))))))), React.createElement("div", {
    style: {
      marginTop: 'var(--space-8)',
      paddingTop: 'var(--space-6)',
      borderTop: '1px solid var(--line-subtle)'
    }
  }, React.createElement(Button, {
    variant: "primary",
    href: CV_PDF
  }, "Download CV"))), React.createElement(Footer, null));
}
window.AboutScreen = AboutScreen;
function TechnicalScreen({ onNav }) {
  const library = window.KPTechnicalLibrary;
  const language = window.KP_I18N.lang;
  const catalogue = window.KP_TECHNICAL[language];
  const { Navbar, Footer } = window.KillianPichonDesignSystem_16387b;
  return React.createElement("div", null,
    React.createElement(Navbar, { activeLink: "Technical", onLinkClick: onNav }),
    React.createElement("main", {
      className: "tool-main",
      dangerouslySetInnerHTML: {
        __html: library.intro(catalogue) + library.catalogue(catalogue, language, library.route(language))
      }
    }),
    React.createElement(Footer, null));
}
window.TechnicalScreen = TechnicalScreen;
const SUBJECTS = ['General Inquiry', 'Hiring Opportunity', 'Studio Collaboration Proposal'];
const RATE_LIMIT_MS = 30000;
const MIN_FILL_MS = 2500;
const FORM_ENDPOINT = 'https://formspree.io/f/xvzejlry';
function Field({
  label,
  htmlFor,
  children
}) {
  return React.createElement("div", {
    style: {
      marginBottom: 'var(--space-6)'
    }
  }, React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      display: 'block',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-widest)',
      marginBottom: '10px'
    }
  }, label), children);
}
function ContactScreen({
  onNav
}) {
  const {
    Navbar,
    Footer,
    Button
  } = window.KillianPichonDesignSystem_16387b;
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
    hpConfirm: ''
  });
  const [status, setStatus] = React.useState('idle');
  const mountedAt = React.useRef(Date.now());
  const lastSentRef = React.useRef(0);
  const [cooldownLeft, setCooldownLeft] = React.useState(0);
  React.useEffect(() => {
    if (status !== 'cooldown') return;
    const iv = setInterval(() => {
      const left = Math.max(0, RATE_LIMIT_MS - (Date.now() - lastSentRef.current));
      setCooldownLeft(Math.ceil(left / 1000));
      if (left <= 0) {
        setStatus('idle');
        clearInterval(iv);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [status]);
  const inputStyle = {
    width: '100%',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--line-default)',
    padding: '10px 0',
    color: 'var(--text-heading)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--color-text-body-lg)',
    outline: 'none',
    transition: 'border-color var(--duration-base) var(--ease-out)'
  };
  function handleFocus(e) {
    e.target.style.borderColor = 'var(--accent)';
  }
  function handleBlur(e) {
    e.target.style.borderColor = 'var(--line-default)';
  }
  function sanitize(str, max) {
    return str.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (status === 'blocked') {
      setStatus('idle');
      return;
    }
    if (status === 'cooldown' || status === 'sending') return;
    if (form.hpConfirm) {
      setStatus('blocked');
      return;
    }
    if (Date.now() - mountedAt.current < MIN_FILL_MS) {
      setStatus('blocked');
      return;
    }
    const name = sanitize(form.name, 100);
    const email = sanitize(form.email, 254);
    const message = sanitize(form.message, 2000);
    setStatus('sending');
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        subject: form.subject,
        message
      })
    }).then(res => {
      if (res.ok) {
        lastSentRef.current = Date.now();
        setStatus('cooldown');
        setCooldownLeft(Math.ceil(RATE_LIMIT_MS / 1000));
      } else {
        setStatus('failed');
      }
    }).catch(() => setStatus('failed'));
  }
  const buttonLabel = status === 'sending' ? 'Sending…' : status === 'cooldown' ? window.KP_I18N.t.f('Sent — Resend in {n}s', {
    n: cooldownLeft
  }) : status === 'blocked' ? 'Try Again' : status === 'failed' ? 'Failed — Try Again' : 'Send Message';
  return React.createElement("div", null, React.createElement(Navbar, {
    activeLink: "Contact",
    onLinkClick: onNav
  }), React.createElement("section", {
    className: "contact-layout",
    style: {
      padding: '64px var(--container-pad) 120px',
      display: 'grid',
      gridTemplateColumns: '1fr 1.2fr',
      gap: 'var(--space-9)'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, "Contact"), React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 'var(--text-display-lg)',
      textTransform: 'uppercase',
      marginTop: '12px'
    }
  }, "Get In Touch"), React.createElement("p", {
    style: {
      fontSize: 'var(--color-text-body-lg)',
      color: 'var(--color-text-body)',
      marginTop: '20px',
      lineHeight: 'var(--leading-relaxed)',
      maxWidth: '380px'
    }
  }, "Reach out for general questions, hiring opportunities, or a studio collaboration proposal using the form \u2014 no other contact details are published on this site."), React.createElement("a", {
    href: "https://www.linkedin.com/in/killian-pichon-79b84b118",
    target: "_blank",
    rel: "me noopener noreferrer",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: 'var(--space-6)',
      fontSize: 'var(--text-small)',
      color: 'var(--text-muted)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.color = 'var(--accent-hover)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.color = 'var(--text-muted)';
    }
  }, "LinkedIn \u2197")), React.createElement("form", {
    className: "contact-form",
    onSubmit: handleSubmit,
    style: {
      maxWidth: '520px'
    }
  }, React.createElement("input", {
    type: "text",
    name: "hpConfirm",
    value: form.hpConfirm,
    onChange: e => setForm({
      ...form,
      hpConfirm: e.target.value
    }),
    tabIndex: -1,
    autoComplete: "off",
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      opacity: 0,
      pointerEvents: 'none',
      left: '-9999px'
    }
  }), React.createElement("div", {
    className: "contact-name-email",
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-5)'
    }
  }, React.createElement(Field, {
    label: "Name",
    htmlFor: "contact-name"
  }, React.createElement("input", {
    id: "contact-name",
    name: "name",
    required: true,
    type: "text",
    maxLength: 100,
    autoComplete: "name",
    value: form.name,
    onChange: e => setForm({
      ...form,
      name: e.target.value
    }),
    onFocus: handleFocus,
    onBlur: handleBlur,
    style: inputStyle,
    placeholder: "Your name"
  })), React.createElement(Field, {
    label: "Email",
    htmlFor: "contact-email"
  }, React.createElement("input", {
    id: "contact-email",
    name: "email",
    required: true,
    type: "email",
    maxLength: 254,
    autoComplete: "email",
    value: form.email,
    onChange: e => setForm({
      ...form,
      email: e.target.value
    }),
    onFocus: handleFocus,
    onBlur: handleBlur,
    style: inputStyle,
    placeholder: "you@studio.com"
  }))), React.createElement(Field, {
    label: "Subject",
    htmlFor: "contact-subject"
  }, React.createElement("select", {
    id: "contact-subject",
    name: "subject",
    value: form.subject,
    onChange: e => setForm({
      ...form,
      subject: e.target.value
    }),
    onFocus: handleFocus,
    onBlur: handleBlur,
    style: {
      ...inputStyle,
      cursor: 'pointer'
    }
  }, SUBJECTS.map(s => React.createElement("option", {
    key: s,
    value: s,
    style: {
      background: 'var(--void-900)',
      color: 'var(--text-heading)'
    }
  }, s)))), React.createElement(Field, {
    label: "Message",
    htmlFor: "contact-message"
  }, React.createElement("textarea", {
    id: "contact-message",
    name: "message",
    required: true,
    rows: 5,
    maxLength: 2000,
    value: form.message,
    onChange: e => setForm({
      ...form,
      message: e.target.value
    }),
    onFocus: handleFocus,
    onBlur: handleBlur,
    style: {
      ...inputStyle,
      resize: 'vertical',
      fontFamily: 'var(--font-body)'
    },
    placeholder: "Tell me about your project\u2026"
  })), React.createElement(Button, {
    type: "submit",
    variant: "accent",
    size: "md",
    disabled: status === 'cooldown' || status === 'sending'
  }, buttonLabel), React.createElement("p", {
    style: {
      fontSize: 'var(--text-micro)',
      color: 'var(--text-faint)',
      marginTop: '14px'
    }
  }, window.KP_I18N.t.f("Sent directly \u2014 no email client required. Limited to one message per {n}s.", {
    n: RATE_LIMIT_MS / 1000
  })))), React.createElement(Footer, null));
}
window.ContactScreen = ContactScreen;
function DemosScreen({ onNav }) {
  const { Navbar, Footer } = window.KillianPichonDesignSystem_16387b;
  const [playing, setPlaying] = React.useState(false);
  const headingRef = React.useRef(null);
  const playRef = React.useRef(null);
  const closeRef = React.useRef(null);
  const lang = window.KP_I18N.lang === 'fr' ? 'fr' : 'en';
  const videoId = lang === 'fr' ? 'wk1_5q8ZHMw' : '7IuTgMDSUew';
  const closeVideo = React.useCallback(() => {
    setPlaying(false);
    window.requestAnimationFrame(() => playRef.current?.focus());
  }, []);
  React.useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  React.useEffect(() => {
    if (!playing) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = e => { if (e.key === 'Escape') closeVideo(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, closeVideo]);
  return React.createElement("div", null,
    React.createElement(Navbar, { onLinkClick: onNav }),
    React.createElement("main", {
      style: { padding: '48px var(--container-pad) 96px', minHeight: '65vh' }
    }, React.createElement("div", { style: { maxWidth: '960px', margin: '0 auto' } },
      React.createElement("h1", {
        ref: headingRef, tabIndex: -1,
        style: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-display-lg)', textTransform: 'uppercase', marginBottom: 'var(--space-6)', outline: 'none' }
      }, "Other demos"),
      React.createElement("h2", {
        style: { fontSize: 'var(--text-h2)', color: 'var(--text-heading)', marginBottom: 'var(--space-5)' }
      }, "Demo reel · 2019–2022"),
      React.createElement("div", {
        className: "demo-reel-player",
        style: { position: 'relative', aspectRatio: '16 / 9', minHeight: '202px', border: '1px solid var(--line-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--void-900)' }
      }, playing ? React.createElement("iframe", {
        src: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`,
        title: "Demo reel · 2019–2022",
        allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
        allowFullScreen: true,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 'inherit' }
      }) : React.createElement("button", {
        ref: playRef, type: 'button', onClick: () => setPlaying(true),
        "aria-label": "Play demo reel 2019–2022",
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 0, borderRadius: 'inherit', background: 'transparent', cursor: 'pointer', color: 'var(--text-heading)' }
      }, React.createElement("img", {
        src: window.__asset(`assets/demos/reel-2019-2022-${lang}.webp`),
        alt: '', width: 480, height: 360,
        style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }
      }), React.createElement("span", {
        "aria-hidden": true,
        style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,11,.25)', borderRadius: 'inherit' }
      }, React.createElement("span", { className: 'project-video-play' }, "\u25B6")))),
      React.createElement("div", {
        style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginTop: 'var(--space-5)', fontSize: 'var(--text-small)' }
      }, playing && React.createElement("button", {
        ref: closeRef, type: 'button', onClick: closeVideo, className: 'kp-footer-link',
        style: { color: 'var(--text-muted)' }
      }, "Close video"), React.createElement("a", {
        href: `https://www.youtube.com/watch?v=${videoId}`, target: '_blank', rel: 'noopener noreferrer',
        className: 'kp-footer-link', style: { color: 'var(--text-muted)' }
      }, "Watch on YouTube")))),
    React.createElement(Footer, null));
}
const SCREEN_META = {
  home: {
    title: 'Killian Pichon — 3D Artist in Montréal | Portfolio',
    description: 'Killian Pichon, 3D artist in Montréal. Portfolio of 3D animation, real-time graphics, fulldome films and projection mapping for immersive experiences.'
  },
  about: {
    title: 'About — Killian Pichon',
    description: 'Production experience, specializations and working approach of Montréal-based immersive artist Killian Pichon.'
  },
  technical: {
    title: 'Tools & workflows — Killian Pichon',
    description: 'Cinema 4D Python scripts, production tools and DJ MIDI mappings by Killian Pichon. Personal tools, professional work and experiments to reuse.'
  },
  demos: {
    title: 'Other demos — Killian Pichon',
    description: 'Killian Pichon’s demo reel from 2019 to 2022.'
  },
  contact: {
    title: 'Contact — Killian Pichon',
    description: 'Contact Killian Pichon for hiring opportunities, general questions and studio collaboration proposals.'
  }
};

// Le titre de l'onglet et la description ne traversent aucun composant : ils
// sont ecrits directement dans le document. Ils se traduisent donc ici, par
// ecran, depuis data/fr.js. Un ecran non traduit garde l'anglais.
Object.keys(SCREEN_META).forEach(screen => {
  const fr = window.KP_I18N.head(screen);
  if (fr) SCREEN_META[screen] = Object.assign({}, SCREEN_META[screen], fr);
});
function routeFromHash() {
  const path = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const page = window.KPProjectPages.parse(window.location.pathname, SITE_ROOT);
  if (!window.location.hash.startsWith('#/') && page && window.KPProjectPages.isPublic(window.KP_PROJECTS[page.id])) {
    return { screen: 'project', projectId: page.id };
  }
  if (!path || path === 'work') return {
    screen: 'home'
  };
  if (path === 'technical' && window.KP_SHOW_TECHNICAL !== true) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/work');
    return { screen: 'home' };
  }
  if (path === 'about' || path === 'technical' || path === 'contact' || path === 'demos') return {
    screen: path
  };
  if (path.startsWith('project/')) {
    let projectId;
    try { projectId = decodeURIComponent(path.slice('project/'.length)); } catch (_) { return { screen: 'home' }; }
    if (PROJECT_DATA[projectId]) return {
      screen: 'project',
      projectId
    };
  }
  return {
    screen: 'home'
  };
}
function App() {
  const [route, setRoute] = React.useState(routeFromHash);
  React.useEffect(() => {
    function onHashChange() {
      const next = routeFromHash();
      if (next.screen === 'project' && window.KPProjectPages.isPublic(window.KP_PROJECTS[next.projectId])) {
        const url = new URL(window.location.href);
        url.pathname = projectHref(next.projectId);
        url.searchParams.delete('lang');
        if (url.hash.startsWith('#/')) url.hash = '';
        window.history.replaceState(null, '', url);
      }
      setRoute(next);
    }
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);
  React.useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [route.screen, route.projectId]);
  React.useEffect(() => {
    const project = route.screen === 'project' ? PROJECT_DATA[route.projectId] : null;
    const publicProject = project && window.KPProjectPages.isPublic(window.KP_PROJECTS[project.id]);
    const meta = publicProject ? window.KPProjectPages.meta(project.id, project, window.KP_I18N.lang) : project ? {
      title: `${project.title} — Killian Pichon`,
      description: project.desc
    } : SCREEN_META[route.screen] || SCREEN_META.home;
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', meta.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    if (ogDescription) ogDescription.setAttribute('content', meta.description);
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterTitle) twitterTitle.setAttribute('content', meta.title);
    if (twitterDescription) twitterDescription.setAttribute('content', meta.description);
    // Public projects have their own static URL in each language.
    const enFrancais = window.KP_I18N.lang === 'fr';
    const pageURL = publicProject ? window.KPProjectPages.origin + window.KPProjectPages.path(project.id, window.KP_I18N.lang) : route.screen === 'technical'
      ? 'https://killianpichon.art/' + window.KPTechnicalLibrary.route(window.KP_I18N.lang)
      : 'https://killianpichon.art/' + (enFrancais ? '?lang=fr' : '');
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute('content', enFrancais ? 'fr_CA' : 'en_CA');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', pageURL);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageURL);
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => {
      const language = link.hreflang === 'fr-CA' ? 'fr' : 'en';
      link.href = 'https://killianpichon.art/' + (publicProject ? window.KPProjectPages.path(project.id, language) : route.screen === 'technical'
        ? window.KPTechnicalLibrary.route(language) : language === 'fr' ? '?lang=fr' : '');
    });
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.content = project && !publicProject ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      const tag = document.querySelector(selector);
      if (tag) tag.content = meta.image || 'https://killianpichon.art/assets/og-image.jpg';
    }
    for (const selector of ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) {
      const tag = document.querySelector(selector);
      if (tag) tag.content = meta.imageAlt || meta.title;
    }
    // Dimensions/type from the homepage artwork do not describe every project image.
    document.querySelectorAll('meta[property="og:image:width"],meta[property="og:image:height"],meta[property="og:image:type"]').forEach(tag => tag.remove());
    const schema = document.querySelector('script[type="application/ld+json"]');
    if (schema) schema.textContent = JSON.stringify(publicProject
      ? window.KPProjectPages.graph(project.id, project, window.KP_I18N.lang)
      : { ...HOME_SCHEMA, '@graph': (HOME_SCHEMA['@graph'] || []).map(item => item['@type'] === 'WebPage'
        ? { ...item, url: pageURL, name: meta.title, description: meta.description, inLanguage: enFrancais ? 'fr-CA' : 'en-CA' } : item) });
    window.dispatchEvent(new Event('kp:pagechange'));
  }, [route.screen, route.projectId]);
  React.useEffect(() => {
    const fallback = document.getElementById('offline-fallback');
    if (fallback) fallback.remove();
  }, []);
  const navigate = React.useCallback(path => {
    const id = path.startsWith('project/') ? decodeURIComponent(path.slice(8)) : null;
    const target = new URL(id ? projectHref(id) : screenHref(path), window.location.href);
    const current = new URL(window.location.href);
    for (const [key, value] of current.searchParams) if (key !== 'lang') target.searchParams.set(key, value);
    if (target.href !== window.location.href) window.history.pushState(null, '', target);
    setRoute(routeFromHash());
  }, []);
  const handleNav = React.useCallback(link => {
    const routes = {
      Work: 'work',
      About: 'about',
      Technical: 'technical',
      Contact: 'contact'
    };
    navigate(routes[link] || 'work');
  }, [navigate]);
  const openProject = React.useCallback(id => navigate(`project/${encodeURIComponent(id)}`), [navigate]);
  if (route.screen === 'project') {
    return React.createElement(ProjectScreen, {
      id: route.projectId,
      onBack: () => navigate('work'),
      onOpenProject: openProject,
      onNav: handleNav
    });
  }
  if (route.screen === 'about') return React.createElement(AboutScreen, {
    onNav: handleNav
  });
  if (route.screen === 'technical') return React.createElement(TechnicalScreen, {
    onNav: handleNav
  });
  if (route.screen === 'contact') return React.createElement(ContactScreen, {
    onNav: handleNav
  });
  if (route.screen === 'demos') return React.createElement(DemosScreen, {
    onNav: handleNav
  });
  return React.createElement(HomeScreen, {
    onOpenProject: openProject,
    onNav: handleNav
  });
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, null));
