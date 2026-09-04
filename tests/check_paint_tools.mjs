import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const geometry = fs.readFileSync(new URL('../app/paint-layers.js', import.meta.url), 'utf8');
const paintCss = fs.readFileSync(new URL('../app/paint-tools.css', import.meta.url), 'utf8');
const paintToolsSource = fs.readFileSync(new URL('../app/paint-tools.js', import.meta.url), 'utf8');
assert.ok(paintToolsSource.includes('window.EyeDropper')&&paintToolsSource.includes('吸取畫布、圖片或螢幕上的顏色'));
assert.ok(!paintToolsSource.includes('底圖取色'),'Eyedropper is no longer restricted to the reference image');
assert.ok(paintCss.includes('.stage .handle[data-handle="tl"],.stage .handle[data-handle="br"]{cursor:nwse-resize}'));
assert.ok(paintCss.includes('.stage .handle[data-handle="tr"],.stage .handle[data-handle="bl"]{cursor:nesw-resize}'));
assert.ok(paintCss.indexOf('.stage-wrap.hand-tool') > paintCss.indexOf('cursor:nesw-resize'), 'Hand cursor must override resize cursors in pan mode');
const ctx = vm.createContext({}); vm.runInContext(geometry, ctx);
const plain = value => JSON.parse(JSON.stringify(value));
const ref = {id:'ref', type:'image', name:'底圖', x:100,y:100,w:800,h:480,r:0,opacity:.35,referenceOnly:true,locked:true,preserveFull:true};
const outer = {id:'outer',name:'外框',type:'box',x:140,y:140,w:480,h:320,r:0,radius:30,fill:'#ffffff',stroke:'#123f8c',strokeWidth:4};
const divider = {id:'divider',name:'T 型分隔線',type:'arrow',points:[{x:380,y:140},{x:380,y:460}],curved:false,width:4,color:'#123f8c',endHead:false,closed:false};
const unrelated = {id:'detail',name:'獨立內部線條',type:'arrow',points:[{x:180,y:250},{x:310,y:310}],curved:false,width:5,color:'#f97316',endHead:false,closed:false};
const shape = {id:'circle',name:'圓形區域',type:'ellipse',x:710,y:220,w:140,h:140,fill:'#ecfdf5',stroke:'#123f8c',strokeWidth:4};
const source = [unrelated,outer,divider,ref,shape], saved = JSON.stringify(source);
const painted = plain(ctx.paintSceneItems(source));
assert.equal(JSON.stringify(source), saved, 'Paint expansion does not mutate editable objects');
assert.deepEqual(painted.map(it=>it.id), ['ref','outer::paint-fill','circle::paint-fill','detail','outer','divider','circle']);
assert.ok(painted.slice(1,3).every(it=>it.strokeWidth===0&&it.paintLayer==='fill'));
assert.equal(painted.find(it=>it.id==='outer').opacity,0);
assert.equal(painted.find(it=>it.id==='detail').width,5,'Unrelated line remains above fills');
assert.equal(new Set(painted.map(it=>it.id)).size,painted.length,'Native ids remain unique');
assert.equal(ctx.paintSceneItems([{...outer,opacity:0}]).length,1,'Transparent fill does not create a layer');
const onlyFill={...outer,id:'region',strokeWidth:0};
assert.equal(ctx.paintSceneItems([onlyFill])[0].id,'region','Color-only regions retain their identity');
const poly={...outer,type:'polygon',label:'visible label'};
assert.equal(ctx.paintSceneItems([poly])[0].label,'');
assert.equal(ctx.paintSceneItems([poly])[1].label,'visible label');
const arrow={...divider,closed:true,fill:'#f00',fillOpacity:1};
assert.equal(ctx.paintSceneItems([arrow])[1].fillOpacity,0);
assert.equal(ctx.paintSceneItems([arrow])[0].endHead,false);
assert.match(html,/items:paintSceneItems\(exportableItems\(sourceItems\)\)/,'Native and editor share paint ordering');
assert.match(html,/return paintSceneItems\(sourceItems\)\.map/);
assert.match(html,/it\.paintSourceId\|\|it\.id/,'Rendered fill still selects the original object');
assert.match(html,/chosen\.some\(it=>it\.id===n\.dataset\.id\)/,'Selection SVG includes fill and stroke but excludes reference');
ctx.items=plain(source);
const fillIds=()=>plain(ctx.paintSceneItems(ctx.items)).filter(it=>it.paintLayer==='fill').map(it=>it.paintSourceId||it.id);
ctx.raiseFilledItem(ctx.items.find(it=>it.id==='outer'));
assert.deepEqual(fillIds(),['circle','outer'],'Repainting an earlier shape raises only its fill');
const undoFill=JSON.stringify(ctx.items);ctx.raiseFilledItem(ctx.items.find(it=>it.id==='circle'));
assert.deepEqual(fillIds(),['outer','circle']);
assert.deepEqual(plain(ctx.paintSceneItems(ctx.items)).filter(it=>it.paintLayer!=='fill').map(it=>it.id),['ref','detail','outer','divider','circle'],'Fill order never changes line order');
ctx.items=JSON.parse(JSON.stringify(ctx.items));assert.deepEqual(fillIds(),['outer','circle'],'Fill order survives save/reload');
ctx.items=JSON.parse(undoFill);assert.deepEqual(fillIds(),['circle','outer'],'Undo restores the previous color stack');
const colorStart=html.indexOf('function applyColorToItem('),colorEnd=html.indexOf('function applyPaletteToSelection(',colorStart);
vm.runInContext(html.slice(colorStart,colorEnd),ctx);
ctx.applyColorToItem(ctx.items.find(it=>it.id==='circle'),'#ef4444',true);assert.deepEqual(fillIds(),['outer','circle']);
ctx.raiseFilledItem(ctx.items.find(it=>it.id==='outer'));
const dropped=ctx.items.find(it=>it.id==='circle');
Object.assign(ctx,{svg:{getBoundingClientRect:()=>({left:0,top:0,right:1200,bottom:675})},svgPt:p=>p,fillTargetAt:()=>dropped,
  document:{getElementById:()=>({textContent:''})},selectedPoints:new Set(),commit(){ctx.dropCommits++},dropCommits:0,
  materializeFillTarget:target=>target,rememberPaletteColor(){},render(){}});
