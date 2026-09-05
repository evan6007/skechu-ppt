import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app/workspace-actions.js',import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x)),events=new Map(),nodes=new Map(),bodyChildren=[];
let hoveredPage=null;
function node(id){if(!nodes.has(id))nodes.set(id,{hidden:true,style:{},innerHTML:'',textContent:'',scrollTop:0,addEventListener(type,fn,capture){events.set(id+':'+type+':'+!!capture,fn)},querySelector(){return null},querySelectorAll(){return[]},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){},getBoundingClientRect(){return{top:0,bottom:400,width:220,height:400}},contains(){return true}});return nodes.get(id)}
let sequence=0,internalPastes=0,autosaves=0,confirmAnswer=true,promptAnswer='新名稱',delayDecode=false;
const pendingImages=[];
const seed=[{id:'stroke',type:'arrow',points:[{x:5,y:6},{x:9,y:10}],pointJunctions:{1:'j1'},layerGroup:{id:'folder'},networkId:'net'},
 {id:'branch',type:'arrow',points:[{x:9,y:10},{x:30,y:20}],pointJunctions:{0:'j1'},attachments:{start:{owner:'stroke'}},layerGroup:{id:'folder'}},
 {id:'fill',type:'arrow',regionFill:{sources:['stroke','branch']},layerGroup:{id:'folder'}}];
