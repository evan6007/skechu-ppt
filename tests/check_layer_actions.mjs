import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync('app/index.html','utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,open:false,textContent:'',querySelectorAll:()=>[]});return nodes.get(id);};
let serial=0,status='';
const ctx=vm.createContext({document:{getElementById:node,querySelectorAll:()=>[]},items:[],selected:null,selectedIds:new Set(),selectedPoints:new Set(),history:[],future:[],
  activeProject:()=>({id:'project'}),activePageId:'page',traceDraft:null,tracePenOn:false,paintTool:null,drag:null,internalClipboard:[],
  deepCopy:plain,id:()=>`clone-${++serial}`,uid:prefix=>`${prefix}-${++serial}`,noteInternalCopy(){},
  render(){},refreshSelectionUI(){},activateSelectTool(){},paintStatus:message=>{status=message},prompt:()=>null});
ctx.byId=id=>ctx.items.find(it=>it.id===id);ctx.commit=()=>{ctx.history.push(JSON.stringify(ctx.items));ctx.future=[];};
for(const file of ['app/paint-layers.js','app/layer-controls.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
for(const fn of ['copyInternalSelection','pasteInternalSelection','deleteSelectedObjects'])vm.runInContext(html.split('\n').find(line=>line.startsWith(`function ${fn}(`)),ctx);
const seed=[{id:'ref',type:'image',name:'底圖',referenceOnly:true,x:0,y:0,w:100,h:100},
  {id:'a',type:'arrow',name:'A',points:[{x:1,y:1},{x:20,y:10}],pointJunctions:{0:'shared'},layerGroup:{id:'g',name:'群組',collapsed:true}},
  {id:'b',type:'arrow',name:'B',points:[{x:1,y:1},{x:10,y:20}],pointJunctions:{0:'shared'},attachments:{start:{owner:'a',slot:'start'}},layerGroup:{id:'g',name:'群組',collapsed:true}},
  {id:'outside',type:'box',name:'Other',x:30,y:30,w:50,h:40}];
function reset(){ctx.items=plain(seed);ctx.selected='outside';ctx.selectedIds=new Set(['outside']);ctx.selectedPoints=new Set([0]);ctx.history=[];ctx.future=['redo'];ctx.internalClipboard=[];ctx.activePageId='page';ctx.traceDraft=ctx.drag=null;status='';}
const target=key=>({projectId:'project',pageId:ctx.activePageId,key,ids:[...ctx.layerMembers(key)].map(it=>it.id)});
reset();const before=JSON.stringify(ctx.items);ctx.runLayerAction('copy',target('group:g'));
assert.equal(JSON.stringify(ctx.items),before);assert.equal(ctx.history.length,0,'Copy does not paste or consume Undo');
assert.deepEqual(plain(ctx.internalClipboard).map(it=>it.id),['a','b'],'Menu targets the requested group, not prior selection');
ctx.items[1].points[0].x=9;assert.equal(ctx.internalClipboard[0].points[0].x,1,'Clipboard is an independent snapshot');
ctx.items[1].points[0].x=1;ctx.runLayerAction('paste',target('item:outside'));
assert.equal(ctx.history.length,1);assert.equal(ctx.items.length,6);
const clones=ctx.items.slice(-2);assert.notEqual(clones[0].id,'a');assert.equal(clones[1].attachments.start.owner,clones[0].id);
assert.notEqual(clones[0].pointJunctions[0],'shared');assert.equal(clones[0].pointJunctions[0],clones[1].pointJunctions[0]);
assert.notEqual(clones[0].layerGroup.id,'g');assert.equal(clones[0].layerGroup.id,clones[1].layerGroup.id);
ctx.items=JSON.parse(ctx.history.pop());assert.equal(JSON.stringify(ctx.items),before,'One Undo removes the whole pasted group');
reset();ctx.runLayerAction('duplicate',target('group:g'));assert.equal(ctx.items.length,6);assert.equal(ctx.history.length,1);
reset();ctx.runLayerAction('delete',target('group:g'));
assert.deepEqual(plain(ctx.items).map(it=>it.id),['ref','outside'],'Whole group removed without deleting unrelated selection');
assert.equal(ctx.selectedIds.size,0);assert.match(status,/Ctrl\+Z/);ctx.items=JSON.parse(ctx.history.pop());assert.deepEqual(plain(ctx.items),seed,'Group delete is exactly reversible');
reset();ctx.items[2].locked=true;ctx.runLayerAction('delete',target('group:g'));assert.equal(ctx.items.length,4);assert.equal(ctx.history.length,0,'Mixed lock group never gets partially deleted');
ctx.runLayerAction('lock',target('group:g'));assert.ok(ctx.items[1].locked&&ctx.items[2].locked);
ctx.runLayerAction('lock',target('group:g'));assert.ok(!ctx.items[1].locked&&!ctx.items[2].locked);
ctx.runLayerAction('delete',target('group:g'));assert.equal(ctx.items.length,2);
reset();ctx.runLayerAction('copy',target('item:ref'));assert.equal(ctx.items.length,4);assert.equal(ctx.internalClipboard[0].referenceOnly,true,'Reference copy stays internal and does not request PPT');
reset();let old=target('group:g');ctx.activePageId='other-page';ctx.runLayerAction('delete',old);assert.equal(ctx.items.length,4,'Stale menu cannot mutate another page');
reset();old=target('group:g');ctx.items[1].layerGroup=null;ctx.runLayerAction('delete',old);assert.equal(ctx.items.length,4,'Changed membership invalidates a stale menu');
for(const mode of ['traceDraft','drag']){reset();ctx[mode]={};ctx.runLayerAction('delete',target('group:g'));assert.equal(ctx.items.length,4);assert.equal(ctx.history.length,0);}
reset();ctx.prompt=()=>'<b>新群組</b>';ctx.runLayerAction('rename',target('group:g'));
assert.ok(ctx.items.slice(1,3).every(it=>it.layerGroup.name==='<b>新群組</b>'));assert.equal(ctx.history.length,1);
ctx.runLayerAction('ungroup',target('group:g'));assert.ok(ctx.items.slice(1,3).every(it=>it.layerGroup===null));assert.equal(ctx.items.length,4,'Ungroup preserves objects');
console.log('Layer actions: explicit target, copy-only, independent group paste, atomic locked deletion, exact Undo, stale/draft guards, rename and ungroup passed.');
