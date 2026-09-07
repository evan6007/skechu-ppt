import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/';
const out='.codex-tmp/color-field-browser';fs.mkdirSync(out,{recursive:true});
const source='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><defs><linearGradient id="a" x2="1" y2=".7"><stop stop-color="#171f54"/><stop offset="1" stop-color="#297ea8"/></linearGradient><radialGradient id="b"><stop stop-color="#badcff"/><stop offset=".3" stop-color="#347de1"/><stop offset="1" stop-color="#32417a"/></radialGradient></defs><path d="M0 0H160V120H0Z" fill="url(#a)"/><ellipse cx="83" cy="64" rx="39" ry="31" fill="url(#b)"/><path d="M10 25Q67 5 135 26" fill="none" stroke="#b3b9d4" stroke-width="3"/></svg>';
const errors=[],browser=await chromium.launch({channel:'chrome',headless:true});
async function setup(page){
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'?v=87-native-fill&experiments=1&storage=field2d-test-'+Date.now()+Math.random());
 await page.waitForFunction(()=>workspaceReady&&typeof ColorFieldPreview!=='undefined');
 await page.evaluate(source=>{
  resetEditorState();items=[{id:'field-ref',name:'Synthetic multi-directional shading',type:'image',src:'data:image/svg+xml,'+encodeURIComponent(source),x:20,y:20,w:480,h:360,r:0,referenceOnly:true,preserveFull:true,opacity:.5,locked:false}];
  setOnlySelected('field-ref');render();fitView();
 },source);
}
const state=page=>page.evaluate(()=>JSON.stringify(items));
async function ready(page){await page.waitForFunction(()=>document.getElementById('auto-field-controls').dataset.ready==='true'&&!autoTraceDialogMotion&&!autoTraceJob,null,{timeout:45000})}
async function selectField(page){await page.locator('#auto-fill').scrollIntoViewIfNeeded();await page.locator('#auto-fill').click();await page.locator('#auto-trace-mode').selectOption('field2d-preview');await ready(page)}
try {
 const page=await browser.newPage({viewport:{width:1400,height:1100}});await setup(page);
 const before=await state(page);await selectField(page);
 assert(await page.locator('#auto-field-controls').isVisible());
 assert.equal(await page.locator('#auto-trace-lines [data-color-field-result]').count(),1);
 assert.equal(await page.locator('#auto-trace-anchors circle').count(),0);
 assert(await page.locator('#auto-trace-apply').isDisabled());
 assert(await page.locator('#auto-trace-advanced').isHidden());
 assert.match(await page.locator('#auto-trace-anchor-info').textContent(),/尚未.*套用.*PPT/);
 assert.equal(await state(page),before);
 await page.locator('#auto-field-quality').selectOption('balanced');await page.locator('#auto-field-quality').selectOption('detail');await ready(page);
 await page.locator('.auto-field-numeric summary').click();
 for(const [k,v] of Object.entries({x:40,y:25,w:80,h:65}))await page.locator('#auto-field-'+k).fill(String(v));
 await page.locator('#auto-field-region-apply').click();await ready(page);
 const stats=JSON.parse(await page.locator('#auto-field-controls').getAttribute('data-stats'));
 assert.deepEqual(stats.region,{x:40,y:25,w:80,h:65});assert.equal(stats.fitWidth,80);assert.equal(stats.fitHeight,65);assert.equal(stats.downsampled,false);
 assert.equal(await page.locator('#auto-trace-svg').getAttribute('viewBox'),'40 25 80 65');
 assert.deepEqual(await page.locator('#auto-field-image-clip').evaluate(e=>['x','y','width','height'].map(k=>e.getAttribute(k))),['40','25','80','65']);
 await page.locator('#auto-field-original').check();assert.equal(await page.locator('#auto-trace-lines').evaluate(e=>getComputedStyle(e).display),'none');
 assert.equal(await page.locator('#auto-trace-image image').getAttribute('opacity'),'1');await page.locator('#auto-field-original').uncheck();
 await page.locator('.auto-field-numeric summary').click();await page.screenshot({path:out+'/desktop-preview.png'});
 // Actual pointer drag in SVG source coordinates, including its letterboxing.
 await page.locator('#auto-field-select').click();
 assert.equal(await page.locator('#auto-field-image-clip').getAttribute('width'),'160');
 const coords=await page.evaluate(()=>{const m=document.getElementById('auto-trace-svg').getScreenCTM();return [{x:20,y:15},{x:130,y:95}].map(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(m);return{x:q.x,y:q.y}})});
 await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();await page.mouse.move(coords[1].x,coords[1].y,{steps:8});await page.mouse.up();await ready(page);
 const region=JSON.parse(await page.locator('#auto-field-controls').getAttribute('data-stats')).region;
 assert(Math.abs(region.x-20)<=1&&Math.abs(region.y-15)<=1&&Math.abs(region.w-110)<=2&&Math.abs(region.h-80)<=2);
 assert.equal(await page.locator('#auto-field-select').getAttribute('aria-pressed'),'false');
 // A direct Apply call also cannot bypass the preview-only guard.
 await page.evaluate(()=>applyAutoTrace());assert.equal(await state(page),before);
 await page.locator('#auto-trace-mode').selectOption('gradient');
 await page.waitForFunction(()=>autoTraceResult&&!document.getElementById('auto-trace-apply').disabled,null,{timeout:45000});
 assert(await page.locator('#auto-field-controls').isHidden());assert(await page.locator('#auto-trace-advanced').isVisible());
 assert.equal(await page.locator('#auto-trace-apply').textContent(),'套用色塊');
 assert(await page.locator('#auto-trace-lines linearGradient').count()>0);
 await page.locator('#auto-trace-mode').selectOption('field2d-preview');await page.locator('#auto-trace-cancel').click();
 await page.waitForFunction(()=>!autoTraceDialog.open&&!autoTraceJob);assert.equal(await state(page),before);
 // The packaged fallback worker runs the same real core without Blob URLs.
 const worker=await page.evaluate(async()=>{
  const im=new Image();im.src=items[0].src;await im.decode();const c=document.createElement('canvas');c.width=160;c.height=120;c.getContext('2d').drawImage(im,0,0);
  const data=c.getContext('2d').getImageData(0,0,160,120).data;
  return await new Promise((resolve,reject)=>{const w=new Worker('color-field-worker.js?v=85-field-preview');w.onerror=e=>{w.terminate();reject(Error(e.message))};w.onmessage=e=>{if(e.data.type==='progress')return;w.terminate();resolve({type:e.data.type,stats:e.data.stats,length:e.data.rgba?.length})};w.postMessage({width:160,height:120,data,quality:'detail'},[data.buffer])});
 });assert.equal(worker.type,'result');assert(worker.stats.controls>0&&worker.length>0);
 await page.evaluate(()=>{items[0].src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><circle cx="40" cy="30" r="20" fill="red"/></svg>');render()});
 await page.locator('#auto-fill').click();await page.locator('#auto-trace-mode').selectOption('field2d-preview');
 await page.waitForFunction(()=>document.getElementById('auto-trace-summary').textContent.includes('透明底圖'),null,{timeout:20000});
 assert(await page.locator('#auto-trace-apply').isDisabled());assert.equal(await page.locator('#auto-trace-lines [data-color-field-result]').count(),0);
 await page.locator('#auto-trace-cancel').click();await page.close();

 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mobile=await context.newPage();
 await setup(mobile);const mobileBefore=await state(mobile);await selectField(mobile);
 await mobile.locator('#auto-field-select').tap();await mobile.locator('#auto-trace-svg').scrollIntoViewIfNeeded();
 const touchCoords=await mobile.evaluate(()=>{const m=document.getElementById('auto-trace-svg').getScreenCTM();return [{x:35,y:25},{x:120,y:90}].map(p=>{const q=new DOMPoint(p.x,p.y).matrixTransform(m);return{x:q.x,y:q.y}})});
 const cdp=await context.newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchCoords[0]]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touchCoords[1]]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ready(mobile);
 const mobileRegion=JSON.parse(await mobile.locator('#auto-field-controls').getAttribute('data-stats')).region;
 assert(Math.abs(mobileRegion.x-35)<=2&&Math.abs(mobileRegion.w-85)<=3);
 await mobile.locator('#auto-field-controls').scrollIntoViewIfNeeded();await mobile.screenshot({path:out+'/mobile-preview.png'});
 await mobile.locator('#auto-trace-cancel').tap();assert.equal(await state(mobile),mobileBefore);await context.close();
 assert.deepEqual(errors,[]);console.log('2D field preview UI OK: visible mode, real Blob/HTTP workers, crop input and mouse/touch drag, comparison, cancellation, transparent-source error, no mutation/Apply, legacy gradient mode restored.');
} finally {await browser.close()}