const ctx=vm.createContext({console,Map,Set,Promise,Math,Array,Number,JSON,Date,
  items:plain(seed),selected:'stroke',selectedIds:new Set(['stroke']),selectedPoint:0,selectedPoints:new Set([0]),selectedSegment:0,editPoints:true,
  activeProjectId:'project',activePageId:'p1',traceDraft:null,drag:null,history:[],internalClipboard:[{id:'old'}],
  project:{id:'project',pages:[{id:'p1',name:'第一頁',canvasWidth:300,canvasHeight:500,canvasColor:'#f4efe8',canvasOpacity:.65,items:plain(seed)},{id:'p2',name:'第二頁',canvasWidth:900,canvasHeight:500,items:[]}]},
  setTimeout:fn=>{fn();return 1},document:{body:{insertAdjacentHTML(){},appendChild(node){bodyChildren.push(node)}},getElementById:node,addEventListener(type,fn){events.set('document:'+type,fn)},elementFromPoint(){return hoveredPage}},
  window:{innerWidth:1200,innerHeight:800,addEventListener(type,fn,capture){events.set('window:'+type+':'+!!capture,fn)}},
  stageWrap:{classList:{add(){},remove(){}}},svgPt:event=>({x:event.clientX,y:event.clientY}),clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),
  deepCopy:plain,id:()=>`item-${++sequence}`,uid:prefix=>`${prefix}-${++sequence}`,esc:String,
  cloneLayerGroups:clones=>{const keys=new Map();for(const it of clones)if(it.layerGroup){const old=it.layerGroup.id;if(!keys.has(old))keys.set(old,`group-${++sequence}`);it.layerGroup.id=keys.get(old)}},
  makePage:(name,items,size)=>({id:`page-${++sequence}`,name,items:plain(items),canvasWidth:size.width,canvasHeight:size.height,canvasColor:size.color,canvasOpacity:size.opacity}),
  prompt:()=>promptAnswer,confirm:()=>confirmAnswer,renderProjectNav(){},renderWorkspacePages(){},queueAutosave(){autosaves++},
  activateSelectTool(){},render(){},pasteInternalSelection(){internalPastes++},setAutosaveStatus(){},repairItemSequence(){},
  normalizeProject:(raw,name)=>({id:`project-${++sequence}`,name:raw?.name||name,pages:[{id:`page-${++sequence}`,name:'圖 1',canvasWidth:300,canvasHeight:500,items:plain(raw?.items||[])}]}),
  FileReader:class{readAsDataURL(file){this.result='data:'+file.type+';base64,test';this.onload()}readAsText(file){this.result=file.content;this.onload()}},
  Image:class{naturalWidth=800;naturalHeight=400;set src(value){if(delayDecode)pendingImages.push(this);else this.onload()}},
});
ctx.activeProject=()=>ctx.project;ctx.activePage=()=>ctx.project.pages.find(p=>p.id===ctx.activePageId);ctx.canvasSize=()=>({width:300,height:500});
ctx.syncActivePage=()=>{const p=ctx.activePage();if(p)p.items=plain(ctx.items)};
ctx.openPage=id=>{ctx.syncActivePage();ctx.activePageId=id;ctx.items=plain(ctx.activePage().items);autosaves++};
ctx.openProject=id=>{ctx.syncActivePage();ctx.activeProjectId=id;ctx.project=ctx.projects.find(project=>project.id===id);ctx.activePageId=ctx.project.pages[0].id;ctx.items=plain(ctx.project.pages[0].items)};
ctx.commit=()=>ctx.history.push(plain(ctx.items));
ctx.projects=[ctx.project];
vm.runInContext(source,ctx);ctx.initializeWorkspaceActions();
const target=id=>({projectId:'project',pageId:id});
ctx.items[0].points[0].x=99;ctx.runPageAction('copy',target('p1'));
ctx.runPageAction('paste',target('p2'));const pasted=ctx.activePage();
assert.equal(pasted.canvasWidth,300);assert.equal(pasted.canvasHeight,500);assert.equal(pasted.items[0].points[0].x,99,'Page clipboard uses current unsaved edits');
assert.equal(pasted.canvasColor,'#f4efe8');assert.equal(pasted.canvasOpacity,.65,'Page copies preserve their canvas color and opacity');
assert.ok(pasted.items.every(it=>!seed.some(old=>old.id===it.id)));
assert.equal(pasted.items[1].attachments.start.owner,pasted.items[0].id);assert.deepEqual(plain(pasted.items[2].regionFill.sources),[pasted.items[0].id,pasted.items[1].id]);
assert.equal(pasted.items[0].pointJunctions[1],pasted.items[1].pointJunctions[0]);assert.notEqual(pasted.items[0].pointJunctions[1],'j1');
assert.equal(pasted.items[0].layerGroup.id,pasted.items[1].layerGroup.id);assert.notEqual(pasted.items[0].layerGroup.id,'folder');
ctx.items[0].points[0].x=7;assert.equal(ctx.project.pages[0].items[0].points[0].x,99,'Copy edits never mutate source');
ctx.runPageAction('first',target(pasted.id));assert.equal(ctx.project.pages[0].id,pasted.id);
ctx.runPageAction('last',target(pasted.id));assert.equal(ctx.project.pages.at(-1).id,pasted.id);
ctx.runPageAction('rename',target('p2'));assert.equal(ctx.project.pages.find(p=>p.id==='p2').name,'新名稱');
promptAnswer=null;ctx.runPageAction('rename',target('p2'));assert.equal(ctx.project.pages.find(p=>p.id==='p2').name,'新名稱');
confirmAnswer=false;ctx.runPageAction('delete',target('p2'));assert.equal(ctx.project.pages.length,3);
confirmAnswer=true;ctx.runPageAction('delete',target('p2'));assert.equal(ctx.project.pages.length,2);assert.equal(ctx.activePageId,pasted.id,'Deleting an inactive page does not switch the canvas');
ctx.runPageAction('new',target(pasted.id));assert.equal(ctx.items.length,0);assert.equal(ctx.activePage().canvasHeight,500);
const count=ctx.project.pages.length;ctx.runPageAction('duplicate',{projectId:'wrong',pageId:pasted.id});assert.equal(ctx.project.pages.length,count);
assert.equal(ctx.pageActionDisabled('delete',{pages:[pasted]},pasted),true,'Cannot delete the final page');
assert.ok(autosaves>0);
ctx.project.pages=[{id:'p1',name:'第一頁',items:plain(seed)},{id:'p2',name:'第二頁',items:[]},pasted];ctx.activePageId='p1';ctx.items=plain(seed);
const pageCard=(id,top=0)=>({dataset:{pageId:id},style:{value:'',writes:0,get transform(){return this.value},set transform(value){this.value=value;this.writes++}},classList:{add(){}},closest(selector){return selector==='[data-page-id]'?this:null},getBoundingClientRect(){return{left:10,top,width:190,height:80}},setPointerCapture(pointerId){this.capturedPointer=pointerId},hasPointerCapture(pointerId){return this.capturedPointer===pointerId},releasePointerCapture(pointerId){if(this.capturedPointer===pointerId)this.capturedPointer=null},removeAttribute(name){delete this.dataset[name]},cloneNode(){return{dataset:{},style:{},classList:{add(){}},removeAttribute(){},setAttribute(){},remove(){this.removed=true}}}});
const pageRows=[pageCard('p1',0),pageCard('p2',80),pageCard(pasted.id,160)];node('workspace-pages').querySelectorAll=selector=>selector==='[data-page-id]'?pageRows:[];
const pageEvent=(y,target=pageRows[0],extra={})=>({button:0,pointerId:7,clientX:40,clientY:y,target,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...extra});
events.get('workspace-pages:pointerdown:false')(pageEvent(20));assert.equal(pageRows[0].capturedPointer,7,'Pointer capture stays on the actual page card so a normal click keeps its page id');events.get('workspace-pages:pointerup:false')(pageEvent(20));
const normalClick=pageEvent(20);events.get('workspace-pages:click:true')(normalClick);assert.ok(!normalClick.prevented&&!normalClick.stopped,'A click without dragging must reach the page-opening handler');
events.get('workspace-pages:pointerdown:false')(pageEvent(20));hoveredPage=pageCard('p2',80);events.get('workspace-pages:pointermove:false')(pageEvent(30));
assert.equal(pageRows[1].style.transform,'','A small page drag follows the pointer without prematurely jumping to another slot');
events.get('workspace-pages:pointermove:false')(pageEvent(70));
assert.equal(bodyChildren.length,1);assert.equal(pageRows[0].dataset.dragSource,'true','The dragged page fades while a translucent copy follows the pointer');
assert.equal(pageRows[1].style.transform,'translateY(-90px)','Pages glide aside to preview the stable insertion position');
const stablePageWrites=pageRows[1].style.writes;events.get('workspace-pages:pointermove:false')(pageEvent(72));assert.equal(pageRows[1].style.writes,stablePageWrites,'Holding the same page slot cannot restart its transition every pointer frame');
events.get('workspace-pages:pointerup:false')(pageEvent(70));
assert.deepEqual(ctx.project.pages.map(page=>page.id),['p2','p1',pasted.id],'Dragging the page card itself reorders pages');
assert.equal(bodyChildren.length,1);assert.equal(bodyChildren[0].removed,true,'Page drag uses a floating preview that fades after drop');
assert.equal(pageRows[1].style.transform,'');assert.equal(pageRows[0].dataset.dragSource,undefined,'Page rows clear their animated drag state');
assert.ok(source.includes('pageDropAt')&&!source.includes('document.elementFromPoint(event.clientX,event.clientY)'),'Animated page cards cannot change their own drop target');
assert.ok(source.includes('card.setPointerCapture?.(event.pointerId)')&&!source.includes('pages.setPointerCapture(event.pointerId)'),'The page list itself must not capture clicks away from page cards');
const swallowed=pageEvent(130);events.get('workspace-pages:click:true')(swallowed);assert.ok(swallowed.prevented&&swallowed.stopped,'The click following a drag cannot accidentally open a page');
ctx.items=[];ctx.activePage().items=[];ctx.history=[];
console.log('Page actions OK: fresh copy, dimensions, independent identities, links/fill/junctions, ordering, rename, delete confirmation and project isolation.');

