import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app/workspace-actions.js',import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x)),events=new Map(),nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{hidden:true,style:{},innerHTML:'',textContent:'',addEventListener(type,fn,capture){events.set(id+':'+type+':'+!!capture,fn)},querySelector(){return null},getBoundingClientRect(){return{width:220,height:400}},contains(){return false}});return nodes.get(id)}
let sequence=0,internalPastes=0,autosaves=0,confirmAnswer=true,promptAnswer='新名稱',delayDecode=false;
const pendingImages=[];
const seed=[{id:'stroke',type:'arrow',points:[{x:5,y:6},{x:9,y:10}],pointJunctions:{1:'j1'},layerGroup:{id:'folder'},networkId:'net'},
 {id:'branch',type:'arrow',points:[{x:9,y:10},{x:30,y:20}],pointJunctions:{0:'j1'},attachments:{start:{owner:'stroke'}},layerGroup:{id:'folder'}},
 {id:'fill',type:'arrow',regionFill:{sources:['stroke','branch']},layerGroup:{id:'folder'}}];
const ctx=vm.createContext({console,Map,Set,Promise,Math,Array,Number,JSON,Date,
  items:plain(seed),selected:'stroke',selectedIds:new Set(['stroke']),selectedPoint:0,selectedPoints:new Set([0]),selectedSegment:0,editPoints:true,
  activeProjectId:'project',activePageId:'p1',traceDraft:null,drag:null,history:[],internalClipboard:[{id:'old'}],
  project:{id:'project',pages:[{id:'p1',name:'第一頁',canvasWidth:300,canvasHeight:500,items:plain(seed)},{id:'p2',name:'第二頁',canvasWidth:900,canvasHeight:500,items:[]}]},
  document:{body:{insertAdjacentHTML(){}},getElementById:node,addEventListener(type,fn){events.set('document:'+type,fn)}},
  window:{innerWidth:1200,innerHeight:800,addEventListener(type,fn,capture){events.set('window:'+type+':'+!!capture,fn)}},
  deepCopy:plain,id:()=>`item-${++sequence}`,uid:prefix=>`${prefix}-${++sequence}`,esc:String,
  cloneLayerGroups:clones=>{const keys=new Map();for(const it of clones)if(it.layerGroup){const old=it.layerGroup.id;if(!keys.has(old))keys.set(old,`group-${++sequence}`);it.layerGroup.id=keys.get(old)}},
  makePage:(name,items,size)=>({id:`page-${++sequence}`,name,items:plain(items),canvasWidth:size.width,canvasHeight:size.height}),
  prompt:()=>promptAnswer,confirm:()=>confirmAnswer,renderProjectNav(){},renderWorkspacePages(){},queueAutosave(){autosaves++},
  activateSelectTool(){},render(){},pasteInternalSelection(){internalPastes++},
  FileReader:class{readAsDataURL(file){this.result='data:'+file.type+';base64,test';this.onload()}},
  Image:class{naturalWidth=800;naturalHeight=400;set src(value){if(delayDecode)pendingImages.push(this);else this.onload()}},
});
ctx.activeProject=()=>ctx.project;ctx.activePage=()=>ctx.project.pages.find(p=>p.id===ctx.activePageId);ctx.canvasSize=()=>({width:300,height:500});
ctx.syncActivePage=()=>{const p=ctx.activePage();if(p)p.items=plain(ctx.items)};
ctx.openPage=id=>{ctx.syncActivePage();ctx.activePageId=id;ctx.items=plain(ctx.activePage().items);autosaves++};
ctx.commit=()=>ctx.history.push(plain(ctx.items));
vm.runInContext(source,ctx);ctx.initializeWorkspaceActions();
const target=id=>({projectId:'project',pageId:id});
ctx.items[0].points[0].x=99;ctx.runPageAction('copy',target('p1'));
ctx.runPageAction('paste',target('p2'));const pasted=ctx.activePage();
assert.equal(pasted.canvasWidth,300);assert.equal(pasted.canvasHeight,500);assert.equal(pasted.items[0].points[0].x,99,'Page clipboard uses current unsaved edits');
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
const key=events.get('window:keydown:true'),press=()=>({key:'v',ctrlKey:true,target:{tagName:'svg'},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}});
let e=press();key(e);assert.ok(e.stopped&&!e.prevented,'External Ctrl+V must allow the browser paste event');
ctx.noteInternalCopy();e=press();key(e);assert.ok(e.prevented);assert.equal(internalPastes,2,'Internal shortcut pastes exactly once');
const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');assert.ok(html.includes('initializeWorkspaceActions();')&&html.includes('noteInternalCopy();'));
console.log('Image paste OK: native files, aspect ratio, new layer/Undo, text fields, internal copy preference, external copy priority, async page guard and draft safety.');
