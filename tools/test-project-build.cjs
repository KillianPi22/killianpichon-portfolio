/* Isolated fixtures only; never reads or copies the owner's authentication. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-project-pages-'));
const env = { ...process.env, NODE_PATH: path.join(root, 'node_modules') + path.delimiter + (process.env.NODE_PATH || '') };
const run = (...args) => execFileSync(process.execPath, [path.join(fixture, 'tools/build-projects.cjs'), ...args], { cwd: fixture, env, stdio: 'pipe' });
const file = name => path.join(fixture, name);
try {
  for (const name of ['index.html','sitemap.xml','CNAME','.nojekyll','data/projects.js','data/fr.js','data/technical.js','data/video-posters.js','assets/project-pages.js','assets/technical-library.js','tools/build-projects.cjs','tools/serve.ps1']) {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.copyFileSync(path.join(root, name), file(name));
  }
  run();
  run('--check');
  const before = fs.readFileSync(file('data/project-pages-manifest.json'), 'utf8');
  run();
  assert.equal(fs.readFileSync(file('data/project-pages-manifest.json'), 'utf8'), before, 'Idempotent dates and output');
  fs.writeFileSync(file('projects/traveler/media-sentinel.bin'), 'existing media');
  const source = { window: {} };
  vm.runInNewContext(fs.readFileSync(file('data/projects.js'), 'utf8'), source);
  const original = source.window.KP_PROJECTS.traveler;
  const save = () => fs.writeFileSync(file('data/projects.js'), 'window.KP_PROJECTS = ' + JSON.stringify(source.window.KP_PROJECTS, null, 2) + ';');
  for (const state of [{ ...original, listing: 'hidden' }, { date: original.date, listing: 'nda', protected: { version: 1 } }]) {
    source.window.KP_PROJECTS.traveler = state;
    save();
    run();
    assert(!fs.existsSync(file('projects/traveler/index.html')));
    assert(!fs.existsSync(file('projects/traveler/fr/index.html')));
    assert(!fs.readFileSync(file('sitemap.xml'), 'utf8').includes('/projects/traveler/'));
    assert.equal(fs.readFileSync(file('projects/traveler/media-sentinel.bin'), 'utf8'), 'existing media');
    source.window.KP_PROJECTS.traveler = original;
    save();
    run();
  }
  source.window.KP_PROJECTS.traveler = { ...original, title: 'Quoted "title" <script>throw 1</script> $&' };
  save();
  run();
  const html = fs.readFileSync(file('projects/traveler/index.html'), 'utf8');
  assert(!html.includes('<script>throw 1</script>'));
  assert(html.includes('$&'));
  assert.equal((html.match(/id="root"/g) || []).length, 1, 'Replacement metacharacters stay literal');
  source.window.KP_PROJECTS.traveler = original;
  save();
  // Exercise the real editor's generation and dependency preflight, without a server or auth.
  const check = '. "' + file('tools/serve.ps1').replace(/"/g,'""') + '" -NoServe; Invoke-ProjectBuild -VerifyDependencies; Update-Sitemap';
  execFileSync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-Command',check], { cwd:fixture, env, stdio:'pipe', windowsHide:true });
  run('--check');
  console.log('PASS: deterministic builds, hidden/protected page removal, media preservation, escaped text, editor generation and dependency preflight.');
} finally {
  // This exact mkdtemp fixture is disposable; no user paths or authentication were copied.
  const resolved = fs.realpathSync(fixture);
  assert(path.dirname(resolved).toLowerCase() === fs.realpathSync(os.tmpdir()).toLowerCase());
  assert(path.basename(resolved).startsWith('kp-project-pages-'));
  fs.rmSync(resolved, { recursive:true, force:true });
}
