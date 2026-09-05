import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../app/layer-controls.js',import.meta.url),'utf8');
const paint=fs.readFileSync(new URL('../app/paint-layers.js',import.meta.url),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const ref={id:'ref',name:'底圖',type:'image',referenceOnly:true,locked:true,x:0,y:0,w:1200,h:675,r:0,opacity:.3,preserveFull:true};
const a={id:'a',name:'方塊 A',type:'box',x:180,y:180,w:180,h:140,r:0,fill:'#93c5fd',stroke:'#123f8c',strokeWidth:3,fillOrder:2};
const b={...a,id:'b',name:'方塊 B',x:220,y:220,fill:'#fda4af',fillOrder:1};
const curve=(id,batch,y)=>({id,name:'自動描圖 '+id,type:'arrow',autoTrace:true,autoTraceBatch:batch,points:[{x:450,y},{x:600,y:y-40},{x:750,y}],curved:true,color:'#123f8c',width:2,closed:false,startHead:false,endHead:false});
const seed=[ref,a,curve('t1','old-batch',300),curve('t2','old-batch',350),b];
const events=new Map(),elements=new Map(),bodyChildren=[];let seq=0;
function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',scrollTop:0,disabled:false,dataset:{},
  addEventListener(type,fn,capture){events.set(id+':'+type+':'+!!capture,fn)},querySelectorAll(){return []},
  setPointerCapture(){},hasPointerCapture(){return false},releasePointerCapture(){},
  getBoundingClientRect(){return {top:0,bottom:400}},contains(){return true}});return elements.get(id);}
