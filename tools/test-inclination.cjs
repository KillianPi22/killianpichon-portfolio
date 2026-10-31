/* Exercise browser permission and lifecycle outcomes without a physical sensor. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/organic-floating.js'), 'utf8');
class Target {
  constructor() { this.listeners = new Map(); this.dataset = {}; this.attrs = {}; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) { for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event); }
  setAttribute(key, value) { this.attrs[key] = value; }
  append() {}
  querySelectorAll() { return []; }
}
function environment({ touch = true, reduced = false, secure = true, api = true, permission } = {}) {
  const win = new Target(), doc = new Target(), html = new Target(), panel = new Target();
  const toggle = new Target(), center = new Target(), status = new Target(), summary = new Target(), label = new Target();
  panel.querySelector = selector => ({ '[data-inclination-toggle]': toggle, '[data-inclination-center]': center, '#kp-inclination-status': status, summary, 'summary span': label })[selector];
  doc.documentElement = html; doc.body = new Target(); doc.hidden = false;
  doc.createElement = () => panel; doc.querySelector = () => null;
  const media = new Map();
  for (const [query, matches] of [['(any-pointer: coarse)', touch], ['(hover: hover) and (pointer: fine)', !touch], ['(prefers-reduced-motion: reduce)', reduced]]) {
    const item = new Target(); item.matches = matches; media.set(query, item);
  }
  const timers = new Map(); let timerId = 0, permissionCalls = 0;
  win.DeviceOrientationEvent = api ? (permission ? { requestPermission: () => { permissionCalls++; return permission(); } } : {}) : undefined;
  win.isSecureContext = secure; win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  const context = { window: win, document: doc, location: { search: '', hash: '' }, URLSearchParams,
    DeviceOrientationEvent: win.DeviceOrientationEvent, IntersectionObserver: win.IntersectionObserver,
    MutationObserver: class { observe() {} }, matchMedia: query => media.get(query),
    screen: { orientation: Object.assign(new Target(), { angle: 0 }) },
    addEventListener: win.addEventListener.bind(win), removeEventListener: win.removeEventListener.bind(win),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }
  };
  const events = []; win.addEventListener('kp:inclination', event => events.push(event.detail));
  vm.runInNewContext(source, context);
  return { win, doc, html, panel, toggle, status, label, summary, media, events,
    on: () => html.dataset.kpInclination === 'on', calls: () => permissionCalls,
    emit: (type, values = {}) => win.dispatchEvent({ type, ...values }),
    click: target => target.dispatchEvent({ type: 'click' }),
    visibility: hidden => { doc.hidden = hidden; doc.dispatchEvent({ type: 'visibilitychange' }); },
    reduction: matches => { const m = media.get('(prefers-reduced-motion: reduce)'); m.matches = matches; m.dispatchEvent({ type: 'change' }); },
    timeout: () => { for (const { fn } of [...timers.values()]) fn(); }
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const android = environment(); assert(android.on(), 'Compatible touch devices start automatically');
  android.emit('deviceorientation', { beta: 45, gamma: 0 });
  android.emit('deviceorientation', { beta: 45, gamma: 5 });
  assert.equal(android.events.at(-1).x, .26); assert.equal(android.events.at(-1).y, 0);
  android.visibility(true); assert(!android.on()); android.visibility(false); assert(android.on());
  android.click(android.toggle); android.visibility(true); android.visibility(false); assert(!android.on(), 'Manual disable survives backgrounding');
  android.click(android.toggle); assert(android.on());
  android.reduction(true); assert(!android.on()); android.reduction(false); assert(android.on());
  android.doc.dispatchEvent({ type: 'keydown', key: 'Tab' }); android.visibility(true); android.visibility(false); assert(!android.on(), 'Keyboard use stays still');

  let gesture = false;
  const ios = environment({ permission: async () => { if (!gesture) throw Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' }); return 'granted'; } });
  await settle(); assert(!ios.on()); assert.equal(ios.label.textContent, 'Enable tilt'); assert.equal(ios.calls(), 1);
  gesture = true; ios.click(ios.summary); await settle(); assert(ios.on(), 'The visible prompt starts permission directly from its click');
  ios.emit('deviceorientation', { beta: 30, gamma: 0 });
  ios.visibility(true); ios.visibility(false); await settle(); assert(ios.on()); assert.equal(ios.calls(), 2, 'Resume reuses this page session permission');

  const granted = environment({ permission: async () => 'granted' }); await settle(); assert(granted.on(), 'Existing permission starts automatically');
  const denied = environment({ permission: async () => 'denied' }); await settle(); denied.visibility(true); denied.visibility(false); await settle(); assert(!denied.on()); assert.equal(denied.calls(), 1, 'Denial does not trigger repeated requests');
  let grant; const pending = environment({ permission: () => new Promise(resolve => { grant = resolve; }) }); pending.visibility(true); grant('granted'); await settle(); assert(!pending.on(), 'A late permission result cannot start a hidden page');
  const silent = environment(); silent.timeout(); assert(!silent.on()); silent.visibility(true); silent.visibility(false); assert(!silent.on(), 'Absent sensor data does not cause retry loops');
  for (const options of [{ touch: false }, { reduced: true }, { secure: false }, { api: false }]) {
    const inactive = environment(options); assert(!inactive.on()); assert.equal(inactive.calls(), 0);
  }
  console.log('PASS: automatic touch startup, iOS gesture and cached permission, denial, late results, missing sensors, pause/resume, manual disable, keyboard, HTTPS and reduced motion.');
})().catch(error => { console.error(error); process.exitCode = 1; });
