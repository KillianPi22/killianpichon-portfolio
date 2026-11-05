/* Cet outil n'a de sens que servi par tools/serve.ps1 en local.
   Ce fichier est versionne, donc publie par GitHub Pages : on refuse
   explicitement de s'executer ailleurs, pour ne pas laisser croire
   qu'un visiteur pourrait editer le site. Il ne le pourrait pas de
   toute facon - GitHub Pages est statique et n'a aucune route d'ecriture. */
(() => {
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
  if (local) return;
  document.body.innerHTML =
    '<div style="margin:auto;max-width:520px;padding:48px 24px;text-align:center">' +
    '<h1 style="font-size:15px;letter-spacing:-.02em">Outil local</h1>' +
    '<p style="color:#9a999f;font-size:14px;line-height:1.7">' +
    "L'éditeur de contenu du portfolio ne fonctionne que sur l'ordinateur qui " +
    "l'exécute, lancé via <code>tools/edit-site.cmd</code>.<br><br>" +
    "Il modifie des fichiers locaux uniquement. Le site publié n'est pas " +
    "modifiable depuis cette page." +
    '</p></div>';
  throw new Error('editeur local uniquement');
})();

const $ = s => document.querySelector(s);
let items = [], stamp = null;
const edits = new Map();

/* ------------------------------------------------------------- traduction FR
   Le dictionnaire est indexe par la phrase anglaise elle-meme, pas par la
   position dans le fichier. Une ligne de l'onglet Textes porte donc deux
   identites : l'anglais se repere par fichier + ligne + decalage, sa traduction
   par le texte anglais. Ne pas les confondre.

   frEdits a pour cle la phrase anglaise, comme le dictionnaire. */
let fr = { ui: new Map(), uiSection: new Map(), projects: new Map(), head: new Map(), stale: new Set() };
const frEdits = new Map();
let frFilter = 'tous';

async function loadFr(){
  const r = await authFetch('/__fr');
  const d = await r.json();
  fr = {
    ui: new Map((d.ui || []).map(p => [p.k, p.v])),
    uiSection: new Map((d.uiSection || []).map(p => [p.k, p.v])),
    projects: new Map(),
    head: new Map(),
    stale: new Set(d.stale || [])
  };
  for (const p of (d.projects || [])){
    if (!fr.projects.has(p.id)) fr.projects.set(p.id, new Map());
    fr.projects.get(p.id).set(p.field, p.list ? (p.v || []) : (p.v || [])[0] || '');
  }
  for (const p of (d.head || [])){
    if (!fr.head.has(p.screen)) fr.head.set(p.screen, new Map());
    fr.head.get(p.screen).set(p.field, p.v);
  }
  frEdits.clear();
}

/* La valeur affichee : la modification en attente si elle existe, sinon celle
   du fichier, sinon rien. */
function frValue(englishText){
  if (frEdits.has(englishText)) return frEdits.get(englishText);
  return fr.ui.get(englishText) || '';
}

/* Le dictionnaire tel qu'il partira au serveur : le fichier, plus les
   modifications en attente. Une valeur vidée retire l'entree. */
function frPayload(){
  const ui = new Map(fr.ui);
  for (const [k, v] of frEdits){
    if (v === '') ui.delete(k); else ui.set(k, v);
  }
  const projects = [];
  for (const [id, champs] of fr.projects){
    for (const [f, v] of champs){
      projects.push({ id, field: f, list: Array.isArray(v), v: Array.isArray(v) ? v : [v] });
    }
  }
  const head = [];
  for (const [screen, champs] of fr.head){
    for (const [f, v] of champs) head.push({ screen, field: f, v });
  }
  return {
    ui: [...ui].map(([k, v]) => ({ k, v })),
    uiSection: [...fr.uiSection].map(([k, v]) => ({ k, v })),
    projects, head,
    // Une entree qu'on vient de retraduire n'est plus a revoir.
    stale: [...fr.stale].filter(k => ui.has(k) && !frEdits.has(k))
  };
}
/* La cle porte le fichier : index.html et data/projects.js ont tous deux une
   ligne 42, et sans cette distinction les deux textes n'en faisaient qu'un. */
const key = it => (it.file || 'index') + ':' + it.line + ':' + it.start;

/* ------------------------------------------------------------- session */
/* Le jeton vit en sessionStorage : il disparait a la fermeture de l'onglet
   et n'est jamais ecrit sur le disque. Le serveur l'invalide au bout de 12 h. */
let token = sessionStorage.getItem('editorToken') || null;

async function authFetch(url, opts){
  const o = Object.assign({}, opts);
  o.headers = Object.assign({}, o.headers, { 'X-Auth-Token': token || '' });
  const r = await fetch(url, o);
  if (r.status === 401){ lock('Session expirée. Saisis à nouveau le mot de passe.'); throw new Error('401'); }
  return r;
}

function lock(msg){
  token = null;
  sessionStorage.removeItem('editorToken');
  $('#lock').style.display = 'flex';
  $('#lockmsg').textContent = msg || '';
  $('#pw').value = '';
  $('#pw').focus();
}

function unlock(){
  $('#lock').style.display = 'none';
  $('#lockmsg').textContent = '';
}

$('#lockform').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('#pw').value;
  const btn = $('#lockform button');
  btn.disabled = true;
  $('#lockmsg').textContent = 'Vérification…';
  try{
    const r = await fetch('/__auth', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ password: pw })
    });
    const d = await r.json();
    if (d.ok){
      token = d.token;
      sessionStorage.setItem('editorToken', token);
      unlock();
      await boot();
    } else if (d.locked){
      $('#lockmsg').textContent = `Trop de tentatives. Réessaie dans ${d.wait} s.`;
    } else {
      $('#lockmsg').textContent = 'Mot de passe incorrect.';
      $('#pw').value = ''; $('#pw').focus();
    }
  } catch(err){
    $('#lockmsg').textContent = 'Serveur injoignable.';
  } finally {
    btn.disabled = false;
  }
});

/* ------------------------------------------------------------- rendu liste */
function autosize(ta){ ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; }

function updateCount(){
  const n = edits.size, f = frEdits.size;
  const bouts = [];
  if (n) bouts.push(`${n} anglais`);
  if (f) bouts.push(`${f} français`);
  $('#count').textContent = bouts.length
    ? bouts.join(' · ') + ' en attente'
    : `${items.length} textes · ${nonTraduits()} sans traduction`;
  $('#save').disabled = (n + f) === 0;
}

/* Nombre de phrases connues sans traduction, toutes origines confondues. */
function nonTraduits(){
  let n = 0;
  for (const t of clesConnues()) if (!frValue(t)) n++;
  return n;
}

/* L'ensemble des phrases anglaises traduisibles : celles que le balayage
   trouve dans le code, plus celles que seul le dictionnaire connait.
   Sans ce second ensemble, les libelles d'un seul mot — Work, Rôle, Outils —
   n'auraient aucune ligne, car le balayage exige un espace dans la chaine. */
function clesConnues(){
  const s = new Set(items.map(it => it.text));
  for (const k of fr.ui.keys()) s.add(k);
  for (const k of frEdits.keys()) s.add(k);
  return s;
}

function passeFiltre(texte){
  if (frFilter === 'manquants') return !frValue(texte);
  if (frFilter === 'revoir')    return fr.stale.has(texte) && !frEdits.has(texte);
  return true;
}

/* Construit la cellule francaise d'une ligne. englishText sert de cle : c'est
   lui, et pas la position dans le fichier, qui identifie la traduction. */
function celluleFr(englishText, row){
  const cell = document.createElement('div');
  cell.className = 'cell';

  if (fr.stale.has(englishText) && !frEdits.has(englishText)){
    row.classList.add('stale');
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = 'à revoir';
    b.title = "L'anglais a changé depuis cette traduction.";
    cell.appendChild(b);
  }

  const ta = document.createElement('textarea');
  ta.className = 'ta-fr';
  ta.rows = 1;
  ta.placeholder = 'Français…';
  ta.value = frValue(englishText);
  ta.addEventListener('input', () => {
    autosize(ta);
    const dansLeFichier = fr.ui.get(englishText) || '';
    if (ta.value === dansLeFichier) frEdits.delete(englishText);
    else frEdits.set(englishText, ta.value);
    row.classList.toggle('fr-dirty', frEdits.has(englishText));
    if (frEdits.has(englishText)){
      row.classList.remove('stale');
      const badge = cell.querySelector('.badge');
      if (badge) badge.remove();
    }
    updateCount();
  });
  cell.appendChild(ta);
  requestAnimationFrame(() => autosize(ta));
  return cell;
}