const ctx=vm.createContext({items:plain(seed),selected:'a',selectedIds:new Set(['a']),selectedPoints:new Set(),selectedPoint:null,selectedSegment:null,
  history:[],future:['redo'],uid:prefix=>prefix+'-'+(++seq),setTimeout:fn=>{fn();return 1},document:{body:{appendChild(node){bodyChildren.push(node)}},getElementById:el,querySelectorAll:()=>[]},window:el('window'),
  esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  activateSelectTool(){},paintStatus(){},render(){},refreshSelectionUI(){},queueAutosave(){},selectLayerFromEvent(){},
});
ctx.byId=id=>ctx.items.find(it=>it.id===id);ctx.commit=()=>{ctx.history.push(JSON.stringify(ctx.items));ctx.future=[]};
vm.runInContext(paint+'\n'+source,ctx);
function reset(){ctx.items=plain(seed);ctx.history=[];ctx.future=['redo'];ctx.selectedIds=new Set(['a']);ctx.selected='a';}
const ids=()=>ctx.items.map(it=>it.id),drawn=()=>plain(ctx.items).map(({layerGroup,locked,...it})=>it);
let entries=plain(ctx.layerEntries());
assert.deepEqual(entries.map(e=>e.key),['item:b','group:trace-old-batch','item:a','item:ref']);
assert.equal(entries[1].members.length,2);assert.equal(entries[1].group.collapsed,true,'Old auto-trace batches default to collapsed');
assert.equal(ctx.items[2].layerGroup,undefined,'Reading legacy groups does not mutate items');
ctx.renderLayerTree();assert.ok(!el('layers').innerHTML.includes('data-layer="t1"'),'Collapsed folder hides individual rows');
const geometry=drawn();ctx.toggleLayerFolder('group:trace-old-batch');
assert.ok(el('layers').innerHTML.includes('data-layer="t1"'));assert.equal(ctx.history.length,0,'Disclosure does not consume Undo');
ctx.items=JSON.parse(JSON.stringify(ctx.items));assert.equal(ctx.layerGroupOf(ctx.byId('t1')).collapsed,false,'Folder disclosure survives save/reload');
assert.deepEqual(drawn(),geometry);
ctx.selectLayerGroup('group:trace-old-batch');assert.deepEqual([...ctx.selectedIds],['t1','t2']);
ctx.selectLayerGroup('group:trace-old-batch',true);assert.equal(ctx.selectedIds.size,0,'Shift toggles whole folder selection');
ctx.toggleLayerLock('group:trace-old-batch');assert.ok(ctx.byId('t1').locked&&ctx.byId('t2').locked);assert.equal(ctx.history.length,1);
assert.equal(ctx.moveLayerEntry('group:trace-old-batch','item:b','above'),false,'Locked group cannot reorder');
ctx.toggleLayerLock('item:t1');assert.equal(ctx.byId('t1').locked,false);assert.equal(ctx.byId('t2').locked,true);
ctx.toggleLayerLock('group:trace-old-batch');assert.ok(ctx.byId('t1').locked&&ctx.byId('t2').locked,'Mixed group click locks all');
ctx.toggleLayerLock('group:trace-old-batch');assert.ok(!ctx.byId('t1').locked&&!ctx.byId('t2').locked);
reset();ctx.selectedIds=new Set(['a','b','ref']);const before=JSON.stringify(ctx.items);
ctx.groupSelectedLayers();const group=ctx.layerGroupOf(ctx.byId('a'));
assert.equal(ctx.layerGroupOf(ctx.byId('b')).id,group.id);assert.equal(ctx.layerGroupOf(ctx.byId('ref')),null,'Reference excluded from vector folders');
assert.equal(ctx.history[0],before);assert.deepEqual(ids(),seed.map(it=>it.id),'Creating a folder preserves line and fill geometry/order');
ctx.selectedIds=new Set(['a']);ctx.ungroupSelectedLayers();assert.equal(ctx.layerGroupOf(ctx.byId('a')),null);assert.ok(ctx.layerGroupOf(ctx.byId('b')));
reset();assert.equal(ctx.moveLayerEntry('item:a','item:b','above'),true);assert.equal(ids().at(-1),'a');assert.equal(ctx.history.length,1);
assert.equal(ctx.moveLayerEntry('item:a','item:b','above'),false,'Repeated drop is a no-op');
assert.equal(ctx.history.length,1);ctx.items=JSON.parse(ctx.history.pop());assert.deepEqual(ids(),seed.map(it=>it.id),'Undo restores stacking');
reset();ctx.moveLayerEntry('group:trace-old-batch','item:b','above');assert.deepEqual(ids().slice(-2),['t1','t2'],'Group reorders as a unit');
reset();ctx.moveLayerEntry('item:a','group:trace-old-batch','inside');assert.equal(ctx.layerGroupOf(ctx.byId('a')).id,'trace-old-batch');
ctx.moveLayerEntry('item:a','item:b','above');assert.equal(ctx.layerGroupOf(ctx.byId('a')),null,'Dragging to root removes membership');
reset();ctx.moveLayerEntry('item:t1','item:t2','above');assert.equal(ctx.layerGroupOf(ctx.byId('t1')).id,'trace-old-batch','Child reorder preserves folder');
ctx.selectedIds=new Set(['t1','t2']);ctx.ungroupSelectedLayers();assert.equal(ctx.layerEntries().filter(e=>e.group).length,0,'Legacy folders stay ungrouped after explicit removal');
reset();assert.equal(ctx.moveLayerEntry('item:a','item:ref','below'),false,'Vectors cannot go behind reference');
ctx.byId('ref').locked=false;assert.equal(ctx.moveLayerEntry('item:ref','item:a','above'),false,'Reference remains below artwork');
reset();ctx.moveLayerEntry('item:a','item:b','below');
const painted=plain(ctx.paintSceneItems(ctx.items));assert.deepEqual(painted.filter(it=>it.paintLayer==='fill').map(it=>it.paintSourceId),['a','b'],'Explicit drag overrides fill recency');
assert.ok(painted.findIndex(it=>it.id==='t1')>painted.findIndex(it=>it.id==='b::paint-fill'),'Linework remains above fill');
ctx.raiseFilledItem(ctx.byId('a'));assert.deepEqual(plain(ctx.paintSceneItems(ctx.items)).filter(it=>it.paintLayer==='fill').map(it=>it.paintSourceId),['b','a'],'Latest repaint can raise the fill again');
reset();const clones=plain(ctx.items.filter(it=>it.autoTrace));ctx.cloneLayerGroups(clones);
assert.equal(ctx.layerGroupOf(clones[0]).id,ctx.layerGroupOf(clones[1]).id);assert.notEqual(ctx.layerGroupOf(clones[0]).id,'trace-old-batch','Pasted group does not merge with original');
assert.deepEqual(clones[0].points,seed[2].points,'Grouping never flattens or changes anchors');
reset();ctx.selected='t2';ctx.selectedIds=new Set(['t2']);ctx.nudgeSelectedLayers('below');assert.equal(ids().indexOf('t2')+1,ids().indexOf('t1'),'Existing reorder buttons share group ordering');
reset();const visibleBefore=JSON.stringify(ctx.items);ctx.selected='t2';ctx.selectedIds=new Set(['a','t1','t2']);
ctx.toggleLayerVisibility('group:trace-old-batch');assert.ok(ctx.byId('t1').hidden&&ctx.byId('t2').hidden);
assert.deepEqual([...ctx.selectedIds],['a']);assert.equal(ctx.selected,'a','Hiding selection clears invisible handles');
assert.equal(ctx.history[0],visibleBefore);assert.ok(!ctx.paintSceneItems(ctx.items).some(it=>it.id==='t1'),'Hidden lines never render or export');
ctx.items=JSON.parse(JSON.stringify(ctx.items));assert.ok(ctx.byId('t2').hidden,'Visibility survives project save/reload');
ctx.toggleLayerVisibility('item:t1');assert.equal(ctx.byId('t1').hidden,false);assert.equal(ctx.byId('t2').hidden,true);
assert.ok(ctx.layerRowMarkup('group:trace-old-batch',ctx.layerMembers('group:trace-old-batch'),ctx.layerGroupOf(ctx.byId('t1'))).includes('部分隱藏'));
ctx.toggleLayerVisibility('group:trace-old-batch');assert.ok(ctx.byId('t1').hidden&&ctx.byId('t2').hidden,'Mixed eye click hides whole folder');
ctx.toggleLayerVisibility('group:trace-old-batch');assert.ok(!ctx.byId('t1').hidden&&!ctx.byId('t2').hidden);
ctx.toggleLayerVisibility('item:ref');assert.equal(ctx.byId('ref').locked,true);assert.equal(ctx.byId('ref').hidden,true,'Eye works independently of lock');
ctx.toggleLayerVisibility('item:a');assert.ok(!ctx.paintSceneItems(ctx.items).some(it=>it.id==='a'||it.paintSourceId==='a'),'Hide removes both color fill and outline');
ctx.items=JSON.parse(ctx.history.pop());assert.equal(ctx.byId('a').hidden,undefined,'Undo restores visibility');
vm.runInContext(html.split('\n').find(l=>l.startsWith('function exportableItems(')),ctx);
assert.ok(!ctx.exportableItems().some(it=>it.referenceOnly||it.hidden),'Native and SVG copying omit hidden items');
const layerCss=fs.readFileSync(new URL('../app/layer-controls.css',import.meta.url),'utf8');
assert.ok(layerCss.includes('grid-template-rows:minmax(110px,var(--inspector-top,calc(50% - 3px))) 6px minmax(110px,1fr)'));
assert.ok(html.includes('class="inspector-tools"')&&html.includes('class="inspector-layers"'),'Tools and layers have independent scroll containers');
assert.match(ctx.layerRowMarkup('item:a',[a]),/class="layer-name" data-layer-drag="item:a"/,'The full layer name area can start a reorder drag');
for(const marker of ['layer-drag-ghost','previewLayerOrder','data-drag-source'])assert.ok(source.includes(marker)||layerCss.includes(marker),'Missing animated drag marker '+marker);
assert.ok(source.includes('layerDropAt')&&!source.includes('document.elementFromPoint(event.clientX,event.clientY)'),'Drop targeting must use the frozen row layout so animated rows cannot cause jitter');
assert.ok(!ctx.layerRowMarkup('item:a',[{...a,name:'<img onerror="bad">'}]).includes('<img'),'Layer labels escape HTML');
// Exercise the actual drag event handlers, including cancellation and pointer ownership.
reset();ctx.initializeLayerControls();let hovered=null;
ctx.document.elementFromPoint=()=>hovered;
const event=(y,extra={})=>({button:0,pointerId:1,clientX:30,clientY:y,preventDefault(){},stopImmediatePropagation(){},...extra});
const grip={dataset:{layerDrag:'item:a'},disabled:false};
const fakeRow=(key,top)=>({dataset:{layerKey:key},style:{value:'',writes:0,get transform(){return this.value},set transform(value){this.value=value;this.writes++}},classList:{add(){}},closest(selector){return selector==='[data-layer-key]'?this:null},getBoundingClientRect:()=>({left:10,top,width:210,height:36}),
  cloneNode(){return{dataset:{},style:{},classList:{add(){}},removeAttribute(){},querySelectorAll(){return[]},remove(){this.removed=true}}}});
