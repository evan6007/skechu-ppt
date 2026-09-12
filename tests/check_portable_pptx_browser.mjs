import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/';
const out='.codex-tmp/portable-pptx-qa';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1280,height:880},serviceWorkers:'block'});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});
    Object.defineProperty(navigator,'userAgentData',{get:()=>({platform:'macOS'}),configurable:true});
    window.clipboardWrites=0;
    Object.defineProperty(navigator,'clipboard',{value:{write:()=>{window.clipboardWrites++;throw Error('Test forbids clipboard writes')},writeText:()=>{window.clipboardWrites++;throw Error('Test forbids clipboard writes')}}});
  });
  let serviceCalls=0;
  await context.route('http://127.0.0.1:8766/**',route=>{serviceCalls++;return route.abort()});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'?mode=web&v=94-system-copy&storage=portable-pptx-qa-'+Date.now());
  await page.waitForFunction(()=>workspaceReady);
  await page.evaluate(()=>{
    const g={type:'linear',angle:35,stops:[{position:0,color:'#ff7920',opacity:1},{position:.4,color:'#00cc88',opacity:.8},{position:1,color:'#123abc',opacity:.5}]};
    const hole=IllustrationTrace.fromSVG('<svg><path fill="#ff7920" d="M0 0 L200 0 L200 160 L0 160 Z M20 20 L20 50 L60 50 L60 20 Z M120 80 C100 80 100 120 120 120 C140 120 140 80 120 80 Z"/></svg>',{toItem:AutoTrace.toItem}).colorItems[0];
    items=[{...hole,id:'holes',width:3,color:'#172033',fillGradient:g},
      {id:'box',type:'box',x:260,y:10,w:150,h:110,r:15,radius:22,fill:'#ff7920',opacity:.8,stroke:'#172033',strokeWidth:2,fillGradient:g},
      {id:'ellipse',type:'ellipse',x:460,y:10,w:150,h:90,r:-10,fill:'#95ccee',opacity:1,stroke:'#172033',strokeWidth:2},
      {id:'curve',type:'arrow',points:[{x:260,y:200},{x:280,y:140},{x:380,y:140},{x:410,y:200}],explicitBezier:true,color:'#ff7920',width:4,head:18,startHead:true,endHead:true,headShape:'diamond'},
      {id:'text',type:'text',x:0,y:235,size:23,text:'Skechu & <editable> 原生漸層',color:'#172033',fontFamily:'Arial'},
      {id:'ref',type:'image',referenceOnly:true,hidden:true,x:0,y:0,w:100,h:100}];
    selectedIds=new Set(items.map(it=>it.id));selected='holes';render();fitView();
  });
  const original=await page.evaluate(()=>JSON.stringify(items));
  await page.keyboard.press('Meta+c');
  await page.locator('#clipboard-portable-actions').waitFor({state:'visible'});
  assert.equal(serviceCalls,0);
  assert.equal(await page.evaluate(()=>window.clipboardWrites),0);
  assert.equal(await page.locator('#clipboard-setup').isVisible(),false);
  const snapshot=await page.evaluate(()=>portableSelectionSnapshot());
  const detached=await page.evaluate(()=>{const s=portableSelectionSnapshot(),before=JSON.stringify(s),old=items.find(it=>it.id==='curve').points[1].x;items.find(it=>it.id==='curve').points[1].x+=30;const unchanged=JSON.stringify(s)===before;items.find(it=>it.id==='curve').points[1].x=old;return unchanged});
  assert.ok(detached,'Snapshot must be detached from edits during async encoding');
  assert.equal(snapshot.shapes.filter(s=>s.contours?.length===3).length,1);
  assert.equal(snapshot.shapes.filter(s=>s.fill?.type==='linear').length,2);
  const curve=snapshot.shapes.find(s=>s.stroke?.color==='#ff7920');
  assert.deepEqual(curve.contours[0].segments[0],{p0:{x:260,y:200},c1:{x:280,y:140},c2:{x:380,y:140},p3:{x:410,y:200}});
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#clipboard-download-pptx').click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'skechu-selection.pptx');
  await download.saveAs(out+'/browser-selection.pptx');
  fs.writeFileSync(out+'/browser-selection.json',JSON.stringify(snapshot));
  assert.match(await page.locator('#clipboard-title').textContent(),/已產生可編輯 PPTX/);
  assert.equal(await page.evaluate(()=>JSON.stringify(items)),original);
  assert.equal(await page.evaluate(()=>window.clipboardWrites),0);
  const stress=await page.evaluate(async()=>{
    const source=portableSelectionSnapshot().shapes.find(s=>s.contours?.length===3);
    const large={version:1,shapes:Array.from({length:2500},()=>source)};
    let ticks=0;const timer=setInterval(()=>ticks++,10),start=performance.now();
    try{const bytes=await encodePortablePptx(large);return{ticks,bytes:bytes.length,ms:performance.now()-start}}finally{clearInterval(timer)}
  });
  assert.ok(stress.ticks>0,'Native packaging must yield to the UI');
  assert.ok(stress.bytes>1e6);
  // Phone-width guidance stays in the page, with a touch-sized action.
  await page.setViewportSize({width:390,height:844});
  await page.locator('#clipboard-download-pptx').scrollIntoViewIfNeeded();
  const b=await page.locator('#clipboard-download-pptx').boundingBox();
  assert.ok(b.width>=120&&b.height>=40&&b.x>=0&&b.x+b.width<=390);
  await page.screenshot({path:out+'/phone-guidance.png'});
  await page.setViewportSize({width:1280,height:880});
  // Unsupported formulas fail as a whole: no partial export or hidden image fallback.
  let unexpected=0;page.on('download',()=>unexpected++);
  await page.evaluate(()=>{items=[{id:'math',type:'text',x:0,y:0,w:120,h:60,size:20,text:'x^2',box:true,latex:true}];setOnlySelected('math')});
  await page.locator('#clipboard-download-pptx').click();
  assert.match(await page.locator('#clipboard-message').textContent(),/LaTeX/);
  assert.equal(unexpected,0);
  assert.equal(await page.locator('#copy-ppt').isDisabled(),false);
  assert.equal(serviceCalls,0);assert.deepEqual(errors,[]);
  // Linux gets the same explicit file route, not a Windows installer.
  await page.evaluate(()=>{Object.defineProperty(navigator,'userAgentData',{get:()=>({platform:'Linux'})});portableCopyGuidance()});
  assert.equal(await page.locator('#clipboard-setup').isVisible(),false);
  await context.close();
  console.log(`Browser portable export: Mac/Linux routing simulation, actual worker/download, ${snapshot.shapes.length} editable parts, exact cubics/holes, detached snapshots, no clipboard/network writes, mobile layout and formula refusal passed. Stress worker: ${Math.round(stress.ms)} ms, ${stress.bytes} bytes, ${stress.ticks} UI ticks.`);
}finally{await browser.close()}