function render(filter){
  const host = $('#list');
  const f = (filter||'').trim().toLowerCase();
  const cherche = it => !f
    || it.text.toLowerCase().includes(f)
    || it.section.toLowerCase().includes(f)
    || (frValue(it.text) || '').toLowerCase().includes(f);

  const shown = items.filter(it => cherche(it) && passeFiltre(it.text));

  /* Les cles que le balayage ne trouve pas : libelles d'un seul mot, phrases
     des fichiers non balayes. Elles n'ont pas de position dans un fichier, donc
     leur anglais s'affiche en lecture seule. Sans ce groupe, 18 % de
     l'interface serait intraduisible depuis l'outil. */
  const balayees = new Set(items.map(it => it.text));
  const horsBalayage = [...clesConnues()]
    .filter(t => !balayees.has(t))
    .filter(t => !f || t.toLowerCase().includes(f) || (frValue(t) || '').toLowerCase().includes(f))
    .filter(passeFiltre);

  if (!shown.length && !horsBalayage.length){
    host.innerHTML = '<p class="empty">Aucun résultat.</p>'; return;
  }

  const groups = new Map();
  for (const it of shown){
    if (!groups.has(it.section)) groups.set(it.section, []);
    groups.get(it.section).push(it);
  }

  host.innerHTML = '';

  const ouvrirSection = titre => {
    const sec = document.createElement('section');
    sec.className = 'section';
    const h = document.createElement('h2');
    h.textContent = titre;
    sec.appendChild(h);
    return sec;
  };

  for (const [section, list] of groups){
    const sec = ouvrirSection(section + ' · ' + list.length);
    for (const it of list){
      const k = key(it);
      const row = document.createElement('div');
      row.className = 'row'
        + (edits.has(k) ? ' dirty en-dirty' : '')
        + (frEdits.has(it.text) ? ' fr-dirty' : '');
      row.dataset.key = k;

      const ln = document.createElement('div');
      ln.className = 'ln'; ln.textContent = it.line;

      const cellEn = document.createElement('div');
      cellEn.className = 'cell';
      const ta = document.createElement('textarea');
      ta.className = 'ta-en';
      ta.value = edits.has(k) ? edits.get(k) : it.text;
      ta.rows = 1;
      ta.addEventListener('input', () => {
        autosize(ta);
        if (ta.value === it.text){ edits.delete(k); row.classList.remove('dirty','en-dirty'); }
        else { edits.set(k, ta.value); row.classList.add('dirty','en-dirty'); }
        updateCount();
      });
      cellEn.appendChild(ta);

      row.append(ln, cellEn, celluleFr(it.text, row));
      sec.appendChild(row);
      requestAnimationFrame(() => autosize(ta));
    }
    host.appendChild(sec);
  }

  if (horsBalayage.length){
    const sec = ouvrirSection('Hors balayage · ' + horsBalayage.length);
    const note = document.createElement('p');
    note.className = 'empty';
    note.style.cssText = 'text-align:left;padding:0 0 10px;font-size:12px';
    note.textContent = "L'anglais de ces phrases n'est pas modifiable ici — libellés d'un seul mot, "
      + "ou textes vivant hors des fichiers balayés. Leur traduction, elle, s'édite normalement.";
    sec.appendChild(note);
    for (const texte of horsBalayage){
      const row = document.createElement('div');
      row.className = 'row' + (frEdits.has(texte) ? ' fr-dirty' : '');
      const ln = document.createElement('div');
      ln.className = 'ln'; ln.textContent = '—';
      const cellEn = document.createElement('div');
      cellEn.className = 'cell';
      const ro = document.createElement('div');
      ro.className = 'ro';
      ro.textContent = texte;
      cellEn.appendChild(ro);
      row.append(ln, cellEn, celluleFr(texte, row));
      sec.appendChild(row);
    }
    host.appendChild(sec);
  }
}

function status(msg, kind){
  const s = $('#status');
  if (!msg){ s.className = ''; s.textContent=''; return; }
  s.textContent = msg;
  s.className = 'show ' + (kind || '');
}

/* ------------------------------------------------------------------ donnees */
async function load(){
  const r = await authFetch('/__strings');
  const d = await r.json();
  items = d.items || [];
  stamp = d.stamp;
  $('#branch').textContent = d.branch || '';
  setLan(d.lanUrl);
  if (d.warning) status(d.warning, 'err');
  edits.clear();
  // Le dictionnaire avant le rendu : chaque ligne affiche sa traduction.
  await loadFr();
  render($('#search').value);
  updateCount();
}

function setLan(url){
  $('#lan').textContent = url ? 'iPhone · ' + url : 'iPhone · activer avec tools/setup-wifi.cmd';
  $('#lan').title = url
    ? 'Sur le même réseau, ouvre cette adresse sur l’iPhone. Garde l’éditeur ouvert sur l’ordinateur.'
    : 'Lance tools/setup-wifi.cmd une fois, puis relance l’éditeur.';
}

function reloadPreview(){
  const f = $('#site');
  let url;
  try { url = new URL(f.contentWindow.location.href); } catch(e) { url = new URL('/', location.href); }
  if (url.origin !== location.origin) url = new URL('/', location.href);
  url.searchParams.set('t', Date.now());
  f.src = url.href;
}

/* --------------------------------------------- battement de coeur + veille */
/* Battement de coeur des le chargement, meme verrouille : sans lui le serveur
   s'arreterait pendant la saisie du mot de passe. /__ping ne renvoie rien. */
let quitting = false;
function heartbeat(){
  if (!quitting) fetch('/__ping?v=' + document.visibilityState, {keepalive:true}).catch(()=>{});
}
heartbeat();
const heartbeatTimer = setInterval(heartbeat, 5000);
document.addEventListener('visibilitychange', heartbeat);
addEventListener('pageshow', heartbeat);

const refreshTimer = setInterval(async () => {
  if (quitting || !token || visual.isBusy()) return;
  try{
    const r = await authFetch('/__meta');
    const d = await r.json();
    if (quitting) return;
    if (d.stamp && stamp && d.stamp !== stamp){
      // L'empreinte couvre index.html, data/projects.js et data/fr.js : le
      // message ne nomme donc plus un fichier en particulier.
      const enAttente = pendingCount();
      if (enAttente){
        status(`Un fichier a été modifié en dehors de l'éditeur. Tes ${enAttente} modif(s) en attente risquent d'être refusées. Enregistre ou recharge.`, 'warn');
      } else {
        await load();
        if (visual.isActive()) await visual.refresh();
        reloadPreview();
        status('Rechargé — un fichier a changé sur le disque.', 'ok');
      }
    }
    $('#branch').textContent = d.branch || '';
  } catch(e){
    if (!quitting) status('Serveur arrêté. Relance tools\\edit-site.cmd.', 'err');
  }
}, 5000);

/* ---------------------------------------------------------------- controles */
$('#search').addEventListener('input', e => render(e.target.value));

$('#frFilters').addEventListener('click', e => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  frFilter = b.dataset.f;
  for (const autre of $('#frFilters').querySelectorAll('button')) autre.classList.toggle('on', autre === b);
  render($('#search').value);
});

$('#reload').addEventListener('click', async () => {
  const enAttente = edits.size + frEdits.size;
  if (enAttente && !confirm(`${enAttente} modification(s) non enregistrée(s). Recharger et les perdre ?`)) return;
  await load(); reloadPreview(); status('');
});

$('#save').addEventListener('click', async () => {
  const payload = [];
  for (const it of items){
    const k = key(it);
    if (edits.has(k)) payload.push({
      file: it.file || 'index',
      line: it.line, start: it.start, len: it.len,
      quote: it.quote, raw: it.raw, text: edits.get(k)
    });
  }
  $('#save').disabled = true;
  status('Enregistrement…');
  try{
    /* Le francais d'abord, l'anglais ensuite, et l'ordre n'est pas arbitraire :
       les cles du dictionnaire sont les phrases anglaises. Enregistrer
       l'anglais d'abord les renommerait, et le francais partirait ensuite avec
       les anciennes cles, ecrasant le report que le serveur vient de faire. */
    if (frEdits.size){
      const rf = await authFetch('/__fr', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(frPayload())
      });
      const df = await rf.json();
      if (!df.ok) throw new Error(df.error || 'écriture de data/fr.js refusée');
      if (df.stamp) stamp = df.stamp;
    }

    if (!payload.length){
      status(`${frEdits.size} traduction(s) enregistrée(s). Pense à commiter quand le résultat te convient.`, 'ok');
      await load();
      reloadPreview();
      await loadChanges();
      return;
    }

    const r = await authFetch('/__save', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ edits: payload })
    });
    const res = await r.json();
    // adopter l'empreinte tout de suite : sinon le surveillant de fichier
    // signale notre propre ecriture comme un changement exterieur
    if (res.stamp) stamp = res.stamp;
    if (res.applied > 0){
      let msg = `${res.applied} texte(s) enregistré(s).`;
      if (res.carried > 0){
        msg += ` ${res.carried} traduction(s) reportée(s) sur le nouveau texte, à revoir.`;
      }
      if (res.rejected && res.rejected.length) msg += ' Refusés : ' + res.rejected.join(' ; ');
      msg += ' Pense à commiter quand le résultat te convient.';
      status(msg, res.rejected && res.rejected.length ? 'warn' : 'ok');
      await load();
      reloadPreview();
      await loadChanges();
    } else {
      status('Rien enregistré. ' + ((res.rejected||[]).join(' ; ') || ''), 'err');
      $('#save').disabled = false;
    }
  } catch(e){
    status('Erreur : ' + e.message, 'err');
    $('#save').disabled = false;
  }
});

