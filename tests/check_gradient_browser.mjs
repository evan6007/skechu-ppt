import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18767/';
const output='.codex-tmp/gradient-browser-qa';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
async function setup(page){
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'?storage=gradient-isolated-'+Date.now());await page.waitForFunction(()=>workspaceReady);
 await page.evaluate(()=>{
  resetEditorState();activateSelectTool();activePage().canvasWidth=900;activePage().canvasHeight=600;
  items=[{id:'gradient-test',name:'漸層測試色塊',type:'ellipse',x:100,y:80,w:380,h:300,fill:'#38bdf8',stroke:'#172554',strokeWidth:3,opacity:1},
   {id:'other',name:'不受影響',type:'box',x:530,y:200,w:200,h:170,fill:'#f97316',stroke:'#172554',strokeWidth:3,opacity:1}];
  setOnlySelected('gradient-test');setCanvasAppearance('#ffffff',1);render();fitView();
 });
}
const state=page=>page.evaluate(()=>JSON.stringify(items));
const stops=page=>page.evaluate(()=>byId('gradient-test').fillGradient?.stops.length);
async function enter(page,id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).blur()}
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});await setup(page);
 const initial=await state(page);await page.locator('#gradient-fill').click();assert.ok(await page.locator('#gradient-editor').isVisible());assert.equal(await stops(page),3);
 await page.locator('#gradient-add-stop').click();assert.equal(await stops(page),4);
 await enter(page,'gradient-color','#f472b6');await enter(page,'gradient-position',65);await enter(page,'gradient-angle',35);
 await page.locator('#gradient-opacity').fill('20');await page.locator('#gradient-opacity').blur();
 assert.equal(await page.evaluate(()=>byId('gradient-test').fillGradient.stops[3].opacity),.8);
 assert.equal(await page.evaluate(()=>byId('other').fill), '#f97316');
 // Color-stop drag uses one history entry even across multiple pointer moves.
 const before=await state(page),h=await page.evaluate(()=>history.length);
 const stop=await page.locator('[data-stop="3"]').boundingBox(),strip=await page.locator('#gradient-stops').boundingBox();
 await page.mouse.move(stop.x+stop.width/2,stop.y+stop.height/2);await page.mouse.down();await page.mouse.move(strip.x+strip.width*.2,stop.y+stop.height/2,{steps:20});await page.mouse.up();
 assert.equal(await page.evaluate(()=>history.length),h+1);assert.ok(await page.evaluate(()=>Math.abs(byId('gradient-test').fillGradient.stops[3].position-.2)<.02));
 await page.keyboard.press('Control+z');assert.equal(await state(page),before);
 await page.keyboard.press('Control+Shift+z'); // Either redo shortcut is handled by the editor.
 await page.evaluate(()=>{setOnlySelected('gradient-test');render()});if(await page.locator('#gradient-editor').isHidden())await page.locator('#gradient-fill').click();
 await page.locator('#gradient-reverse').click();
 // Invalid input cannot create a bogus gradient/history entry.
 const valid=await state(page);await enter(page,'gradient-position',150);assert.equal(await state(page),valid);
 await page.locator('#gradient-position').fill('50');await page.locator('#gradient-position').blur();
 while(await stops(page)<10)await page.locator('#gradient-add-stop').click();assert.ok(await page.locator('#gradient-add-stop').isDisabled());
 while(await stops(page)>2)await page.locator('#gradient-delete-stop').click();assert.ok(await page.locator('#gradient-delete-stop').isDisabled());
 await page.locator('#gradient-add-stop').click();await page.locator('#gradient-color').fill('#f472b6');await page.locator('#gradient-color').blur();
 await page.screenshot({path:output+'/desktop.png'});
 const painted=await page.evaluate(()=>{const result=JSON.parse(nativeBody());return{items:result.items,selected:byId('gradient-test'),defs:scene.querySelectorAll('linearGradient').length}});
 assert.ok(painted.defs>0);assert.ok(painted.items.find(i=>i.paintLayer==='fill'&&i.fillGradient));
 // Real selection export keeps defs and renders with non-flat colors.
 const exported=await page.evaluate(async()=>{const {blob}=await selectionSvgBlob();return blob.text()});
 assert.match(exported,/<linearGradient/);fs.writeFileSync(output+'/selection.svg',exported);
 const pixels=await page.evaluate(async text=>{
  const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(text);await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const context=c.getContext('2d');context.drawImage(img,0,0);
  return[.25,.5,.75].map(x=>Array.from(context.getImageData(Math.round(c.width*x),Math.round(c.height*.5),1,1).data));
 },exported);assert.ok(new Set(pixels.map(p=>p.join(','))).size>1,'Exported SVG must retain gradient colors');
 // .skc uses JSON metadata; autosave reload must retain all stops exactly.
 await page.evaluate(()=>syncActivePage());const saved=await state(page);await page.evaluate(()=>queueAutosave());
 await page.waitForFunction(()=>document.getElementById('autosave-status')?.textContent==='已自動保存');
 await page.reload();await page.waitForFunction(()=>workspaceReady);assert.equal(await state(page),saved,'Persisted gradient survives a real browser reload');
 // Isolated page roundtrip through the actual project switch path.
 await page.evaluate(()=>openPage(activePageId));assert.equal(await state(page),saved);assert.ok(await page.locator('#gradient-editor').isHidden());
 await page.evaluate(()=>{setOnlySelected('gradient-test');render()});await page.locator('#gradient-fill').click();
 await page.locator('#gradient-solid').click();assert.equal(await stops(page),undefined);await page.keyboard.press('Control+z');assert.ok(await stops(page)>=2);
 await page.locator('#gradient-fill').click();await page.evaluate(()=>{byId('gradient-test').locked=true;render()});assert.ok(await page.locator('#gradient-editor').isHidden());
 const locked=await state(page);await page.locator('#gradient-fill').click();assert.equal(await state(page),locked);assert.match(await page.locator('#status').textContent(),/未鎖定/);
 await page.evaluate(()=>{byId('gradient-test').locked=false;setOnlySelected('gradient-test');render()});await page.locator('#gradient-fill').click();
 await page.evaluate(()=>{selectedIds.add('other');render()});assert.ok(await page.locator('#gradient-editor').isHidden());
 const multi=await state(page);await page.locator('#gradient-fill').click();assert.equal(await state(page),multi);
 // Mobile: genuine touch pointer capture on a compact sheet, not a fullscreen dialog.
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});await setup(mobile);
 await mobile.locator('#gradient-fill').tap();const box=await mobile.locator('#gradient-editor').boundingBox();assert.ok(box.height<=422&&box.width<=374);
 const s=await mobile.locator('[data-stop="1"]').boundingBox(),track=await mobile.locator('#gradient-stops').boundingBox(),cdp=await mobile.context().newCDPSession(mobile);
 const mh=await mobile.evaluate(()=>history.length),y=s.y+s.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:s.x+s.width/2,y,id:1}]});
 for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:track.x+track.width*(.5+.25*i/12),y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await mobile.evaluate(()=>history.length),mh+1);assert.ok(await mobile.evaluate(()=>Math.abs(byId('gradient-test').fillGradient.stops[1].position-.75)<.025));
 await mobile.screenshot({path:output+'/mobile.png'});
 assert.deepEqual(errors,[]);console.log('Desktop/mobile gradient editor, touch drag, undo, bounds, SVG and native metadata checks passed.');
}finally{await browser.close()}