vm.runInContext(html.split('\n').find(line=>line.startsWith('function completePaletteDrop(')),ctx);
ctx.completePaletteDrop('#ef4444',800,300,null);assert.deepEqual(fillIds(),['outer','circle'],'Same-color repaint can still raise a lower fill');
assert.equal(ctx.dropCommits,1);ctx.completePaletteDrop('#ef4444',800,300,null);assert.equal(ctx.dropCommits,1,'Same-color repaint already on top is a no-op');

for (const corner of ['tl','tr','bl','br']) for (const r of [0,30,90,-120]) {
  const base={x:100,y:150,w:800,h:480,r};
  const next=ctx.resizedReference(base,corner,70,-45);
  assert.ok(Math.abs(next.w/next.h-base.w/base.h)<1e-10,'Aspect ratio is preserved');
  const fixed = item => {
    const sx=corner.includes('r')?-1:1,sy=corner.includes('b')?-1:1,a=r*Math.PI/180;
    return [item.x+item.w/2+(sx*item.w*Math.cos(a)-sy*item.h*Math.sin(a))/2,item.y+item.h/2+(sx*item.w*Math.sin(a)+sy*item.h*Math.cos(a))/2];
  };
  const a=fixed(base),b=fixed(next); assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8,'Opposite corner stays fixed, including rotation');
}
const tiny=ctx.resizedReference(ref,'br',-9000,-9000);
assert.ok(tiny.w>=20&&tiny.h>=20);
assert.equal(ctx.resizedReference(ref,'br',-200,0,true).h,480,'Shift permits free resize');
for (const [x,y] of [[10,10],[790,10],[10,590],[790,590],[400,300]]) {
  const p=ctx.colorLoupePosition(x,y,800,600);
  assert.ok(p.x>=8&&p.y>=8&&p.x+112<=792&&p.y+140<=592);
  assert.ok(x<p.x||x>p.x+112||y<p.y||y>p.y+140,'Magnifier never covers the sampled point');
}
console.log('Paint tools OK: bottom fills, unrelated lines, SVG/PPT order, immutable source, rotated proportional resizing and offset loupe.');