$('#refresh').addEventListener('click', reloadPreview);

/* ------------------------------------------- pointage dans l'apercu du site */
/* L'apercu est servi par le meme serveur : meme origine, donc on peut ecouter
   directement dans son document. Le mode est un interrupteur pour que
   l'apercu reste navigable normalement le reste du temps. */
let picking = false;
let pickDoc = null;

function reveal(selector){
  const row = document.querySelector(selector);
  if (!row) return false;
  row.scrollIntoView({ block:'center', behavior:'smooth' });
  row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 1200);
  const field = row.querySelector('textarea, input');
  if (field){ field.focus(); if (field.select) field.select(); }
  return true;
}

function textNodeAtPoint(doc, x, y){
  let range = null;
  if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
  else if (doc.caretPositionFromPoint){
    const p = doc.caretPositionFromPoint(x, y);
    if (p){ range = doc.createRange(); range.setStart(p.offsetNode, p.offset); }
  }
  const n = range && range.startContainer;
  return (n && n.nodeType === 3) ? n.nodeValue : null;
}

function findTextItem(value){
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  let hit = items.find(it => it.text === value) || items.find(it => it.text.trim() === v);
  if (!hit) hit = items.find(it => it.text.trim().includes(v) && v.length > 3);
  return hit || null;
}

function findMediaItem(src){
  if (!src) return null;
  // src rendu est absolu : on le ramene au chemin du depot
  let p = src;
  try { p = new URL(src, location.href).pathname.replace(/^\//, ''); } catch(e){}
  p = decodeURIComponent(p);
  // l'apercu rend le chemin complet ; le champ, lui, peut ne contenir que la
  // partie qui suit un prefixe concatene
  return media.find(m => m.resolved === p) || media.find(m => m.text === p) || null;
}

async function handlePick(e){
  e.preventDefault();
  e.stopPropagation();

  // 1. une image ?
  let src = null;
  if (e.target.tagName === 'IMG') src = e.target.getAttribute('src');
  if (!src){
    const bg = pickDoc.defaultView.getComputedStyle(e.target).backgroundImage;
    const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
    if (m) src = m[1];
  }
  if (src){
    if (!media.length) await loadMedia();
    const hit = findMediaItem(src);
    if (hit){
      showTab('media');
      await sleep(60);
      if (reveal(`.med[data-resolved="${hit.resolved}"]`)) {
        status('Média trouvé dans le panneau.', 'ok');
        return;
      }
    }
    status("Cette image n'est pas référencée par window.__asset — elle vient probablement du CSS.", 'warn');
    return;
  }

  // 2. sinon, un texte
  const value = textNodeAtPoint(pickDoc, e.clientX, e.clientY)
             || (e.target.textContent || '');
  const hit = findTextItem(value);
  if (!hit){
    status('Ce texte ne correspond à aucune chaîne éditable (il vient peut-être du CSS ou d\'un calcul).', 'warn');
    return;
  }
  showTab('texts');
  $('#search').value = '';
  render('');
  await sleep(60);
  if (!reveal(`.row[data-key="${key(hit)}"]`))
    status('Texte trouvé mais introuvable dans la liste.', 'warn');
  else
    status(`Texte trouvé — ${hit.section}, ligne ${hit.line}.`, 'ok');
}

function onPickMove(e){
  if (!picking) return;
  if (pickDoc.__hl && pickDoc.__hl !== e.target) pickDoc.__hl.style.outline = '';
  pickDoc.__hl = e.target;
  e.target.style.outline = '2px solid #ff5a2a';
  e.target.style.outlineOffset = '1px';
}

function attachPicking(){
  const doc = $('#site').contentDocument;
  if (!doc) return;
  pickDoc = doc;
  doc.addEventListener('click', handlePick, true);
  doc.addEventListener('mousemove', onPickMove, true);
  doc.body.style.cursor = 'crosshair';
}

function detachPicking(){
  if (!pickDoc) return;
  try {
    pickDoc.removeEventListener('click', handlePick, true);
    pickDoc.removeEventListener('mousemove', onPickMove, true);
    if (pickDoc.__hl) pickDoc.__hl.style.outline = '';
    pickDoc.body.style.cursor = '';
  } catch(e){}
  pickDoc = null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

$('#pick').addEventListener('click', () => {
  if (visual.isActive()) { status('Le pointage est disponible dans les onglets Textes et Médias.', 'warn'); return; }
  picking = !picking;
  $('#pick').classList.toggle('on', picking);
  if (picking){
    attachPicking();
    status("Mode pointage : clique un texte ou une image dans l'aperçu pour l'ouvrir dans le panneau.", 'ok');
  } else {
    detachPicking();
    status('');
  }
});

// le rechargement de l'apercu remplace le document : il faut se raccrocher
$('#site').addEventListener('load', () => { if (picking) attachPicking(); });

$('#quit').addEventListener('click', async () => {
  if (quitting) return;
  if (pendingCount() && !confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
  quitting = true;
  $('#quit').disabled = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await authFetch('/__quit', {method:'POST', signal:controller.signal});
    if (!response.ok || !(await response.json()).ok) throw new Error('Arrêt refusé');
  } catch(e){
    quitting = false;
    $('#quit').disabled = false;
    status('Arrêt non confirmé. Réessaie ou ferme la fenêtre du serveur.', 'err');
    return;
  } finally { clearTimeout(timeout); }
  clearInterval(heartbeatTimer);
  clearInterval(refreshTimer);
  sessionStorage.removeItem('editorToken');
  token = null;
  window.close();
  // Une URL saisie manuellement peut ne pas etre fermable par le navigateur.
  // Le lanceur habituel ouvre un onglet que window.close() peut fermer.
  setTimeout(() => {
    document.querySelectorAll('button, input, textarea, select').forEach(el => { el.disabled = true; });
    $('#site').src = 'about:blank';
    status('Serveur arrêté. Le navigateur garde cet onglet ouvert : ferme-le avec Ctrl + W.', 'ok');
  }, 250);
});

$('#widths').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  [...$('#widths').children].forEach(x => x.classList.toggle('on', x === b));
  const w = +b.dataset.w;
  const f = $('#site');
  if (w === 0){ f.style.width='100%'; f.style.height='100%'; f.classList.remove('framed'); }
  else { f.style.width = w+'px'; f.style.height='100%'; f.classList.add('framed'); }
});

/* ------------------------------------------------------------- redimension */
(() => {
  const grip = $('#grip'); let dragging = false;
  grip.addEventListener('mousedown', e => {
    dragging = true; grip.classList.add('active');
    document.body.style.userSelect='none'; e.preventDefault();
  });
  addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.min(Math.max(e.clientX, 320), innerWidth*0.7);
    document.documentElement.style.setProperty('--sidebar', w+'px');
  });
  addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; grip.classList.remove('active'); document.body.style.userSelect='';
  });
})();

/* ------------------------------------------------------------ modifications */
let changes = [];

