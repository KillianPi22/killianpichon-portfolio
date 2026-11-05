/* Local editor only. No credentials or drafts are stored in the site iframe. */
window.createVisualEditor = function ({ host, frame, request, notify, saved, canStart }) {
  const labels = { home:'Accueil', about:'Profil', technical:'Technique', clients:'Clients', awards:'Prix',
    expertise:'Expertise', specializations:'Spécialisations', experience:'Expérience', education:'Formation',
    toolkit:'Outils', interests:'Domaines de recherche', studies:'Études de cas', overview:'Contexte',
    contribution:'Contribution', pipeline:'Étapes de production', technicalChallenges:'Défis',
    designIntent:'Intention', rnd:'Recherche', recognition:'Reconnaissance', impact:'Résultat' };
  let catalog = [], baseLayout = {}, layout = {}, version = null, active = false, editing = true, busy = false;
  let changes = new Map(), history = [], future = [], doc = null, observer = null, scheduled = false;
  let bindings = new Map(), focused = null, selection = null, drag = null, overlay = null, cleanup = [];
  let textLookup = new Map();
  const $ = selector => host.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();
  const currentLanguage = () => frame.contentWindow?.KP_I18N?.lang === 'fr' ? 'fr' : 'en';
  const projectId = () => (frame.contentWindow.location.hash.match(/^#\/project\/([a-z0-9-]+)$/) || [])[1];
  const isProtected = () => !!frame.contentWindow?.KP_PROJECTS?.[projectId()]?.protected;
  function readText(node) {
    if(node.nodeType===3) return node.nodeValue;
    if(node.nodeName==='BR') return '\n';
    let text='';
    for(const child of node.childNodes) {
      if(/^(DIV|P)$/.test(child.nodeName) && text && !text.endsWith('\n')) text+='\n';
      text+=readText(child);
    }
    return text;
  }
  const dirty = () => changes.size > 0 || !same(layout,baseLayout) || !!(focused && readText(focused.element) !== focused.before);
  function element(tag, text, className) {
    const el = document.createElement(tag); if (text) el.textContent = text; if(className) el.className = className; return el;
  }
  function button(text, action, title) {
    const b = element('button', text); b.type = 'button'; if(title) b.title = title; b.addEventListener('click',action); return b;
  }
  host.innerHTML = `<div class="visual-intro"><h2>Éditer sur la page</h2>
    <p>Clique un texte encadré pour le modifier. Déplace les blocs avec leur poignée ou les flèches.</p></div>
    <label for="visual-page">Page</label><select id="visual-page" aria-label="Page à éditer"></select>
    <div class="visual-row"><label for="visual-language">Langue</label><select id="visual-language"><option value="en">English</option><option value="fr">Français</option></select>
    <button id="visual-mode" type="button" aria-pressed="true">Édition active</button></div>
    <p id="visual-hint" class="visual-hint"></p>
    <div class="visual-row"><button id="visual-undo" type="button">Annuler</button><button id="visual-redo" type="button">Rétablir</button></div>
    <h3>Blocs de cette page</h3><p class="visual-hint">L’ordre est commun aux deux langues. Les blocs restent dans leur groupe pour conserver le rendu sur mobile.</p>
    <div id="visual-blocks"></div><h3>Brouillon local</h3><div id="visual-drafts"></div>
    <div class="visual-row visual-save"><button id="visual-save" type="button">Enregistrer</button><button id="visual-discard" type="button">Tout abandonner</button></div>
    <p class="visual-hint">Enregistrer modifie les fichiers locaux. La publication reste une étape séparée.</p>`;
  function snapshot() { return { changes: [...changes], layout: clone(layout) }; }
  function remember() { history.push(snapshot()); if(history.length>80) history.shift(); future=[]; }
  function restore(state) { changes=new Map(state.changes); layout=clone(state.layout); applyLayout(); scan(); render(); }
  function undo(redo=false) {
    finish(); const from = redo ? future : history, to = redo ? history : future;
    if(!from.length || busy) return; to.push(snapshot()); restore(from.pop());
  }
  $('#visual-undo').onclick=()=>undo(); $('#visual-redo').onclick=()=>undo(true);
  function value(entry, lang) { return changes.get(entry.id+':'+lang)?.text ?? entry[lang]; }
  function commitText(binding, text) {
    text = text.replace(/\r/g,'');
    if (!text.trim()) { notify('Un texte vide ne peut pas être enregistré. Le texte précédent est conservé.', 'warn'); return false; }
    if(text === value(binding.entry,binding.lang)) return true;
    remember(); const key=binding.entry.id+':'+binding.lang;
    if(text===binding.entry[binding.lang]) changes.delete(key);
    else changes.set(key,{id:binding.entry.id,lang:binding.lang,text});
    scan(); render(); return true;
  }
  function finish(cancel=false) {
    if(!focused) return;
    const f=focused; focused=null;
    const text=readText(f.element);
    f.element.textContent=text;
    f.element.removeAttribute('data-kp-writing');
    if(cancel || !commitText(f,text)) f.element.textContent=f.before;
    f.element.blur();
    render();
  }
  function match(text) {
    const lang=currentLanguage(), id=projectId(), n=normalize(text);
    if(!n) return null;
    const route=frame.contentWindow.location.hash.split('/')[1] || 'home';
    const sections={home:['HomeScreen','Hero','Clients','Awards'],about:['AboutScreen','AboutSection','ExperienceTimeline','EXPERIENCE','EDUCATION','CORE_EXPERTISE','SPECIALIZATIONS','LANGUAGES','TOOLKIT'],
      technical:['TechnicalScreen','TechSection'],contact:['ContactScreen'],demos:['DemosScreen'],project:['ProjectScreenContent']};
    let candidates=[...(textLookup.get(n)||[])].filter(e => (e.kind!=='project' || e.project===id) && (lang!=='en' || e.kind!=='ui') &&
      (e.kind!=='source' || (sections[route]||sections.home).includes(e.section)) &&
      (normalize(e[lang])===n || normalize(value(e,lang))===n));
    const project=candidates.filter(e=>e.kind==='project');
    if(project.length) candidates=project;
    // Never guess which repeated source occurrence should be rewritten.
    if(candidates.length>1 && lang==='fr' && candidates.every(e=>e.kind!=='project' && e.en===candidates[0].en)) candidates=candidates.slice(0,1);
    return candidates.length===1 ? {entry:candidates[0],lang} : null;
  }
  function schedule() {
    if(scheduled || !active) return; scheduled=true;
    frame.contentWindow.requestAnimationFrame(()=>{scheduled=false; scan(); renderBlocks(); positionOverlay();});
  }
  function scan() {
    if(!doc || !active) return;
    textLookup=new Map();
    const lang=currentLanguage();
    for(const entry of catalog) for(const text of [entry[lang],value(entry,lang)]) {
      const normalized=normalize(text);if(!normalized)continue;
      if(!textLookup.has(normalized)) textLookup.set(normalized,new Set());
      textLookup.get(normalized).add(entry);
    }
    for(const [el] of bindings) if(!el.isConnected) bindings.delete(el);
    if(isProtected()) { for(const [el] of bindings) clearBinding(el); bindings.clear(); $('#visual-hint').textContent='Fiche protégée : édition visuelle désactivée.'; return; }
    const root=doc.getElementById('root'); if(!root) return;
    // Only plain text leaves: never flatten links, line breaks, controls or rich markup.
    for(const el of root.querySelectorAll('h1,h2,h3,h4,p,li,span,div,figcaption')) {
      if(el.children.length || !el.textContent.trim() || el.closest('nav,button,a,form,[role="dialog"],.kp-protected-backdrop,svg')) continue;
      let binding=bindings.get(el);
      if(binding && binding!==focused && !el.hasAttribute('data-kp-writing') &&
        ![binding.lastRendered,binding.entry[binding.lang],value(binding.entry,binding.lang)].some(v=>normalize(v)===normalize(el.textContent))) {
        clearBinding(el); bindings.delete(el); binding=null;
      }
      if(!binding) {
        const hit=match(el.textContent); if(!hit) continue;
        binding={...hit,element:el,originalTab:el.getAttribute('tabindex')}; bindings.set(el,binding);
      }
      if(!el.hasAttribute('data-kp-writing')) {
        const text=value(binding.entry,binding.lang);
        if(el.textContent!==text) el.textContent=text;
        binding.lastRendered=text;
      }
      el.toggleAttribute('data-kp-editable',editing && !busy);
      if(editing && !busy) { el.setAttribute('contenteditable','plaintext-only'); el.setAttribute('tabindex','0'); }
      else clearBinding(el);
    }
    $('#visual-hint').textContent = isProtected() ? 'Fiche protégée : édition visuelle désactivée.' :
      `${bindings.size} textes repérés · ${currentLanguage()==='fr'?'français':'anglais'}. Entrée valide, Maj+Entrée ajoute une ligne, Échap annule la saisie.`;
  }
  function clearBinding(el) {
    el.removeAttribute('contenteditable'); el.removeAttribute('data-kp-editable');
    const b=bindings.get(el); if(b?.originalTab===null) el.removeAttribute('tabindex'); else if(b) el.setAttribute('tabindex',b.originalTab);
  }
  function applyLayout() {
    if(!frame.contentWindow?.KPLayout) return;
    frame.contentWindow.KP_LAYOUT=clone(layout);
    frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('kp-layout-preview'));
  }
  function groups() {
    if(!doc || isProtected()) return [];
    return [...doc.querySelectorAll('[data-kp-group]')].map(node=>({node,id:node.dataset.kpGroup,
      blocks:[...node.children].filter(el=>el.dataset.kpBlock)})).filter(g=>g.blocks.length>1);
  }
  function move(groupId, blockId, target) {
    finish(); if(busy) return;
    const group=groups().find(g=>g.id===groupId); if(!group) return;
    const ids=group.blocks.map(b=>b.dataset.kpBlock), from=ids.indexOf(blockId);
    if(from<0 || target<0 || target>=ids.length || from===target) return;
    remember(); ids.splice(target,0,ids.splice(from,1)[0]);
    // Hidden optional blocks retain their positions in the stored order.
    const old=layout[groupId] || []; let next=0;
    layout[groupId]=old.length ? old.map(id=>ids.includes(id)?ids[next++]:id).concat(ids.slice(next)) : ids;
    selection={groupId,blockId}; applyLayout(); render();
    notify(`${labels[blockId]||blockId} déplacé. Enregistre pour conserver cet ordre.`, 'ok');
  }
  function select(groupId,blockId) {
    selection={groupId,blockId};
    const block=groups().find(g=>g.id===groupId)?.blocks.find(b=>b.dataset.kpBlock===blockId);
    block?.scrollIntoView({block:'center',behavior:'smooth'}); positionOverlay();
  }
  function startDrag(e,groupId,blockId) {
    finish(); drag={groupId,blockId}; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',blockId);
  }
  function renderBlocks() {
    const target=$('#visual-blocks');
    const available=groups();
    const signature=JSON.stringify(available.map(g=>[g.id,g.blocks.map(b=>b.dataset.kpBlock)]))+busy;
    if(target.dataset.signature===signature) return; target.dataset.signature=signature; target.replaceChildren();
    if(!available.length) target.append(element('p',isProtected()?'Fiche protégée : blocs verrouillés.':'Aucun groupe de blocs déplaçables sur cette page.','visual-hint'));
    for(const group of available) {
      target.append(element('h4',labels[group.id] || (group.id.endsWith(':details')?'Colonnes de la fiche':'Récit de la fiche')));
      const list=element('ol',null,'visual-block-list'); target.append(list);
      group.blocks.forEach((block,i)=>{
        const id=block.dataset.kpBlock, label=labels[id]||id, row=element('li'); row.dataset.block=id;
        const handle=button('⠿',()=>select(group.id,id),'Repérer '+label); handle.draggable=!busy;
        handle.setAttribute('aria-label','Déplacer '+label); handle.ondragstart=e=>startDrag(e,group.id,id); handle.ondragend=()=>{drag=null;};
        const up=button('↑',()=>move(group.id,id,i-1),'Monter '+label), down=button('↓',()=>move(group.id,id,i+1),'Descendre '+label);
        up.setAttribute('aria-label','Monter '+label); down.setAttribute('aria-label','Descendre '+label);
        up.disabled=busy||i===0; down.disabled=busy||i===group.blocks.length-1;
        row.append(handle,element('span',label),up,down); list.append(row);
        row.ondragover=e=>{if(drag?.groupId===group.id) {e.preventDefault(); e.dataTransfer.dropEffect='move';}};
        row.ondrop=e=>{e.preventDefault(); if(drag?.groupId===group.id) move(group.id,drag.blockId,i); drag=null;};
      });
    }
  }
  function positionOverlay() {
    if(!overlay || !doc) return;
    doc.querySelectorAll('[data-kp-selected]').forEach(el=>el.removeAttribute('data-kp-selected'));
    const group=groups().find(g=>g.id===selection?.groupId), block=group?.blocks.find(b=>b.dataset.kpBlock===selection?.blockId);
    if(!block || !editing || !active || busy) {overlay.hidden=true; return;}
    const rect=block.getBoundingClientRect();
    if(rect.bottom<0 || rect.top>doc.defaultView.innerHeight) {overlay.hidden=true; return;}
    block.setAttribute('data-kp-selected',''); overlay.hidden=false;
    overlay.style.left=Math.max(4,Math.min(rect.left,doc.defaultView.innerWidth-200))+'px'; overlay.style.top=Math.max(4,rect.top-34)+'px';
    overlay.querySelector('span').textContent=labels[selection.blockId]||selection.blockId;
    const at=group.blocks.indexOf(block); overlay.querySelector('[data-up]').disabled=at===0; overlay.querySelector('[data-down]').disabled=at===group.blocks.length-1;
  }
  function listen(target,event,fn,options) {target.addEventListener(event,fn,options); cleanup.push(()=>target.removeEventListener(event,fn,options));}
  function attach() {
    detach(); if(!active) return;
    try {doc=frame.contentDocument; if(!doc?.getElementById('root')) return;} catch {return;}
    const style=doc.createElement('style'); style.textContent=`[data-kp-editable]{outline:1px dashed #ff825980;outline-offset:3px;cursor:text}[data-kp-editable]:focus{outline:2px solid #ff8259!important}[data-kp-writing]{white-space:pre-wrap}[data-kp-selected]{outline:2px dashed #ff8259!important;outline-offset:5px}.kp-edit-overlay{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:6px;background:#131316;color:#f5f4f0;border:1px solid #ff8259;border-radius:6px;padding:4px;font:12px system-ui}.kp-edit-overlay[hidden]{display:none}.kp-edit-overlay button{background:#1b1b20;color:white;border:1px solid #777;border-radius:3px;cursor:pointer;padding:3px 7px}.kp-edit-overlay button:disabled{opacity:.35}`;
    doc.head.append(style); cleanup.push(()=>style.remove());
    overlay=doc.createElement('div'); overlay.className='kp-edit-overlay'; overlay.hidden=true;
    overlay.innerHTML='<button type="button" draggable="true" aria-label="Déplacer ce bloc">⠿</button><span></span><button type="button" data-up aria-label="Monter ce bloc">↑</button><button type="button" data-down aria-label="Descendre ce bloc">↓</button>';
    doc.body.append(overlay); const toolbar=overlay; cleanup.push(()=>toolbar.remove());
    overlay.firstChild.ondragstart=e=>startDrag(e,selection.groupId,selection.blockId);
    for(const [selector,delta] of [['[data-up]',-1],['[data-down]',1]]) overlay.querySelector(selector).onclick=()=>{
      const g=groups().find(g=>g.id===selection.groupId); move(g.id,selection.blockId,g.blocks.findIndex(b=>b.dataset.kpBlock===selection.blockId)+delta);
    };
    listen(doc,'focusin',e=>{
      const b=bindings.get(e.target); if(!b || !editing || busy) return;
      finish(); focused={...b,before:e.target.textContent}; e.target.setAttribute('data-kp-writing','');
    },true);
    listen(doc,'focusout',e=>{if(focused?.element===e.target) finish();},true);
    listen(doc,'input',()=>render(),true);
    listen(doc,'keydown',e=>{
      if(!focused) return;
      if(e.key==='Escape' || (e.key==='Enter'&&!e.shiftKey)) {e.preventDefault();e.stopPropagation();finish(e.key==='Escape');}
    },true);
    listen(doc,'click',e=>{
      if(!editing || busy || isProtected()) return;
      const b=bindings.get(e.target); if(b) {e.preventDefault();e.stopPropagation();}
      const block=e.target.closest('[data-kp-block]'), group=block?.parentElement.closest('[data-kp-group]');
      if(group) {selection={groupId:group.dataset.kpGroup,blockId:block.dataset.kpBlock}; positionOverlay();}
    },true);
    listen(doc,'dragover',e=>{const group=e.target.closest('[data-kp-block]')?.parentElement.closest('[data-kp-group]');if(drag && group?.dataset.kpGroup===drag.groupId)e.preventDefault();},true);
    listen(doc,'drop',e=>{
      if(focused) {e.preventDefault();return;} // Never insert dropped HTML into editable text.
      const block=e.target.closest('[data-kp-block]'), g=groups().find(g=>g.id===drag?.groupId);
      if(g && g.blocks.includes(block)) {e.preventDefault();move(g.id,drag.blockId,g.blocks.indexOf(block));} drag=null;
    },true);
    listen(doc,'dragend',()=>{drag=null;},true);
    listen(doc.defaultView,'scroll',positionOverlay,{passive:true}); listen(doc.defaultView,'resize',positionOverlay);
    listen(doc.defaultView,'hashchange',()=>{finish();selection=null;bindings.forEach((_,el)=>clearBinding(el));bindings.clear();schedule();syncPage();});
    observer=new doc.defaultView.MutationObserver(schedule); observer.observe(doc.getElementById('root'),{childList:true,subtree:true,characterData:true});
    applyLayout(); scan(); syncPage(); render();
  }
  function detach() {
    finish(); observer?.disconnect(); observer=null;
    bindings.forEach((_,el)=>clearBinding(el));bindings.clear();
    doc?.querySelectorAll('[data-kp-selected]').forEach(el=>el.removeAttribute('data-kp-selected'));
    cleanup.splice(0).forEach(fn=>fn()); overlay=null; doc=null;
  }
  function syncPage() {
    if(!doc) return;
    const select=$('#visual-page'), route=frame.contentWindow.location.hash || '#/';
    select.replaceChildren();
    for(const [path,label] of [['#/','Accueil'],['#/about','Profil'],['#/technical','Technique'],['#/contact','Contact'],['#/demos','Autres démos']]) {
      const option=element('option',label);option.value=path;select.append(option);
    }
    for(const [id,p] of Object.entries(frame.contentWindow.KP_PROJECTS||{})) {
      if(p.protected) continue;
      const option=element('option',p.title);option.value='#/project/'+id;select.append(option);
    }
    select.value=route; $('#visual-language').value=currentLanguage();
  }
  function render() {
    $('#visual-save').disabled=busy||!dirty(); $('#visual-discard').disabled=busy||!dirty();
    $('#visual-undo').disabled=busy||!history.length;$('#visual-redo').disabled=busy||!future.length;
    const drafts=$('#visual-drafts');drafts.replaceChildren();
    if(!changes.size && same(layout,baseLayout)) drafts.append(element('p',focused?'Saisie en cours…':'Aucune modification en attente.','visual-hint'));
    for(const change of changes.values()) {
      const entry=catalog.find(e=>e.id===change.id), row=element('div',null,'chg');
      row.append(element('div',`${entry?.section} · ${change.lang.toUpperCase()}`,'meta'),element('div',entry?.[change.lang],'before'),element('div',change.text,'after'));drafts.append(row);
    }
    if(!same(layout,baseLayout)) drafts.append(element('p','Ordre des blocs modifié.','visual-hint'));
    renderBlocks();
  }
  async function load() {
    const res=await request('/__visual'), data=await res.json();
    if(!res.ok || !data.entries) throw Error(data.reason||'Chargement impossible.');
    catalog=data.entries;baseLayout=clone(data.layout);layout=clone(data.layout);version=data.stamp;changes.clear();history=[];future=[];
  }
  async function activate() {
    if(active) return true;
    if(!canStart()) {notify('Enregistre les modifications du panneau avant de passer en édition visuelle.','warn');return false;}
    await load();active=true;attach();return true;
  }
  function deactivate() {if(dirty()){notify('Enregistre ou abandonne le brouillon visuel avant de changer d’onglet.','warn');return false;} active=false;detach();return true;}
  $('#visual-mode').onclick=()=>{finish();editing=!editing;$('#visual-mode').textContent=editing?'Édition active':'Navigation';$('#visual-mode').setAttribute('aria-pressed',String(editing));scan();positionOverlay();};
  $('#visual-page').onchange=()=>{finish();frame.contentWindow.location.hash=$('#visual-page').value;};
  $('#visual-language').onchange=()=>{finish();const url=new URL(frame.contentWindow.location.href);url.searchParams.set('lang',$('#visual-language').value);frame.src=url.href;};
  $('#visual-discard').onclick=async()=>{
    if(!confirm('Abandonner tous les textes et déplacements non enregistrés ?')) return;
    finish(true); busy=true;
    try { await load(); await saved(version); notify('Brouillon abandonné. Fichiers rechargés.','ok'); }
    catch(error) { notify(error.message,'err'); }
    finally { busy=false;applyLayout();scan();render(); }
  };
  $('#visual-save').onclick=async()=>{
    finish(); if(!dirty()||busy) return;
    busy=true;scan();render();notify('Enregistrement du brouillon…');
    try {
      const res=await request('/__visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stamp:version,edits:[...changes.values()],layout})});
      const result=await res.json();if(!result.ok) throw Error(result.reason||'Enregistrement refusé.');
      changes.clear();history=[];future=[];baseLayout=clone(layout);version=result.stamp;
      await saved(result.stamp);await load();
      notify('Textes et blocs enregistrés localement.','ok');
    } catch(error) {notify(error.message,'err');}
    finally {busy=false;scan();render();}
  };
  frame.addEventListener('load',()=>{if(active)attach();});
  return {activate,deactivate,dirty,finish,isActive:()=>active,isBusy:()=>busy,refresh:async()=>{if(!dirty()){await load();attach();}}};
};
