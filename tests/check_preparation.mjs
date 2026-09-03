import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app/ppt-preparation.js',import.meta.url),'utf8');
const timers=new Map(),requests=[],labels={};let sequence=0,now=0,resolveRequest;
const ctx=vm.createContext({crypto:{randomUUID:()=> 'tab'},Date:{now:()=>now},
  items:[{id:'a',type:'box',x:0,locked:false},{id:'b',type:'box',x:10}],activeProjectId:'p',activePageId:'page',
  nativeBody:items=>JSON.stringify({items}),exportableItems:items=>items.filter(it=>!it.hidden&&!it.referenceOnly),
  HAS_NATIVE_PPT_BRIDGE:true,workspaceReady:true,pptCopyRunning:false,pptPrepareTimer:null,pptPrepareRunning:false,pptPrepareWanted:null,pptPreparedBody:null,drag:null,traceDraft:null,
  document:{getElementById:()=>labels},
  setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),
  fetch:async(url,options)=>{requests.push({url,...JSON.parse(options.body)});return new Promise(resolve=>resolveRequest=resolve)},
  readNativeStream:async response=>response,
  canWebPptPrepare:()=>false,
});
vm.runInContext(source,ctx);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
const tick=async()=>{const pending=[...timers.values()];timers.clear();pending.forEach(t=>{assert.equal(t.ms,650);t.fn()});await flush()};
const finish=async()=>{resolveRequest({ok:true,count:2,prepared:true});await flush()};
ctx.queueNativePrepare();ctx.queueNativePrepare();ctx.queueNativePrepare();assert.equal(requests.length,0);assert.equal(timers.size,1);
await tick();assert.equal(requests.length,1);assert.equal(requests[0].url,'/prepare');assert.equal(requests[0].items.length,2);
await finish();ctx.queueNativePrepare();await tick();assert.equal(requests.length,1,'No new work without geometry changes');
ctx.items[0].locked=true;ctx.items[0].name='renamed';ctx.items[0].layerGroup={id:'folder',collapsed:true};ctx.queueNativePrepare();await tick();assert.equal(requests.length,1,'UI-only changes do not invalidate native cache');
const full=ctx.nativeRequestBody(),subset=ctx.nativeRequestBody([ctx.items[0]]);assert.notEqual(JSON.parse(full).cacheId,JSON.parse(subset).cacheId);
ctx.noteNativeCopy(subset,{cached:false});assert.equal(ctx.pptPreparedBody,full,'Subset copy preserves the whole-scene fingerprint');
ctx.items[0].x=2;ctx.queueNativePrepare();await tick();assert.equal(requests.length,2);
ctx.items[0].x=3;ctx.queueNativePrepare();await tick();ctx.items[0].x=4;ctx.queueNativePrepare();await tick();assert.equal(requests.length,2,'Only one preparation in flight');
await finish();assert.equal(requests.length,3);assert.equal(requests[2].items[0].x,4,'Intermediate edit 3 is coalesced');await finish();
// Undo back to the prepared version while a newer version is in flight.
ctx.items[0].x=5;ctx.queueNativePrepare();await tick();ctx.items[0].x=4;ctx.queueNativePrepare();await tick();await finish();
assert.equal(requests.at(-1).items[0].x,4);await finish();
ctx.items[0].x=6;ctx.queueNativePrepare();await tick();ctx.items[0].x=7;ctx.queueNativePrepare();await tick();ctx.pptCopyRunning=true;ctx.pptPrepareWanted=null;await finish();
assert.equal(requests.at(-1).items[0].x,6,'Explicit copy takes priority over queued background work');
ctx.pptCopyRunning=false;ctx.drag={};ctx.queueNativePrepare();await tick();assert.equal(requests.at(-1).items[0].x,6,'Do not prepare mid-drag');ctx.drag=null;
ctx.HAS_NATIVE_PPT_BRIDGE=false;ctx.queueNativePrepare();assert.equal(timers.size,0,'No web background requests without approved capable companion');
ctx.canWebPptPrepare=()=>true;ctx.requestWebPptPrepare=async body=>{requests.push({url:'web-prepare',...JSON.parse(body)});return {ok:true,prepared:true,count:2}};
ctx.queueNativePrepare();await tick();await flush();assert.equal(requests.at(-1).url,'web-prepare');
ctx.items[0].x=8;ctx.requestWebPptPrepare=async()=>{throw new Error('closed')};ctx.queueNativePrepare();await tick();await flush();
ctx.queueNativePrepare();assert.equal(timers.size,0,'Background errors back off instead of flooding Office');
now=16000;ctx.queueNativePrepare();assert.equal(timers.size,1,'A temporary failure does not disable preparation forever');
ctx.activePageId='other';assert.notEqual(JSON.parse(ctx.nativeRequestBody()).cacheId,JSON.parse(full).cacheId);
assert.ok(requests.every(r=>r.url!='/copy'),'Background preparation never writes the clipboard');
console.log('PPT preparation OK: idle-only, no-op dedupe, latest-only edits/Undo, copy priority, full/subset/page isolation, consent, retry and no clipboard writes.');