function shorten(s, n){
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function suggestMessage(list){
  if (!list.length) return '';
  if (list.length === 1) return 'Corrige le texte : ' + shorten(list[0].after, 52);
  const secs = [...new Set(list.map(c => c.section))];
  return `Corrige ${list.length} textes (${secs.join(', ')})`;
}

function renderChanges(d){
  const host = $('#changes');
  host.innerHTML = '';

  if (!d.ok){
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = d.reason || 'Comparaison impossible.';
    host.appendChild(p);
    changes = [];
  } else if (!d.changes.length){
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Aucune modification depuis le dernier commit.';
    host.appendChild(p);
    changes = [];
  } else {
    changes = d.changes;
    for (const c of changes){
      const box = document.createElement('div');
      box.className = 'chg';
      const meta = document.createElement('div');
      meta.className = 'meta';
      // les reglages n'ont pas de ligne unique : ils s'ecrivent a plusieurs endroits
      meta.textContent = c.line
        ? `${c.section} · ligne ${c.line}`
        : `${c.section} · ${c.label}`;
      const b = document.createElement('div');
      b.className = 'before'; b.textContent = c.before;
      const a = document.createElement('div');
      a.className = 'after'; a.textContent = c.after;
      box.append(meta, b, a);
      host.appendChild(box);
    }
  }

  $('#tabChanges').textContent = changes.length
    ? `Modifications (${changes.length})` : 'Modifications';

  // Le commit part toujours sur la branche de contenu, quelle que soit la
  // branche sortie : main est la branche de publication, l'editeur n'y ecrit
  // pas. Autant l'annoncer avant de cliquer, pas apres.
  const br = d.branch || '';
  const cb = $('#cbranch');
  cb.innerHTML = 'vers <b></b>';
  cb.querySelector('b').textContent = 'content';
  cb.title = br === 'content' ? 'Branche déjà sortie.' : `Branche courante : ${br}. L'éditeur basculera sur content avant de commiter, puis poussera cette branche.`;
  cb.classList.toggle('warn', br !== 'content');

  if (!$('#cmsg').value.trim()) $('#cmsg').value = suggestMessage(changes);
  $('#commit').disabled = changes.length === 0;
}

async function loadChanges(){
  try{
    const r = await authFetch('/__changes');
    renderChanges(await r.json());
  } catch(e){}
}

/* ------------------------------------------------ selecteur d'image (modal) */
let mediaLib = [];
let pickerPick = null;   // callback du champ qui a ouvert le selecteur

function isVideoPath(p){ return /\.(mp4|webm)$/i.test(p || ''); }

/* Une valeur peut etre une adresse absolue vers le site en ligne (og:image).
   On la ramene au fichier local pour comparer et pour l'apercu. */
function toLocalPath(v){
  if (!v) return '';
  const m = v.match(/^https?:\/\/killianpichon\.art\/(.*)$/i);
  return m ? m[1] : v.replace(/^\//, '');
}

function renderPicker(filter, current){
  const grid = $('#pkgrid');
  const f = (filter || '').trim().toLowerCase();
  const list = f ? mediaLib.filter(p => p.toLowerCase().includes(f)) : mediaLib;
  grid.innerHTML = '';

  if (!list.length){
    grid.innerHTML = '<p class="empty">Aucun fichier ne correspond.</p>';
    return;
  }

  for (const p of list){
    const cell = document.createElement('div');
    cell.className = 'pkitem' + (p === current ? ' cur' : '');
    const img = document.createElement('div');
    img.className = 'pkimg';
    if (isVideoPath(p)) img.textContent = 'vidéo';
    else img.style.backgroundImage = `url("/${p}")`;
    const name = document.createElement('div');
    name.className = 'pkname';
    name.textContent = p;
    cell.append(img, name);
    cell.addEventListener('click', () => {
      if (pickerPick) pickerPick(p);
      closePicker();
    });
    grid.appendChild(cell);
  }
}

async function openPicker(currentValue, onChoose){
  if (!mediaLib.length){
    try {
      const r = await authFetch('/__media');
      mediaLib = (await r.json()).library || [];
    } catch(e){ return; }
  }
  pickerPick = onChoose;
  $('#picker').classList.add('on');
  $('#pksearch').value = '';
  renderPicker('', toLocalPath(currentValue));
  $('#pksearch').focus();
}

function closePicker(){
  $('#picker').classList.remove('on');
  pickerPick = null;
}

$('#pkclose').addEventListener('click', closePicker);
$('#pksearch').addEventListener('input', e => renderPicker(e.target.value, null));
$('#picker').addEventListener('click', e => { if (e.target.id === 'picker') closePicker(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && $('#picker').classList.contains('on')) closePicker(); });

/* ------------------------------------------------------------------ medias */
let media = [];
const medEdits = new Map();
const medKey = it => (it.file || 'index') + ':' + it.line + ':' + it.start;

function isVideo(p){ return /\.(mp4|webm)$/i.test(p || ''); }

function updateMedCount(){
  const n = medEdits.size;
  $('#medcount').textContent = n ? `${n} chemin${n>1?'s':''} modifié${n>1?'s':''}` : `${media.length} médias`;
  $('#medsave').disabled = n === 0;
}

function paintThumb(thumb, path){
  if (!path){ thumb.style.backgroundImage = ''; thumb.textContent = 'vide'; return; }
  if (isVideo(path)){ thumb.style.backgroundImage = ''; thumb.textContent = 'vidéo'; return; }
  thumb.textContent = '';
  thumb.style.backgroundImage = `url("/${path}")`;
}

function renderMedia(){
  const host = $('#media');
  host.innerHTML = '';
  if (!media.length){
    host.innerHTML = '<p class="empty">Aucun média référencé.</p>';
    updateMedCount(); return;
  }

  const groups = new Map();
  for (const it of media){
    if (!groups.has(it.section)) groups.set(it.section, []);
    groups.get(it.section).push(it);
  }

  for (const [section, list] of groups){
    const sec = document.createElement('section');
    sec.className = 'section';
    const h = document.createElement('h2');
    h.textContent = section + ' · ' + list.length;
    sec.appendChild(h);

    for (const it of list){
      const k = medKey(it);
      const row = document.createElement('div');
      row.className = 'med' + (medEdits.has(k) ? ' dirty' : '');

      const thumb = document.createElement('div');
      thumb.className = 'medthumb';

      const body = document.createElement('div');
      body.className = 'medbody';
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'medialib');
      input.value = medEdits.has(k) ? medEdits.get(k) : it.text;

      const meta = document.createElement('div');
      meta.className = 'medmeta';

      // le champ contient le litteral tel qu'il est ecrit dans le code ;
      // le chemin reel y ajoute le prefixe quand il vient d'une concatenation
      const full = v => (it.base || '') + v;

      const refreshMeta = (known) => {
        const missing = known === false;
        meta.classList.toggle('missing', missing);
        meta.textContent = `ligne ${it.line}`
          + (it.base ? ` · ${it.base}` : '')
          + (missing ? ' · fichier introuvable' : '');
      };
      refreshMeta(it.exists);
      paintThumb(thumb, full(input.value));

      input.addEventListener('input', () => {
        if (input.value === it.text){ medEdits.delete(k); row.classList.remove('dirty'); }
        else { medEdits.set(k, input.value); row.classList.add('dirty'); }
        paintThumb(thumb, full(input.value));
        // le fichier existe-t-il ? on demande au serveur qui sert le site
        fetch('/' + full(input.value), { method: 'HEAD' })
          .then(r => refreshMeta(r.ok))
          .catch(() => refreshMeta(false));
        updateMedCount();
      });

      const browse = document.createElement('button');
      browse.type = 'button';
      browse.className = 'browse';
      browse.textContent = 'Parcourir';
      browse.addEventListener('click', () => openPicker(full(input.value), chosen => {
        // le code concatene un prefixe : n'ecrire que la partie qui lui revient
        input.value = (it.base && chosen.startsWith(it.base))
          ? chosen.slice(it.base.length) : chosen;
        input.dispatchEvent(new Event('input', {bubbles:true}));
      }));

      const line = document.createElement('div');
      line.className = 'medrow';
      line.append(input, browse);

      body.append(line, meta);
      row.append(thumb, body);
      row.dataset.line = it.line;
      row.dataset.path = it.text;
      row.dataset.resolved = it.resolved;
      sec.appendChild(row);
    }
    host.appendChild(sec);
  }
  updateMedCount();
}

async function loadMedia(){
  try{
    const r = await authFetch('/__media');
    const d = await r.json();
    media = d.items || [];
    $('#medialib').innerHTML = '';
    for (const p of (d.library || [])){
      const o = document.createElement('option');
      o.value = p;
      $('#medialib').appendChild(o);
    }
    medEdits.clear();
    renderMedia();
  } catch(e){}
}

$('#medsave').addEventListener('click', async () => {
  const payload = [];
  for (const it of media){
    const k = medKey(it);
    if (medEdits.has(k)) payload.push({
      file: it.file || 'index',
      line: it.line, start: it.start, len: it.len,
      quote: it.quote, raw: it.raw, text: medEdits.get(k)
    });
  }
  $('#medsave').disabled = true;
  status('Enregistrement des médias…');
  try{
    const r = await authFetch('/__media', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ edits: payload })
    });
    const res = await r.json();
    if (res.stamp) stamp = res.stamp;
    if (res.applied > 0){
      let m = `${res.applied} chemin(s) enregistré(s).`;
      if (res.rejected && res.rejected.length) m += ' Refusés : ' + res.rejected.join(' ; ');
      status(m, res.rejected && res.rejected.length ? 'warn' : 'ok');
      await loadMedia();
      reloadPreview();
      await loadChanges();
    } else {
      status('Rien enregistré. ' + ((res.rejected||[]).join(' ; ') || ''), 'err');
      $('#medsave').disabled = false;
    }
  } catch(e){
    status('Erreur : ' + e.message, 'err');
    $('#medsave').disabled = false;
  }
});

/* ---------------------------------------------------------------- reglages */
let settings = [];
const setEdits = new Map();

/* Une image de partage est referencee en adresse absolue vers le site en
   ligne. Pour l'apercu on retombe sur le fichier local : pas de requete
   sortante, et on voit ce qu'on est en train de modifier. */
function previewSrc(v){
  if (!v) return '';
  const m = v.match(/^https?:\/\/killianpichon\.art\/(.*)$/i);
  return m ? '/' + m[1] : v;
}

function updateSetCount(){
  const n = setEdits.size;
  $('#setcount').textContent = n ? `${n} réglage${n>1?'s':''} modifié${n>1?'s':''}` : `${settings.length} réglages`;
  $('#setsave').disabled = n === 0;
}

