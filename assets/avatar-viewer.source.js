/* Bundled locally by tools/build-avatar.cjs. No CDN, account or remote service. */
import {
  ACESFilmicToneMapping, AnimationMixer, Box3, DirectionalLight, HemisphereLight,
  OrthographicCamera, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const clamp = value => Math.max(-1, Math.min(1, value));

function releaseModel(model) {
  const textures = new Set(), materials = new Set(), geometries = new Set(), skeletons = new Set();
  model?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of [object.material].flat().filter(Boolean)) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) { texture.source?.data?.close?.(); texture.dispose(); }
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

export async function mountAvatar(stage, { modelURL, signal, onState }) {
  const response = await fetch(modelURL, { signal });
  if (!response.ok) throw new Error('Avatar unavailable');
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
  const model = gltf.scene;
  if (signal.aborted) { releaseModel(model); return null; }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) { releaseModel(model); return null; }
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0, 0);
  canvas.setAttribute('aria-hidden', 'true');
  const scene = new Scene();
  scene.add(model);
  scene.add(new HemisphereLight(0xf2f4ff, 0x45352c, 1.45));
  const key = new DirectionalLight(0xfff2e5, 2.1);
  key.position.set(-2, 3, 4); scene.add(key);
  const fill = new DirectionalLight(0xe7eeff, 0.65);
  fill.position.set(2, 1, 2); scene.add(fill);
  const rim = new DirectionalLight(0xffd7b0, 1.2);
  rim.position.set(1, 2, -2); scene.add(rim);
  // Keep each exported material: skin, cloth, hair and lenses need different finishes.
  model.traverse(object => {
    if (object.isSkinnedMesh) object.frustumCulled = false;
    for (const material of [object.material].flat().filter(Boolean)) {
      if (/MetaHuman_(Hair|Beard|Moustache|Eyebrows)/.test(material.name)) {
        material.transparent = true;
        material.alphaTest = 0.01;
        material.depthWrite = false;
        material.color.multiplyScalar(material.name === 'MetaHuman_Hair' ? 1.7 : 1.3);
      }
      if (material.name === 'Clear_Lenses') material.depthWrite = false;
      if (material.name === 'Killian_Scan') material.color.multiplyScalar(2.2);
    }
  });

  const mixer = new AnimationMixer(model);
  for (const clip of gltf.animations) mixer.clipAction(clip).play();
  mixer.setTime(0.2);
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true);
  const center = bounds.getCenter(new Vector3());
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(center.x, center.y + 0.07, 3.4);
  camera.lookAt(center.x, center.y, 0);
  const height = Math.max(1.95, (bounds.max.y - bounds.min.y) * 1.23);
  const head = model.getObjectByName('BD_Head_jnt');
  const neck = model.getObjectByName('BD_Neck_jnt');
  const gazeBones = [neck, head].filter(Boolean).map((bone, i) => ({
    bone, weight: i === 0 ? 0.25 : 0.75, base: bone.quaternion.clone()
  }));
  const worldQ = new Quaternion(), inverseQ = new Quaternion(), turnQ = new Quaternion(), pitchQ = new Quaternion();
  const up = new Vector3(0, 1, 0), right = new Vector3(1, 0, 0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, contextLost = false, paused = false, visible = true, frameId = 0, previous = 0;
  let targetX = 0, targetY = 0, gazeX = 0, gazeY = 0, sensor = false, pointerAt = 0;
  const state = () => {
    stage.dataset.avatarPaused = String(paused || reduced.matches);
    onState({ ready: true, paused, reduced: reduced.matches });
  };
  const resetGaze = () => { targetX = targetY = 0; pointerAt = 0; };
  function render(delta = 0) {
    if (disposed || contextLost) return;
    for (const { bone, base } of gazeBones) bone.quaternion.copy(base);
    mixer.update(delta);
    for (const item of gazeBones) item.base.copy(item.bone.quaternion);
    if (pointerAt && performance.now() - pointerAt > 2400) resetGaze();
    const blend = 1 - Math.exp(-Math.max(delta, 1 / 30) * 7);
    gazeX += (targetX - gazeX) * blend;
    gazeY += (targetY - gazeY) * blend;
    model.updateMatrixWorld(true);
    for (const { bone, weight } of gazeBones) {
      bone.parent.getWorldQuaternion(worldQ);
      inverseQ.copy(worldQ).invert();
      turnQ.setFromAxisAngle(up, gazeX * 0.52 * weight);
      pitchQ.setFromAxisAngle(right, gazeY * 0.28 * weight);
      turnQ.multiply(pitchQ).premultiply(inverseQ).multiply(worldQ);
      bone.quaternion.premultiply(turnQ);
      bone.updateMatrixWorld(true);
    }
    renderer.render(scene, camera);
  }
  function stop() { cancelAnimationFrame(frameId); frameId = 0; previous = 0; }
  function running() { return !disposed && !contextLost && visible && !document.hidden && !paused && !reduced.matches; }
  function schedule() { if (!frameId && running()) frameId = requestAnimationFrame(frame); }
  function frame(time) {
    frameId = 0;
    if (!running()) return;
    if (!previous || time - previous >= 1000 / 30) {
      render(previous ? Math.min((time - previous) / 1000, 0.07) : 0);
      previous = time;
    }
    schedule();
  }
  function resize() {
    const width = stage.clientWidth, h = stage.clientHeight;
    if (!width || !h || disposed) return;
    camera.left = -height * width / h / 2; camera.right = -camera.left;
    camera.top = height / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); renderer.setSize(width, h, false); render();
  }
  const listenerOptions = { signal, passive: true };
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || sensor || !running()) return;
    const rect = stage.getBoundingClientRect();
    targetX = clamp((event.clientX - rect.left - rect.width / 2) / Math.max(innerWidth * 0.38, rect.width));
    targetY = clamp((event.clientY - rect.top - rect.height * 0.2) / Math.max(innerHeight * 0.45, rect.height));
    pointerAt = performance.now();
  }, listenerOptions);
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) resetGaze(); }, listenerOptions);
  window.addEventListener('blur', resetGaze, listenerOptions);
  window.addEventListener('kp:inclination', event => {
    sensor = !!event.detail?.active;
    resetGaze();
    if (sensor && running()) {
      targetX = clamp(event.detail.x * 2); targetY = clamp(event.detail.y * 2);
    }
  }, listenerOptions);
  document.addEventListener('visibilitychange', () => {
    stop(); resetGaze(); gazeX = gazeY = 0; sensor = false;
    if (!document.hidden) { render(); schedule(); }
  }, listenerOptions);
  reduced.addEventListener('change', () => {
    stop(); resetGaze(); gazeX = gazeY = 0; state(); render(); schedule();
  }, { signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; stop(); stage.dataset.avatarState = 'fallback';
    onState({ ready: false, paused: true, reduced: reduced.matches });
  }, { signal });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) { stop(); resetGaze(); } else schedule();
  });
  observer.observe(stage);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  stage.append(canvas); resize(); stage.dataset.avatarState = 'ready'; state(); schedule();
  const controller = {
    togglePaused() {
      paused = !paused; stop(); resetGaze(); gazeX = gazeY = 0; state(); render(); schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true; stop(); observer.disconnect(); resizeObserver.disconnect();
      mixer.stopAllAction(); mixer.uncacheRoot(model); releaseModel(model);
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    }
  };
  signal.addEventListener('abort', () => controller.dispose(), { once: true });
  return controller;
}