const image={type:'image/png',name:'網站圖片.png',size:100},data={items:[{kind:'file',getAsFile:()=>image}],types:['Files']};
const paste=(clipboardData=data,target={tagName:'svg'})=>{const event={target,clipboardData,preventDefault(){this.prevented=true}};ctx.handleCanvasPaste(event);return event};
const settle=()=>vm.runInContext('imagePasteQueue',ctx);
assert.ok(paste().prevented);await settle();assert.equal(ctx.items.length,1);const im=ctx.items[0];
assert.equal(im.type,'image');assert.equal(im.referenceOnly,false);assert.equal(im.locked,false);assert.equal(im.opacity,1);assert.equal(im.w/im.h,2);assert.equal(im.w,240);assert.equal(ctx.history.length,1);assert.equal(ctx.selected,im.id);
const before=plain(ctx.items);assert.ok(!paste(data,{tagName:'INPUT'}).prevented);await settle();assert.deepEqual(plain(ctx.items),before);
ctx.noteInternalCopy();paste();assert.equal(internalPastes,1,'A same-focus internal object is not converted to Office preview PNG');
events.get('window:blur:false')();paste();await settle();assert.equal(ctx.items.length,2,'After copying externally, real image wins over stale internal objects');
delayDecode=true;paste();await Promise.resolve();await Promise.resolve();ctx.activePageId=pasted.id;pendingImages.splice(0).forEach(im=>im.onload());await settle();assert.equal(ctx.items.length,2,'Slow decode cannot insert into a different page');
delayDecode=false;ctx.traceDraft={};paste();await settle();assert.equal(ctx.items.length,2);ctx.traceDraft=null;
paste({items:[],types:['text/plain'],getData:()=>'<img src="https://invalid.example/image.png">'});assert.equal(internalPastes,1,'External text/URLs never paste stale objects or execute HTML');
const dragOver=events.get('window:dragover:false'),drop=events.get('window:drop:false');
const svgFile={type:'image/svg+xml',name:'圖示.svg',size:100};
let dropped={clientX:180,clientY:240,dataTransfer:{files:[svgFile],dropEffect:'none'},preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
dragOver(dropped);assert.ok(dropped.prevented);assert.equal(dropped.dataTransfer.dropEffect,'copy');drop(dropped);await settle();assert.ok(dropped.stopped);assert.equal(ctx.items.at(-1).name,'圖示.svg');assert.equal(ctx.items.at(-1).referenceOnly,false);
const projectFile={type:'application/json',name:'作品.skc',size:200,content:JSON.stringify({project:{name:'拖入專案',items:[]}})};
dropped={dataTransfer:{files:[projectFile]},preventDefault(){this.prevented=true},stopPropagation(){}};drop(dropped);await settle();assert.ok(dropped.prevented);assert.equal(ctx.project.name,'拖入專案');
const key=events.get('window:keydown:true'),press=()=>({key:'v',ctrlKey:true,target:{tagName:'svg'},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}});
let e=press();key(e);assert.ok(e.stopped&&!e.prevented,'External Ctrl+V must allow the browser paste event');
ctx.noteInternalCopy();e=press();key(e);assert.ok(e.prevented);assert.equal(internalPastes,2,'Internal shortcut pastes exactly once');
const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');assert.ok(html.includes('initializeWorkspaceActions();')&&html.includes('noteInternalCopy();'));
console.log('Image/file import OK: clipboard images, SVG/JPG/PNG drops, Skechu JSON projects, placement, Undo and draft safety.');
const worker=fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8');
assert.ok(html.includes('workspace-page-ghost')&&html.includes('workspace-actions.js?v=36-page-click'));assert.ok(worker.includes('workspace-actions.js?v=36-page-click'));