function renderSettings(){
  const host = $('#settings');
  host.innerHTML = '';
  const groups = new Map();
  for (const s of settings){
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push(s);
  }

  for (const [group, list] of groups){
    const sec = document.createElement('section');
    sec.className = 'section';
    const h = document.createElement('h2');
    h.textContent = group;
    sec.appendChild(h);

    for (const s of list){
      const box = document.createElement('div');
      box.className = 'set';
      const lab = document.createElement('label');
      lab.textContent = s.label;
      box.appendChild(lab);

      if (s.problem){
        const w = document.createElement('div');
        w.className = 'warn';
        w.textContent = `Introuvable dans index.html (${s.problem}). Ce réglage n'est pas modifiable ici.`;
        box.appendChild(w);
        sec.appendChild(box);
        continue;
      }

      let input;
      if (s.kind === 'textarea'){
        input = document.createElement('textarea');
      } else {
        input = document.createElement('input');
        input.type = s.kind === 'boolean' ? 'checkbox' : 'text';
      }
      input.value = setEdits.has(s.key) ? setEdits.get(s.key) : s.value;
      input.id = `setting-${s.key}`;
      lab.htmlFor = input.id;
      if (s.kind === 'boolean') input.checked = input.value === 'true';

      const onInput = () => {
        if (s.kind === 'boolean') input.value = String(input.checked);
        if (input.value === s.value){ setEdits.delete(s.key); box.classList.remove('dirty'); }
        else { setEdits.set(s.key, input.value); box.classList.add('dirty'); }
        if (s.kind === 'image') prev.style.backgroundImage = `url("${previewSrc(input.value)}")`;
        if (s.kind === 'color') swatch.value = /^#[0-9a-f]{6}$/i.test(input.value) ? input.value : '#000000';
        updateSetCount();
      };
      input.addEventListener('input', onInput);

      let prev, swatch;
      if (s.kind === 'image'){
        const row = document.createElement('div');
        row.className = 'withimg';
        prev = document.createElement('div');
        prev.className = 'imgprev';
        prev.textContent = 'aperçu';
        prev.style.backgroundImage = `url("${previewSrc(input.value)}")`;

        const browse = document.createElement('button');
        browse.type = 'button';
        browse.className = 'browse';
        browse.textContent = 'Parcourir';
        browse.addEventListener('click', () => openPicker(input.value, chosen => {
          // og:image doit rester absolue : les robots sociaux ne resolvent
          // pas les chemins relatifs. On conserve la forme du champ.
          const wasAbsolute = /^https?:\/\//i.test(input.value);
          input.value = wasAbsolute ? 'https://killianpichon.art/' + chosen : chosen;
          input.dispatchEvent(new Event('input', {bubbles:true}));
        }));

        const stack = document.createElement('div');
        stack.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:6px;min-width:0';
        stack.append(input, browse);
        row.append(stack, prev);
        box.appendChild(row);
      } else if (s.kind === 'color'){
        const row = document.createElement('div');
        row.className = 'setcolor';
        swatch = document.createElement('input');
        swatch.type = 'color';
        swatch.value = /^#[0-9a-f]{6}$/i.test(input.value) ? input.value : '#000000';
        swatch.addEventListener('input', () => { input.value = swatch.value; onInput(); });
        row.append(swatch, input);
        box.appendChild(row);
      } else {
        box.appendChild(input);
      }

      if (s.targets > 1){
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = (s.help || '') + ` Écrit dans ${s.targets} endroits du fichier.`;
        box.appendChild(hint);
      } else if (s.help){
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = s.help;
        box.appendChild(hint);
      }

      if (s.divergent){
        const w = document.createElement('div');
        w.className = 'warn';
        w.textContent = "Les copies de ce réglage ne concordent pas dans le fichier. Enregistrer les réalignera toutes sur la valeur ci-dessus.";
        box.appendChild(w);
      }

      sec.appendChild(box);
    }
    host.appendChild(sec);
  }
  updateSetCount();
}

async function loadSettings(){
  try{
    const r = await authFetch('/__settings');
    settings = (await r.json()).items || [];
    setEdits.clear();
    renderSettings();
  } catch(e){}
}

$('#setsave').addEventListener('click', async () => {
  const values = {};
  for (const [k, v] of setEdits) values[k] = v;
  $('#setsave').disabled = true;
  status('Enregistrement des réglages…');
  try{
    const r = await authFetch('/__settings', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ values })
    });
    const d = await r.json();
    if (d.stamp) stamp = d.stamp;
    if (d.applied > 0){
      let m = `${d.applied} emplacement(s) mis à jour dans index.html.`;
      if (d.rejected && d.rejected.length) m += ' Refusés : ' + d.rejected.join(' ; ');
      status(m, d.rejected && d.rejected.length ? 'warn' : 'ok');
      await loadSettings();
      await load();
      reloadPreview();
      await loadChanges();
    } else {
      status('Rien à enregistrer. ' + ((d.rejected||[]).join(' ; ') || ''), 'err');
      $('#setsave').disabled = false;
    }
  } catch(e){
    status('Erreur : ' + e.message, 'err');
    $('#setsave').disabled = false;
  }
});

/* ==================================================================== projets
   Cet onglet ecrit data/projects.js. Deux principes le gouvernent :
   - le serveur ne reecrit que le bloc du projet concerne, donc une erreur
     ici ne peut pas emporter les autres fiches ;
   - le chiffrement se fait dans cette page, jamais sur le serveur. Le code
     d'acces ne quitte pas le navigateur et n'est jamais ecrit sur le disque.
*/
let projectItems = [], projectFields = [], projectFormId = null, projectFormNew = false;

const PROJECT_REQUIRED = ['title', 'category', 'date', 'thumb', 'desc', 'overview', 'role', 'tools', 'contribution', 'pipeline'];

function fieldsByGroup(){
  const groups = new Map();
  for (const f of projectFields){
    if (!groups.has(f.group)) groups.set(f.group, []);
    groups.get(f.group).push(f);
  }
  return groups;
}

async function loadProjects(){
  const r = await authFetch('/__projects');
  const d = await r.json();
  projectItems = d.items || [];
  projectFields = d.fields || [];
  if (d.stamp) stamp = d.stamp;
  if (projectFormId === null) renderProjectList();
}

function renderProjectList(){
  projectFormDirty = false;
  const host = $('#projects');
  host.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'prjbar';
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = '+ Nouveau projet';
  add.addEventListener('click', () => openProjectForm(null));
  const sp = document.createElement('span');
  sp.className = 'sp';
  const count = document.createElement('span');
  count.className = 'prjmeta';
  count.textContent = projectItems.length + ' projets';
  bar.append(add, sp, count);
  host.appendChild(bar);

  const note = document.createElement('p');
  note.className = 'prjnote';
  note.textContent = "L'ordre est calculé à partir de la date : du plus récent au plus ancien, ici comme sur le site. Les quatre premiers occupent la grille du haut.";
  host.appendChild(note);

  projectItems.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'prj';

    const th = document.createElement('div');
    th.className = 'prjthumb';
    if (it.protected) th.textContent = '🔒';
    else if (it.thumb) th.style.backgroundImage = `url("/${it.thumb}")`;
    else th.textContent = '—';

    const body = document.createElement('div');
    body.className = 'prjbody';
    const title = document.createElement('div');
    title.className = 'prjtitle';
    title.textContent = it.title || it.id;
    const meta = document.createElement('div');
    meta.className = 'prjmeta';
    meta.textContent = `${it.date || 'sans date'} · ${it.id}`;
    if (i < 4 && it.listing !== 'hidden') {
      const b = document.createElement('span');
      b.className = 'prjbadge';
      b.textContent = 'vitrine';
      meta.appendChild(b);
    }
    if (it.protected){
      const b = document.createElement('span');
      b.className = 'prjbadge lock';
      b.textContent = it.listing === 'hidden' ? 'protégé · masqué'
        : it.listing === 'nda' ? 'protégé · NDA' : 'protégé · verrou';
      meta.appendChild(b);
    }
    if (it.hasLink){
      const b = document.createElement('span');
      b.className = 'prjbadge lock';
      b.textContent = 'lien protégé';
      meta.appendChild(b);
    }
    body.append(title, meta);

    const acts = document.createElement('div');
    acts.className = 'prjacts';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = it.protected ? 'Déprotéger' : 'Éditer';
    edit.addEventListener('click', () => it.protected ? unprotectProject(it.id) : openProjectForm(it.id));
    const lock = document.createElement('button');
    lock.type = 'button';
    lock.textContent = it.protected ? 'Voir' : it.hasLink ? 'Retirer le lien' : 'Protéger';
    lock.addEventListener('click', () => it.protected
      ? window.open('/#/project/' + it.id, '_blank')
      : it.hasLink ? removeProjectLink(it.id) : protectProject(it.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Retirer';
    del.addEventListener('click', () => deleteProject(it));
    acts.append(edit, lock, del);

    row.append(th, body, acts);
    host.appendChild(row);
  });
}

/* --------------------------------------------------------------- formulaire */
async function openProjectForm(id){
  projectFormNew = !id;
  projectFormId = id || '';
  let values = {};
  if (id){
    const r = await authFetch('/__project?id=' + encodeURIComponent(id));
    const d = await r.json();
    if (!d.ok){ status(d.reason || 'Projet introuvable.', 'err'); projectFormId = null; return; }
    values = d.values || {};
  }
  renderProjectForm(values);
}

