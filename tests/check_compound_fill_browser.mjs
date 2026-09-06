import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:18767/')+'?storage=compound-outline-isolated-'+Date.now());
 await page.waitForFunction(()=>workspaceReady);
 const checked=await page.evaluate(()=>{
   resetEditorState();
   const r=IllustrationTrace.fromSVG('<svg><path fill="#f2c478" d="M20 20 L220 20 L220 180 L20 180 Z M40 40 L40 70 L80 70 L80 40 Z M140 100 C120 100 120 140 140 140 C160 140 160 100 140 100 Z"/></svg>',{toItem:AutoTrace.toItem});
   items=[{...r.colorItems[0],id:'hole-test',width:7,color:'#000000'}];
   activePage().canvasWidth=260;activePage().canvasHeight=220;
   setCanvasAppearance('#ffffff',1);setOnlySelected('hole-test');editPoints=false;render();fitView();
   const hole=itemContainsFillPoint(items[0],{x:60,y:55}),outside=itemContainsFillPoint(items[0],{x:100,y:80});
   const paths=[...document.querySelectorAll('#stage [data-id="hole-test"] > .arrow-line')].map(p=>({d:p.getAttribute('d'),width:p.getAttribute('stroke-width')}));
   return{hole,outside,paths,scene:paintSceneItems(items)};
 });
 assert.equal(checked.hole,false);assert.equal(checked.outside,true);
 assert.equal(checked.paths.length,4);assert.equal(checked.paths[0].d.match(/M/g).length,3);
 assert.ok(checked.paths.slice(1).every(p=>p.d.match(/M/g).length===1&&p.width==='7'));
 await page.locator('#line-width').fill('12');
 assert.ok(await page.evaluate(()=>paintSceneItems(items).filter(it=>it.paintLayer==='line').every(it=>it.width===12)));
 await page.evaluate(()=>{items[0].fillOpacity=0;render()});
 assert.equal(await page.evaluate(()=>document.querySelectorAll('#stage [data-id="hole-test"] > .arrow-line').length),3);
 await page.evaluate(()=>{items[0].fillOpacity=1;render()});
 const saved=await page.evaluate(()=>JSON.stringify(items));
 await page.evaluate(saved=>{items=JSON.parse(saved);render()},saved);
 assert.equal(await page.evaluate(()=>paintSceneItems(items)[0].compoundContours.length),3);
 fs.mkdirSync('.codex-tmp/compound-qa',{recursive:true});
 await page.evaluate(()=>{setOnlySelected(null);render()});
 await page.locator('#stage').screenshot({path:'.codex-tmp/compound-qa/browser-thick-outlines.png'});
 if(process.argv[2]){
   const original=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
   await page.evaluate(r=>{
     resetEditorState();activePage().canvasWidth=1080;activePage().canvasHeight=1061;
     items=[...r.colorItems,...r.items].map((it,i)=>({...it,id:'real-'+i,color:'#000000',width:it.autoTraceColored?1:1.1}));
     setCanvasAppearance('#ffffff',1);setOnlySelected(null);editPoints=false;render();fitView();
   },original);
   const stats=await page.evaluate(()=>({sources:items.length,compounds:paintSceneItems(items).filter(it=>it.compoundContours).length,exported:JSON.parse(nativeBody()).items.length}));
   assert.ok(stats.compounds>0);
   await page.locator('#stage').screenshot({path:'.codex-tmp/compound-qa/geto-corrected.png'});
   fs.writeFileSync('.codex-tmp/compound-qa/geto-native.json',await page.evaluate(()=>nativeBody()));
   const data=await page.evaluate(()=>{syncActivePage();const project=deepCopy(activeProject());project.name='插畫外框修正測試';project.pages=project.pages.filter(p=>p.id===activePageId);return{version:2,project}});
   fs.writeFileSync('.codex-tmp/compound-qa/geto-corrected.skc',JSON.stringify(data));
   console.log(stats);
 }
 assert.deepEqual(errors,[]);
 console.log('Compound browser: holes, thickness input, transparent fill, save/reload, separate SVG and native contour payload passed.');
}finally{await browser.close()}
