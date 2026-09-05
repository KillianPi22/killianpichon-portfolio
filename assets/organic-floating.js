/* Apercu uniquement : ?explore=2. Aucun media, acces ou consentement n'est modifie. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('explore') !== '2') return;
  if (!window.IntersectionObserver) return;
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const selector = '.kp-surface,.kp-panel-depth';
  const states = new Map(), active = new Set();
  const properties = ['x', 'y', 'z', 'rx', 'ry', 'rz'];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  let floating = true, hovered = null, frameId = 0, lastFrame = 0;
  let sensorOn = false, sensorPending = false, permissionAttempt = 0, sensorTimer = 0;
  let baseline = null, inclination = null;
  const sensorVisible = new Set();

  const panel = document.createElement('details');
  panel.className = 'kp-exploration-panel';
  panel.innerHTML = '<summary>Exploration 02 · <span>Cadres flottants</span></summary><div class="kp-exploration-options"><button type="button" data-organic-choice="off" aria-pressed="false">Version publiée</button><button type="button" data-organic-choice="on" aria-pressed="true">Flottant</button><p class="kp-exploration-note">À la souris, le cadre suit doucement, puis revient se poser.</p><div class="kp-inclination-controls"><button type="button" data-inclination-toggle aria-pressed="false" aria-describedby="kp-inclination-status">Activer l’inclinaison</button><button type="button" data-inclination-center hidden>Recentrer</button><p id="kp-inclination-status" class="kp-exploration-note" role="status">Sur téléphone ou tablette, active l’inclinaison dans ta position de lecture. Les données restent sur l’appareil.</p></div></div>';
  document.body.append(panel);
  const sensorButton = panel.querySelector('[data-inclination-toggle]');
  const centerButton = panel.querySelector('[data-inclination-center]');
  const sensorStatus = panel.querySelector('#kp-inclination-status');
  html.dataset.kpOrganic = 'on';
  // Le <base> du site retire la query des ancres natives. Garder l'apercu et sa
  // langue pendant la navigation, uniquement dans cette variante opt-in.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#/"]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    event.preventDefault(); location.hash = link.getAttribute('href');
  });
  panel.querySelectorAll('[data-organic-choice]').forEach(button => button.addEventListener('click', () => {
    floating = button.dataset.organicChoice === 'on';
    stopSensor();
    html.dataset.kpOrganic = floating ? 'on' : 'off';
    panel.querySelector('summary span').textContent = floating ? 'Cadres flottants' : 'Version publiée';
    panel.querySelectorAll('[data-organic-choice]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    updateSensorControls();
  }));

  function enabled() { return floating && (pointer.matches || sensorOn) && !reduced.matches && !document.hidden; }
  function eligible(el) {
    return el?.isConnected && el.matches(selector) && !el.matches(':disabled,.thumb-locked,[hidden]') && !el.closest('[hidden]');
  }
  function editing(el) {
    return el.contains(document.activeElement) && document.activeElement.matches('input,textarea,select,[contenteditable="true"]');
  }
  function reset(s) {
    s.x = s.y = s.lift = s.vx = s.vy = s.vlift = s.tx = s.ty = s.tlift = 0;
    s.sensor = false;
    s.bounds = null;
    s.el.removeAttribute('data-kp-organic-active');
    properties.forEach(p => s.el.style.removeProperty('--kp-float-' + p));
    active.delete(s);
  }
  function resetAll() {
    cancelAnimationFrame(frameId); frameId = 0; lastFrame = 0; hovered = null;
    states.forEach(reset);
  }
  function release() {
    if (!hovered) return;
    hovered.tx = hovered.ty = hovered.tlift = 0;
    active.add(hovered); hovered = null; schedule();
  }
  function schedule() {
    if (!frameId && enabled() && active.size) frameId = requestAnimationFrame(frame);
  }
  function stateFor(el) {
    if (!states.has(el)) {
      const image = el.classList.contains('kp-surface');
      const client = !!el.closest('.clients-track,.clients-grid');
      const s = { el, image, angle: image || client ? 6 : 4, travel: image ? 6 : 4, depth: image ? 4 : 3 };
      reset(s); states.set(el, s);
    }
    return states.get(el);
  }

  document.addEventListener('pointermove', event => {
    if (!enabled() || sensorOn || !pointer.matches || event.pointerType !== 'mouse') return;
    const el = event.target.closest?.(selector);
    if (!eligible(el) || editing(el)) { release(); return; }
    const s = stateFor(el);
    if (hovered !== s) { release(); hovered = s; }
    // Le repere reste fixe pendant le survol pour eviter une boucle de poursuite
    // entre la position du curseur et les limites du cadre deja transforme.
    s.bounds ||= el.getBoundingClientRect();
    const r = s.bounds;
    if (!r.width || !r.height) return;
    s.tx = clamp((event.clientX - r.left) / r.width - .5, -.5, .5);
    s.ty = clamp((event.clientY - r.top) / r.height - .5, -.5, .5);
    s.tlift = 1;
    active.add(s); schedule();
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (hovered && !hovered.el.contains(event.relatedTarget)) release();
  }, { passive: true });
  document.addEventListener('pointercancel', resetAll, { passive: true });
  document.addEventListener('scroll', release, { passive: true, capture: true });
  document.addEventListener('focusin', event => {
    const el = event.target.closest?.(selector), s = states.get(el);
    if (s) { if (hovered === s) hovered = null; reset(s); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') stopSensor();
    else if (event.key === 'Escape') resetAll();
  });
  addEventListener('resize', resetAll, { passive: true });
  addEventListener('blur', resetAll);
  addEventListener('hashchange', resetAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSensor(); });
  reduced.addEventListener('change', () => { stopSensor(); updateSensorControls(); });
  pointer.addEventListener('change', resetAll);

  function updateSensorControls(message) {
    sensorButton.disabled = sensorPending || !floating || reduced.matches || !window.isSecureContext || !window.DeviceOrientationEvent;
    sensorButton.textContent = sensorOn ? 'Désactiver l’inclinaison' : sensorPending ? 'Autorisation…' : 'Activer l’inclinaison';
    sensorButton.setAttribute('aria-pressed', String(sensorOn));
    centerButton.hidden = !sensorOn;
    if (message) sensorStatus.textContent = message;
    else if (reduced.matches) sensorStatus.textContent = 'L’inclinaison est désactivée avec la réduction des mouvements.';
    else if (!window.isSecureContext) sensorStatus.textContent = 'L’inclinaison nécessite une connexion HTTPS sur téléphone ou tablette.';
    else if (!window.DeviceOrientationEvent) sensorStatus.textContent = 'L’inclinaison n’est pas disponible dans ce navigateur.';
    else if (!floating) sensorStatus.textContent = 'Choisis Flottant pour essayer l’inclinaison.';
    else if (!sensorOn && !sensorPending) sensorStatus.textContent = 'Sur téléphone ou tablette, active l’inclinaison dans ta position de lecture. Les données restent sur l’appareil.';
  }
  function stopSensor(message) {
    permissionAttempt++;
    sensorOn = sensorPending = false;
    clearTimeout(sensorTimer);
    removeEventListener('deviceorientation', onOrientation);
    sensorObserver.disconnect(); sensorVisible.clear();
    baseline = inclination = null;
    delete html.dataset.kpInclination;
    resetAll(); updateSensorControls(message);
  }
  function recenter() {
    baseline = inclination = null;
    resetAll();
    if (sensorOn) updateSensorControls('Garde ta position de lecture : le prochain mouvement recentre les cadres.');
  }
  centerButton.addEventListener('click', recenter);
  if (screen.orientation?.addEventListener) screen.orientation.addEventListener('change', recenter);
  else addEventListener('orientationchange', recenter);
  sensorButton.addEventListener('click', async () => {
    if (sensorOn) { stopSensor(); return; }
    if (sensorButton.disabled) return;
    const attempt = ++permissionAttempt;
    sensorPending = true; updateSensorControls('Autorise l’inclinaison si ton navigateur le demande.');
    try {
      // iOS exige cet appel directement dans le geste utilisateur, avant tout autre await.
      const permission = typeof DeviceOrientationEvent.requestPermission === 'function'
        ? await DeviceOrientationEvent.requestPermission() : 'granted';
      if (attempt !== permissionAttempt) return;
      if (permission !== 'granted') { stopSensor('Autorisation refusée. Les cadres restent stables au toucher.'); return; }
      sensorPending = false; sensorOn = true;
      resetAll(); baseline = inclination = null;
      html.dataset.kpInclination = 'on';
      registerSensorSurfaces();
      addEventListener('deviceorientation', onOrientation, { passive: true });
      updateSensorControls('Garde ta position de lecture pendant la détection du capteur.');
      sensorTimer = setTimeout(() => {
        if (!baseline) stopSensor('Aucun capteur disponible. Les cadres restent stables au toucher.');
      }, 4000);
    } catch {
      if (attempt === permissionAttempt) stopSensor('L’inclinaison est indisponible. Les cadres restent stables au toucher.');
    }
  });
  function onOrientation(event) {
    if (!sensorOn || !enabled() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!baseline) {
      baseline = { beta: event.beta, gamma: event.gamma };
      clearTimeout(sensorTimer);
      updateSensorControls('Incline doucement l’appareil. Recentrer adapte l’effet à ta position de lecture.');
    }
    const delta = (value, origin) => ((value - origin + 540) % 360) - 180;
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    const pitch = delta(event.beta, baseline.beta), roll = delta(event.gamma, baseline.gamma);
    // Zone neutre et quantification : le bruit du capteur ne maintient pas une animation au repos.
    const axis = value => Math.round(clamp(Math.sign(value) * Math.max(0, Math.abs(value) - .8) / 28, -.5, .5) * 100) / 100;
    inclination = { x: axis(roll * Math.cos(angle) + pitch * Math.sin(angle)), y: axis(pitch * Math.cos(angle) - roll * Math.sin(angle)) };
    updateSensorTargets();
  }
  const sensorObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) sensorVisible.add(entry.target);
      else { sensorVisible.delete(entry.target); const s = states.get(entry.target); if (s) reset(s); }
    });
    updateSensorTargets();
  });
  function registerSensorSurfaces() {
    if (!sensorOn) return;
    document.querySelectorAll(selector).forEach(el => {
      if (eligible(el)) { stateFor(el); sensorObserver.observe(el); }
    });
  }
  function updateSensorTargets() {
    if (!sensorOn || !inclination || !enabled()) return;
    const modal = document.querySelector('.modal-backdrop:not([hidden]),[role="dialog"][aria-modal="true"]');
    sensorVisible.forEach(el => {
      const s = states.get(el);
      if (!s) return;
      if (!eligible(el) || editing(el) || (modal && !modal.contains(el))) { reset(s); return; }
      const { x, y } = inclination, lift = x || y ? 1 : 0;
      if (s.tx === x && s.ty === y && s.tlift === lift) return;
      s.sensor = true; s.tx = x; s.ty = y; s.tlift = lift;
      active.add(s);
    });
    schedule();
  }
  updateSensorControls();

  function frame(now) {
    frameId = 0;
    if (!enabled()) { resetAll(); return; }
    const elapsed = Math.min(40, lastFrame ? now - lastFrame : 16) / 1000;
    lastFrame = now;
    const steps = Math.max(1, Math.ceil(elapsed * 120)), dt = elapsed / steps;
    active.forEach(s => {
      if (!eligible(s.el) || editing(s.el)) { if (hovered === s) hovered = null; reset(s); return; }
      // Ressort amorti independant de la cadence : petite inertie, sans mouvement perpetuel.
      for (let i = 0; i < steps; i++) {
        for (const axis of ['x', 'y', 'lift']) {
          s['v' + axis] += ((s['t' + axis] - s[axis]) * 150 - s['v' + axis] * (s.sensor ? 25 : 20)) * dt;
          s[axis] += s['v' + axis] * dt;
        }
      }
      const settled = ['x', 'y', 'lift'].every(axis => Math.abs(s['t' + axis] - s[axis]) < .001 && Math.abs(s['v' + axis]) < .01);
      if (settled) {
        active.delete(s);
        s.x = s.tx; s.y = s.ty; s.lift = s.tlift;
        s.vx = s.vy = s.vlift = 0;
        if (!s.tlift) { reset(s); return; }
      }
      const angle = s.sensor ? (s.image ? 1.5 : 1) : s.angle;
      const travel = s.sensor ? 1.6 : s.travel;
      const values = {
        x: (s.x * travel).toFixed(3) + 'px', y: (s.y * travel * .7).toFixed(3) + 'px',
        z: (s.lift * (s.sensor ? .5 : s.depth)).toFixed(3) + 'px',
        rx: (-s.y * angle).toFixed(3) + 'deg', ry: (s.x * angle).toFixed(3) + 'deg',
        rz: (s.sensor ? 0 : s.x * s.y * (s.image ? .7 : .4)).toFixed(3) + 'deg'
      };
      s.el.dataset.kpOrganicActive = 'true';
      properties.forEach(p => s.el.style.setProperty('--kp-float-' + p, values[p]));
    });
    if (active.size) schedule(); else lastFrame = 0;
  }

  // React peut reutiliser une tuile pour un placeholder : supprimer aussi son mouvement.
  new MutationObserver(() => {
    states.forEach((s, el) => {
      if (!eligible(el)) {
        if (hovered === s) hovered = null;
        sensorObserver.unobserve(el); sensorVisible.delete(el);
        reset(s); states.delete(el);
      }
    });
    registerSensorSurfaces();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'class'] });
})();
