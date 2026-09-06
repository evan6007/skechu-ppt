import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const scope=vm.createContext({});
for(const file of ['app/trace-boundary.js','app/region-fill.js'])vm.runInContext(fs.readFileSync(file,'utf8'),scope);
const {B,R}=vm.runInContext('({B:TraceBoundary,R:RegionFill})',scope);
const line=(points,closed=false)=>({type:'arrow',points,closed,width:2,curved:false,pointJunctions:{},pointHandleAngles:{}});
const convert=items=>items.map((it,i)=>({id:String(i),closed:it.closed,width:it.width,segments:it.points.slice(0,it.closed?undefined:-1).map((p,j)=>R.line(p,it.points[(j+1)%it.points.length]))}));
const source={items:[line([{x:2,y:40},{x:60,y:60},{x:118,y:40}])],stats:{paths:1,anchors:3},issues:[]};
const before=JSON.stringify(source),result=B.close(source,120,100),faces=R.build(convert(result.items));
assert.equal(JSON.stringify(source),before,'Closure never mutates the original curves');
assert.equal(result.stats.borderJoins,2);
assert.equal(result.items.filter(it=>it.traceBoundary==='rim').length,1);
assert.equal(result.items.at(-1).width,0,'The crop boundary is not a new black frame');
assert.equal(faces.length,2,'Clipped line divides the image into two real fillable faces');
assert.notEqual(R.find(faces,{x:60,y:20}).key,R.find(faces,{x:60,y:90}).key);
assert.equal(R.find(faces,{x:130,y:90}),null,'No closure outside the source image');
const fill=R.toItem(R.find(faces,{x:60,y:90}),'lower','#182c49');
assert.equal(fill.closed,true);assert.equal(fill.type,'arrow');
assert.ok(fill.points.some(p=>p.y===100),'The color reaches the bottom edge, not a diagonal shortcut');
assert.strictEqual(B.close(result,120,100),result,'Repeated closure does not duplicate the frame');
assert.strictEqual(B.close(source,120,100,{maxGap:0}),source);
assert.equal(B.close({items:[],stats:{}},120,100).items.length,0);
assert.equal(B.close({items:[line([{x:30,y:30},{x:70,y:50}])]},120,100).items.length,1,'Interior gaps are not stretched to the page edge');
assert.equal(B.close({items:[line([{x:2,y:20},{x:2,y:80},{x:30,y:50}],true)]},120,100).items.length,1,'Already closed regions are unchanged');
for(let rotation=0;rotation<4;rotation++){
  const rotate=p=>{let q={...p};for(let i=0;i<rotation;i++)q={x:100-q.y,y:q.x};return q};
  const clipped={items:[line([{x:2,y:40},{x:50,y:60},{x:98,y:40}].map(rotate))],stats:{}};
  assert.equal(R.build(convert(B.close(clipped,100,100).items)).length,2,'All four image edges close');
}
// Internal T cuts remain separate instead of all being filled as one rectangle.
const tee={items:[line([{x:2,y:50},{x:50,y:50}]),line([{x:50,y:50},{x:98,y:50}]),line([{x:50,y:50},{x:50,y:98}])],stats:{}};
assert.equal(R.build(convert(B.close(tee,100,100).items)).length,3);
// Synthetic three-pixel curl crossing a divider less than .15 px from a
// shared endpoint. Coarse intersection sampling merged both 5,000 px faces.
const tinyMain={p0:{x:53,y:49},c1:{x:52.82,y:49.12},c2:{x:50.28,y:49.90},p3:{x:50,y:50}};
const tinyLoop=[{p0:{x:53,y:49},c1:{x:52.38,y:49.21},c2:{x:53.66,y:51},p3:{x:52,y:51}},
 {p0:{x:52,y:51},c1:{x:51.25,y:51},c2:{x:50.70,y:49.76},p3:{x:50,y:50}}];
const square={id:'square',closed:true,segments:[R.line({x:0,y:0},{x:100,y:0}),R.line({x:100,y:0},{x:100,y:100}),R.line({x:100,y:100},{x:0,y:100}),R.line({x:0,y:100},{x:0,y:0})]};
const curled=[square,{id:'left',segments:[R.line({x:0,y:70},{x:50,y:50})]},
 {id:'right',segments:[R.line({x:53,y:49},{x:100,y:40})]},{id:'main',segments:[tinyMain]},{id:'curl',segments:tinyLoop}];
for(const paths of[curled,[...curled].reverse()]){
 const faces=R.build(paths);assert.equal(faces.length,3,'Tiny curl preserves the two large regions and its real small loop');
 assert.notEqual(R.find(faces,{x:20,y:20}).key,R.find(faces,{x:20,y:90}).key,'A subpixel crossing cannot leak across the long divider');
}
assert.throws(()=>B.close(source,NaN,100),/boundary/);
assert.throws(()=>B.close(source,100,100,{maxGap:Infinity}),/boundary/);
for(const file of ['app/index.html','app/service-worker.js','.github/workflows/windows-release.yml'])assert.ok(fs.readFileSync(file,'utf8').includes('trace-boundary.js'),'Include the boundary engine in '+file);
console.log('Image boundary OK: exact native rim, clipped regions, all edges, T separation, no diagonal shortcuts, opt-out, immutable source, idempotence and package assets.');
