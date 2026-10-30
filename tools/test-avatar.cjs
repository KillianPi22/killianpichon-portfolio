'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const bytes = fs.readFileSync(path.join(root, 'assets/profile/killian-avatar.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert(bytes.length < 5 * 1024 * 1024, 'Avatar must remain small enough for mobile');
const jsonSize = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonSize));
const binary = bytes.subarray(28 + jsonSize);
function values(index) {
  const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType, 5126, 'Expected floating-point animation/weights');
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
  const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const result = [];
  for (let i = 0; i < accessor.count; i++) for (let j = 0; j < width; j++) {
    const value = binary.readFloatLE(offset + i * (view.byteStride || width * 4) + j * 4);
    assert(Number.isFinite(value)); result.push(value);
  }
  return { result, width };
}
assert.equal(gltf.skins.length, 1);
for (const name of ['BD_Head_jnt', 'BD_Neck_jnt', 'L_BD_NB_Hip_jnt', 'R_BD_NB_Hip_jnt']) {
  assert(gltf.nodes.some(node => node.name === name), 'Missing joint: ' + name);
}
assert(gltf.animations.length > 0);
let hipsMove = 0;
for (const clip of gltf.animations) for (const channel of clip.channels) {
  const sampler = clip.samplers[channel.sampler];
  const time = values(sampler.input).result;
  assert(Math.abs(time.at(-1) - time[0] - 1.6) < 0.001, 'The walk must loop at a consistent duration');
  const { result, width } = values(sampler.output);
  for (let i = 0; i < width; i++) assert(Math.abs(result[i] - result[result.length - width + i]) < 0.001, 'Discontinuous loop');
  const node = gltf.nodes[channel.target.node];
  if (/Hip_jnt$/.test(node.name) && channel.target.path === 'rotation') {
    assert(result.some((v, i) => Math.abs(v - result[i % width]) > 0.05), 'The legs must move'); hipsMove++;
  }
  if (node.name === 'SKM_Killian_Pichon' && channel.target.path === 'translation') {
    for (let i = 0; i < result.length; i += 3) {
      assert(Math.abs(result[i] - result[0]) < 0.0001);
      assert(Math.abs(result[i + 2] - result[2]) < 0.0001, 'Root must not walk out of frame');
    }
  }
}
assert.equal(hipsMove, 2);
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  const weights = values(primitive.attributes.WEIGHTS_0).result;
  for (let i = 0; i < weights.length; i += 4) assert(Math.abs(weights.slice(i, i + 4).reduce((a, b) => a + b, 0) - 1) < 0.002);
}
for (const asset of [...gltf.buffers, ...gltf.images]) assert(!asset.uri, 'All model resources must be embedded');
assert.equal(fs.readFileSync(path.join(root, 'CNAME'), 'utf8').trim(), 'killianpichon.art');
assert(fs.existsSync(path.join(root, '.nojekyll')));
console.log('PASS: complete rig, two moving legs, continuous in-place loops, normalized skin weights, embedded resources, mobile size and Pages files.');

if (process.env.KP_TEST_ORIGIN) (async () => {
  const origin = process.env.KP_TEST_ORIGIN;
  for (const file of ['assets/avatar-viewer.js', 'assets/profile/killian-avatar.glb', 'assets/profile/killian-avatar.webp', 'assets/profile/normal-studio-can.webp']) {
    let directory = root;
    for (const segment of file.split('/')) { assert(fs.readdirSync(directory).includes(segment)); directory = path.join(directory, segment); }
    const response = await fetch(origin + '/' + file);
    assert.equal(response.status, 200, file);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(root, file)), file);
  }
  for (const file of ['tools/auth.json', 'tools/.backups/x', 'tools/.diagnostic-ping.log', '.git/HEAD', '.git', '.claude/settings.json']) {
    assert.equal((await fetch(origin + '/' + file)).status, 404, file);
  }
  assert.equal((await fetch(origin + '/__settings')).status, 401);
  console.log('PASS: HTTP assets, exact case and bytes, original photo preserved, sensitive files refused and editor authenticated.');
})().catch(error => { console.error(error); process.exitCode = 1; });