const sourceRow=fakeRow('item:a',80),targetRow=fakeRow('item:b',20);el('layers').querySelectorAll=selector=>selector==='[data-layer-key]'?[targetRow,sourceRow]:[];
events.get('layers:pointerdown:false')(event(85,{target:{closest:()=>grip}}));
hovered={dataset:{layerKey:'item:b'},getBoundingClientRect:()=>({top:20,height:40}),closest(){return this}};
events.get('layers:pointermove:false')(event(20,{pointerId:2}));assert.equal(ctx.history.length,0);
events.get('layers:pointermove:false')(event(20));events.get('layers:pointerup:false')(event(20));assert.equal(ids().at(-1),'a');assert.equal(ctx.history.length,1);
reset();events.get('layers:pointerdown:false')(event(85,{target:{closest:()=>grip}}));events.get('layers:pointermove:false')(event(20));ctx.finishLayerPointer(true);
assert.deepEqual(ids(),seed.map(it=>it.id));assert.equal(ctx.history.length,0,'Cancel leaves order and Undo untouched');
const name={dataset:{layerDrag:'item:a'},disabled:false,closest(selector){return selector==='[data-layer-drag]'?this:selector==='[data-layer-key]'?sourceRow:null}};
el('layers').querySelectorAll=selector=>selector==='[data-layer-key]'?[targetRow,sourceRow]:[];hovered=targetRow;bodyChildren.length=0;reset();
events.get('layers:pointerdown:false')(event(85,{target:name}));events.get('layers:pointermove:false')(event(95));
assert.equal(targetRow.style.transform,'','A small drag only moves the ghost and does not reorder before crossing the adjacent row center');
events.get('layers:pointermove:false')(event(50));
assert.equal(bodyChildren.length,1);assert.equal(sourceRow.dataset.dragSource,'true','Dragged row fades while a floating copy follows the pointer');
assert.equal(targetRow.style.transform,'translateY(40px)','Rows between source and destination animate aside to preview the new order');
const stableLayerWrites=targetRow.style.writes;events.get('layers:pointermove:false')(event(48));assert.equal(targetRow.style.writes,stableLayerWrites,'Holding the same insertion slot cannot restart the row animation every pointer frame');
events.get('layers:pointerup:false')(event(50));assert.equal(bodyChildren[0].removed,true,'Floating copy fades and is removed after drop');
assert.equal(targetRow.style.transform,'');
for(const asset of ['layer-controls.js','layer-controls.css']){
  const version=asset.endsWith('.js')?'?v=67-touch-shell':'?v=35-stable-motion';
  assert.ok(html.includes(asset+version));
  assert.ok(fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes(asset+version));
  assert.ok(fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/'+asset+';.'));
}
reset();let captures=0;el('layers').setPointerCapture=()=>captures++;
events.get('layers:pointerdown:false')(event(85,{pointerType:'touch',target:name}));
assert.equal(vm.runInContext('layerPointerDrag',ctx),null,'Touch row names must permit native list scrolling');
events.get('layers:pointerdown:false')(event(85,{pointerType:'touch',target:{closest:()=>grip}}));
assert.ok(vm.runInContext('layerPointerDrag',ctx),'Touch grips still allow reorder');ctx.finishLayerPointer(true);
events.get('layers:pointerdown:false')(event(85,{target:name}));assert.equal(captures,0,'A stationary click cannot be captured by the list container');
events.get('layers:pointermove:false')(event(95));assert.equal(captures,1,'Pointer capture begins only after drag threshold');ctx.finishLayerPointer(true);
assert.match(html,/cloneLayerGroups\(clones\)/);assert.match(html,/initializeLayerControls\(\)/);
console.log('Layer folders OK: legacy auto batches, collapse/save, manual grouping, shared locks, reorder/Undo, fill parity, cloned isolation and drag cancellation.');
if(process.argv.includes('--fixture')){
  const output=fileURLToPath(new URL('../app/.codex-tmp/layers-qa/',import.meta.url));fs.mkdirSync(output,{recursive:true});
  const image='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#f1f5f9"/></svg>';
  ref.src='data:image/svg+xml;base64,'+Buffer.from(image).toString('base64');
  const fixtureItems=[ref,a,...Array.from({length:80},(_,i)=>curve('t'+i,'old-batch',180+i*4)),b];
  const diagnostic='<script>window.addEventListener("error",e=>{const p=document.createElement("pre");p.id="qa-errors";p.textContent=e.message;document.body.appendChild(p)})</script>';
  const fixture=html.replace('<head>','<head><base href="/">'+diagnostic).replace(/const STARTER_ITEMS=\[[\s\S]*?\n\];/,()=>`const STARTER_ITEMS=${JSON.stringify(fixtureItems)};`);
  fs.writeFileSync(path.join(output,'editor.html'),fixture);console.log(output);
}
