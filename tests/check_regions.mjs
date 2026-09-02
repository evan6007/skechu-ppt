import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
const ctx=vm.createContext({Math,Number,Object,Set,JSON,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
vm.runInContext(fs.readFileSync(new URL('../app/region-fill.js',import.meta.url),'utf8')+'\nthis.R=RegionFill;',ctx);
const R=ctx.R,plain=x=>JSON.parse(JSON.stringify(x));
function load(name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);
  const next=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,next),ctx);
}
for(const name of ['normalizeAngle','pointIsSharp','pointSmoothnessValue','automaticTangentDelta','pointTangentAngle','pointTangentDelta','splitHandleAngles','splitHandleDelta','limitedControl','curveSegmentControls','arrowDefaultSmoothness','arrowUsesCurves','hasAuthoredCurveControls','fillBoundaryPath','fillBoundarySamples','pointInPolygon','unrotatePoint','arrowCanClose','itemContainsFillPoint','regionGeometryKey','fillNetworkFaces','fillTargetAt','materializeFillTarget'])load(name);
const path=(id,pts,closed=false)=>({id,width:2,closed,segments:pts.slice(0,-1).map((p,i)=>R.line(p,pts[i+1])).concat(closed?[R.line(pts.at(-1),pts[0])]:[])});
const outer=path('outer',[{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}],true);
const divider=path('divider',[{x:100,y:0},{x:100,y:100}]);
const faces=R.build([outer,divider]);
assert.equal(faces.length,2,'Two T junctions split a closed outline');
assert.equal(R.find(faces,{x:30,y:50}).area,10000);
assert.notEqual(R.find(faces,{x:30,y:50}).key,R.find(faces,{x:170,y:50}).key);
assert.equal(R.find(faces,{x:250,y:50}),null,'Outside is never a fill target');
const cross=path('cross',[{x:0,y:50},{x:200,y:50}]);
assert.equal(R.build([outer,divider,cross]).length,4,'Crossing paths produce four local faces');
assert.equal(R.build([divider,cross]).length,0,'An open cross is not a closed region');
const dangling=path('dangling',[{x:100,y:0},{x:100,y:40}]);
const unsplit=R.build([outer,dangling]);
assert.equal(unsplit.length,1);assert.deepEqual(plain(unsplit[0].owners),['outer'],'Dangling branch is pruned');
const sides=outer.segments.map((s,i)=>({id:'side'+i,width:2,closed:false,segments:[s]}));
assert.equal(R.build([...sides,divider]).length,2,'Multiple open paths can jointly enclose regions');
assert.equal(R.build(sides.slice(0,-1)).length,0,'A missing side must not be auto-closed');
const smallGap=path('gap',[{x:100,y:.7},{x:100,y:99.3}]);
assert.equal(R.build([outer,smallGap]).length,2,'A subpixel attachment error is tolerated');
const largeGap=path('gap',[{x:100,y:7},{x:100,y:93}]);
assert.equal(R.build([outer,largeGap]).length,1,'An actual gap does not create a region');
const reversed=path('reverse',[{x:0,y:100},{x:200,y:100},{x:200,y:0},{x:0,y:0}],true);
assert.equal(R.build([reversed,divider]).length,2,'Clockwise and counterclockwise source paths work');

const circle={id:'circle',closed:true,width:3,segments:R.arc(200,200,150,150,0,Math.PI*2)};
const curve={id:'curve',closed:false,width:3,segments:[{p0:{x:200,y:50},c1:{x:45,y:110},c2:{x:355,y:290},p3:{x:200,y:350}}]};
const curvedFaces=R.build([circle,curve]);
assert.equal(curvedFaces.length,2,'A curved divider meets a curved outline at two T junctions');
const fill=R.toItem(curvedFaces[0],'region-test','#7c3aed');
assert.equal(fill.width,0);assert.equal(fill.closed,true);assert.equal(fill.endHead,false);
assert.ok(fill.points.length>=3);
const actual=ctx.fillBoundaryPath(fill).segments;
assert.equal(actual.length,curvedFaces[0].segments.length);
actual.forEach((s,i)=>{for(const k of ['p0','c1','c2','p3'])assert.ok(Math.hypot(s[k].x-curvedFaces[0].segments[i][k].x,s[k].y-curvedFaces[0].segments[i][k].y)<1e-8,'Original cubic pieces survive fill creation')});
const native=spawnSync(process.env.PYTHON||'python',['-c','import sys,json;sys.path.insert(0,"app");import bridge;print(json.dumps(bridge.freeform_node_points(json.load(sys.stdin))))'],{cwd:new URL('..',import.meta.url),input:JSON.stringify(fill),encoding:'utf8'});
assert.equal(native.status,0,native.stderr);
const nodes=JSON.parse(native.stdout),expected=[actual[0].p0,...actual.flatMap(s=>[s.c1,s.c2,s.p3])];
assert.equal(nodes.length,expected.length);nodes.forEach((p,i)=>assert.ok(Math.hypot(p.x-expected[i].x,p.y-expected[i].y)<1e-8,'SVG/PPT curve parity'));
const lens=R.build([{id:'upper',width:2,closed:false,segments:[{p0:{x:0,y:0},c1:{x:20,y:-60},c2:{x:80,y:-60},p3:{x:100,y:0}}]},{id:'lower',width:2,closed:false,segments:[{p0:{x:0,y:0},c1:{x:20,y:60},c2:{x:80,y:60},p3:{x:100,y:0}}]}]);
assert.equal(lens.length,1);assert.ok(R.toItem(lens[0],'lens','#ff0000').points.length>=3,'Two-curve lens stays closed in the editor');

