import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../app/selection-controls.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const reference = {id:'ref',name:'鎖定底圖',type:'image',x:0,y:0,w:1200,h:675,locked:true,referenceOnly:true};
const box = {id:'a',name:'方塊 A',type:'box',x:160,y:180,w:180,h:120,fill:'#dbeafe',stroke:'#123f8c',strokeWidth:3};
const circle = {id:'b',name:'圓形 B',type:'ellipse',x:520,y:200,w:140,h:140,fill:'#dcfce7',stroke:'#123f8c',strokeWidth:3};
const outline = {id:'empty',name:'中空外框',type:'ellipse',x:80,y:80,w:1020,h:520,fill:'#ffffff',opacity:0,stroke:'#123f8c',strokeWidth:3};
const arrow = {id:'line',name:'三點線段',type:'arrow',points:[{x:200,y:440},{x:330,y:420},{x:440,y:480}],color:'#123f8c',width:3,curved:false,endHead:false};
const seed = [reference,outline,box,circle,arrow];
const events = new Map(),elements = new Map();
let sceneRenders=0,menuCalls=0;
function el(id) {
  if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',classList:{add(){},remove(){}},
    addEventListener(type,handler,capture){events.set(id+':'+type+':'+!!capture,handler)},
    setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){},
    getBoundingClientRect(){return {left:0,top:0}},clientWidth:1200,clientHeight:675,scrollLeft:0,scrollTop:0});
  return elements.get(id);
}
const ctx=vm.createContext({
  document:{getElementById:el},window:el('window'),svg:el('svg'),stageWrap:el('wrap'),
  autoJunctionPositions:new Map(),items:plain(seed),selected:null,selectedPoint:null,selectedSegment:null,
  selectedIds:new Set(),selectedPoints:new Set(),editPoints:false,drag:null,marqueeRect:null,
  history:[],future:[],snapLines:[],snapAnchors:[],hotAnchor:null,traceSnapTarget:null,
  tracePenOn:false,traceDraft:null,traceJoinMode:false,paintTool:null,zoom:1,
  deepCopy:plain,snap:v=>v,svgPt:e=>({x:e.clientX,y:e.clientY}),
  render(){sceneRenders++},renderSelection(){},renderLayers(){},syncControls(){},syncSplitHandleLengthControls(){},syncArrowAttachments(){},
  closestSelectionHandle:(e,h)=>h,ctrlSnapPoint:p=>p,magneticEdgeSnap:p=>p,
  itemBounds:it=>it.points ? {x:Math.min(...it.points.map(p=>p.x)),y:Math.min(...it.points.map(p=>p.y)),w:Math.max(...it.points.map(p=>p.x))-Math.min(...it.points.map(p=>p.x)),h:Math.max(...it.points.map(p=>p.y))-Math.min(...it.points.map(p=>p.y))} : it,
  normalizeAngle:a=>a,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  activateSelectTool(){ctx.paintTool=null;ctx.tracePenOn=false},
  showLineContextMenu(){menuCalls++;el('context-menu').hidden=false},
});
ctx.byId=id=>ctx.items.find(it=>it.id===id);ctx.state=()=>JSON.stringify(ctx.items);
ctx.commit=()=>{ctx.history.push(ctx.state());if(ctx.history.length>80)ctx.history.shift();ctx.future=[]};
vm.runInContext(source,ctx);
vm.runInContext(fs.readFileSync(new URL('../app/paint-layers.js',import.meta.url),'utf8'),ctx);
vm.runInContext(html.split('\n').find(l=>l.startsWith("document.getElementById('image-locked').onchange=")),ctx);
for(const name of ['moveFromBase','select']) vm.runInContext(html.split('\n').find(l=>l.startsWith('function '+name+'(')),ctx);
const downStart=html.indexOf("svg.addEventListener('pointerdown',");
vm.runInContext(html.slice(downStart,html.indexOf("svg.addEventListener('auxclick',",downStart)),ctx);
const moveStart=html.indexOf('function handleCanvasPointerMove(');
vm.runInContext(html.slice(moveStart,html.indexOf("svg.addEventListener('pointermove',",moveStart)),ctx);
vm.runInContext(html.split('\n').find(l=>l.startsWith("window.addEventListener('keydown',")),ctx);
ctx.initializeSelectionControls();
const down=e=>{events.get('wrap:pointerdown:true')(e);events.get('svg:pointerdown:false')(e)},move=ctx.handleCanvasPointerMove,up=e=>ctx.finishSelectionGesture(e);
const target=(id,handle,index)=>({closest:selector=>selector==='[data-id]'&&id ? {dataset:{id}} : ['[data-handle]','[data-handle],[data-segment],[data-action]'].includes(selector)&&handle ? {dataset:{handle,...(index==null?{}:{point:String(index)})},getAttribute:()=>0} : null});
const event=(x=900,y=640,options={})=>({clientX:x,clientY:y,pointerId:1,button:0,shiftKey:false,ctrlKey:false,detail:1,target:target(),preventDefault(){},stopPropagation(){},...options});
const right=(x,y,options={})=>event(x,y,{...options,button:2});
function reset(ids=['a']) {
  ctx.items=plain(seed);ctx.selectedIds=new Set(ids);ctx.selected=ids.at(-1)||null;
  ctx.selectedPoints=new Set();ctx.selectedPoint=ctx.selectedSegment=null;ctx.history=[];ctx.future=['redo'];
  ctx.drag=null;ctx.marqueeRect=null;ctx.paintTool=null;ctx.tracePenOn=false;
  menuCalls=0;el('context-menu').hidden=true;
}
function click(id,options={}){const e=event(250,250,{target:target(id),...options});down(e);up(e)}

