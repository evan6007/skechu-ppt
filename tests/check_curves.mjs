import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
assert.equal(html.split('</html>')[1].trim(),'','No code or styles outside HTML');
const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
const fixture=JSON.parse(fs.readFileSync(new URL('./curve_fixture.json',import.meta.url),'utf8'));
const names=['normalizeAngle','pointIsSharp','pointSmoothnessValue','automaticTangentDelta','pointTangentAngle','pointTangentDelta','splitHandleAngles','splitHandleDelta','limitedControl','curveSegmentControls','smoothPath','smoothClosedPath','arrowDefaultSmoothness','anchorHandleLengths','setLinkedTangent','hasAuthoredCurveControls','reversePointHandleAngles','overlayUnit','tangentHandleLayout','tangentGuideMarkup','shiftIndexedPointValues','shiftPointKinds','scaleSelectionOverlay','closestSelectionHandle'];
const context=vm.createContext({Math,Number,Object,selectedPoint:5,zoom:1,svg:{getScreenCTM:()=>({a:1,b:0})},clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
for(const name of names){const line=source.split('\n').find(line=>line.startsWith('function '+name+'('));assert.ok(line,name);vm.runInContext(line,context)}
const controls=(item)=>context.smoothClosedPath(item.points,item.pointKinds,item.pointSmoothness,item.pointAngles,item.pointHandleAngles,item.smoothnessDefault,item.centerlineLocked);
const jsNodes=[...controls(fixture).matchAll(/[MC]([^MCZ]+)/g)].flatMap(match=>{const numbers=match[1].trim().split(/[ ,]+/).map(Number);return Array.from({length:numbers.length/2},(_,i)=>({x:numbers[i*2],y:numbers[i*2+1]}))});
// Compare actual SVG path coordinates with the native bridge's control points.
const python=process.env.PYTHON||'python';
const result=spawnSync(python,['-c','import sys,json; sys.path.insert(0,"app"); import bridge; print(json.dumps(bridge.freeform_node_points(json.load(sys.stdin))))'],{cwd:new URL('..',import.meta.url),input:JSON.stringify(fixture),encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const nativeNodes=JSON.parse(result.stdout);
assert.equal(jsNodes.length,nativeNodes.length);
jsNodes.forEach((p,i)=>assert.ok(Math.hypot(p.x-nativeNodes[i].x,p.y-nativeNodes[i].y)<1e-8));
assert.ok(context.hasAuthoredCurveControls(fixture));
const linked=structuredClone(fixture);delete linked.pointHandleAngles[5];
context.setLinkedTangent(linked,5,-35,240,180);
assert.equal(linked.pointHandleAngles[5].linked,true);
assert.equal(context.anchorHandleLengths(linked,5).out,240);
assert.equal(context.tangentHandleLayout(linked,5).split,false);
assert.equal(JSON.parse(JSON.stringify(linked)).pointHandleAngles[5].outLength,240);
const reversed=context.reversePointHandleAngles(linked.pointHandleAngles,linked.points.length)[1];
assert.equal(reversed.inLength,240);assert.equal(reversed.outLength,180);assert.equal(reversed.linked,true);
context.shiftPointKinds(linked,2,1);assert.equal(linked.pointHandleAngles[6].outLength,240);
assert.equal(context.splitHandleAngles({0:{in:0,out:0,inLength:null}},0).inLength,null);
// Every helper, including invisible hit targets, stays constant in screen pixels.
for(const scale of [.4,1,2,5]){
  context.svg.getScreenCTM=()=>({a:scale,b:0});
  const circles=[7,8,9,18,18,15].map(r=>({r,getAttribute(){return this.r},setAttribute(_,v){this.r=v}}));
  context.selection={querySelectorAll:selector=>selector==='circle'?circles:[]};
  context.scaleSelectionOverlay();
  circles.forEach((c,i)=>assert.ok(Math.abs(c.r*scale-[7,8,9,18,18,15][i])<1e-9));
  const layout=context.tangentHandleLayout(fixture,5),p=fixture.points[5];
  for(const h of [layout.incoming,layout.outgoing])assert.ok(Math.hypot(h.x-p.x,h.y-p.y)*scale>=44);
  assert.ok(Math.hypot(layout.incoming.x-layout.outgoing.x,layout.incoming.y-layout.outgoing.y)*scale>=42);
  // Two coincident inward controls must still be individually clickable.
  const cusp=structuredClone(fixture);cusp.pointHandleAngles[5]={in:-90,out:-90,inLength:4,outLength:4};
  const separated=context.tangentHandleLayout(cusp,5);
  assert.ok(Math.hypot(separated.incoming.x-separated.outgoing.x,separated.incoming.y-separated.outgoing.y)*scale>=42);
}
const nearHit={getBoundingClientRect:()=>({x:0,y:0,width:36,height:36})};
const overlappingHit={getBoundingClientRect:()=>({x:12,y:0,width:36,height:36})};
context.selection={querySelectorAll:()=>[nearHit,overlappingHit]};
assert.equal(context.closestSelectionHandle({clientX:18,clientY:18},overlappingHit),nearHit,'overlapping hit regions choose nearest center');
assert.equal(context.closestSelectionHandle({clientX:30,clientY:18},nearHit),overlappingHit);
assert.equal(context.closestSelectionHandle({clientX:18,clientY:18},null),null,'empty canvas remains available for marquee');
console.log(`Curve parity OK: ${jsNodes.length} SVG/native coordinates; linked/split handles and 4 zoom scales passed.`);

vm.runInContext(fs.readFileSync(new URL('../app/local-smoothing.js',import.meta.url),'utf8')+'\nthis.fairing=LocalSmoothing;',context);
const makePlan=(item,selected)=>{
  const duplicate=item.closed&&Math.hypot(item.points[0].x-item.points.at(-1).x,item.points[0].y-item.points.at(-1).y)<.01;
  const pts=duplicate?item.points.slice(0,-1):item.points;
  return context.fairing.buildPlan(item,selected,i=>context.curveSegmentControls(pts,i,item.pointKinds,item.pointSmoothness,item.pointAngles,item.pointHandleAngles,item.smoothnessDefault||100,!!item.closed,!!item.centerlineLocked));
};
const plain=value=>JSON.parse(JSON.stringify(value));
const wave={type:'arrow',curved:true,points:Array.from({length:7},(_,i)=>({x:80+i*75,y:180+.006*(i*75-225)**2})),pointHandleAngles:{}};
for(let i=1;i<6;i++){const a=context.pointTangentAngle(wave.points,i)+(i%2?12:-12);wave.pointHandleAngles[i]={in:a+180,out:a,inLength:i%2?10:50,outLength:i%2?50:10,linked:true};}
const wavePlan=makePlan(wave,[1,2,3,4,5]), softened=context.fairing.apply(wavePlan,100);
assert.equal(wavePlan.targets.size,5);
assert.deepEqual(plain(softened.points),wave.points,'smoothing must not move anchors');
assert.deepEqual(plain(context.fairing.apply(wavePlan,0)),wave,'0 must restore even absent fields');
assert.deepEqual(plain(context.fairing.apply(wavePlan,30)),plain(context.fairing.apply(wavePlan,30)),'values are absolute, not cumulative');
const segment=(it,i)=>context.curveSegmentControls(it.points,i,it.pointKinds,it.pointSmoothness,it.pointAngles,it.pointHandleAngles,100,!!it.closed);
const curvature=(s,end)=>{const p=end?s.p2:s.p1,c=end?s.c2:s.c1,other=end?s.c1:s.c2,sign=end?1:-1,dx=3*(p.x-c.x)*sign,dy=3*(p.y-c.y)*sign,ddx=6*(p.x-2*c.x+other.x),ddy=6*(p.y-2*c.y+other.y);return(dx*ddy-dy*ddx)/Math.pow(Math.hypot(dx,dy),3);};
const roughness=it=>[1,2,3,4,5].reduce((sum,i)=>sum+Math.abs(curvature(segment(it,i-1),true)-curvature(segment(it,i),false)),0);
assert.ok(roughness(softened)<roughness(wave)*.05,`curvature jumps: ${roughness(wave)} -> ${roughness(softened)}`);
const local=context.fairing.apply(makePlan(wave,[2,3]),70);
assert.deepEqual(plain(local.pointHandleAngles[1]),wave.pointHandleAngles[1]);
assert.deepEqual(plain(local.pointHandleAngles[4]),wave.pointHandleAngles[4]);
const cuspPlan=makePlan(fixture,[0,1,2,3,4,5,6]);
assert.ok(cuspPlan.protectedIndices.includes(5),'inward cusp must be protected');
const cuspResult=context.fairing.apply(cuspPlan,100);
assert.deepEqual(plain(cuspResult.pointHandleAngles[5]),fixture.pointHandleAngles[5]);
const boosted=context.fairing.apply(wavePlan,300);
assert.notDeepEqual(plain(boosted.pointHandleAngles),plain(softened.pointHandleAngles),'300 must extend the effect beyond 100');
assert.deepEqual(plain(boosted.points),wave.points);
assert.deepEqual(plain(context.fairing.apply(wavePlan,900)),plain(boosted),'upper bound is 300');
assert.deepEqual(plain(context.fairing.apply(wavePlan,100)),plain(softened),'returning to 100 keeps the original standard result');
for(const [key,value] of Object.entries(boosted.pointHandleAngles)) {
  const standard=softened.pointHandleAngles[key];
  assert.ok(value.linked);
  assert.ok(Math.abs(value.in-standard.in)<1e-9&&Math.abs(value.out-standard.out)<1e-9,'boost must not flip tangent directions');
  assert.ok(value.inLength>=standard.inLength&&value.outLength>=standard.outLength);
  assert.ok(value.inLength<=600&&value.outLength<=600);
  const i=Number(key),prev=wave.points[i-1],next=wave.points[i+1],p=wave.points[i];
  assert.ok(value.inLength<=Math.hypot(prev.x-p.x,prev.y-p.y)*.75+1e-9);
  assert.ok(value.outLength<=Math.hypot(next.x-p.x,next.y-p.y)*.75+1e-9);
}
assert.deepEqual(plain(context.fairing.apply(cuspPlan,300).pointHandleAngles[5]),fixture.pointHandleAngles[5],'boost preserves inward cusps');
const sharp=structuredClone(wave);sharp.pointKinds={3:'sharp'};
assert.ok(makePlan(sharp,[2,3,4]).protectedIndices.includes(3));
assert.equal(makePlan(wave,[0,6]).targets.size,0,'open endpoints stay fixed');
const duplicate=structuredClone(fixture);duplicate.points.push({...duplicate.points[0]});
assert.equal(makePlan(duplicate,[0,duplicate.points.length-1]).selectedCount,1);
const allClosed=makePlan(duplicate,[0,1,2,3,4,5,6,7]);
assert.ok([...allClosed.targets.values()].every(v=>Number.isFinite(v.outgoing.x)));
// New fairing output uses the existing native representation, including short handles.
const exported=[softened,local,cuspResult,boosted];
const parity=spawnSync(python,['-c','import sys,json; sys.path.insert(0,"app"); import bridge; print(json.dumps([bridge.freeform_node_points(x) for x in json.load(sys.stdin)]))'],{cwd:new URL('..',import.meta.url),input:JSON.stringify(exported),encoding:'utf8'});
assert.equal(parity.status,0,parity.stderr);
JSON.parse(parity.stdout).forEach((nodes,k)=>{
  const it=exported[k],spline=it.closed?context.smoothClosedPath:context.smoothPath;
  const path=spline(it.points,it.pointKinds,it.pointSmoothness,it.pointAngles,it.pointHandleAngles,it.smoothnessDefault||100,!!it.centerlineLocked);
  const coords=[...path.matchAll(/[MC]([^MCZ]+)/g)].flatMap(m=>m[1].trim().split(/[ ,]+/).map(Number));
  assert.equal(coords.length,nodes.length*2);
  nodes.forEach((p,i)=>assert.ok(Math.hypot(p.x-coords[i*2],p.y-coords[i*2+1])<1e-8));
});
console.log(`Local smoothing OK: curvature jumps ${roughness(wave).toFixed(4)} -> ${roughness(softened).toFixed(8)}; cusp, fixed anchors, local scope, reset, closure and native parity passed.`);