// Exercise the shipped pointer/keyboard handlers without browser-private state.
const elements=new Map(),events=new Map();
function element(id) {
  if(!elements.has(id))elements.set(id,{
    attributes:{},style:{setProperty(){}},classList:{add(){},remove(){}},hidden:false,
    setAttribute(key,value){this.attributes[key]=value},insertAdjacentHTML(){},
    querySelector(key){return element(id+' '+key)},querySelectorAll(){return []},
    addEventListener(type,handler,capture){events.set(id+':'+type+':'+!!capture,handler)},
    setPointerCapture(){},hasPointerCapture(){return false},releasePointerCapture(){}
  });
  return elements.get(id);
}
let paintCount=0,renderCount=0;
const controller=vm.createContext({
  document:{getElementById:element,querySelector:element,body:element('body')},
  window:element('window'),svg:element('stage'),stageWrap:element('.stage-wrap'),stageShell:element('.stage-shell'),items:[plain(ref),plain(divider)],selected:ref.id,
  selectedIds:new Set([ref.id]),selectedPoints:new Set(),history:[],future:['redo'],drag:null,palettePointerDrag:null,
  activePaletteColor:'#7c3aed',setFillHover(){},renderSelection(){},render(){renderCount++},
  svgPt:e=>({x:e.clientX,y:e.clientY}),overlayUnit:()=>1,deepCopy:plain,
  completePaletteDrop(){paintCount++;return true},
  commit(){controller.history.push('snapshot');controller.future=[]},
  byId:id=>controller.items.find(it=>it.id===id),rememberPaletteColor(){},
  setOnlySelected:id=>{controller.selected=id;controller.selectedIds=new Set([id])},
  renderPalette(){},clearSelectionState(){},
});
vm.runInContext(geometry+'\n'+fs.readFileSync(new URL('../app/paint-tools.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../app/pan-tool.js',import.meta.url),'utf8'),controller);
controller.setTracePen=()=>controller.resetPaintTools();
controller.activateSelectTool=()=>controller.setTracePen(false);
controller.initializePaintTools();controller.activatePaintBucket();
controller.window.EyeDropper=class{async open(){return{sRGBHex:'#12ab34'}}};
await controller.activateColorPicker();assert.equal(controller.activePaletteColor,'#12ab34','System eyedropper accepts any on-screen color without a reference image');
const pointer=(x,y,extra={})=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){},target:{closest:()=>null},...extra});
const down=events.get('stage:pointerdown:true'),move=events.get('stage:pointermove:true'),up=events.get('stage:pointerup:true');
down(pointer(200,200));down(pointer(220,220));
assert.equal(paintCount,2);assert.equal(vm.runInContext('paintTool',controller),'bucket','Mode persists across multiple clicks');
vm.runInContext(html.split('\n').find(l=>l.startsWith('function applyPaletteToSelection(')),controller);
const original=JSON.stringify(controller.items);
controller.applyPaletteToSelection('#ef4444');
assert.equal(controller.activePaletteColor,'#ef4444');assert.equal(JSON.stringify(controller.items),original,'Changing bucket swatch must not recolor selection');
events.get('window:keydown:true')({...pointer(0,0),key:'Escape',target:{tagName:'svg'}});
assert.equal(vm.runInContext('paintTool',controller),null,'Escape exits bucket');
controller.activateReferenceResize();
down(pointer(900,580,{target:{closest:()=>({dataset:{referenceCorner:'br'}})}}));
move(pointer(700,460));up(pointer(700,460));
assert.equal(controller.items[0].w,600);assert.equal(controller.items[0].h,360);
assert.equal(controller.items[0].locked,true);assert.equal(controller.history.length,1,'One drag is one undo step');
assert.deepEqual(plain(controller.items[1]),divider,'Reference resize never changes line geometry');
down(pointer(700,460,{target:{closest:()=>({dataset:{referenceCorner:'br'}})}}));
move(pointer(500,340));controller.finishReferenceDrag(true);
assert.equal(controller.items[0].w,600);assert.equal(controller.history.length,1,'Canceled drag restores the previous size');
assert.ok(renderCount>0);
console.log('Paint interaction OK: persistent bucket, color-only swatch choice, Escape, proportional drag, isolated geometry and canceled gesture.');