reset();ctx.selectedPoints.add(1);ctx.selectedPoint=1;ctx.selectedSegment=0;
down(event());assert.equal(ctx.selected,null,'Blank pointerdown immediately clears all selection');up(event());
assert.equal(ctx.selectedIds.size,0);assert.equal(ctx.selectedPoints.size,0);assert.equal(ctx.selectedSegment,null);
assert.deepEqual(plain(ctx.future),['redo']);assert.equal(ctx.history.length,0);
reset();const blankDown=e=>{events.get('wrap:pointerdown:true')(e);events.get('wrap:pointerdown:false')(e)};blankDown(event(10,10));
assert.equal(ctx.drag.capture,ctx.stageWrap);assert.equal(ctx.selected,null,'Checkerboard outside SVG clears selection');
events.get('wrap:pointerup:false')(event(10,10));assert.equal(ctx.selectedIds.size,0);

reset();const original=ctx.state(),beforeSelectionRenders=sceneRenders;click('b');assert.equal(ctx.selected,'b');
assert.equal(sceneRenders,beforeSelectionRenders,'Click selection only refreshes handles and inspector, not the whole scene');
assert.equal(ctx.history.length,0);assert.deepEqual(plain(ctx.future),['redo'],'Selection must not discard Redo');
down(event(250,250,{target:target('a')}));move(event(252,251));up(event(252,251));
assert.equal(ctx.state(),original,'A small hand tremor must not move or snap an object');
assert.equal(ctx.history.length,0);
reset();down(event(250,250,{target:target('a')}));move(event(270,260));
assert.equal(ctx.byId('a').x,180);assert.equal(ctx.history.length,1);up(event(270,260));
assert.equal(ctx.history.length,1,'A drag is exactly one undo step');assert.equal(ctx.history[0],original);
reset();down(event(250,250,{target:target('a')}));move(event(270,260));move(event(250,250));up(event(250,250));
assert.equal(ctx.history.length,0);assert.deepEqual(plain(ctx.future),['redo'],'Returning to the original geometry is not an edit');
reset();down(event(250,250,{target:target('a')}));move(event(270,260));ctx.finishSelectionGesture(null,true);
assert.equal(ctx.state(),original);assert.equal(ctx.selected,'a');assert.equal(ctx.history.length,0);assert.deepEqual(plain(ctx.future),['redo']);
reset();down(event(250,250,{target:target('a')}));move(event(270,260,{pointerId:2}));up(event(270,260,{pointerId:2}));
assert.equal(ctx.state(),original);assert.ok(ctx.drag,'Another pointer cannot move or end the gesture');ctx.finishSelectionGesture(null,true);