// First-run reference and image import defaults use production constructors.
let starterSequence=0;
const starterContext=vm.createContext({
  id:()=>`item-${++starterSequence}`,uid:prefix=>`${prefix}-${++starterSequence}`,deepCopy:plain,
  canvasAppearance:()=>({color:'#ffffff',opacity:1}),
  FileReader:class {readAsDataURL(){this.result='data:image/png;base64,test';this.onload()}},
  Image:class {naturalWidth=2048;naturalHeight=1024;set src(value){this.onload()}},
  document:{getElementById:()=>({})},requestAnimationFrame:fn=>fn(),fitView(){},setTracePen(){},syncActivePage(){},openPage(){},alert:message=>assert.fail(message)
});
for(const name of ['makePage','makeProject','makeStarterProject','importReferenceImage'])vm.runInContext(html.match(new RegExp(`^function ${name}\\([^\\n]+`,'m'))[0],starterContext);
vm.runInContext(html.match(/const STARTER_ITEMS=\[[\s\S]*?\n\];/)[0],starterContext);
const starter=vm.runInContext('makeStarterProject()',starterContext),page=starter.pages[0],reference=page.items[0];
assert.equal(page.items.length,1,'Starter contains only the supplied brain reference');
assert.equal(reference.type,'image');assert.equal(reference.referenceOnly,true);assert.equal(reference.locked,false);
const png=fs.readFileSync(new URL('../app/'+reference.src,import.meta.url));
assert.equal(page.canvasWidth,png.readUInt32BE(16));assert.equal(page.canvasHeight,png.readUInt32BE(20));
assert.equal(reference.w,page.canvasWidth);assert.equal(reference.h,page.canvasHeight);assert.equal(reference.opacity,.5);
assert.ok(worker.includes('./'+reference.src),'Starter must be available offline');
assert.ok(fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/'+reference.src+';.'),'Starter must be packaged for Windows');
starterContext.activeProject=()=>starter;
reference.locked=true;
starterContext.importReferenceImage({name:'new-reference.png'});
const imported=starter.pages.at(-1);
assert.equal(imported.items[0].locked,false,'New tracing references are unlocked');
assert.equal(imported.items[0].opacity,.5,'New tracing references start at 50% opacity');
assert.equal(imported.canvasWidth,1600);assert.equal(imported.canvasHeight,800);
assert.equal(reference.locked,true,'Import does not unlock an existing reference');
assert.equal(starterContext.makeProject().pages[0].items.length,0,'Explicit new projects still start blank');
console.log('Starter/import defaults OK: full-size brain, unlocked new references, existing locks preserved, offline/Windows asset.');
starterContext.stageWrap={clientWidth:1400,clientHeight:750};starterContext.stageShell={style:{}};
starterContext.canvasSize=()=>({width:1536,height:1024});
starterContext.resetCanvasPan=starterContext.renderSelection=starterContext.syncCheckerGrid=()=>{};
vm.runInContext(html.match(/^function fitView\([^\n]+/m)[0],starterContext);
starterContext.fitView();
assert.ok(parseFloat(starterContext.stageShell.style.width)*1024/1536<=714,'The whole brain canvas fits vertically');
starterContext.stageWrap.clientWidth=320;starterContext.fitView();
assert.ok(parseFloat(starterContext.stageShell.style.width)<=284,'Fit also respects narrow mobile viewports');