function makeField(def, value){
  const wrap = document.createElement('div');
  wrap.className = 'set';
  const label = document.createElement('label');
  label.textContent = def.label + (PROJECT_REQUIRED.includes(def.key) ? ' *' : '');
  wrap.appendChild(label);

  let input;
  if (def.kind === 'para'){
    input = document.createElement('textarea');
    input.value = value == null ? '' : String(value);
  } else if (def.kind === 'list' || def.kind === 'medias'){
    input = document.createElement('textarea');
    input.value = Array.isArray(value) ? value.join('\n') : (value == null ? '' : String(value));
    input.rows = 4;
  } else if (def.kind === 'projects'){
    // Choix parmi les projets existants : une saisie libre laissait passer un
    // titre qui ne renvoyait vers rien, et la rubrique s'affichait vide.
    const chosen = new Set(Array.isArray(value) ? value : []);
    input = document.createElement('div');
    input.className = 'prjpick';
    for (const other of projectItems){
      if (other.id === projectFormId) continue;
      if (other.listing === 'hidden') continue;
      const row = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.id = other.id;
      // une fiche ecrite avant le selecteur porte le titre, pas l'identifiant
      box.checked = chosen.has(other.id) || chosen.has(other.title);
      const name = document.createElement('span');
      name.textContent = other.title || other.id;
      row.append(box, name);
      input.appendChild(row);
    }
    if (!input.children.length){
      const empty = document.createElement('div');
      empty.className = 'hint';
      empty.textContent = 'Aucun autre projet à lier.';
      input.appendChild(empty);
    }
  } else if (def.kind === 'bool'){
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(value);
  } else if (def.kind === 'number'){
    input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = value == null ? '' : String(value);
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = value == null ? '' : String(value);
  }
  input.dataset.key = def.key;
  input.dataset.kind = def.kind;
  input.dataset.lang = 'en';

  if (def.kind === 'media'){
    const row = document.createElement('div');
    row.className = 'prjrow';
    const prev = document.createElement('div');
    prev.className = 'imgprev';
    const paint = () => {
      const v = input.value.trim();
      prev.style.backgroundImage = v ? `url("/${v}")` : '';
      prev.textContent = v ? '' : 'vide';
    };
    input.addEventListener('input', paint);
    const browse = document.createElement('button');
    browse.type = 'button';
    browse.textContent = 'Parcourir';
    browse.addEventListener('click', () => openPicker(input.value, p => { input.value = p; paint(); }));
    row.append(input, browse, prev);
    wrap.appendChild(row);
    paint();
    wrap.appendChild(makeUploader(list => { input.value = list[0]; paint(); }));
  } else if (def.kind === 'medias'){
    wrap.appendChild(input);
    wrap.appendChild(makeUploader(list => {
      const cur = input.value.trim();
      input.value = (cur ? cur + '\n' : '') + list.join('\n');
    }, true));
  } else {
    wrap.appendChild(input);
  }

  if (def.help){
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = def.help;
    wrap.appendChild(hint);
  }
  if (def.kind === 'list' || def.kind === 'medias'){
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Une entrée par ligne.';
    wrap.appendChild(hint);
  }
  return wrap;
}

function readChosenProjects(el){
  return [...el.querySelectorAll('input[type=checkbox]')].filter(b => b.checked).map(b => b.dataset.id);
}

/* Televersement : le fichier part tel quel, sans conversion. Son poids et ses
   dimensions sont affiches avant l'envoi, pour que rien de trop lourd ne
   parte sans qu'on l'ait vu. */
function makeUploader(onDone, multiple){
  const box = document.createElement('div');
  box.className = 'prjup';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.avif,.webp,.jpg,.jpeg,.png,.gif,.svg,.mp4,.webm';
  if (multiple) input.multiple = true;
  const info = document.createElement('div');
  input.addEventListener('change', async () => {
    const files = [...input.files];
    if (!files.length) return;
    const id = ($('#prjid') && $('#prjid').value.trim()) || projectFormId;
    if (!id){ info.textContent = "Donne d'abord un identifiant au projet."; box.classList.add('warn'); return; }
    const added = [];
    for (const f of files){
      info.textContent = `Envoi de ${f.name}…`;
      box.classList.remove('warn');
      const dims = await readDimensions(f);
      try {
        const r = await authFetch('/__upload', {
          method: 'POST',
          headers: { 'X-Project-Id': id, 'X-File-Name': f.name, 'Content-Type': 'application/octet-stream' },
          body: await f.arrayBuffer()
        });
        const d = await r.json();
        if (!d.ok){ info.textContent = d.reason; box.classList.add('warn'); continue; }
        added.push(d.path);
        const mo = (f.size / 1048576);
        info.textContent = `${d.path} · ${mo.toFixed(2)} Mo${dims ? ' · ' + dims : ''}`;
        // Le fichier n'est pas converti : au-dela de 1 Mo, autant le signaler
        // plutot que de laisser le depot grossir sans bruit.
        if (mo > 1) box.classList.add('warn');
      } catch(e){
        info.textContent = 'Envoi impossible : ' + e.message;
        box.classList.add('warn');
      }
    }
    input.value = '';
    if (added.length) onDone(added);
  });
  box.append(input, info);
  return box;
}

function readDimensions(file){
  return new Promise(resolve => {
    if (!/^image\//.test(file.type)) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img.naturalWidth + '×' + img.naturalHeight); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/* Le pendant francais d'un champ de fiche. Rien pour les champs qui ne se
   traduisent pas — medias, dates, listes d'outils, projets lies — ni pour une
   fiche en cours de creation : tant que l'anglais n'est pas ecrit, il n'y a
   rien a traduire.
   Les valeurs vivent dans data/fr.js, pas dans data/projects.js : ce champ ne
   part donc pas avec le formulaire du projet mais par la route /__fr. */
function makeFrField(def){
  if (!def.translate || projectFormNew || !projectFormId) return null;

  const champs = fr.projects.get(projectFormId);
  const brut = champs ? champs.get(def.key) : undefined;
  const estListe = def.kind === 'list';

  const wrap = document.createElement('div');
  wrap.className = 'set frset';
  const label = document.createElement('label');
  label.textContent = def.label + ' — français';
  wrap.appendChild(label);

  const input = document.createElement('textarea');
  input.dataset.key = def.key;
  input.dataset.kind = def.kind;
  input.dataset.lang = 'fr';
  input.placeholder = 'Vide, la fiche garde l’anglais.';
  if (estListe){
    input.value = Array.isArray(brut) ? brut.join('\n') : '';
    input.rows = 4;
  } else {
    input.value = brut == null ? '' : String(brut);
    if (def.kind === 'para') input.rows = 3;
  }
  input.addEventListener('input', () => wrap.classList.add('dirty'));
  wrap.appendChild(input);
  return wrap;
}

function renderProjectForm(values){
  projectFormDirty = false;
  const host = $('#projects');
  host.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'prjhead';
  const h = document.createElement('h2');
  h.textContent = projectFormNew ? 'Nouveau projet' : 'Modifier · ' + projectFormId;
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Retour';
  back.addEventListener('click', () => {
    if (projectFormDirty && !confirm('Abandonner les modifications de cette fiche ?')) return;
    projectFormId = null; renderProjectList();
  });
  head.append(h, back);
  host.appendChild(head);

  const form = document.createElement('div');
  form.className = 'prjform';

  const idWrap = document.createElement('div');
  idWrap.className = 'set';
  const idLabel = document.createElement('label');
  idLabel.textContent = 'Identifiant *';
  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.id = 'prjid';
  idInput.value = projectFormId || '';
  idInput.disabled = !projectFormNew;
  const idHint = document.createElement('div');
  idHint.className = 'hint';
  idHint.textContent = "Minuscules, chiffres et tirets. Sert d'adresse (#/project/…) et de dossier de médias (projects/…). Il ne se change plus ensuite.";
  idWrap.append(idLabel, idInput, idHint);
  form.appendChild(idWrap);

  for (const [group, defs] of fieldsByGroup()){
    if (group === 'Visibilite') continue;
    const title = document.createElement('div');
    title.className = 'prjgroup';
    title.textContent = group;
    form.appendChild(title);
    for (const def of defs){
      form.appendChild(makeField(def, values[def.key]));
      const champFr = makeFrField(def);
      if (champFr) form.appendChild(champFr);
    }
  }

  const err = document.createElement('div');
  err.className = 'prjerr';
  err.id = 'prjerr';
  form.appendChild(err);

  const actions = document.createElement('div');
  actions.className = 'prjbar';
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Enregistrer le projet';
  save.addEventListener('click', () => saveProjectForm());
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', () => { projectFormId = null; renderProjectList(); });
  actions.append(save, cancel);
  form.appendChild(actions);

  host.appendChild(form);
}

function collectProjectForm(){
  const values = {};
  // Les champs francais portent data-lang="fr" et vont dans data/fr.js, pas
  // dans la fiche : les inclure ici ecraserait l'anglais par sa traduction.
  for (const el of $('#projects').querySelectorAll('[data-key]:not([data-lang="fr"])')){
    const kind = el.dataset.kind;
    const key = el.dataset.key;
    if (kind === 'projects'){ values[key] = readChosenProjects(el); continue; }
    if (kind === 'bool'){ values[key] = el.checked; continue; }
    const raw = el.value.trim();
    if (kind === 'list' || kind === 'medias'){
      values[key] = raw ? raw.split('\n').map(s => s.trim()).filter(Boolean) : [];
      continue;
    }
    // Un nombre laisse vide n'est pas un zero a ecrire : le champ n'existe
    // simplement pas dans la fiche.
    if (kind === 'number'){ if (raw !== '') values[key] = Number(raw); continue; }
    values[key] = raw;
  }
  return values;
}

/* Ecrit dans data/fr.js les champs francais du formulaire ouvert.
   Un champ vide retire la surcharge : la fiche retombe alors sur l'anglais,
   ce qui est le comportement voulu et non une entree vide a conserver. */
async function saveFrProject(id){
  const champs = $('#projects').querySelectorAll('[data-lang="fr"]');
  if (!champs.length) return 0;

  const avant = fr.projects.get(id) || new Map();
  const apres = new Map();
  let n = 0;
  for (const el of champs){
    const brut = el.value.trim();
    if (!brut) continue;
    apres.set(el.dataset.key, el.dataset.kind === 'list'
      ? brut.split('\n').map(s => s.trim()).filter(Boolean)
      : brut);
    n++;
  }

  const memeChose = apres.size === avant.size
    && [...apres].every(([k, v]) => JSON.stringify(v) === JSON.stringify(avant.get(k)));
  if (memeChose) return 0;

  if (apres.size) fr.projects.set(id, apres); else fr.projects.delete(id);

  const r = await authFetch('/__fr', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(frPayload())
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'écriture de data/fr.js refusée');
  if (d.stamp) stamp = d.stamp;
  return n;
}

async function saveProjectForm(){
  const id = $('#prjid').value.trim();
  const values = collectProjectForm();
  const err = $('#prjerr');

  const missing = PROJECT_REQUIRED.filter(k => {
    const v = values[k];
    return Array.isArray(v) ? v.length === 0 : !String(v || '').trim();
  });
  if (!id){ err.textContent = "L'identifiant est obligatoire."; return; }
  if (missing.length){
    const labels = missing.map(k => (projectFields.find(f => f.key === k) || {}).label || k);
    err.textContent = 'À remplir : ' + labels.join(', ') + '.';
    return;
  }
  err.textContent = '';

  const r = await authFetch('/__project', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, values })
  });
  const d = await r.json();
  if (!d.ok){ err.textContent = d.reason || 'Enregistrement refusé.'; return; }

  // La traduction part ensuite, et seulement si la fiche anglaise est passee :
  // ecrire un francais qui traduit un anglais refuse n'aurait aucun sens.
  let traduits = 0;
  try { traduits = await saveFrProject(id); }
  catch (e){ err.textContent = 'Fiche enregistrée, mais la traduction a échoué : ' + e.message; }

  const suffixe = traduits ? ` ${traduits} champ(s) traduit(s).` : '';
  status((d.created ? `Projet ${id} créé.` : `Projet ${id} enregistré.`) + suffixe, 'ok');
  if (d.stamp) stamp = d.stamp;
  projectFormId = null;
  await loadProjects();
  renderProjectList();
  reloadPreview();
  await loadChanges();
}

async function deleteProject(item){
  if (!confirm(`Retirer « ${item.title || item.id} » du site ?\n\nLa fiche disparaît, les médias de projects/${item.id}/ restent sur le disque.`)) return;
  const r = await authFetch('/__project-delete', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id: item.id })
  });
  const d = await r.json();
  if (!d.ok){ status(d.reason || 'Suppression refusée.', 'err'); return; }
  status(`Projet ${item.id} retiré. Médias conservés dans ${d.mediaDir}/.`, 'ok');
  if (d.stamp) stamp = d.stamp;
  await loadProjects();
  renderProjectList();
  reloadPreview();
  await loadChanges();
}