reset(['a']);click('a',{shiftKey:true});assert.equal(ctx.selectedIds.size,0,'Shift-click can remove the last selected object');
reset(['a']);click('b',{shiftKey:true});assert.deepEqual([...ctx.selectedIds],['a','b']);
click('b');assert.deepEqual([...ctx.selectedIds],['b'],'Click an already-selected member without dragging collapses the group');
reset(['a','b']);down(event(250,250,{target:target('a')}));move(event(270,260));up(event(270,260));
assert.deepEqual([...ctx.selectedIds],['a','b']);assert.equal(ctx.byId('a').x,180);assert.equal(ctx.byId('b').x,540,'Dragging a selected member moves the existing group');
reset(['a']);down(event(250,250,{target:target('b'),shiftKey:true}));move(event(270,260));up(event(270,260));
assert.equal(ctx.byId('a').x,180);assert.equal(ctx.byId('b').x,540,'Shift-select and drag moves both in the same gesture');

// References are editable when unlocked; referenceOnly controls export, not locking.
reset(['ref']);const referenceOriginal=ctx.state();
down(event(100,100,{target:target('ref')}));move(event(130,120));up(event(130,120));
assert.equal(ctx.state(),referenceOriginal,'Locked reference cannot move');
ctx.select('ref');el('image-locked').onchange({target:{checked:false}});
assert.equal(ctx.selected,'ref');assert.equal(ctx.byId('ref').locked,false);
ctx.history=[];ctx.future=['redo'];const unlockedOriginal=ctx.state();
down(event(100,100,{target:target('ref')}));move(event(130,120));up(event(130,120));
assert.equal(ctx.byId('ref').x,30,'Unlocked reference moves directly with left drag');
assert.equal(ctx.byId('ref').y,20);assert.equal(ctx.history.length,1);
assert.deepEqual(plain(ctx.items.slice(1)),plain(seed.slice(1)),'Moving reference never changes traced vectors');
ctx.items=JSON.parse(ctx.history.pop());assert.equal(ctx.state(),unlockedOriginal,'Reference move is undoable');
assert.equal(ctx.byId('ref').referenceOnly,true,'Unlock never changes reference export exclusion');
for(const corner of ['tl','tr','bl','br']) for(const r of [0,30,90]) {
  reset(['ref']);Object.assign(ctx.byId('ref'),{locked:false,r});
  const base=plain(ctx.byId('ref'));
  down(event(100,100,{target:target(null,corner)}));move(event(160,135));up(event(160,135));
  const expected=plain(ctx.resizedReference(base,corner,60,35));
  for(const key of ['x','y','w','h'])assert.equal(ctx.byId('ref')[key],expected[key],corner+' uses rotated proportional resizing: '+key);
  assert.equal(ctx.history.length,1);assert.deepEqual(plain(ctx.items.slice(1)),plain(seed.slice(1)));
}
reset(['ref']);ctx.byId('ref').locked=false;
down(event(100,100,{target:target(null,'tr')}));move(event(170,100,{shiftKey:true}));up(event(170,100));
assert.equal(ctx.byId('ref').w,1270);assert.equal(ctx.byId('ref').h,675,'Shift allows free image sizing');
reset(['ref']);ctx.byId('ref').locked=false;const cancelRef=ctx.state();
down(event(100,100,{target:target(null,'tl')}));move(event(170,140));ctx.finishSelectionGesture(null,true);
assert.equal(ctx.state(),cancelRef);assert.equal(ctx.history.length,0);assert.deepEqual(plain(ctx.future),['redo']);
el('image-locked').onchange({target:{checked:true}});const relocked=ctx.state();
down(event(100,100,{target:target(null,'br')}));move(event(160,140));up(event(160,140));assert.equal(ctx.state(),relocked,'Relocking disables resize');
assert.equal((ctx.imageSelectionMarkup({...reference,locked:false}).match(/data-handle=/g)||[]).length,4,'Unlocked image shows all four corners without an extra edit mode');
assert.ok(!ctx.imageSelectionMarkup(reference).includes('data-handle='),'Locked image does not show misleading active handles');

