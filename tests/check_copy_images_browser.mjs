import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const out='.codex-tmp/copy-recovery-qa';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await context.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{value:{write:async entries=>{const blob=await entries[0].getType('image/png');window.pictureCopy={type:blob.type,size:blob.size};}}});
 });
 let requests=0;await context.route('http://127.0.0.1:8766/**',route=>{requests++;return route.abort()});
 await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/')+'?mode=web&storage=copy-images-qa-'+Date.now());
 await page.waitForFunction(()=>workspaceReady);
 await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=64;c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='#ff7920';ctx.fillRect(0,0,32,32);ctx.fillStyle='#123456';ctx.fillRect(32,0,32,32);
  items=[{id:'picture',type:'image',referenceOnly:true,preserveFull:true,src:c.toDataURL(),x:0,y:0,w:256,h:128,r:12,opacity:.5},
   {id:'box',type:'box',x:300,y:0,w:100,h:80,r:0,fill:'#ff7920',opacity:1,stroke:'#123456',strokeWidth:2,fillGradient:{type:'linear',angle:40,stops:[{position:0,color:'#ff7920',opacity:1},{position:.5,color:'#ffffff',opacity:1},{position:1,color:'#123456',opacity:1}]}}];
  selectedIds=new Set(['picture']);selected='picture';render();fitView();
 });
 const before=await page.evaluate(()=>JSON.stringify(items));
 await page.keyboard.press('Control+c');await page.waitForFunction(()=>window.pictureCopy);
 assert.equal(requests,0,'Single-picture copy does not probe Office or local-network access');
 assert.ok((await page.evaluate(()=>window.pictureCopy.size))>100);
 assert.equal(await page.evaluate(()=>pptCopyRunning),false);
 const data=await page.evaluate(async()=>{
  selectedIds=new Set(items.map(it=>it.id));
  const prepared=await clipboardImageSnapshot(clipboardSelection());
  return{scene:portableSelectionSnapshot(prepared),native:JSON.parse(nativeRequestBody(prepared,true))};
 });
 assert.equal(data.scene.shapes.filter(it=>it.kind==='image').length,1);
 assert.ok(data.scene.shapes.some(it=>it.fill?.type==='linear'));
 assert.equal(data.native.items.filter(it=>it.type==='image').length,1);
 fs.writeFileSync(out+'/native-input.json',JSON.stringify(data.native));
 fs.writeFileSync(out+'/snapshot.json',JSON.stringify(data.scene));
 const result=await page.evaluate(async scene=>Array.from(await encodePortablePptx(scene)),data.scene);
 fs.writeFileSync(out+'/mixed.pptx',Buffer.from(result));
 assert.equal(await page.evaluate(()=>JSON.stringify(items)),before,'Export does not mutate image opacity, geometry or source');
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{clipboardFeedback('測試失敗','可以重試','error');setClipboardBusy(false)});
 assert.ok(await page.locator('#clipboard-retry-operation').isVisible());
 assert.ok(await page.locator('#clipboard-retry-operation').isEnabled());
 await page.screenshot({path:out+'/mobile-recovery.png'});
 console.log('Browser: direct image copy, native mixed-image snapshot, PPTX worker, immutable sources and mobile recovery passed.');
}finally{await browser.close()}
