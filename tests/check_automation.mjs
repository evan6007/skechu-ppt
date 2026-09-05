import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const definitions=JSON.parse(read('app/automation/commands.json'));
const context=vm.createContext({AbortController});vm.runInContext(read('app/automation/core.js'),context);
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture() {
  const doc={projectId:'p',pageId:'one',name:'Test',canvas:{width:1000,height:600,color:'#ffffff'},selection:[],items:[
    {id:'a',type:'ellipse',x:10,y:20,w:30,h:40,fill:'#ffffff'},
    {id:'ref',type:'image',referenceOnly:true,x:0,y:0,w:100,h:100,src:'PRIVATE_PIXELS',opacity:.5},
    {id:'locked',type:'ellipse',locked:true,x:30,y:40,w:30,h:40}]};
  let edits=0,serial=0,busy=false,confirmation=()=>true,resolveTrace;
  const undo=[],redo=[];
  const host={read:()=>doc,bounds:it=>({x:it.x,y:it.y,w:it.w,h:it.h}),uid:()=>`created-${++serial}`,
    busy:()=>busy,select:ids=>{doc.selection=ids},
    apply(items,ids){undo.push(plain(doc.items));redo.length=0;doc.items=items;doc.selection=ids;edits++;},
    history(action){const source=action==='undo'?undo:redo,target=action==='undo'?redo:undo;if(source.length){target.push(doc.items);doc.items=source.pop();}},
    exportSvg:()=>'<svg/>',confirmDelete:n=>confirmation(n),
    trace:()=>new Promise(resolve=>{resolveTrace=resolve})};
  const api=context.SkechuAutomationCore.create(host,definitions);
  return {api,doc,host,undo,get edits(){return edits},set busy(v){busy=v},set confirmation(v){confirmation=v},
    finishTrace:()=>resolveTrace({items:[{id:'traced',type:'arrow',points:[{x:0,y:0},{x:1,y:1}]}],stats:{paths:1}}),
    async ctx(){return (await api.execute('read_document')).context}};
}
const rejects=(promise,code)=>assert.rejects(promise,error=>error.code===code);
let f=fixture();
await rejects(f.api.execute('read_document'),'NOT_AUTHORIZED');f.api.grant();
let doc=await f.api.execute('read_document');
assert.equal(doc.total,3);assert.ok(!JSON.stringify(doc).includes('PRIVATE_PIXELS'));
await rejects(f.api.execute('create_shapes',{context:doc.context,shapes:[{kind:'rectangle',x:NaN,y:0,width:10,height:10}]}),'INVALID_ARGUMENT');
await rejects(f.api.execute('update_objects',{context:doc.context,ids:['a'],style:{fill:'url(javascript:bad)'}}),'INVALID_ARGUMENT');
await rejects(f.api.execute('update_objects',{context:doc.context,ids:['a'],style:JSON.parse('{"__proto__":{}}')}),'INVALID_ARGUMENT');
await rejects(f.api.execute('update_objects',{context:doc.context,ids:['a','locked'],style:{fill:'#ff0000'}}),'LOCKED');
assert.equal(f.edits,0);assert.equal(f.doc.items[0].fill,'#ffffff');
await rejects(f.api.execute('update_objects',{context:doc.context,ids:['missing'],style:{fill:'#ff0000'}}),'NOT_FOUND');
const copyBefore=JSON.stringify(f.doc.items);
await f.api.execute('select_objects',{context:doc.context,ids:['a']});assert.equal(JSON.stringify(f.doc.items),copyBefore);
await f.api.execute('update_objects',{context:doc.context,ids:['a'],style:{fill:'#ff0000',opacity:.7}});
assert.equal(f.edits,1);assert.equal(f.undo.length,1);assert.equal(f.doc.items[0].fill,'#ff0000');
await rejects(f.api.execute('update_objects',{context:doc.context,ids:['a'],style:{fill:'#00ff00'}}),'STALE_DOCUMENT');
await f.api.execute('history',{context:await f.ctx(),action:'undo'});assert.equal(f.doc.items[0].fill,'#ffffff');
await f.api.execute('history',{context:await f.ctx(),action:'redo'});assert.equal(f.doc.items[0].fill,'#ff0000');
const updated=await f.ctx();f.doc.items[0].x=55;
await rejects(f.api.execute('move_objects',{context:updated,ids:['a'],dx:10,dy:10}),'STALE_DOCUMENT');
await f.api.execute('move_objects',{context:await f.ctx(),ids:['a'],dx:10,dy:10});assert.equal(f.doc.items[0].x,65);
await f.api.execute('create_shapes',{context:await f.ctx(),shapes:[{kind:'rectangle',x:1,y:2,width:30,height:40},{kind:'ellipse',x:10,y:10,width:20,height:20}]});
assert.equal(f.doc.items.length,5);assert.equal(f.doc.items[3].points.length,4);assert.equal(f.doc.items[4].type,'ellipse');
const pageResult=await f.api.execute('read_document',{offset:1,limit:2});assert.equal(pageResult.objects.length,2);assert.equal(pageResult.nextOffset,3);
f.doc.items.push({id:'label',type:'text',x:10,y:10,color:'#333333'});
await f.api.execute('update_objects',{context:await f.ctx(),ids:['label'],style:{fill:'#abcdef'}});assert.equal(f.doc.items.at(-1).color,'#abcdef');
await rejects(f.api.execute('update_objects',{context:await f.ctx(),ids:['label'],style:{strokeWidth:2}}),'UNSUPPORTED');
f.busy=true;await rejects(f.api.execute('read_document'),'BUSY');f.busy=false;
f.doc.pageId='two';await rejects(f.api.execute('read_document'),'PAGE_CHANGED');assert.equal(f.api.status().enabled,false);
await rejects(f.api.execute('read_document'),'NOT_AUTHORIZED');