reset(['line']);ctx.selectedPoints=new Set([0,1]);ctx.selectedPoint=1;
down(event(200,440,{target:target(null,'arrow-point',0),shiftKey:true}));up(event(200,440));
assert.deepEqual([...ctx.selectedPoints],[1]);assert.equal(ctx.selectedPoint,1);
down(event(330,420,{target:target(null,'arrow-point',1),shiftKey:true}));up(event(330,420));
assert.equal(ctx.selectedPoints.size,0);assert.equal(ctx.selectedPoint,null,'No stale anchor index after deselection');
reset(['line']);ctx.selectedPoints=new Set([0,1]);ctx.selectedPoint=0;
down(event(200,440,{target:target(null,'arrow-point',0),shiftKey:true}));move(event(220,450));up(event(220,450));
assert.deepEqual([...ctx.selectedPoints],[0,1]);assert.equal(ctx.byId('line').points[1].x,350,'Dragging an already-selected anchor keeps all selected anchors');
reset(['line']);const segmentEvent=event(265,430,{target:{closest:selector=>selector==='[data-segment]'?{dataset:{segment:'0'}}:null}});
down(segmentEvent);up(event(265,430));assert.equal(ctx.selectedSegment,0,'Click on the segment overlay still selects an insertion segment');
down(segmentEvent);move(event(305,450));up(event(305,450));
assert.equal(ctx.byId('line').points[0].x,240);assert.equal(ctx.selectedSegment,null,'Dragging the selected segment moves the line instead of swallowing the gesture');

reset([]);down(right(140,160));move(right(370,330));up(right(370,330));
assert.deepEqual([...ctx.selectedIds],['a'],'Marquee selects contained objects, never the locked image or enclosing outline');
assert.equal(ctx.state(),original);assert.equal(ctx.history.length,0);assert.deepEqual(plain(ctx.future),['redo'],'Right marquee never changes geometry or history');
reset(['b']);down(right(140,160,{shiftKey:true}));move(right(370,330));up(right(370,330));
assert.deepEqual([...ctx.selectedIds],['b','a'],'Shift-marquee adds objects');
reset(['line']);down(right(180,400));move(right(360,460));up(right(360,460));
assert.equal(ctx.selected,'line');assert.deepEqual([...ctx.selectedPoints],[0,1],'Anchor marquee survives initial blank deselection');
reset(['b']);down(event(140,160));move(event(370,330));
assert.equal(ctx.marqueeRect,null,'Left-drag on blank canvas must never start a marquee');up(event(370,330));
assert.equal(ctx.selectedIds.size,0);assert.equal(ctx.history.length,0);assert.equal(ctx.state(),original);
reset(['b']);blankDown(event(10,10));events.get('wrap:pointermove:false')(event(400,400));
assert.equal(ctx.marqueeRect,null,'Left-drag on checkerboard must never marquee');events.get('wrap:pointerup:false')(event(400,400));
reset(['b']);blankDown(right(10,10));events.get('wrap:pointermove:false')(right(370,330));events.get('wrap:pointerup:false')(right(370,330));
assert.deepEqual([...ctx.selectedIds],['a'],'Right-drag can begin on checkerboard');
reset(['b']);down(right(170,190,{target:target('a')}));
assert.equal(ctx.selected,'b','Right down must not select the object before deciding click versus drag');
ctx.handleSelectionContextMenu(right(250,250,{target:target('a')}));assert.equal(menuCalls,0,'Windows contextmenu on pointerdown must wait');
move(right(680,350));up(right(680,350));
assert.equal(ctx.byId('a').x,160,'Right-drag from an object does not move it');
assert.deepEqual([...ctx.selectedIds],['b'],'Right-drag starting inside A can marquee-select B');
ctx.handleSelectionContextMenu(right(680,350,{target:target('b')}));assert.equal(menuCalls,0,'Contextmenu after right-drag must stay suppressed');
reset(['a']);down(right(550,240,{target:target('b')}));up(right(550,240));
assert.equal(ctx.selected,'b');assert.equal(menuCalls,1,'Stationary right-click selects the target and opens its menu');
ctx.handleSelectionContextMenu(right(550,240,{target:target('b')}));assert.equal(menuCalls,1,'Native contextmenu must not open twice');
reset(['line']);down(right(200,440,{target:target(null,'arrow-point',0)}));move(right(360,400));up(right(360,400));
assert.deepEqual([...ctx.selectedPoints],[0,1]);assert.equal(ctx.state(),original,'Right-drag starting on an anchor selects points instead of moving the anchor');
reset(['line']);down(right(200,440,{target:target(null,'arrow-point',0)}));up(right(200,440));
assert.equal(menuCalls,1,'Right-click on an anchor opens its owner context menu');
reset(['a']);down(right(140,160));move(right(370,330));ctx.finishSelectionGesture(null,true);
assert.equal(ctx.selected,'a');assert.equal(ctx.marqueeRect,null);assert.equal(menuCalls,0,'Canceling a right-drag restores selection without a menu');
reset(['a']);ctx.handleSelectionContextMenu(event(550,240,{target:target('b')}));
assert.equal(ctx.selected,'b');assert.equal(menuCalls,1,'Keyboard context menus remain supported');
for(const type of ['image','text','box','ellipse','polygon','arrow']) {
  reset([]);const it=type==='arrow'?plain(arrow):type==='polygon'?{...plain(arrow),type:'polygon'}:{...plain(box),type};
  it.id='movable';ctx.items.push(it);down(event(250,250,{target:target('movable')}));move(event(280,270));up(event(280,270));
  assert.equal(it.points?it.points[0].x:it.x,type==='arrow'||type==='polygon'?230:190,type+' must move with left-drag');
  assert.equal(ctx.marqueeRect,null);
}
reset(['a']);down(event(900,640,{button:1}));up(event(900,640,{button:1}));
assert.equal(ctx.selected,'a','Middle-click no longer clears selection');
reset(['a']);ctx.selectLayerFromEvent({shiftKey:true},'a');assert.equal(ctx.selectedIds.size,0,'Layer list uses the same Shift toggle');
reset(['a']);events.get('window:keydown:false')({key:'Escape',target:{tagName:'svg'},preventDefault(){}});
assert.equal(ctx.selected,null,'Escape in selection mode clears everything');
reset(['a']);down(event(250,250,{target:target('a')}));move(event(270,260));
events.get('window:keydown:true')({key:'z',ctrlKey:true,target:{tagName:'svg'},preventDefault(){},stopImmediatePropagation(){}});
assert.equal(ctx.state(),original);assert.equal(ctx.drag,null);assert.equal(ctx.history.length,0,'Undo during a drag cancels that gesture cleanly');
for(const mode of ['bucket','picker','reference','pan']){reset();ctx.paintTool=mode;blankDown(event(10,10));blankDown(right(10,10));assert.equal(ctx.selected,'a',mode+' keeps its own background gesture');assert.equal(ctx.drag,null);}
reset();ctx.tracePenOn=true;blankDown(event(10,10));blankDown(right(10,10));assert.equal(ctx.selected,'a','Drawing mode does not become a marquee');assert.equal(ctx.drag,null);
assert.match(html,/data-outline-only=/);assert.match(html,/items\.filter\(selectableOnCanvas\)/);
assert.ok(!html.includes('左鍵拖空白可框選'),'Help text must match right-button marquee');
const worker=fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8');
for(const asset of ['paint-layers.js','paint-tools.js','paint-tools.css','selection-controls.js']) {
  const versioned=asset+'?v='+(asset==='selection-controls.js'?'19-reference-unlock':asset==='paint-layers.js'?'18-fill-order':asset==='paint-tools.css'?'19-reference-unlock':'14-selection');
  assert.ok(html.includes('"'+versioned+'"'),'Changed runtime asset must bypass stale HTTP caches: '+asset);
  assert.ok(worker.includes("'./"+versioned+"'"),'Offline cache must use the same asset version: '+asset);
}
console.log('Selection audit OK: blank/checkerboard clicks, Shift toggles, group/anchor drag, marquee, locked reference, jitter, undo/redo, cancellation and mode isolation.');