/* ------------------------------------------------------------- protection */
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const randHex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

async function encryptPayload(resourceId, accessCode, payload, iterations){
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const km = await crypto.subtle.importKey('raw', enc.encode(accessCode.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(`kp-protected-content:${resourceId}:v1`), tagLength: 128 },
    key, enc.encode(JSON.stringify(payload)));
  return { id: resourceId, version: 1, iterations, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) };
}

const MEDIA_KEYS = ['thumb', 'heroImage', 'videoPoster'];

/* Les medias d'un projet protege changent de dossier et de nom : un chemin
   devinable rendrait le chiffrement inutile, puisque les fichiers restent
   servis en statique. La correspondance part dans le contenu chiffre, seul
   endroit d'ou la levee de protection pourra la relire. */
function planMediaMoves(values, id, keepVisible){
  const folder = 'projects/' + randHex(16);
  const moves = [];
  const outside = [];
  const own = 'projects/' + id + '/';
  const keep = new Set((keepVisible || []).filter(Boolean));
  // Un meme fichier peut etre cite en vignette et en galerie : il ne recoit
  // qu'un seul nouveau nom, et ne se deplace qu'une fois.
  const seen = new Map();
  const rename = path => {
    if (!path || !/^projects\//.test(path)) return path;
    // La vignette du mode NDA reste ou elle est : c'est ce que montre la tuile.
    if (keep.has(path)) return path;
    // Un media range ailleurs appartient a un autre projet : le deplacer
    // casserait la fiche qui s'en sert. Il reste en place, et donc public.
    if (!path.startsWith(own)) { if (!outside.includes(path)) outside.push(path); return path; }
    if (seen.has(path)) return seen.get(path);
    const ext = (path.match(/\.[a-z0-9]+$/i) || ['.bin'])[0].toLowerCase();
    const to = `${folder}/${randHex(16)}${ext}`;
    seen.set(path, to);
    moves.push({ from: path, to });
    return to;
  };
  const next = Object.assign({}, values);
  for (const k of MEDIA_KEYS) if (next[k]) next[k] = rename(next[k]);
  if (Array.isArray(next.galleryImages)) next.galleryImages = next.galleryImages.map(rename);
  return { values: next, moves, outside };
}

/* Le dialogue remplace une file de fenetres systeme : les deux portees de
   protection et les trois presentations en grille se lisent d'un coup d'oeil,
   au lieu de se decouvrir une question a la fois. */
let protectTarget = null;

function protectRadio(name){
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function syncProtectDialog(){
  const scope = protectRadio('pbscope');
  const listing = protectRadio('pblisting');
  $('#pbficheopts').hidden = scope !== 'fiche';
  $('#pblienopts').hidden = scope !== 'lien';
  $('#pbtitlerow').hidden = scope !== 'fiche' || listing === 'hidden';
  $('#pbthumbrow').hidden = scope !== 'fiche' || listing !== 'nda';
  $('#pbok').textContent = scope === 'lien' ? 'Protéger le lien' : 'Protéger la fiche';
}

function openProtectDialog(id, values){
  protectTarget = { id, values };
  $('#pbname').textContent = (values.title || id) + ' · ' + id;
  $('#pbthumb').value = values.thumb || '';
  $('#pbcode').value = '';
  $('#pbcode2').value = '';
  $('#pberr').textContent = '';
  document.querySelector('input[name="pbscope"][value="fiche"]').checked = true;
  document.querySelector('input[name="pblisting"][value="nda"]').checked = true;
  syncProtectDialog();
  $('#protectbox').classList.add('on');
  $('#pbcode').focus();
}

function closeProtectDialog(){
  $('#protectbox').classList.remove('on');
  $('#pbcode').value = '';
  $('#pbcode2').value = '';
  protectTarget = null;
}

async function protectProject(id){
  const r = await authFetch('/__project?id=' + encodeURIComponent(id));
  const d = await r.json();
  if (!d.ok){ status(d.reason, 'err'); return; }
  openProtectDialog(id, d.values);
}

async function runProtect(){
  if (!protectTarget) return;
  const { id, values } = protectTarget;
  const err = $('#pberr');
  const code = $('#pbcode').value;
  if (code.length < 6){ err.textContent = 'Code trop court : 6 caractères au minimum.'; return; }
  if (code !== $('#pbcode2').value){ err.textContent = 'Les deux codes diffèrent.'; return; }

  const scope = protectRadio('pbscope');
  $('#pbok').disabled = true;
  try {
    if (scope === 'lien') await protectLink(id, code, err);
    else await protectWholeProject(id, values, code, err);
  } finally {
    $('#pbok').disabled = false;
  }
}

async function protectWholeProject(id, values, code, err){
  const listing = protectRadio('pblisting');
  const lockedTitle = $('#pbtitle').value.trim() || 'Projet protégé';
  if (listing === 'nda' && !values.thumb){
    err.textContent = "Ce projet n'a pas de vignette : le mode NDA n'a rien à montrer.";
    return;
  }
  // En mode NDA la vignette reste lisible, donc elle ne bouge pas.
  const plan = planMediaMoves(values, id, listing === 'nda' ? [values.thumb] : []);
  if (plan.outside.length){
    const ok = confirm(`Ces médias ne sont pas dans projects/${id}/ :\n\n${plan.outside.join('\n')}\n\nIls appartiennent à un autre projet : ils resteront en place et resteront accessibles publiquement. Protéger quand même ?`);
    if (!ok) return;
  }
  status('Chiffrement…');
  plan.values.__mediaMap = plan.moves;
  const resource = await encryptPayload(id, code, { project: plan.values }, 600000);

  const rr = await authFetch('/__project-protect', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, resource, listing, lockedTitle, thumb: values.thumb || '', moves: plan.moves })
  });
  const dd = await rr.json();
  if (!dd.ok){ err.textContent = dd.reason || 'Protection refusée.'; return; }
  closeProtectDialog();
  const mode = listing === 'nda' ? 'vignette visible, verrou' : listing === 'hidden' ? 'masqué' : 'verrou seul';
  status(`Projet ${id} protégé (${mode}). ${dd.moved} média(s) déplacé(s) hors des chemins devinables.`, 'ok');
  if (dd.stamp) stamp = dd.stamp;
  await loadProjects();
  renderProjectList();
  reloadPreview();
  await loadChanges();
}