// Deletion rechecks consent AND revision after the async confirmation.
f=fixture();f.api.grant();f.confirmation=()=>false;
assert.equal((await f.api.execute('delete_objects',{context:await f.ctx(),ids:['a']})).cancelled,true);assert.equal(f.edits,0);
f.confirmation=()=>{f.doc.items[0].x++;return true};
await rejects(f.api.execute('delete_objects',{context:await f.ctx(),ids:['a']}),'STALE_DOCUMENT');assert.equal(f.edits,0);
f.confirmation=()=>{f.api.revoke();f.api.grant();return true};
await rejects(f.api.execute('delete_objects',{context:await f.ctx(),ids:['a']}),'NOT_AUTHORIZED');
f.confirmation=()=>true;await f.api.execute('delete_objects',{context:await f.ctx(),ids:['a']});assert.equal(f.doc.items.length,2);

// Connected curves cannot be partially detached, nor computed fills translated.
f=fixture();f.doc.items=[{id:'a',type:'arrow',points:[{x:1,y:1},{x:2,y:2}],pointJunctions:{0:'j'}},{id:'b',type:'arrow',points:[{x:1,y:1},{x:4,y:4}],pointJunctions:{0:'j'}}];f.api.grant();
await rejects(f.api.execute('move_objects',{context:await f.ctx(),ids:['a'],dx:1,dy:1}),'LINKED_OBJECTS');
await f.api.execute('move_objects',{context:await f.ctx(),ids:['a','b'],dx:1,dy:1});assert.equal(f.doc.items[1].points[0].x,2);
f.doc.items[0].explicitBezier=true;
await rejects(f.api.execute('move_objects',{context:await f.ctx(),ids:['a','b'],dx:1,dy:1}),'UNSUPPORTED');

// A trace is staged, cancellable, and cannot apply to a changed document.
f=fixture();f.api.grant();let args={context:await f.ctx(),imageId:'ref'};
let task=await f.api.execute('trace_image',args);assert.equal(task.status,'running');assert.equal(f.edits,0);
await rejects(f.api.execute('trace_image',args),'BUSY');
await f.api.execute('cancel_task',{taskId:task.taskId});f.finishTrace();await new Promise(r=>setTimeout(r,0));assert.equal(f.api.status().task,null);
task=await f.api.execute('trace_image',args);f.finishTrace();await new Promise(r=>setTimeout(r,0));
assert.equal((await f.api.execute('get_task',{taskId:task.taskId})).status,'ready');
f.doc.items[0].x++;
await rejects(f.api.execute('apply_trace',{context:await f.ctx(),taskId:task.taskId}),'STALE_DOCUMENT');
await f.api.execute('cancel_task',{taskId:task.taskId});
task=await f.api.execute('trace_image',{context:await f.ctx(),imageId:'ref'});f.finishTrace();await new Promise(r=>setTimeout(r,0));
await f.api.execute('apply_trace',{context:await f.ctx(),taskId:task.taskId});assert.equal(f.edits,1);assert.equal(f.doc.items.at(-1).id,'traced');
assert.equal(f.api.status().task,null);

for(const path of ['core.js','editor.js','panel.css','commands.json']){
  assert.ok(read('app/service-worker.js').includes('automation/'+path),'Offline assets include automation');
  assert.ok(read('.github/workflows/windows-release.yml').includes('app/automation;automation'));
}
const traceUi=read('app/auto-trace-ui.js'),workerCalls=[];
const workerContext=vm.createContext({URL:{},location:{protocol:'https:'},Worker:function(url){workerCalls.push(url)}});
vm.runInContext(traceUi.slice(0,traceUi.indexOf("document.getElementById('import-reference')")),workerContext);
workerContext.createAutoTraceJob();assert.deepEqual(workerCalls,['auto-trace-worker.js?v=70-automation']);
assert.ok(read('app/service-worker.js').includes("'./auto-trace.js'"),'Fallback worker engine must be available offline');
console.log('Automation: opt-in scope, strict schemas, atomic batches, undo/redo, locks, stale edits, graph safety, source redaction, staged tracing/cancel and desktop assets OK.');
