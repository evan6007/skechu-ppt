import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/';
const installer='https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe';
const out='.codex-tmp/connector-setup-browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const windowsUA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const errors=[],copies=[];let online=false,interrupt=false,downloads=0,serviceRequests=0;
try {
  const context=await browser.newContext({viewport:{width:1360,height:940},userAgent:windowsUA,serviceWorkers:'block'});
  // Model an uninstalled service, then an installed one, without touching Office
  // or the real machine clipboard. Exercise the real UI and client transport.
  await context.route('http://127.0.0.1:8766/**',async route=>{
    serviceRequests++;const url=route.request().url(),headers={'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Private-Network':'true'};
    if(!online)return route.abort('connectionrefused');
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.endsWith('/status'))return route.fulfill({json:{ok:true,protocol:1,capabilities:['inline-copy','gradient-fill-v1']},headers});
    if(url.endsWith('/copy')){
      copies.push(route.request().postDataJSON());if(interrupt)return route.abort('connectionreset');
      return route.fulfill({headers,contentType:'application/x-ndjson',body:JSON.stringify({type:'result',ok:true,count:1})+'\n'});
    }
    return route.fulfill({status:404,headers});
  });
  await context.route(installer,async route=>{downloads++;return route.fulfill({contentType:'application/octet-stream',headers:{'Content-Disposition':'attachment; filename="Skechu-PPT-Windows-Setup.exe"'},body:'Download test fixture only; not an executable.'})});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'?mode=web&storage=connector-qa-'+Date.now());await page.waitForFunction(()=>workspaceReady);
  await page.evaluate(()=>{items=[{id:'copy-first',type:'box',x:25,y:30,w:90,h:70,fill:'#fa9235',color:'#123454',width:2}];setOnlySelected('copy-first');render();fitView()});
  const original=await page.evaluate(()=>JSON.stringify(items)),url=page.url();
  assert.equal(serviceRequests,0);assert.equal(downloads,0);
  await page.keyboard.press('Control+c');await page.locator('#clipboard-setup').waitFor({state:'visible',timeout:20000});
  assert.equal(copies.length,0);assert.equal(downloads,0);assert.equal(await page.evaluate(()=>JSON.stringify(items)),original);
  assert.equal(await page.locator('#clipboard-install').getAttribute('href'),installer);
  assert.equal(await page.locator('#clipboard-web-actions').isVisible(),false);
  for(const theme of ['graphite','mist','linen']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.screenshot({path:out+'/'+theme+'.png'});
  }
  await page.evaluate(()=>document.documentElement.dataset.theme='graphite');
  for(const width of [320,390]){
    await page.setViewportSize({width,height:740});await page.locator('#clipboard-retry').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#clipboard-setup').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Narrow layout must not overflow');
    const r=await page.locator('#clipboard-retry').boundingBox();assert.ok(r.height>=40&&r.x>=0&&r.x+r.width<=width);
    await page.locator('#clipboard-install').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/narrow-'+width+'.png'});
  }
  await page.setViewportSize({width:1360,height:940});await page.locator('#clipboard-install').scrollIntoViewIfNeeded();
  const download=page.waitForEvent('download');await page.locator('#clipboard-install').click();
  assert.equal((await download).suggestedFilename(),'Skechu-PPT-Windows-Setup.exe');
  assert.equal(downloads,1);assert.equal(context.pages().length,1);assert.equal(page.url(),url);assert.equal(copies.length,0);
  assert.equal(await page.evaluate(()=>JSON.stringify(items)),original);
  // Installation/return does not initiate a copy. Retry targets the new selection.
  online=true;await page.evaluate(()=>{items.push({id:'copy-second',type:'box',x:130,y:30,w:80,h:70,fill:'#48a2d8',width:0});setOnlySelected('copy-second');render()});
  assert.equal(copies.length,0);await page.locator('#clipboard-retry').click();
  await page.waitForFunction(()=>document.getElementById('clipboard-feedback').dataset.kind==='success');
  assert.equal(copies.length,1);assert.ok(copies[0].items.length>0&&copies[0].items.every(it=>/^copy-second(?:::paint-.*)?$/.test(it.id)));assert.equal(await page.locator('#clipboard-setup').isVisible(),false);
  // Subsequent Ctrl+C is direct; interrupted writes do not trigger installation
  // or a second POST. Existing artwork and the user's clipboard are not erased.
  await page.keyboard.press('Control+c');await page.waitForFunction(()=>!pptCopyRunning);assert.equal(copies.length,2);
  interrupt=true;await page.keyboard.press('Control+c');await page.waitForFunction(()=>!pptCopyRunning);assert.equal(copies.length,3);
  assert.equal(await page.locator('#clipboard-setup').isVisible(),false);assert.match(await page.locator('#clipboard-message').textContent(),/連線中斷/);
  const beforeUnsupported=serviceRequests;
  await page.evaluate(()=>{Object.defineProperty(navigator,'userAgentData',{value:{platform:'Android'},configurable:true})});
  await page.keyboard.press('Control+c');await page.waitForFunction(()=>document.getElementById('clipboard-title').textContent.includes('Windows 電腦'));
  assert.equal(serviceRequests,beforeUnsupported);assert.equal(await page.locator('#clipboard-setup').isVisible(),false);
  assert.equal(await page.locator('#clipboard-download-svg').isVisible(),true);
  await context.close();assert.deepEqual(errors,[]);
  console.log('Connector installation UI OK: offline guide, direct user-clicked download, no popup or drawing loss, desktop/narrow layouts, current-selection retry, direct subsequent Ctrl+C, no retry of uncertain writes, and unsupported-platform alternatives. Copy responses and installer body were controlled test fixtures.');
} finally {await browser.close()}