async function protectLink(id, code, err){
  const raw = $('#pburl').value.trim();
  let url;
  try { url = new URL(raw); } catch(e){ err.textContent = "Adresse invalide."; return; }
  if (url.protocol !== 'https:'){ err.textContent = "L'adresse doit être en HTTPS."; return; }
  const label = $('#pblabel').value.trim() || 'Open protected content';

  status('Chiffrement…');
  const resourceId = id + '-link';
  const resource = await encryptPayload(resourceId, code, { url: url.href }, 600000);
  resource.label = label;
  resource.provider = url.hostname.replace(/^www\./, '');
  resource.allowedHosts = [url.hostname.toLowerCase()];

  const rr = await authFetch('/__project-link', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, resource })
  });
  const dd = await rr.json();
  if (!dd.ok){ err.textContent = dd.reason || 'Protection refusée.'; return; }
  closeProtectDialog();
  status(`Lien protégé ajouté à ${id}. La fiche reste publique.`, 'ok');
  if (dd.stamp) stamp = dd.stamp;
  await loadProjects();
  renderProjectList();
  reloadPreview();
  await loadChanges();
}

async function removeProjectLink(id){
  if (!confirm(`Retirer le lien protégé de « ${id} » ?\n\nLa fiche n'affichera plus de bouton d'accès. L'adresse chiffrée est perdue : il faudra la ressaisir.`)) return;
  const r = await authFetch('/__project-link', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, remove: true })
  });
  const d = await r.json();
  if (!d.ok){ status(d.reason || 'Retrait refusé.', 'err'); return; }
  status(`Lien protégé retiré de ${id}.`, 'ok');
  if (d.stamp) stamp = d.stamp;
  await loadProjects();
  renderProjectList();
  reloadPreview();
  await loadChanges();
}

async function unprotectProject(id){
  const r = await authFetch('/__project?id=' + encodeURIComponent(id));
  const d = await r.json();
  if (!d.ok || !d.protectedResource){ status("Ressource protégée illisible.", 'err'); return; }

  const code = prompt("Code d'accès pour rouvrir cette fiche :");
  if (code === null) return;

  let fiche;
  try {
    const target = await window.KPProtectedContent.unlock(d.protectedResource, code);
    fiche = target.project;
  } catch(e){
    status(e && e.code === 'RATE_LIMITED' ? 'Trop de tentatives, attends un instant.' : "Code d'accès incorrect.", 'err');
    return;
  }

  const map = Array.isArray(fiche.__mediaMap) ? fiche.__mediaMap : [];
  const moves = map.map(m => ({ from: m.to, to: m.from }));
  const values = Object.assign({}, fiche);
  delete values.__mediaMap;
  for (const k of MEDIA_KEYS){
    const hit = map.find(m => m.to === values[k]);
    if (hit) values[k] = hit.from;
  }
  if (Array.isArray(values.galleryImages)){
    values.galleryImages = values.galleryImages.map(p => {
      const hit = map.find(m => m.to === p);
      return hit ? hit.from : p;
    });
  }

  const rr = await authFetch('/__project-unprotect', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, values, moves })
  });
  const dd = await rr.json();
  if (!dd.ok){ status(dd.reason || 'Levée de protection refusée.', 'err'); return; }
  status(`Projet ${id} redevenu public. ${dd.moved} média(s) remis dans projects/${id}/.`, 'ok');
  if (dd.stamp) stamp = dd.stamp;
  await loadProjects();
  renderProjectList();
  reloadPreview();
  await loadChanges();
}

let projectFormDirty = false;
$('#projects').addEventListener('input', () => { projectFormDirty = true; });
function pendingCount(){ return edits.size + frEdits.size + setEdits.size + medEdits.size + Number(projectFormDirty) + Number(visual.dirty()); }
const visual = createVisualEditor({
  host: $('#visual'), frame: $('#site'), request: authFetch, notify: status,
  canStart: () => !edits.size && !frEdits.size && !setEdits.size && !medEdits.size && !projectFormDirty,
  saved: async nextStamp => { stamp = nextStamp; await load(); reloadPreview(); await loadChanges(); }
});
async function showTab(which){
  if (which !== 'visual' && visual.isActive() && !visual.deactivate()) return;
  if (which === 'visual') {
    try { if (!(await visual.activate())) return; }
    catch(e) { status('Édition visuelle : ' + e.message, 'err'); return; }
    picking = false; detachPicking(); $('#pick').classList.remove('on');
    status('');
  }
  const map = { visual:'#tabVisual', texts:'#tabTexts', projects:'#tabProjects', media:'#tabMedia', settings:'#tabSettings', changes:'#tabChanges' };
  for (const [k, sel] of Object.entries(map)) $(sel).classList.toggle('on', k === which);
  $('#visual').hidden = which !== 'visual';
  $('#search').hidden = which === 'visual';
  $('#frFilters').hidden = which === 'visual';
  $('.actions').hidden = which === 'visual';
  $('#pick').disabled = which === 'visual';
  $('#list').classList.toggle('off', which !== 'texts');
  $('#projects').classList.toggle('on', which === 'projects');
  $('#media').classList.toggle('on', which === 'media');
  $('#settings').classList.toggle('on', which === 'settings');
  $('#changes').classList.toggle('on', which === 'changes');
  $('#medbox').classList.toggle('on', which === 'media');
  $('#setbox').classList.toggle('on', which === 'settings');
  $('#commitbox').classList.toggle('on', which === 'changes');
  if (which === 'projects' && !projectFormDirty) loadProjects();
  if (which === 'media') loadMedia();
  if (which === 'settings') loadSettings();
  if (which === 'changes') loadChanges();
}

for (const el of document.querySelectorAll('input[name="pbscope"], input[name="pblisting"]')){
  el.addEventListener('change', syncProtectDialog);
}
$('#pbok').addEventListener('click', runProtect);
$('#pbcancel').addEventListener('click', closeProtectDialog);
$('#protectbox').addEventListener('click', e => { if (e.target.id === 'protectbox') closeProtectDialog(); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#protectbox').classList.contains('on')) closeProtectDialog();
});

$('#tabTexts').addEventListener('click', () => showTab('texts'));
$('#tabVisual').addEventListener('click', () => showTab('visual'));
$('#tabProjects').addEventListener('click', () => showTab('projects'));
$('#tabMedia').addEventListener('click', () => showTab('media'));
$('#tabSettings').addEventListener('click', () => showTab('settings'));
$('#tabChanges').addEventListener('click', () => showTab('changes'));

$('#commit').addEventListener('click', async () => {
  if (pendingCount()){
    status('Enregistre d\'abord tes modifications en attente.', 'warn');
    return;
  }
  const msg = $('#cmsg').value.trim();
  if (!msg){ status('Écris un message de commit.', 'err'); return; }

  $('#commit').disabled = true;
  status('Commit en cours…');
  try{
    const r = await authFetch('/__commit', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: msg })
    });
    const d = await r.json();
    if (d.ok){
      status(`Commit ${d.hash} créé sur ${d.branch}. ` + (d.pushed ? 'Branche envoyée sur GitHub. La publication passe ensuite par main.' : 'Envoi sur GitHub non effectué : ' + (d.pushReason || 'à reprendre dans GitHub Desktop.')), d.pushed ? 'ok' : 'warn');
      $('#cmsg').value = '';
      await loadChanges();
    } else {
      status('Commit refusé : ' + (d.reason || 'raison inconnue'), 'err');
      $('#commit').disabled = false;
    }
  } catch(e){
    status('Erreur : ' + e.message, 'err');
    $('#commit').disabled = false;
  }
});

addEventListener('beforeunload', e => {
  if (!quitting && pendingCount()){ e.preventDefault(); e.returnValue = ""; }
});

async function boot(){
  await load();
  reloadPreview();
  await loadChanges();   // alimente le compteur de l'onglet des le demarrage
  await showTab('visual');
}

/* Un jeton deja present (rechargement de page) est reutilise s'il est
   toujours valide ; sinon authFetch renvoie sur l'ecran de deverrouillage. */
(async () => {
  if (token){
    try { await boot(); unlock(); return; } catch(e){}
  }
  lock('');
})();