controller.initializeHandTool();
controller.stageWrap.scrollLeft=0;controller.stageWrap.scrollTop=0;
controller.activateHandTool();
const handBefore=JSON.stringify(controller.items),selectionBefore=controller.selected,undoBefore=controller.history.length;
const handDown=events.get('.stage-wrap:pointerdown:true'),handMove=events.get('.stage-wrap:pointermove:true');
handDown(pointer(400,300));handMove(pointer(580,380));
assert.equal(controller.stageShell.style.transform,'translate(180px, 80px)','Hand pans even with no scrollbars at fit zoom');
handMove(pointer(500,320,{pointerId:2}));
assert.equal(controller.stageShell.style.transform,'translate(180px, 80px)','A second pointer must not take over the gesture');
events.get('.stage-wrap:pointerup:true')(pointer(580,380));
assert.equal(vm.runInContext('handDrag',controller),null);
controller.drag={kind:'pan'};
handMove({...pointer(300,300),stopImmediatePropagation(){throw new Error('Middle-button panning must keep its existing handler')}});
controller.drag=null;
assert.equal(JSON.stringify(controller.items),handBefore);assert.equal(controller.selected,selectionBefore);
assert.equal(controller.history.length,undoBefore,'View movement never creates drawing undo steps');
controller.activatePaintBucket();assert.equal(vm.runInContext('paintTool',controller),'bucket','Hand and paint modes are exclusive');
assert.equal(controller.stageShell.style.transform,'translate(180px, 80px)','Changing tools retains view position');
events.get('window:keydown:true')({...pointer(0,0),key:'h',target:{tagName:'svg'}});
assert.equal(vm.runInContext('paintTool',controller),'pan');
handDown(pointer(200,200));events.get('window:blur:false')();
assert.equal(vm.runInContext('handDrag',controller),null,'Window blur releases the hand');
controller.resetCanvasPan();assert.equal(controller.stageShell.style.transform,'','Fit/page switch can reset view');
events.get('window:keydown:true')({...pointer(0,0),key:'Escape',target:{tagName:'svg'}});
assert.equal(vm.runInContext('paintTool',controller),null);
assert.match(html,/function fitView\(\)\{resetCanvasPan\(\)/);
assert.match(html,/function resetEditorState\(\)\{resetPaintTools\(\);resetCanvasPan\(\)/);
assert.match(html,/id="select-tool"[\s\S]*?id="pan-tool"[\s\S]*?id="trace-pen"/);
console.log('Hand tool OK: toolbar order, free panning, selection/geometry/history isolation, H/Escape, pointer ownership, tool switching and reset.');

if (process.env.SKECHU_TEST_POWERPOINT === '1') {
  const payload = plain(ctx.paintSceneItems([unrelated,{...outer,fill:'#ef4444'},divider,shape]));
  const code = `import sys,json,pathlib
sys.path.insert(0,"app")
import bridge
items=json.load(sys.stdin)
try:
    bridge.copy_native({"items":items},copy_clipboard=False)
    state=bridge.STATE;group=state["cached_group"]
    ordered=[]
    for item in items:
        shape=group.GroupItems.Item(state["item_shapes"][item["id"]][0])
        ordered.append((item["id"],shape.ZOrderPosition))
        if item.get("paintLayer")=="fill":
            assert shape.Line.Visible==0,(item["id"],"fill layer has an outline")
        if item.get("paintLayer")=="line":
            assert shape.Fill.Transparency>.999,(item["id"],"foreground fill must be transparent")
    assert all(ordered[i][1]<ordered[i+1][1] for i in range(len(ordered)-1)),ordered
    # Recolor and reorder together used to reuse the old group's stacking order.
    items[0],items[1]=items[1],items[0]
    items[1]['fill']='#22c55e'
    changed=bridge.copy_native({"items":items},copy_clipboard=False)
    assert changed.get('incremental'),changed
    state=bridge.STATE;group=state['cached_group']
    positions=[group.GroupItems.Item(state['item_shapes'][item['id']][0]).ZOrderPosition for item in items]
    assert positions==sorted(positions),positions
    items[0]['fill']='#2563eb'
    assert bridge.copy_native({"items":items},copy_clipboard=False).get('incremental'),'Same-order recolor should stay fast'
    out=pathlib.Path(".codex-tmp/paint-native-qa").resolve();out.mkdir(parents=True,exist_ok=True)
    state["presentation"].Slides(1).Export(str(out/"layer-order.png"),"PNG",1200,675)
    print("Actual PowerPoint fill/line ordering verified:",ordered)
finally:
    pres=bridge.STATE.get("presentation")
    if pres is not None: pres.Saved=True;pres.Close()
`;
  const result=spawnSync(process.env.PYTHON||'python',['-X','utf8','-c',code],{cwd:new URL('..',import.meta.url),input:JSON.stringify(payload),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
}

if(process.argv.includes('--fixture')) {
  const dir=fileURLToPath(new URL('../app/.codex-tmp/paint-qa/',import.meta.url));fs.mkdirSync(dir,{recursive:true});
  const image='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480"><rect width="400" height="480" fill="#fbbf24"/><rect x="400" width="400" height="480" fill="#38bdf8"/></svg>';
  ref.src='data:image/svg+xml;base64,'+Buffer.from(image).toString('base64');
  const fixture=html.replace('<head>','<head><base href="/">').replace(/const STARTER_ITEMS=\[[\s\S]*?\n\];/,()=>`const STARTER_ITEMS=${JSON.stringify([ref,unrelated,outer,divider,shape])};`);
  assert.notEqual(fixture,html);fs.writeFileSync(path.join(dir,'editor.html'),fixture);
  const overlap=html.replace('<head>','<head><base href="/">').replace(/const STARTER_ITEMS=\[[\s\S]*?\n\];/,()=>`const STARTER_ITEMS=${JSON.stringify([ref,outer,{...shape,x:420,y:260,w:250,h:230},unrelated])};`);
  fs.writeFileSync(path.join(dir,'overlap.html'),overlap);
  console.log(dir);
}
