/* Run with Node + Playwright available (NODE_PATH may point to a shared install).
   Every write targets a temporary copy; the real auth.json is never read/copied. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-visual-test-'));
const port = Number(process.env.KP_TEST_PORT || 8137);
const origin = `http://localhost:${port}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, browser;
const consoleErrors = [], networkErrors = [], resources = new Set(), externalRequests = new Set();
function data(file, name) { const ctx={window:{}}; vm.runInNewContext(fs.readFileSync(path.join(fixture,file),'utf8'),ctx);return JSON.parse(JSON.stringify(ctx.window[name])); }
function check(condition, message) { assert(condition,message); console.log('PASS',message); }
function invariantProjects(before,after) {
  for(const [id,project] of Object.entries(before)) for(const [key,value] of Object.entries(project)) {
    if(['desc','impact'].includes(key) && id==='cabotage') continue;
    assert.deepEqual(after[id][key],value,`${id}.${key} changed`);
  }
}
async function testSession(context, password, auth) {
  const headers = {'X-Auth-Token':auth.token};
  check((await fetch(origin+'/__quit',{headers})).status===405,'quitting requires POST');
  check((await fetch(origin+'/__quit',{method:'POST'})).status===401,'quitting requires authentication');
  const meta = await (await fetch(origin+'/__meta',{headers})).json();
  if (process.env.KP_EXPECT_LAN) {
    assert.equal(meta.lanUrl, `http://${process.env.KP_EXPECT_LAN}:${port}/`);
    check((await fetch(meta.lanUrl)).ok,'public site responds through the LAN address');
    for (const file of ['tools/auth.json','tools/.backups/x','.git/HEAD','.claude/settings.json','tools/.diagnostic-ping.log']) {
      check((await fetch(meta.lanUrl+file)).status===404,'LAN address blocks private path: '+file);
    }
  }
  await fetch(origin+'/__ping?v=hidden');
  await delay(30000);
  check((await fetch(origin+'/')).ok,'hidden editor survives more than the former 25-second timeout');
  const launch = await context.newPage();
  // Simulate a browser that blocks automatic popups, then permits a real click.
  await launch.addInitScript(() => {
    if (!location.search.includes('launch=1')) return;
    const open = window.open.bind(window);
    let first = true;
    window.open = (...args) => { if (first) { first=false; return null; } return open(...args); };
  });
  await launch.goto(origin+'/__editor?launch=1');
  for (const width of [390,768,1440]) {
    await launch.setViewportSize({width,height:900});
    check(await launch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'launcher fits width '+width);
  }
  const popup = context.waitForEvent('page');
  await launch.locator('#open').click();
  const page = await popup;
  await page.waitForLoadState();
  page.on('pageerror',error=>consoleErrors.push(error.message));
  await page.locator('#pw').fill(password);await page.locator('#lockform button').click();
  await page.locator('#visual:not([hidden])').waitFor();
  await page.route('**/__quit',route=>route.fulfill({status:503,body:'Unavailable'}),{times:1});
  await page.locator('#quit').click();
  await page.getByText('Arrêt non confirmé. Réessaie ou ferme la fenêtre du serveur.',{exact:true}).waitFor();
  check(!page.isClosed() && await page.locator('#quit').isEnabled(),'failed shutdown keeps the editor open for retry');
  await page.locator('#visual-page').selectOption('#/about');
  const text=page.frameLocator('#site').locator('.about-intro-copy p[data-kp-editable]');
  await text.fill('Unsaved closing test');await text.press('Enter');
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#quit').click();
  check(!page.isClosed() && (await text.innerText())==='Unsaved closing test','cancelled quit preserves the draft');
  const sibling=await context.newPage();await sibling.goto(origin+'/');
  let dialogs=0;page.on('dialog',dialog=>{dialogs++;return dialog.accept();});
  const closed=page.waitForEvent('close');await page.locator('#quit').click();await closed;
  check(dialogs===1,'quitting a draft asks once, without a second unload prompt');
  check(!sibling.isClosed(),'Quit closes only the editor tab');
  for(let i=0;i<30 && server.exitCode===null;i++) await delay(100);
  check(server.exitCode===0,'Quit cleanly stops the server');
  check(consoleErrors.length===0,'editor lifecycle has no runtime errors');
}
async function main() {
  for(const name of ['index.html','privacy.html','sitemap.xml','CNAME','.nojekyll','data','assets','projects']) fs.cpSync(path.join(root,name),path.join(fixture,name),{recursive:true});
  fs.mkdirSync(path.join(fixture,'tools'),{recursive:true});
  for(const name of ['serve.ps1','visual-editor.ps1','local-network.ps1','launch-editor.html','editor.html','editor.js','editor.css','visual-editor.js']) fs.copyFileSync(path.join(root,'tools',name),path.join(fixture,'tools',name));
  const git = args => execFileSync('git',['-c','user.name=Editor test','-c','user.email=editor-test@example.invalid',...args],{cwd:fixture,windowsHide:true,stdio:'pipe'}).toString();
  git(['init','--initial-branch=main']);
  git(['add','index.html','data','sitemap.xml','CNAME','.nojekyll']);
  // Reproduce the first launch after upgrading: layout.js exists only on disk.
  git(['rm','--cached','--','data/layout.js']);git(['commit','-m','Test fixture baseline']);
  // Fresh test credentials, generated in memory, unrelated to the user's password.
  const password=crypto.randomBytes(32).toString('base64url'),salt=crypto.randomBytes(16);
  fs.writeFileSync(path.join(fixture,'tools/auth.json'),JSON.stringify({iter:310000,salt:salt.toString('base64'),hash:crypto.pbkdf2Sync(password,salt,310000,32,'sha256').toString('base64')}));
  server=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(fixture,'tools/serve.ps1'),'-Port',String(port),'-NoBrowser','-IdleTimeoutSeconds',process.argv.includes('--session')?'25':'600'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',b=>{serverLog+=b;});server.stderr.on('data',b=>{serverLog+=b;});
  for(let i=0;i<80;i++) {try {if((await fetch(origin+'/__ping')).ok)break;}catch{}if(i===79)throw Error('Server unavailable: '+serverLog);await delay(250);}
  check((await fetch(origin+'/__visual')).status===401,'visual API requires authentication');
  for(const rel of ['tools/auth.json','tools/.backups/file.txt','tools/.diagnostic-ping.log','.git/HEAD','.claude/settings.json','tools/../tools/auth.json']) check((await fetch(origin+'/'+rel)).status===404,'private path blocked: '+rel);
  const auth=await (await fetch(origin+'/__auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})})).json();
  assert(auth.ok,'test authentication');
  const initialReview=await(await fetch(origin+'/__changes',{headers:{'X-Auth-Token':auth.token}})).json();
  check(initialReview.ok,'change review works before layout.js has its first commit');
  check(!initialReview.changes.some(change=>change.section==='Disposition des blocs'),'uncommitted default layout does not create a false change');
  await delay(100);
  check(!/fatal:/i.test(serverLog),'new layout file does not print a fatal Git error');
  if (process.argv.includes('--git-review')) return;
  async function api(payload) {return (await fetch(origin+'/__visual',{headers:{'X-Auth-Token':auth.token,'Content-Type':'application/json'},...(payload?{method:'POST',body:JSON.stringify(payload)}:{})})).json();}
  const originalProjects=data('data/projects.js','KP_PROJECTS');
  let catalog=await api();check(catalog.entries.length>100,'visual catalog loads');
  const protectedIds=Object.entries(originalProjects).filter(([,p])=>p.protected).map(([id])=>id);
  check(!catalog.entries.some(e=>protectedIds.includes(e.project)),'protected projects excluded from editable catalog');
  const snapshot=()=>Object.fromEntries(['index.html','data/projects.js','data/fr.js','data/layout.js','sitemap.xml'].map(f=>[f,fs.readFileSync(path.join(fixture,f))]));
  const safety=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/test-visual-safety.ps1'),'-Fixture',fixture],{windowsHide:true,encoding:'utf8'});console.log(safety.trim());
  catalog=await api();
  const unchanged=snapshot();
  for(const payload of [
    {stamp:'stale',edits:[],layout:{}},
    {stamp:catalog.stamp,edits:[],layout:{home:['clients','clients']}},
    {stamp:catalog.stamp,edits:[],layout:{home:['media']}},
    {stamp:catalog.stamp,edits:[{id:'p:unknown:desc:0',lang:'en',text:'Invalid'}],layout:{}},
    {stamp:catalog.stamp,edits:[{id:catalog.entries[0].id,lang:'en',text:''}],layout:{}}
  ]) {const result=await api(payload);check(!result.ok,'invalid or stale visual save refused');assert.deepEqual(snapshot(),unchanged,'invalid request wrote files');}
  const single=catalog.entries.find(e=>e.kind==='project'&&e.list&&e.index===0&&e.fr&&catalog.entries.filter(p=>p.project===e.project&&p.field===e.field).length===1);
  assert(single,'single-item list fixture');
  let listResult=await api({stamp:catalog.stamp,edits:[{id:single.id,lang:'fr',text:single.fr+' Liste test.'}],layout:catalog.layout});
  check(listResult.ok && data('data/fr.js','KP_FR').projects[single.project][single.field][0].endsWith('Liste test.'),'single-item French list stays an array');
  catalog=await api();assert((await api({stamp:catalog.stamp,edits:[{id:single.id,lang:'fr',text:single.fr}],layout:catalog.layout})).ok);
  browser=await chromium.launch({headless:true,channel:process.env.KP_TEST_BROWSER || 'msedge'});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-CA'});
  if (process.argv.includes('--session')) { await testSession(context,password,auth); return; }
  const page=await context.newPage();
  context.on('request',req=>{if(!req.url().startsWith(origin))externalRequests.add(req.url());});
  context.on('response',res=>{if(res.url().startsWith(origin)){if(res.status()>=400)networkErrors.push(new URL(res.url()).pathname+': HTTP '+res.status());else resources.add(new URL(res.url()).pathname);}});
  page.on('pageerror',e=>consoleErrors.push(e.message));
  page.on('requestfailed',r=>{if(r.url().startsWith(origin))networkErrors.push(r.url().slice(origin.length)+': '+r.failure().errorText);});
  await page.goto(origin+'/__editor');
  await page.locator('#pw').fill(password);await page.locator('#lockform button').click();
  await page.locator('#visual:not([hidden])').waitFor();
  const frame=page.frameLocator('#site');
  if(process.argv.includes('--legacy')) {
    await page.locator('#tabTexts').click();await page.locator('#list .row').first().waitFor();
    await page.locator('#tabProjects').click();await page.locator('.prj').filter({hasText:'Cabotage'}).getByRole('button',{name:'Éditer',exact:true}).click();
    const field=page.locator('#projects [data-key="title"][data-lang="en"]');await field.fill('Draft title preserved');
    await page.locator('#tabTexts').click();await page.locator('#tabProjects').click();
    check(await field.inputValue()==='Draft title preserved','project form draft survives tab changes');
    await page.locator('#tabVisual').click();check(!(await page.locator('#visual').isVisible()),'visual editor cannot overwrite pending project form');
    page.once('dialog',dialog=>dialog.accept());await page.locator('#projects').getByRole('button',{name:'Retour',exact:true}).click();
    await page.locator('#tabMedia').click();await page.locator('#media .med').first().waitFor();
    await page.locator('#tabSettings').click();await page.locator('#settings .set').first().waitFor();
    await page.locator('#tabVisual').click();await page.locator('#visual:not([hidden])').waitFor();
    await page.locator('#visual-page').selectOption('#/project/cabotage');await frame.locator('h1[data-kp-editable]').waitFor();
    const title=frame.locator('h1[data-kp-editable]'),original=await title.textContent();await title.click();await title.press('Enter');
    check(await title.textContent()===original && await page.locator('#visual-save').isDisabled(),'focusing an uppercase heading does not change its source case');
    await page.locator('#widths button[data-w="390"]').click();
    check(await page.evaluate(()=>document.querySelector('#site').contentWindow.innerWidth)===390,'phone preview width is exact');
    await page.bringToFront();await page.setViewportSize({width:390,height:1000});await delay(1200);
    await page.screenshot({path:path.join(fixture,'editor-active-mobile.png')});
    check(consoleErrors.length===0,'legacy forms have no runtime errors');console.log('Screenshots:',fixture);return;
  }
  await page.locator('#visual-page').selectOption('#/about');
  await frame.locator('[data-kp-group="about"] [data-kp-block="expertise"]').waitFor();
  const text=frame.locator('.about-intro-copy p[data-kp-editable]');await text.waitFor();
  const before=await text.innerText();
  await text.fill(before+' Local preview test.');await text.press('Enter');
  await page.locator('#visual-undo').click();assert.equal(await text.innerText(),before);
  await page.locator('#visual-redo').click();assert.equal(await text.innerText(),before+' Local preview test.');
  await page.locator('#visual-undo').click();check(true,'direct text editing, undo and redo');
  await text.fill('Cancelled edit');await text.press('Escape');assert.equal(await text.innerText(),before);check(true,'Escape restores the previous text');
  await page.getByRole('button',{name:'Monter Formation',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#site').contentDocument.querySelector('[data-kp-group="about"]').children[2].dataset.kpBlock==='education');
  check(true,'block arrow changes preview order');
  await page.locator('#visual-undo').click();
  await page.getByRole('button',{name:'Déplacer Formation',exact:true}).dragTo(page.locator('#visual-blocks li[data-block="expertise"]'));
  await page.waitForFunction(()=>document.querySelector('#site').contentDocument.querySelector('[data-kp-group="about"]').children[0].dataset.kpBlock==='education');
  check(true,'drag-and-drop changes block order');
  await page.locator('#visual-save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('enregistrés localement'));
  await frame.locator('[data-kp-group="about"]').waitFor();
  assert.equal(await frame.locator('[data-kp-group="about"] > [data-kp-block]').first().getAttribute('data-kp-block'),'education');
  check(true,'order persists after saving and reload retains current page');
  await page.locator('#visual-page').selectOption('#/project/cabotage');
  await frame.locator('.project-summary p[data-kp-editable]').waitFor();
  const english=frame.locator('.project-summary p[data-kp-editable]').first();const oldEn=await english.innerText();
  await english.fill(oldEn+' Test EN.');await english.press('Enter');
  await page.locator('#visual-language').selectOption('fr');await frame.locator('html[lang="fr-CA"]').waitFor();
  const french=frame.locator('.project-summary p[data-kp-editable]').first();await french.waitFor();const oldFr=await french.innerText();
  await french.fill(oldFr+' Test FR.');await french.press('Enter');
  await page.locator('#tabTexts').click();check(await page.locator('#visual').isVisible(),'pending visual draft prevents silent tab loss');
  await page.locator('#visual-save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('enregistrés localement'));
  check(data('data/projects.js','KP_PROJECTS').cabotage.desc.endsWith('Test EN.'),'English project text saved');
  check(data('data/fr.js','KP_FR').projects.cabotage.desc.endsWith('Test FR.'),'French project text saved separately');
  invariantProjects(originalProjects,data('data/projects.js','KP_PROJECTS'));check(true,'all other project fields, media and protections preserved');
  const review=await(await fetch(origin+'/__changes',{headers:{'X-Auth-Token':auth.token}})).json();
  check(review.ok && review.changes.some(c=>c.section==='Traductions' && c.after.includes('Test FR.')),'French changes appear before/after in review');
  check(review.changes.some(c=>c.section==='Disposition des blocs'),'block order appears in review');
  check(await frame.getByText('Unreal Engine 5',{exact:true}).getAttribute('contenteditable')===null,'project tool names cannot edit an unrelated profile source');
  // Preserve a draft when the on-disk version changes outside the editor.
  const currentText=frame.locator('.project-summary p[data-kp-editable]').first();await currentText.waitFor();
  await currentText.fill('Brouillon a conserver');await currentText.press('Enter');
  fs.appendFileSync(path.join(fixture,'data/layout.js'),'\n');
  await page.locator('#visual-save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('ont change'));
  check((await page.locator('#visual-drafts').innerText()).includes('Brouillon a conserver'),'external conflict preserves the draft');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#visual-discard').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Brouillon abandonné'));
  // The source serializer must make closing script tags harmless, including pasted markup.
  catalog=await api();const source=catalog.entries.find(e=>e.kind==='source'&&e.section==='ContactScreen'&&e.en.startsWith('Reach out for general questions'));
  check(source,'source serializer fixture is present');
  const malicious='Plain text </script><script>window.badPaste=true</script> \\ " café';
  const result=await api({stamp:catalog.stamp,edits:[{id:source.id,lang:'en',text:malicious}],layout:catalog.layout});check(result.ok,'source text safely serialized');
  const publicPage=await context.newPage();publicPage.on('pageerror',e=>consoleErrors.push(e.message));
  await publicPage.goto(origin+'/?lang=en#/contact');await publicPage.waitForSelector('h1');
  check(!(await publicPage.evaluate(()=>window.badPaste)),'pasted markup never executes');
  check((await publicPage.locator('p').allTextContents()).includes(malicious),'pasted markup renders as plain text');
  // Restore that test text through the same API before responsive checks.
  catalog=await api();const entry=catalog.entries.find(e=>e.kind==='source'&&e.en===malicious);
  assert((await api({stamp:catalog.stamp,edits:[{id:entry.id,lang:'en',text:source.en}],layout:catalog.layout})).ok);
  for(const width of [390,768,1440]) {
    await page.bringToFront();
    await page.setViewportSize({width,height:1000});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'editor responsive at '+width);
    await delay(1100);
    await page.screenshot({path:path.join(fixture,'editor-'+width+'.png')});
    await publicPage.bringToFront();
    await publicPage.setViewportSize({width,height:1000});
    for(const route of ['#/','#/about','#/technical','#/project/cabotage','#/project/banquet','#/demos','#/contact']) {
      await publicPage.goto(origin+'/?lang=en'+route);await publicPage.waitForSelector('#root > div');await delay(120);
      check(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'site responsive '+width+' '+route);
    }
  }
  await publicPage.goto(origin+'/?lang=fr#/about');await publicPage.waitForSelector('[data-kp-group="about"]');
  assert.equal(await publicPage.locator('[data-kp-group="about"] > [data-kp-block]').first().getAttribute('data-kp-block'),'education');
  check(true,'saved layout applies outside editor in French');
  check(await publicPage.locator('[contenteditable],.kp-edit-overlay').count()===0,'public page has no editing UI');
  await publicPage.goto(origin+'/?lang=en#/project/cabotage');await publicPage.waitForSelector('.project-media-tile');
  await publicPage.locator('.project-media-tile[aria-pressed]').first().click();
  await publicPage.waitForSelector('.project-video-player iframe');
  check(await publicPage.locator('.project-video-player iframe').count()===1,'video still opens in the existing inline player');
  await publicPage.keyboard.press('Escape');await publicPage.waitForSelector('.project-video-player iframe',{state:'detached'});
  await publicPage.locator('.project-media-tile:not([aria-pressed]):not(a)').first().click();await publicPage.waitForSelector('[role="dialog"]');
  await publicPage.keyboard.press('ArrowRight');await publicPage.keyboard.press('Escape');await publicPage.waitForSelector('.modal-backdrop',{state:'detached'});
  await publicPage.getByRole('button',{name:'Next project',exact:true}).click();await delay(200);check(!publicPage.url().endsWith('/cabotage'),'project navigation remains functional');
  for(const route of ['#/about','#/technical','#/contact','#/demos']) {await publicPage.goto(origin+'/?lang=en'+route);await publicPage.waitForSelector('#root > div');}
  for(const resource of resources) {
    if(resource.startsWith('/__') || resource==='/') continue;
    let cursor=fixture;for(const part of decodeURIComponent(resource).split('/').filter(Boolean)) {assert(fs.readdirSync(cursor).includes(part),'wrong resource case: '+resource);cursor=path.join(cursor,part);}
  }
  check(true,'loaded local resources use exact filename case');
  check(![...externalRequests].some(url=>/google-analytics\.com|googletagmanager\.com/.test(url)),'no Analytics request before consent');
  // A stale content branch must never replace the current site on commit.
  git(['branch','content']);fs.appendFileSync(path.join(fixture,'index.html'),'\n<!-- fixture main update -->\n');git(['add','index.html']);git(['commit','-m','Advance test main']);
  const rejectedCommit=await(await fetch(origin+'/__commit',{method:'POST',headers:{'X-Auth-Token':auth.token,'Content-Type':'application/json'},body:JSON.stringify({message:'Should be refused'})})).json();
  check(!rejectedCommit.ok && rejectedCommit.reason.includes('main') && git(['branch','--show-current']).trim()==='main','stale content branch cannot replace main');
  for(const file of ['CNAME','.nojekyll'])assert.deepEqual(fs.readFileSync(path.join(fixture,file)),fs.readFileSync(path.join(root,file)));
  check(true,'custom domain and Pages marker unchanged');
  check(consoleErrors.length===0,'no browser runtime errors: '+consoleErrors.join('; '));
  check(networkErrors.length===0,'no failed local resources: '+networkErrors.join('; '));
  check(!/fatal:/i.test(serverLog),'no fatal Git diagnostics during editing and review');
  console.log('Screenshots:',fixture);
}
main().catch(e=>{console.error(e);console.error('Browser errors:',consoleErrors);console.error('Test fixture:',fixture);process.exitCode=1;}).finally(async()=>{
  await browser?.close();server?.kill();
  const testAuth=path.join(fixture,'tools/auth.json');if(fs.existsSync(testAuth))fs.unlinkSync(testAuth);
});
