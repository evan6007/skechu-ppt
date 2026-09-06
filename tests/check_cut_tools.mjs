import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),plain=v=>JSON.parse(JSON.stringify(v));
const source=[...read('app/index.html').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
const ctx=vm.createContext({console,Math,Number,Set,Map,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
for(const file of ['region-fill.js','path-cut.js','paint-layers.js','cut-tools.js'])vm.runInContext(read('app/'+file),ctx);
function load(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);const next=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,next),ctx);}
for(const name of ['normalizeAngle','pointIsSharp','pointSmoothnessValue','automaticTangentDelta','pointTangentAngle','pointTangentDelta','splitHandleAngles','splitHandleDelta','limitedControl','curveSegmentControls','arrowDefaultSmoothness','arrowUsesCurves','hasAuthoredCurveControls','fillBoundaryPath','regionGeometryKey','cubicPoint','arrowPathSamples','nearestPointOnArrow'])load(name);
const {R,C}=vm.runInContext('({R:RegionFill,C:PathCut})',ctx);
load('arrowSegmentControls');
const cubic={p0:{x:0,y:0},c1:{x:35,y:120},c2:{x:65,y:-120},p3:{x:100,y:0}};
const boundary=C.prepare({segments:[cubic],closed:false});
const knife=[{x:40,y:-150},{x:40,y:150}],hits=C.intersections(boundary,knife);
assert.equal(hits.length,1);assert.ok(Math.abs(hits[0].point.x-40)<1e-6);
const p=C.pieces(boundary,hits.map(h=>h.at));assert.equal(p.length,2);
for(const part of p)for(let i=0;i<=100;i++){
 const a=R.point(part.segments[0],i/100),b=R.point(cubic,part.a+(part.b-part.a)*i/100);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-9,'Cubic remains exact after splitting');
}
const base={id:'line',name:'Curve',type:'arrow',color:'#aabbcc',width:3,startHead:true,endHead:true,layerGroup:'group',pointJunctions:{0:'start',1:'end'},points:[cubic.p0,cubic.p3]};
const result=p.map((piece,i)=>C.toItem(base,boundary,piece,'piece-'+i));
assert.equal(result[0].startHead,true);assert.equal(result[0].endHead,false);assert.equal(result[1].startHead,false);assert.equal(result[1].endHead,true);
assert.equal(result[0].layerGroup,'group');assert.equal(result[1].width,3);
assert.equal(result[0].pointJunctions[0],'start');assert.equal(result[0].pointJunctions[1],undefined);assert.equal(result[1].pointJunctions[0],undefined);assert.equal(result[1].pointJunctions[1],'end');
result.forEach((it,j)=>{
 const actual=ctx.fillBoundaryPath(it).segments;
 for(let i=0;i<actual.length;i++)for(const key of ['p0','c1','c2','p3'])assert.ok(Math.hypot(actual[i][key].x-p[j].segments[i][key].x,actual[i][key].y-p[j].segments[i][key].y)<1e-9,'Editor renders the original cubic pieces');
});
const open=C.prepare({segments:[R.line({x:0,y:0},{x:50,y:0}),R.line({x:50,y:0},{x:100,y:0})],closed:false});
assert.equal(C.pieces(open,[1,1,1+1e-9]).length,2,'Shared anchor cuts are deduplicated');
assert.equal(C.pieces(open,[0,2]).length,0,'No zero-length pieces at existing ends');
assert.equal(C.intersections(open,[{x:50,y:-20},{x:50,y:20}]).length,1);
assert.equal(C.pieces(open,[.25,.5,.75,1,1.5]).length,6,'Several cuts on one path');
assert.equal(C.intersections(open,[{x:10,y:-10},{x:30,y:10},{x:50,y:-10},{x:70,y:10}]).length,3,'Freehand knife finds every crossing');
assert.equal(C.intersections(open,[{x:120,y:-10},{x:120,y:10}]).length,0);
const square=C.prepare({closed:true,segments:[R.line({x:0,y:0},{x:100,y:0}),R.line({x:100,y:0},{x:100,y:100}),R.line({x:100,y:100},{x:0,y:100}),R.line({x:0,y:100},{x:0,y:0})]});
let cut=C.pieces(square,[.5]);assert.equal(cut.length,1);assert.equal(cut[0].segments.length,5);
assert.deepEqual(plain(cut[0].segments[0].p0),plain(cut[0].segments.at(-1).p3),'Closed outline opens with two coincident independent ends');
assert.equal(C.pieces(square,[0,4]).length,1);assert.equal(C.pieces(square,[.5,2.5]).length,2);
const long=C.prepare({segments:[R.line({x:0,y:0},{x:10000,y:0})],closed:false});
assert.ok(C.pieces(long,[.5]).every(p=>p.segments.length>1),'Long handles are safely subdivided');

