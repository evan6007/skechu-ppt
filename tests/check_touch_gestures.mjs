import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app/touch-gestures.js'),plain=v=>JSON.parse(JSON.stringify(v));
function harness(){
  const listeners=new Map(),frames=new Map(),elements=new Map(),captured=new Set();let serial=0,grids=0;
  const el=id=>{if(!elements.has(id))elements.set(id,{className:'stage',attrs:{class:'stage','aria-pressed':'false'},style:{},
    getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v},classList:{add(){},remove(){}},
    addEventListener(type,fn,options){listeners.set(id+':'+type,{fn,options})},hasPointerCapture:id=>captured.has(id),
    setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id)});return elements.get(id);};
  const ctx=vm.createContext({window:el('window'),document:{getElementById:el},stageWrap:el('wrap'),stageShell:el('shell'),svg:el('svg'),
    activeProjectId:'p',activePageId:'a',items:[{id:'shape',x:20,y:40,locked:false}],history:['older'],future:['redo'],
    selected:'shape',selectedIds:new Set(['shape']),selectedPoints:new Set(),traceDraft:null,paintTool:null,tracePenOn:false,
    traceRouteValid:true,traceJoinMode:false,traceSnapTarget:null,activePaletteColor:'#123456',autoJunctionPositions:new Map(),
    zoom:1,baseStageWidth:338,canvasPan:{x:0,y:0},wheelFrame:0,wheelFactor:1,
    deepCopy:plain,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    selectionSnapshot(){return {selected:ctx.selected,ids:[...ctx.selectedIds],points:[...ctx.selectedPoints]}},
    restoreSelectionSnapshot(s){ctx.selected=s.selected;ctx.selectedIds=new Set(s.ids);ctx.selectedPoints=new Set(s.points)},
    state:()=>JSON.stringify(ctx.items),finishSelectionGesture(){},finishReferenceDrag(){},finishHandDrag(){},
    setFillHover(){},syncPaintColor(){},render(){},closeMobilePanels(){},renderSelection(){},syncMobileControls(){},
    syncCheckerGrid(){grids++},setCanvasPan(x,y){ctx.canvasPan={x,y}},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)});
  ctx.stageWrap.contains=target=>target===ctx.svg||target===ctx.stageWrap;
  ctx.stageWrap.scrollLeft=39;ctx.stageWrap.scrollTop=27;
  ctx.stageShell.style.width='338px';
  ctx.svg.getBoundingClientRect=()=>{
    const shellWidth=parseFloat(ctx.stageShell.style.width),width=shellWidth-2,height=width*2/3;
    return {left:12+Math.max(8,(390-shellWidth)/2)+1+ctx.canvasPan.x-ctx.stageWrap.scrollLeft,
      top:100+8+1+ctx.canvasPan.y-ctx.stageWrap.scrollTop,width,height};
  };
  vm.runInContext(source,ctx);ctx.initializeTouchGestures();
  const fire=(type,id,x=140,y=220,extra={})=>{
    const event={pointerType:'touch',pointerId:id,clientX:x,clientY:y,target:ctx.svg,cancelable:true,
      preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra};
    listeners.get('window:'+type).fn(event);return event;
  };
  const tick=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());};
  const screen=(u,v)=>{const r=ctx.svg.getBoundingClientRect();return{x:r.left+u*r.width,y:r.top+v*r.height}};
  return {ctx,listeners,frames,captured,fire,tick,screen,grids:()=>grids,active:()=>vm.runInContext('canvasTouchNavigation',ctx)};
}
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,`${message}: ${actual} != ${expected}`);
let h=harness(),c=h.ctx;
assert.equal(h.fire('pointerdown',1).stopped,undefined,'Single touch continues into existing editing handlers');
c.items[0].x=999;c.history.push('accidental drag');c.future=[];c.selected=null;c.selectedIds.clear();
assert.equal(h.fire('pointerdown',2,240,220).stopped,true);
assert.equal(c.items[0].x,20);assert.deepEqual(plain(c.history),['older']);assert.deepEqual(plain(c.future),['redo']);assert.equal(c.selected,'shape');
const initial=c.svg.getBoundingClientRect(),u=(190-initial.left)/initial.width,v=(220-initial.top)/initial.height;
h.fire('pointermove',1,130,260);h.fire('pointermove',2,330,260);assert.equal(h.frames.size,1,'Both contacts coalesce into one paint frame');h.tick();
near(c.zoom,2,'Distance doubles zoom');near(h.screen(u,v).x,230,'Horizontal midpoint stays anchored across flex recentering');near(h.screen(u,v).y,260,'Vertical midpoint stays anchored across padding and scroll');
h.fire('pointermove',1,-500,-400);h.fire('pointermove',2,-300,-400);h.tick();
near(c.zoom,2,'Two-finger pan does not zoom');near(h.screen(u,v).x,-400,'Can pan outside scrollable bounds');near(h.screen(u,v).y,-400,'Can pan upwards');
h.fire('pointerup',2,-300,-400);const lastPan={...c.canvasPan};
assert.equal(h.fire('pointermove',1,200,350).stopped,true);h.tick();assert.deepEqual(c.canvasPan,lastPan,'Remaining finger cannot move the view or objects');
h.fire('pointerup',1,200,350);assert.equal(h.active(),false);assert.equal(h.captured.size,0);assert.equal(h.fire('dblclick',1).stopped,true,'Pinch cannot leak a compatibility double click');
assert.equal(h.fire('pointerdown',3).stopped,undefined,'Next fresh single touch can edit again');h.fire('pointerup',3);
assert.equal(h.fire('click',3).stopped,undefined);

