import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 const root=process.env.SKECHU_TEST_URL||'http://127.0.0.1:8767/';await page.goto(root+'?storage=illustration-qa-'+Date.now());await page.waitForFunction(()=>workspaceReady);
 const src=process.env.SKECHU_QA_IMAGE?'data:image/jpeg;base64,'+fs.readFileSync(process.env.SKECHU_QA_IMAGE).toString('base64'):null;
 await page.evaluate(async src=>{
  if(!src){const c=document.createElement('canvas');c.width=400;c.height=400;const x=c.getContext('2d');x.fillStyle='#f2deb4';x.fillRect(0,0,400,400);x.fillStyle='#253b58';x.beginPath();x.arc(200,190,150,0,7);x.fill();x.fillStyle='#e1a778';x.fillRect(115,130,170,180);x.fillStyle='#1b283b';x.fillRect(140,190,55,6);x.fillStyle='#aac7d6';x.fillRect(180,55,5,50);src=c.toDataURL()}
  const image=new Image();image.src=src;await image.decode();resetEditorState();activePage().canvasWidth=image.naturalWidth+100;activePage().canvasHeight=image.naturalHeight+100;
  items=[{id:'illustration-qa-reference',type:'image',name:'Local tracing QA',src,x:50,y:50,w:image.naturalWidth,h:image.naturalHeight,r:0,opacity:.5,preserveFull:true,referenceOnly:true,locked:false}];setCanvasAppearance('#ffffff',1);selected=items[0].id;selectedIds=new Set([selected]);render();fitView();
 },src);
 await page.locator('#auto-trace').click();await page.locator('#auto-trace-mode').selectOption('illustration');
 await page.waitForFunction(()=>autoTraceResult?.stats.mode==='illustration'&&!autoTraceJob,{},{timeout:60000});
 assert.equal(await page.evaluate(()=>items.length),1,'Preview never changes the project');
 await page.locator('#auto-trace-show-image').uncheck();await page.locator('#auto-trace-show-anchors').uncheck();await page.locator('#auto-trace-show-issues').uncheck();
 fs.mkdirSync('.codex-tmp',{recursive:true});await page.locator('#auto-trace-svg').screenshot({path:'.codex-tmp/illustration-lines-browser.png'});
 await page.locator('#auto-trace-color').check();assert.equal(await page.locator('#auto-trace-apply').innerText(),'套用並填色');
 assert.ok(await page.locator('#auto-trace-lines path[fill^="#"]').count()>0);await page.locator('#auto-trace-svg').screenshot({path:'.codex-tmp/illustration-fill-browser.png'});
 const count=await page.evaluate(()=>autoTraceResult.colorItems.length),lineCount=await page.evaluate(()=>autoTraceResult.items.length);await page.locator('#auto-trace-apply').click();await page.waitForFunction(count=>items.length===count+1,count+lineCount);
 assert.equal(await page.evaluate(()=>items.filter(i=>i.autoTraceColored&&i.closed&&i.fillOpacity===1&&i.width===0).length),count,'Applied fills are normal editable closed vector shapes, with no raster substitute');
 assert.equal(await page.evaluate(()=>items.filter(i=>i.autoTraceMode==='illustration'&&!i.autoTraceColored&&i.fillOpacity===0).length),lineCount,'Automatic colors keep the unique line art as separate editable objects');
 const exported=await page.evaluate(()=>JSON.parse(nativeRequestBody(items)).items);
 assert.equal(exported.filter(i=>i.autoTraceColored).length,count);
 assert.equal(exported.filter(i=>i.autoTraceMode==='illustration'&&!i.autoTraceColored).length,lineCount,'PPT receives exactly one stroke network, without per-fill duplicated outlines');
 const result=await page.evaluate(()=>({stats:autoTraceResult?.stats,count:items.length,anchors:items.filter(i=>i.autoTraceColored).reduce((n,i)=>n+i.points.length,0)}));
 await page.evaluate(()=>{const ref=items.find(i=>i.referenceOnly);ref.hidden=true;setOnlySelected(null);editPoints=false;render()});
 await page.locator('#stage').screenshot({path:'.codex-tmp/illustration-applied-browser.png'});
 if(src){const project=await page.evaluate(()=>{syncActivePage();const p=deepCopy(activeProject());p.name='插畫描圖與自動填色';p.pages=p.pages.filter(page=>page.id===activePageId);p.pages[0].name='封閉區域・自動填色';return{version:2,project:p}});fs.writeFileSync('.codex-tmp/illustration-result.skc',JSON.stringify(project));}
 const colorsBefore=await page.evaluate(()=>items.filter(i=>i.autoTraceColored).map(i=>({id:i.id,fill:i.fill})));
 await page.evaluate(()=>{activePaletteColor='#00c49a';syncPaintColor()});await page.locator('#paint-bucket').click();
 const probe=await page.evaluate(p=>{const m=svg.getScreenCTM();return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}},{x:src?450:210,y:src?600:225});
 const start=Date.now();await page.mouse.click(probe.x,probe.y);await page.waitForFunction(()=>items.some(i=>i.fill==='#00c49a'));
 const changes=await page.evaluate(before=>items.filter(it=>it.autoTraceColored&&before.find(b=>b.id===it.id)?.fill!==it.fill).length,colorsBefore);
 assert.equal(changes,1,'A real paint-bucket click recolors exactly one closed region');result.recolorMs=Date.now()-start;assert.ok(result.recolorMs<2500,'Recoloring must not rebuild a huge redundant intersection graph');
 await page.keyboard.press('Escape');await page.keyboard.press('Control+z');
 // Native cubic representation survives the app's save/restore serializer.
 const snapshot=await page.evaluate(()=>JSON.stringify(items.filter(i=>i.autoTraceColored)));await page.evaluate(()=>{items=JSON.parse(JSON.stringify(items));render()});assert.equal(await page.evaluate(()=>JSON.stringify(items.filter(i=>i.autoTraceColored))),snapshot);
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>items.length),1,'One Undo removes the entire tracing/fill operation');
 // The same closed contours must work without automatic colors, too.
 await page.evaluate(()=>{items[0].hidden=false;setOnlySelected(items[0].id);render()});
 await page.locator('#auto-trace').click();await page.waitForFunction(()=>autoTraceResult?.stats.mode==='illustration'&&!autoTraceJob,{},{timeout:60000});
 await page.locator('#auto-trace-color').uncheck();await page.locator('#auto-trace-apply').click();await page.waitForFunction(()=>items.length>1);
 await page.evaluate(()=>{items.find(i=>i.referenceOnly).hidden=true;setOnlySelected(null);editPoints=false;render();activePaletteColor='#00c49a';syncPaintColor()});
 await page.locator('#paint-bucket').click();
 const lineProbe=await page.evaluate(p=>{const m=svg.getScreenCTM();return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}},{x:src?797:210,y:src?595:225});
 const lineStart=Date.now();await page.mouse.click(lineProbe.x,lineProbe.y);await page.waitForFunction(()=>items.some(i=>i.fill==='#00c49a'&&i.fillOpacity===1),{},{timeout:20000});
 result.lineFillMs=Date.now()-lineStart;
 const filled=await page.evaluate(()=>items.filter(i=>i.fill==='#00c49a'&&i.fillOpacity===1).map(i=>({bounds:itemBounds(i),closed:i.closed})));
 assert.equal(filled.length,1);assert.ok(filled[0].closed);if(src){assert.ok(filled[0].bounds.w<70&&filled[0].bounds.h<115,'The earring fills independently of the surrounding ear, hair and background')}
 await page.locator('#stage').screenshot({path:'.codex-tmp/illustration-manual-fill-browser.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,...result,errors}));
}finally{await browser.close()}