// Free points use the same exact intersections, without breaking connectivity.
const baseBefore=JSON.stringify(base),inserted=C.insertAnchors(base,boundary,[hits[0].at]);
assert.equal(inserted.item.id,base.id);assert.equal(inserted.item.points.length,3);assert.deepEqual(plain(inserted.addedIndices),[1]);
assert.equal(inserted.item.pointJunctions[0],'start');assert.equal(inserted.item.pointJunctions[2],'end');assert.equal(inserted.item.pointJunctions[1],undefined);
assert.equal(inserted.item.startHead,true);assert.equal(inserted.item.endHead,true);assert.equal(JSON.stringify(base),baseBefore);
const addedSegments=ctx.fillBoundaryPath(inserted.item).segments;
addedSegments.forEach((s,i)=>{for(const key of ['p0','c1','c2','p3'])assert.ok(Math.hypot(s[key].x-p[i].segments[0][key].x,s[key].y-p[i].segments[0][key].y)<1e-9,'Adding anchors preserves original cubic geometry');});
assert.equal(C.insertAnchors(inserted.item,ctx.fillBoundaryPath(inserted.item),[0,1,2]),null,'Existing nodes and open endpoints are not duplicated');
const roundSource=R.toItem({segments:R.arc(100,100,70,70,0,Math.PI*2),key:'circle',owners:[]},'round','#ff8800');
delete roundSource.regionFill;roundSource.width=2;roundSource.fillOpacity=.7;roundSource.networkId='keep-network';roundSource.pointJunctions={0:'start-j',2:'inside-j'};
const roundBoundary=C.prepare(ctx.fillBoundaryPath(roundSource)),roundAdded=C.insertAnchors(roundSource,roundBoundary,[.5,3.25]);
assert.equal(roundAdded.item.closed,true);assert.equal(roundAdded.item.id,roundSource.id);assert.equal(roundAdded.item.fill,'#ff8800');assert.equal(roundAdded.item.fillOpacity,.7);assert.equal(roundAdded.item.networkId,'keep-network');
assert.equal(roundAdded.item.points.length,roundSource.points.length+2);assert.equal(roundAdded.item.pointJunctions[0],'start-j');assert.equal(roundAdded.item.pointJunctions[3],'inside-j');
const roundCurves=ctx.fillBoundaryPath(roundAdded.item).segments,expectedCurves=roundBoundary.segments.flatMap((s,i)=>i===0?R.split(s,.5):i===3?R.split(s,.25):[s]);
roundCurves.forEach((s,i)=>{for(const key of ['p0','c1','c2','p3'])assert.ok(Math.hypot(s[key].x-expectedCurves[i][key].x,s[key].y-expectedCurves[i][key].y)<1e-8,'Closed seam and incoming/outgoing handles remain exact');});