// Integration: fill detection prefers a network face even when the hit DOM is
// the enclosing filled object; source objects remain untouched and reusable.
ctx.items=[{id:'box',type:'box',x:0,y:0,w:200,h:100,fill:'#fff',strokeWidth:2},{id:'cut',type:'arrow',points:[{x:100,y:0},{x:100,y:100}],curved:false,closed:false,width:2}];
ctx.byId=id=>ctx.items.find(it=>it.id===id);ctx.id=()=>`fill-${ctx.items.length}`;ctx.activePaletteColor='#ff0000';ctx.regionFaceCache={signature:null,faces:[]};ctx.pendingRegionFace=null;
const before=JSON.stringify(ctx.items),target=ctx.fillTargetAt({x:30,y:50},{closest:()=>({dataset:{id:'box'}})});
assert.ok(target.regionFace,'Must not recolor the whole enclosing box');
const created=ctx.materializeFillTarget(target);
assert.equal(JSON.stringify(ctx.items.slice(0,2)),before,'Original paths were not merged, closed or changed');
assert.equal(created.type,'arrow');assert.equal(created.fillOpacity,1);
assert.equal(ctx.fillTargetAt({x:30,y:50},null).id,created.id,'Repeated drop recolors the same region');
assert.ok(ctx.fillTargetAt({x:170,y:50},null).regionFace,'Other side remains separately fillable');
ctx.items=plain(ctx.items);assert.equal(ctx.fillTargetAt({x:30,y:50},null).id,created.id,'Save/reload preserves the region');
ctx.items=ctx.items.slice(0,2);assert.ok(ctx.fillTargetAt({x:30,y:50},null).regionFace,'Undoing fill leaves the network usable');
assert.equal(ctx.fillBoundaryPath({type:'image',referenceOnly:true}),null,'Reference images do not create boundaries');
assert.equal(ctx.fillBoundaryPath({type:'arrow',referenceOnly:true,points:[{x:0,y:0},{x:1,y:1}]}),null);
load('regionStrokeItems');load('nativeBody');load('exportableItems');
ctx.items.push(created);ctx.items[0].stroke='#123f8c';ctx.items[1].color='#123f8c';
const strokeCopies=ctx.regionStrokeItems(ctx.items);
assert.equal(strokeCopies.length,2,'Source outlines are redrawn above adjacent fills');
assert.ok(strokeCopies.every(it=>it.explicitBezier&&!it.closed&&!it.regionFill));
const nativeScene=JSON.parse(ctx.nativeBody(ctx.items));
assert.equal(nativeScene.items.length,5,'Native layering uses the same source-outline pass');
assert.equal(JSON.parse(ctx.nativeBody([created])).items.length,1,'Copying a color layer alone does not pull in unrelated lines');

if(process.env.SKECHU_TEST_POWERPOINT==='1'){
  const curveItem={id:'curve',name:'Curved divider',type:'arrow',points:[curve.segments[0].p0,curve.segments[0].c1,curve.segments[0].c2,curve.segments[0].p3],curved:false,explicitBezier:true,width:3,color:'#123f8c',endHead:false};
  const circleItem={id:'circle',name:'Round boundary',type:'ellipse',x:50,y:50,w:300,h:300,stroke:'#123f8c',strokeWidth:3,fill:'#ffffff'};
  const colorItem=plain(fill),scene=[{id:'origin',type:'box',x:0,y:0,w:1,h:1,strokeWidth:0},circleItem,curveItem,colorItem];
  const payload=JSON.parse(ctx.nativeBody(scene));
  const code=`import sys,json,pathlib
sys.path.insert(0,"app")
import bridge
p=json.load(sys.stdin)
try:
    bridge.copy_native(p,copy_clipboard=False)
    s=bridge.STATE;g=s["cached_group"]
    for item in p["items"]:
        if item["type"]=="arrow":
            bridge.verify_freeform_nodes(g.GroupItems.Item(s["item_shapes"][item["id"]][0]),bridge.freeform_node_points(item),0,0,.75)
    out=pathlib.Path(".codex-tmp/native-region-qa").resolve();out.mkdir(parents=True,exist_ok=True)
    s["presentation"].Slides(1).Export(str(out/"region-fill.png"),"PNG",1200,675)
    print("Native region scene verified and rendered")
finally:
    pres=bridge.STATE.get("presentation")
    if pres is not None:
        pres.Saved=True;pres.Close()
`;
  const result=spawnSync(process.env.PYTHON||'python',['-X','utf8','-c',code],{cwd:new URL('..',import.meta.url),input:JSON.stringify(payload),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
}
console.log(`Network fill OK: T junctions, crossings, open gaps, reversed paths, curved faces, independent edits, recolor/save/undo and ${nodes.length} native coordinates.`);
