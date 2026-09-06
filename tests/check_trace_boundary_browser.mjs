import assert from'node:assert/strict';import{createRequire}from'node:module';
const{chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:8767/';
 await page.goto(base+(base.includes('?')?'&':'?')+'storage=paper-edge-test-'+Date.now());await page.waitForFunction(()=>workspaceReady);
 await page.evaluate(()=>{
  resetEditorState();activePage().canvasWidth=336;activePage().canvasHeight=336;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,256,256);c.strokeStyle='#182c49';c.lineWidth=3;
  c.beginPath();c.moveTo(0,160);c.bezierCurveTo(80,160,128,40,180,120);c.lineTo(256,160);c.stroke();
  items=[{id:'ref',type:'image',name:'Synthetic cropped line',src:canvas.toDataURL(),x:40,y:40,w:256,h:256,r:0,opacity:.5,referenceOnly:true,preserveFull:true,locked:false}];
  setCanvasAppearance('#ffffff',1);setOnlySelected('ref');render();fitView();
 });
 await page.locator('#auto-trace').click();await page.waitForFunction(()=>autoTraceResult?.items.length>0);
 await page.locator('#auto-trace-mode').selectOption('line');await page.waitForFunction(()=>autoTraceResult?.stats.mode==='line');
 assert.equal(await page.locator('#auto-trace-close-border').isChecked(),true);
 assert.equal(await page.evaluate(()=>activeAutoTraceResult().items.filter(it=>it.traceBoundary==='rim').length),1);
 await page.locator('#auto-trace-close-border').uncheck();assert.equal(await page.evaluate(()=>activeAutoTraceResult().items.some(it=>it.traceBoundary)),false);
 await page.locator('#auto-trace-close-border').check();await page.locator('#auto-trace-apply').click();await page.waitForFunction(()=>!autoTraceDialog.open);
 assert.equal(await page.evaluate(()=>items.find(it=>it.traceBoundary==='rim').width),0);
 const initial=await page.evaluate(()=>JSON.stringify(items));
 await page.evaluate(()=>{activePaletteColor='#1256c8';syncPaintColor()});await page.locator('#paint-bucket').click();
 const p=await page.evaluate(()=>{const m=svg.getScreenCTM();return{x:m.a*168+m.c*270+m.e,y:m.b*168+m.d*270+m.f}});await page.mouse.click(p.x,p.y);
 const proof=await page.evaluate(()=>{const fill=items.find(it=>it.regionFill&&it.fill==='#1256c8');return fill&&{closed:fill.closed,lower:itemContainsFillPoint(fill,{x:168,y:270}),upper:itemContainsFillPoint(fill,{x:100,y:80}),outside:itemContainsFillPoint(fill,{x:20,y:270}),bottom:Math.max(...fill.points.map(p=>p.y))}});
 assert.deepEqual(proof,{closed:true,lower:true,upper:false,outside:false,bottom:296});
 await page.keyboard.press('Escape');await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>JSON.stringify(items)),initial);
 assert.deepEqual(errors,[]);
 console.log('Image-edge browser OK: default toggle, disable/re-enable, native rim, real bucket click to exact bottom, no background/outside leak, exact Undo.');
}finally{await browser.close()}