// Persistent tracing and paint tools restore their pre-touch document, not a
// blank draft or the first finger's accidental extra node/fill.
for(const mode of ['trace','bucket','picker','pan','reference']){
  h=harness();c=h.ctx;c.paintTool=mode==='trace'?null:mode;c.tracePenOn=mode==='trace';
  c.traceDraft=mode==='trace'?{id:'line',anchorCount:3,anchorIndices:[0,1,2]}:null;
  const before=c.state(),draft=plain(c.traceDraft);h.fire('pointerdown',1);
  c.items.push({id:'accidental',x:500});c.history.push('accidental');c.traceDraft={id:'accidental',anchorCount:1};c.activePaletteColor='#ffffff';
  h.fire('pointerdown',2,260,220);
  assert.equal(c.state(),before,mode+' must not edit during navigation');assert.deepEqual(plain(c.traceDraft),draft);assert.equal(c.activePaletteColor,'#123456');
  assert.equal(c.paintTool,mode==='trace'?null:mode);h.fire('pointercancel',2);h.fire('pointercancel',1);assert.equal(h.active(),false);
}

// Rotation is deliberately ignored; only contact distance and midpoint matter.
h=harness();c=h.ctx;h.fire('pointerdown',1,140,220);h.fire('pointerdown',2,240,220);
h.fire('pointermove',1,190,170);h.fire('pointermove',2,190,270);h.tick();near(c.zoom,1,'Rotating fingers cannot rotate or enlarge artwork');
h.fire('pointermove',1,-10000,0);h.fire('pointermove',2,10000,0);h.tick();assert.equal(c.zoom,5);
h.fire('pointermove',1,190,220);h.fire('pointermove',2,191,220);h.tick();assert.equal(c.zoom,.35);
h.fire('pointerdown',3,300,300);const beforeThird=c.svg.getBoundingClientRect();
h.fire('pointerup',1,190,220);h.fire('pointermove',2,191,220);h.tick();
near(c.svg.getBoundingClientRect().left,beforeThird.left,'Replacing one of three fingers rebases without a jump');
h.listeners.get('window:blur').fn();assert.equal(h.active(),false);assert.equal(h.captured.size,0);assert.equal(h.frames.size,0);
assert.equal(h.fire('pointerdown',4,100,200,{pointerType:'mouse'}).stopped,undefined);assert.equal(h.fire('pointerdown',5,200,200,{pointerType:'pen'}).stopped,undefined);
assert.equal(h.fire('pointerdown',6,100,200,{target:{}}).stopped,undefined,'Toolbar and panels are outside the navigation surface');
c.document.getElementById('auto-trace-dialog').open=true;h.fire('pointerdown',7);h.fire('pointerdown',8,240,220);assert.equal(h.active(),false,'An open modal owns its own touches');

// Many frames, nonuniform movement and repeated zoom/pan cycles cannot drift.
h=harness();c=h.ctx;h.fire('pointerdown',1,90,210);h.fire('pointerdown',2,250,230);
const pair={x:170,y:220},r=c.svg.getBoundingClientRect(),ax=(pair.x-r.left)/r.width,ay=(pair.y-r.top)/r.height;
for(let i=0;i<200;i++){
  const x=170+80*Math.sin(i/17),y=220+60*Math.cos(i/13),dx=80*(1+.65*Math.sin(i/19)),dy=10;
  h.fire('pointermove',1,x-dx,y-dy);h.fire('pointermove',2,x+dx,y+dy);h.tick();
  near(h.screen(ax,ay).x,x,'No horizontal drift at frame '+i);near(h.screen(ax,ay).y,y,'No vertical drift at frame '+i);
}
assert.deepEqual(plain(c.history),['older']);assert.deepEqual(plain(c.future),['redo']);
h.listeners.get('window:pagehide').fn();assert.equal(h.active(),false);
h=harness();c=h.ctx;h.fire('pointerdown',1);c.activePageId='new';c.items=[{id:'new-page-item'}];h.fire('pointerdown',2,240,220);
assert.equal(c.items[0].id,'new-page-item','A page switch cannot resurrect the previous document');
h.listeners.get('window:resize').fn();assert.equal(h.active(),false);assert.equal(h.captured.size,0);
h=harness();h.ctx.baseStageWidth=0;h.fire('pointerdown',1);h.fire('pointerdown',2,240,220);assert.equal(h.active(),false,'Wait for first page layout before navigating');

const html=read('app/index.html'),worker=read('app/service-worker.js');
assert.ok(html.includes('touch-gestures.js?v=68-touch-gestures')&&html.includes('initializeTouchGestures();'));
assert.ok(worker.includes('touch-gestures.js?v=68-touch-gestures'));
assert.ok(read('.github/workflows/windows-release.yml').includes('app/touch-gestures.js;.'));
assert.ok(read('app/mobile-controls.css').includes('.stage-wrap{touch-action:none;overscroll-behavior:contain;overflow-anchor:none}'));
assert.equal(h.listeners.get('window:pointerdown').options.capture,true);
assert.equal(h.listeners.get('window:pointermove').options.passive,false);
console.log('Touch navigation OK: anchored pinch, free pan, no rotation/drift, first-finger edit rollback, tracing/paint/history preservation, third-finger rebasing, cancellation, mouse/pen/modal isolation, ghost-click suppression and offline packaging.');