if(process.argv.includes('--fixture')) {
  const dir=fileURLToPath(new URL('../app/.codex-tmp/selection-qa/',import.meta.url));fs.mkdirSync(dir,{recursive:true});
  const image='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#f1f5f9"/></svg>';
  reference.src='data:image/svg+xml;base64,'+Buffer.from(image).toString('base64');reference.opacity=.3;reference.preserveFull=true;reference.r=0;
  const diagnostics='<script>function qaShowError(error){let output=document.getElementById("qa-errors");if(!output){output=document.createElement("pre");output.id="qa-errors";output.style="position:fixed;inset:0 0 auto auto;max-width:600px;z-index:9999;background:#fff;color:#b91c1c;white-space:pre-wrap";document.documentElement.appendChild(output)}output.textContent+=String(error?.stack||error)+"\\n"}window.addEventListener("error",e=>qaShowError(e.error||e.message));window.addEventListener("unhandledrejection",e=>qaShowError(e.reason));</script>';
  const fixture=html.replace('<head>','<head><base href="/">'+diagnostics).replace(/const STARTER_ITEMS=\[[\s\S]*?\n\];/,()=>`const STARTER_ITEMS=${JSON.stringify(seed)};`);
  assert.notEqual(fixture,html);fs.writeFileSync(path.join(dir,'editor.html'),fixture);console.log(dir);
}