// Real editor mutations: one history entry per gesture, untouched originals,
// locked/hidden/reference exclusions and shared-end detachment.
let serial=0,renders=0,status='';
Object.assign(ctx,{deepCopy:plain,id:()=>`new-${++serial}`,items:[],history:[],future:['redo'],selected:null,selectedIds:new Set(),selectedPoints:new Set(),autoJunctionPositions:new Map(),paintTool:'cut',activateSelectTool(){ctx.paintTool=null},render(){renders++},paintStatus(message){status=message}});
ctx.byId=id=>ctx.items.find(it=>it.id===id);ctx.commit=()=>{ctx.history.push(JSON.stringify(ctx.items));ctx.future=[];};
const line=(id,y,extra={})=>({id,type:'arrow',points:[{x:0,y},{x:100,y}],curved:false,closed:false,width:2,color:'#123f8c',endHead:false,...extra});
ctx.items=[line('a',0),line('b',20),line('locked',40,{locked:true}),line('hidden',60,{hidden:true}),line('fill',80,{regionFill:{key:'fill'}}),{id:'photo',type:'image',referenceOnly:true}];
assert.deepEqual(plain(ctx.cutCandidates().map(e=>e.it.id)),['a','b']);
const before=JSON.stringify(ctx.items),plans=ctx.cutCandidates().map(e=>({...e,locations:[.5]}));
ctx.applyCuts(plans);assert.equal(ctx.history.length,1);assert.equal(ctx.items.length,8);assert.equal(ctx.history[0],before);
assert.equal(ctx.byId('locked').points.length,2);assert.equal(renders,1);assert.equal(ctx.selectedIds.size,4);
assert.equal(ctx.paintTool,null);assert.equal(ctx.editPoints,true,'A completed cut immediately exposes editable anchors');
const start={x:20,y:30};
for(const [end,expected] of [[{x:120,y:50},{x:120,y:30}],[{x:-80,y:10},{x:-80,y:30}],[{x:40,y:130},{x:20,y:130}],[{x:0,y:-70},{x:20,y:-70}]]){
 assert.deepEqual(plain(ctx.constrainedCutEnd(start,end,true)),expected,'Ctrl locks to the nearest horizontal or vertical axis');
 assert.deepEqual(plain(ctx.constrainedCutEnd(start,end,false)),end,'Releasing Ctrl preserves the unconstrained pointer');
}
const gesture={points:[start]};ctx.updateStraightCut(gesture,{x:120,y:50},true);assert.deepEqual(plain(gesture.points[1]),{x:120,y:30});
ctx.updateStraightCut(gesture,gesture.rawPoint,false);assert.deepEqual(plain(gesture.points[1]),{x:120,y:50},'Modifier changes do not require pointer movement');
ctx.items=JSON.parse(ctx.history.pop());assert.equal(JSON.stringify(ctx.items),before,'One undo restores the entire cut');
ctx.items=plain(ctx.items);assert.equal(ctx.byId('a').points.length,2,'Save/reload uses ordinary editor geometry');
const joint=line('joint',0,{pointJunctions:{0:'j',1:'other'},attachments:{start:{owner:'other',slot:'path',pathT:0}}});
ctx.items=[joint];ctx.selected='joint';assert.equal(ctx.nearestCutTarget({x:2,y:1},ctx.cutCandidates(),10).hit.at,0,'A near-junction tap snaps to the existing endpoint instead of producing a tiny fragment');
ctx.items=[joint];ctx.applyCuts([{it:joint,boundary:ctx.fillBoundaryPath(joint),locations:[0]}]);
assert.equal(ctx.items.length,1);assert.equal(ctx.items[0].pointJunctions[0],undefined);assert.equal(ctx.items[0].pointJunctions[1],'other');assert.equal(ctx.items[0].attachments.start,undefined);
assert.equal(joint.pointJunctions[0],'j','Original object is not mutated before commit');
const colored={id:'square',type:'box',x:0,y:0,w:100,h:100,strokeWidth:2,stroke:'#000',fill:'#ff8800',opacity:.7};
ctx.items=[colored];ctx.applyCuts([{it:colored,boundary:ctx.fillBoundaryPath(colored),locations:[.5,2.5]}]);
assert.equal(ctx.items.length,3);const color=ctx.items.find(it=>it.regionFill);assert.equal(color.fill,'#ff8800');assert.equal(color.fillOpacity,.7,'Existing color is retained as an independent editable fill');
const parent=line('parent',0),child={...line('child',40),points:[{x:80,y:0},{x:80,y:40}],attachments:{start:{owner:'parent',slot:'path',pathT:.8}}};
ctx.items=[parent,child];ctx.applyCuts([{it:parent,boundary:ctx.fillBoundaryPath(parent),locations:[.5]}]);
assert.notEqual(child.attachments.start.owner,'parent','Attached branch follows the second piece');
assert.ok(Math.abs(child.attachments.start.pathT-.6)<1e-7);
assert.equal(ctx.applyCuts([]),false);assert.match(status,/沒有切到/);
ctx.items=[line('joined',0,{pointJunctions:{0:'a',1:'b'}}),line('another',20),line('locked',40,{locked:true})];ctx.history=[];
const beforePoints=JSON.stringify(ctx.items),freePointPlans=ctx.cutCandidates().map(entry=>({...entry,locations:[.3,.7]}));
ctx.applyFreePoints(freePointPlans);
assert.equal(ctx.items.length,3,'Free points never multiply source objects');assert.equal(ctx.items[0].id,'joined');assert.equal(ctx.items[0].points.length,4);assert.equal(ctx.items[0].pointJunctions[3],'b');
assert.equal(ctx.items[2].points.length,2);assert.equal(ctx.history.length,1);assert.equal(ctx.history[0],beforePoints);assert.equal(ctx.paintTool,null);assert.equal(ctx.editPoints,true);
assert.equal(ctx.items[0].closed,false);assert.equal(ctx.applyFreePoints([]),false);assert.match(status,/沒有新增/);
ctx.items=JSON.parse(ctx.history.pop());assert.equal(JSON.stringify(ctx.items),beforePoints,'Free points undo as one gesture');
for(const asset of ['path-cut.js','cut-tools.js','cut-tools.css']){
 assert.ok(read('app/index.html').includes(asset));assert.ok(read('app/service-worker.js').includes(asset));assert.ok(read('.github/workflows/windows-release.yml').includes(asset));
}
console.log('Scissors OK: exact cuts and connected anchor insertion, closed seams, multiple intersections, T links, styles/fills, attachment remapping, locks, save and undo.');
