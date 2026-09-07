import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18767/';
const output='.codex-tmp/split-trace-fill-qa';fs.mkdirSync(output,{recursive:true});
async function seed(page){
 await page.evaluate(()=>{
  resetEditorState();activateSelectTool();activePage().canvasWidth=800;activePage().canvasHeight=500;
  const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="white"/><path d="M30 40H180V200H30Z" fill="#f89936" stroke="#183d69" stroke-width="4"/><path d="M180 40H290V115H180Z" fill="#309ac4" stroke="#183d69" stroke-width="4"/><path d="M180 115H290V200H180Z" fill="#97bb3f" stroke="#183d69" stroke-width="4"/><circle cx="105" cy="120" r="33" fill="white" stroke="#183d69" stroke-width="4"/></svg>');
  items=[{id:'qa-ref',name:'三色色區',type:'image',referenceOnly:true,preserveFull:true,src,x:120,y:40,w:560,h:420,r:0,opacity:.5,locked:false}];
  setOnlySelected('qa-ref');setCanvasAppearance('#ffffff',1);render();fitView();
 });
}
async function setup(page){
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'?storage=split-trace-fill-isolated-'+Date.now());await page.waitForFunction(()=>workspaceReady);await seed(page);
}
async function ready(page){
 await page.waitForFunction(()=>autoTraceResult!==null&&!document.getElementById('auto-trace-apply').disabled,{},{timeout:30000});
 await page.waitForFunction(()=>!autoTraceDialogMotion);
 await page.waitForFunction(()=>!autoTraceDialog.classList.contains('auto-trace-entering')&&getComputedStyle(document.querySelector('.auto-trace-heading')).opacity==='1');
 await page.evaluate(()=>Promise.all(autoTraceDialog.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
}
const state=page=>page.evaluate(()=>JSON.stringify(items));
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});await setup(page);
 assert.equal(await page.locator('.topbar #auto-trace').count(),1);assert.equal(await page.locator('.topbar #auto-fill').count(),1);
 await page.locator('#auto-trace').click();await ready(page);
 assert.equal(await page.locator('#auto-trace-title').textContent(),'自動描圖');assert.ok(await page.locator('#auto-trace-mode').isEnabled());
 assert.ok(await page.evaluate(()=>activeAutoTraceResult().items.every(it=>!it.autoTraceColored)));
 await page.locator('#auto-trace-apply').click();await page.waitForFunction(()=>!autoTraceDialog.open);
 const traceState=await state(page),traceIds=await page.evaluate(()=>items.filter(it=>it.autoTrace&&!it.autoTraceColored).map(it=>it.id));assert.ok(traceIds.length>0);
 await page.locator('#auto-fill').click();await ready(page);
 assert.equal(await page.locator('#auto-trace-title').textContent(),'自動填色');assert.ok(await page.locator('#auto-trace-mode').isEnabled());
 assert.ok(await page.locator('#auto-trace-close-border-label').isHidden());assert.ok(await page.locator('#auto-trace-issues-label').isHidden());
 assert.equal(await page.locator('#auto-trace-color').count(),0,'No combined-output checkbox remains');
 const preview=await page.evaluate(()=>({count:activeAutoTraceResult().items.length,allFill:activeAutoTraceResult().items.every(it=>it.autoTraceColored&&it.width===0)}));
 assert.ok(preview.count>=3&&preview.allFill,'Real worker returns independent no-stroke fill regions');
 await page.screenshot({path:output+'/desktop-fill-preview.png'});
 // Repeat apply during the real closing animation: exactly one append/Undo record.
 const historyBefore=await page.evaluate(()=>history.length);
 await page.locator('#auto-trace-apply').click();await page.evaluate(()=>applyAutoTrace());await page.waitForFunction(()=>!autoTraceDialog.open);
 assert.equal(await page.evaluate(()=>history.length),historyBefore+1);
 assert.equal(await page.evaluate(()=>items.filter(it=>it.autoTraceColored).length),preview.count);
 assert.equal(await page.evaluate(()=>JSON.stringify(items.filter(it=>!it.autoTraceColored))),traceState,'Fill cannot change or duplicate existing linework or the reference');
 const groups=await page.evaluate(()=>layerEntries().filter(e=>e.group).map(e=>({name:e.group.name,ids:e.members.map(it=>it.id)})));
 assert.deepEqual(groups.map(g=>g.name).sort(),['自動填色','自動描圖']);assert.deepEqual(groups.find(g=>g.name==='自動描圖').ids.sort(),traceIds.sort());
 const filledState=await state(page);
 await page.evaluate(()=>{clearSelectionState();render()});await page.screenshot({path:output+'/desktop-two-groups.png'});
 // Independent deletion of the fill folder leaves every line intact, with Undo.
 await page.evaluate(()=>{const g=layerEntries().find(e=>e.group?.name==='自動填色');selectLayerGroup(g.key)});
 await page.keyboard.press('Delete');assert.equal(await state(page),traceState);await page.keyboard.press('Control+z');assert.equal(await state(page),filledState);
 await page.keyboard.press('Control+z');assert.equal(await state(page),traceState);
 // Do not apply to a different page/source while the close transition is running.
 await page.locator('#auto-fill').click();await ready(page);await page.locator('#auto-trace-apply').click();
 await page.evaluate(()=>{byId('qa-ref').x+=1});await page.waitForFunction(()=>!autoTraceDialog.open);
 assert.equal(await page.evaluate(()=>items.filter(it=>it.autoTraceColored).length),0);assert.match(await page.locator('#status').textContent(),/沒有新增物件/);
 await page.evaluate(()=>{items=[];selected=null;render()});await page.locator('#auto-fill').click();assert.ok(await page.locator('#auto-trace-dialog').isHidden());assert.match(await page.locator('#status').textContent(),/請先匯入底圖/);
 await page.close();

 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mobile=await mobileContext.newPage();await setup(mobile);
 const beforeMobile=await state(mobile);
 await mobile.locator('#auto-fill').scrollIntoViewIfNeeded();const box=await mobile.locator('#auto-fill').boundingBox();assert.ok(box.y<200&&box.height>=40,'Fill is a reachable top toolbar button, not a bottom-only action');
 assert.equal(await mobile.locator('#auto-fill .tool-icon svg').count(),1);
 await mobile.locator('#auto-fill').tap();await ready(mobile);assert.equal(await mobile.locator('#auto-trace-title').textContent(),'自動填色');
 await mobile.locator('#auto-trace-apply').scrollIntoViewIfNeeded();await mobile.screenshot({path:output+'/mobile-fill-preview.png'});
 await mobile.locator('#auto-trace-apply').tap();await mobile.waitForFunction(()=>!autoTraceDialog.open);assert.ok(await mobile.evaluate(()=>items.some(it=>it.autoTraceColored)));
 await mobile.locator('#mobile-undo').tap();assert.equal(await state(mobile),beforeMobile);
 await mobile.locator('#auto-trace').scrollIntoViewIfNeeded();await mobile.locator('#auto-trace').tap();await ready(mobile);assert.equal(await mobile.locator('#auto-trace-title').textContent(),'自動描圖');
 await mobile.locator('#auto-trace-cancel').tap();await mobile.waitForFunction(()=>!autoTraceDialog.open);assert.equal(await state(mobile),beforeMobile);
 assert.deepEqual(errors,[]);console.log('Split trace/fill browser OK: real workers, separate outputs/groups, unchanged linework, delete/Undo, transition guards and mobile taps.');
}finally{await browser.close()}
