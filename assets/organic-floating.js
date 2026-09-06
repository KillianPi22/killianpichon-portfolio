/* Cadres flottants valides ; comparaison via ?explore=2. Les acces restent intacts. */
(() => {
  'use strict';
  const exploration = new URLSearchParams(location.search).get('explore');
  if (exploration === '1') return; // Conserver l'ancien comparateur explicite.
  const showControls = exploration === '2';
  if (!window.IntersectionObserver) return;
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const selector = '.kp-surface,.kp-panel-depth';
  const states = new Map(), active = new Set();
  const properties = ['x', 'y', 'z', 'rx', 'ry', 'rz'];
  const intensity = 1.5; // Amplitude souris validee ; les limites capteur restent independantes.
  // Les axes capteur vont de -.5 a .5 : au maximum 6 degres / 8 px pour une image,
  // 3 degres / 4 px pour une fenetre. Une inclinaison de 8,8 degres atteint la limite.
  const sensorResponse = 16;
  const sensorImageMotion = { angle: 12, travel: 16, depth: 3 };
  const sensorPanelMotion = { angle: 6, travel: 8, depth: 2 };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  let floating = true, hovered = null, frameId = 0, lastFrame = 0;
  let sensorOn = false, sensorPending = false, permissionAttempt = 0, sensorTimer = 0;
  let baseline = null, inclination = null;
  const sensorVisible = new Set();
  const t = text => window.KP_I18N?.t ? window.KP_I18N.t(text) : text;

  const panel = document.createElement('details');
  panel.className = showControls ? 'kp-exploration-panel' : 'kp-exploration-panel kp-inclination-panel';
  panel.innerHTML = `<summary>${showControls ? 'Exploration 02 · ' : ''}<span>${t(showControls ? 'Floating frames' : 'Device tilt')}</span></summary><div class="kp-exploration-options">${showControls ? `<button type="button" data-organic-choice="off" aria-pressed="false">${t('Previous motion')}</button><button type="button" data-organic-choice="on" aria-pressed="true">${t('Floating')}</button><p class="kp-exploration-note">${t('With a mouse, the frame follows gently, then settles.')}</p>` : ''}<div class="kp-inclination-controls"><button type="button" data-inclination-toggle aria-pressed="false" aria-describedby="kp-inclination-status"></button><button type="button" data-inclination-center hidden>${t('Recenter')}</button><p id="kp-inclination-status" class="kp-exploration-note" role="status"></p></div></div>`;
  document.body.append(panel);
  const sensorButton = panel.querySelector('[data-inclination-toggle]');
  const centerButton = panel.querySelector('[data-inclination-center]');
  const sensorStatus = panel.querySelector('#kp-inclination-status');
  html.dataset.kpOrganic = 'on';
  // Garder la langue, le capteur actif et le comparateur eventuel pendant la
  // navigation interne, sans recharger via le <base> du site.
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
    panel.querySelector('summary span').textContent = t(floating ? 'Floating frames' : 'Previous motion');
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
  pointer.addEventListener('change', () => { resetAll(); updateSensorControls(); });

  function updateSensorControls(message) {
    panel.hidden = !showControls && (pointer.matches || !window.DeviceOrientationEvent);
    sensorButton.disabled = sensorPending || !floating || reduced.matches || !window.isSecureContext || !window.DeviceOrientationEvent;
    sensorButton.textContent = t(sensorOn ? 'Disable tilt' : sensorPending ? 'Permission…' : 'Enable tilt');
    sensorButton.setAttribute('aria-pressed', String(sensorOn));
    centerButton.hidden = !sensorOn;
    if (message) sensorStatus.textContent = t(message);
    else if (reduced.matches) sensorStatus.textContent = t('Tilt is disabled while reduced motion is enabled.');
    else if (!window.isSecureContext) sensorStatus.textContent = t('Tilt requires HTTPS on a phone or tablet.');
    else if (!window.DeviceOrientationEvent) sensorStatus.textContent = t('Tilt is unavailable in this browser.');
    else if (!floating) sensorStatus.textContent = t('Choose Floating to try device tilt.');
    else if (!sensorOn && !sensorPending) sensorStatus.textContent = t('On a phone or tablet, enable tilt in your reading position. Sensor data stays on your device.');
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
    if (sensorOn) updateSensorControls('Hold your reading position: the next sensor reading recenters the frames.');
  }
  centerButton.addEventListener('click', recenter);
  if (screen.orientation?.addEventListener) screen.orientation.addEventListener('change', recenter);
  else addEventListener('orientationchange', recenter);
  sensorButton.addEventListener('click', async () => {
    if (sensorOn) { stopSensor(); return; }
    if (sensorButton.disabled) return;
    const attempt = ++permissionAttempt;
    sensorPending = true; updateSensorControls('Allow motion access if your browser asks.');
    try {
      // iOS exige cet appel directement dans le geste utilisateur, avant tout autre await.
      const permission = typeof DeviceOrientationEvent.requestPermission === 'function'
        ? await DeviceOrientationEvent.requestPermission() : 'granted';
      if (attempt !== permissionAttempt) return;
      if (permission !== 'granted') {
        stopSensor('Motion access was denied by the browser. On iPhone, fully close Safari or Chrome, reopen this page and try again. Choose “Allow” if prompted.');
        return;
      }
      sensorPending = false; sensorOn = true;
      resetAll(); baseline = inclination = null;
      html.dataset.kpInclination = 'on';
      registerSensorSurfaces();
      addEventListener('deviceorientation', onOrientation, { passive: true });
      updateSensorControls('Hold your reading position while the sensor is detected.');
      sensorTimer = setTimeout(() => {
        if (!baseline) stopSensor('Permission granted, but no sensor data received. Reload the page and try again in Safari or Chrome.');
      }, 4000);
    } catch {
      if (attempt === permissionAttempt) stopSensor('Tilt is unavailable. The frames remain still.');
    }
  });
  function onOrientation(event) {
    if (!sensorOn || !enabled() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!baseline) {
      baseline = { beta: event.beta, gamma: event.gamma, movementReceived: false };
      clearTimeout(sensorTimer);
      updateSensorControls('Sensor active. Tilt your device gently; Recenter adapts the effect to your reading position.');
    }
    const delta = (value, origin) => ((value - origin + 540) % 360) - 180;
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    const pitch = delta(event.beta, baseline.beta), roll = delta(event.gamma, baseline.gamma);
    // Zone neutre et quantification : le bruit du capteur ne maintient pas une animation au repos.
    const axis = value => Math.round(clamp(Math.sign(value) * Math.max(0, Math.abs(value) - .8) / sensorResponse, -.5, .5) * 100) / 100;
    inclination = { x: axis(roll * Math.cos(angle) + pitch * Math.sin(angle)), y: axis(pitch * Math.cos(angle) - roll * Math.sin(angle)) };
    if (!baseline.movementReceived && (inclination.x || inclination.y)) {
      baseline.movementReceived = true;
      updateSensorControls('Motion received. Visible frames follow device tilt; Recenter adapts the effect to your reading position.');
    }
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
      const sensorMotion = s.image ? sensorImageMotion : sensorPanelMotion;
      const angle = s.sensor ? sensorMotion.angle : s.angle * intensity;
      const travel = s.sensor ? sensorMotion.travel : s.travel * intensity;
      const depth = s.sensor ? sensorMotion.depth : s.depth * intensity;
      const values = {
        x: (s.x * travel).toFixed(3) + 'px', y: (s.y * travel * .7).toFixed(3) + 'px',
        z: (s.lift * depth).toFixed(3) + 'px',
        rx: (-s.y * angle).toFixed(3) + 'deg', ry: (s.x * angle).toFixed(3) + 'deg',
        rz: (s.sensor ? 0 : s.x * s.y * (s.image ? .7 : .4) * intensity).toFixed(3) + 'deg'
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
