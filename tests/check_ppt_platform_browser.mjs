import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/';
const out='.codex-tmp/ppt-platform-qa';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const cases=[
  ['windows','Windows',{platform:'Win32',userAgentData:{platform:'Windows'},userAgent:'Mozilla/5.0 Windows NT 10.0',maxTouchPoints:10}],
  ['mac','Mac',{platform:'MacIntel',userAgentData:null,userAgent:'Mozilla/5.0 Macintosh',maxTouchPoints:0}],
  ['ios','iPad',{platform:'MacIntel',userAgentData:null,userAgent:'Mozilla/5.0 Macintosh',maxTouchPoints:5}],
  ['ios','iPhone',{platform:'iPhone',userAgentData:null,userAgent:'Mozilla/5.0 iPhone like Mac OS X',maxTouchPoints:5}],
  ['android','Android',{platform:'Linux armv8l',userAgentData:null,userAgent:'Mozilla/5.0 Android',maxTouchPoints:5}],
  ['linux','Linux',{platform:'Linux x86_64',userAgentData:{platform:'Linux'},userAgent:'Mozilla/5.0 Linux',maxTouchPoints:0}],
  ['chromeos','ChromeOS',{platform:'Linux x86_64',userAgentData:null,userAgent:'Mozilla/5.0 CrOS',maxTouchPoints:0}],
  ['unknown','未辨識系統',{platform:'',userAgentData:null,userAgent:'Mozilla/5.0',maxTouchPoints:0}],
];
try{
  for(const [id,name,nav] of cases){
    const mobile=['ios','android'].includes(id),context=await browser.newContext({viewport:{width:mobile?390:1280,height:850},serviceWorkers:'block'});
    await context.addInitScript(nav=>{for(const [key,value] of Object.entries(nav))Object.defineProperty(navigator,key,{value,configurable:true})},nav);
    let effects=0;
    await context.route('http://127.0.0.1:8766/**',route=>{effects++;return route.abort()});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('download',()=>effects++);
    // No mode=web override: an ordinary localhost URL must also respect OS.
    await page.goto(base+'?v=94-system-copy&storage=os-qa-'+Date.now());
    await page.waitForFunction(()=>workspaceReady);
    assert.equal(await page.evaluate(()=>detectPptPlatform().id),id);
    assert.equal(await page.evaluate(()=>canPreparePpt()),id==='windows'&&new URL(base).hostname==='127.0.0.1');
    await page.locator('.export-menu > summary').click();
    assert.match(await page.locator('#ppt-platform-note').textContent(),new RegExp(name));
    await page.locator('#ppt-platform-note').click();
    assert.equal(await page.locator('#ppt-transfer-mode').inputValue(),'auto');
    await page.locator('#ppt-transfer-mode').selectOption('portable');
    assert.equal(effects,0,'Changing routing cannot copy, download or probe');
    assert.equal(await page.evaluate(()=>canPreparePpt()),false);
    const r=await page.locator('#ppt-transfer-mode').boundingBox();
    assert.ok(r.height>=40&&r.x>=0&&r.x+r.width<=(mobile?390:1280));
    if(name==='iPad'||name==='Windows')await page.screenshot({path:out+'/'+name+'.png'});
    await page.reload();await page.waitForFunction(()=>workspaceReady);
    assert.equal(await page.evaluate(()=>clipboardNeedsWindows()),true,'Manual routing preference survives reload');
    assert.equal(await page.locator('#copy-ppt').getAttribute('data-ppt-route'),'portable');
    assert.deepEqual(errors,[]);assert.equal(effects,0);
    await context.close();
  }
  console.log('Actual browser UI: 8 simulated OS profiles, detected labels, touch-sized mode selector, no-localhost preparation, persisted override and zero copy/download/probe side effects.');
}finally{await browser.close()}
