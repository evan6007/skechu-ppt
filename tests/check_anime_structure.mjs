import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const scope=vm.createContext({});
for(const file of ['app/auto-trace.js','app/region-fill.js','experiments/anime-trace/structure-layers.js'])vm.runInContext(fs.readFileSync(file,'utf8'),scope);
const {engine,geometry,layers}=vm.runInContext('({engine:AutoTrace,geometry:RegionFill,layers:AnimeStructureLayers})',scope);
const reference={width:120,height:120,data:new Uint8Array(120*120*4).fill(255)};
function color(predicate,rgb){for(let y=0;y<120;y++)for(let x=0;x<120;x++)if(predicate(x,y))reference.data.set([...rgb,255],(y*120+x)*4)}
color(x=>x<60,[236,198,153]);color(x=>x>=60,[173,121,89]);
const box=engine.toItem({closed:true},[
  geometry.line({x:10,y:10},{x:110,y:10}),geometry.line({x:110,y:10},{x:110,y:110}),
  geometry.line({x:110,y:110},{x:10,y:110}),geometry.line({x:10,y:110},{x:10,y:10})
],'#222222',1.7,new Set());
const divider=engine.toItem({closed:false},[geometry.line({x:60,y:10},{x:60,y:110})],'#222222',1.7,new Set());
const input={items:[box,divider],stats:{paths:2}};
const saved=JSON.stringify(input),pixels=Array.from(reference.data);
const candidate=layers.run(input,reference,engine,geometry);
assert.equal(JSON.stringify(input),saved,'Original geometry and metadata are not mutated');
assert.deepEqual(Array.from(reference.data),pixels,'Source pixels remain untouched');
assert.equal(candidate.items.find(it=>it.structureSource.item===1).width,0,'Uninked midtone divider supplies fill topology without an added black line');
assert.ok(candidate.items.filter(it=>it.structureSource.item===0).every(it=>it.width===1.7),'Unsupported outer strokes remain visible');
function faces(result){return geometry.build(result.items.map((it,id)=>({id:String(id),closed:it.closed,width:it.width,segments:layers.curves(it)})))}
const f=faces(candidate);
assert.equal(f.length,2,'A zero-stroke divider still closes two fill faces');
assert.notEqual(geometry.find(f,{x:35,y:50}).key,geometry.find(f,{x:85,y:50}).key);
const fills=[geometry.toItem(geometry.find(f,{x:35,y:50}),'left','#ff8800'),geometry.toItem(geometry.find(f,{x:85,y:50}),'right','#35aadd')];
assert.ok(fills.every(it=>it.closed&&it.width===0&&it.fillOpacity===1),'Each fill is an independent native closed object');
const oldRight=JSON.stringify(fills[1]);fills[0].fill='#00ff00';assert.equal(JSON.stringify(fills[1]),oldRight);
const visible=layers.run(input,reference,engine,geometry,{hideColorSteps:false});
assert.ok(visible.items.every(it=>it.width===1.7),'Experimental source classification is reversible');
color(x=>Math.abs(x-60)<=1,[30,25,20]);
const ink=layers.run(input,reference,engine,geometry);
assert.equal(ink.items.find(it=>it.structureSource.item===1).width,1.7,'Real ink on a color boundary must remain visible');
color(()=>true,[32,40,51]);color(x=>Math.abs(x-60)<=1,[233,243,255]);
assert.equal(layers.run(input,reference,engine,geometry).items.find(it=>it.structureSource.item===1).width,1.7,'A light source stroke is not a color-step closure');
// A genuine dark earring is a single closed loop, never collapsed to a crease.
color(()=>true,[230,189,141]);color((x,y)=>((x-60)/14)**2+((y-60)/23)**2<1,[22,30,42]);
const ring=engine.toItem({closed:true},geometry.arc(60,60,14,23,0,Math.PI*2),'#222222',1.7,new Set());
const rings=layers.run({items:[ring],stats:{}},reference,engine,geometry);
assert.equal(rings.items.length,1);assert.equal(rings.items[0].closed,true);assert.equal(rings.items[0].width,1.7);
assert.ok(geometry.find(faces(rings),{x:60,y:60}),'Earring interior remains independently fillable');
// Paper rim is not artist ink; its adjacent silhouettes are protected.
color(x=>x<60,[236,198,153]);color(x=>x>=60,[173,121,89]);
const rim={...box,traceBoundary:'rim',width:0};
const exterior=layers.run({items:[rim,divider],stats:{}},reference,engine,geometry);
assert.equal(exterior.items.find(it=>it.structureSource.item===0).width,0);
assert.equal(exterior.items.find(it=>it.structureSource.item===1).width,1.7,'Rim-adjacent silhouette is not hidden by a midtone step');
reference.data.fill(0);
assert.equal(layers.run(input,reference,engine,geometry).structure.hiddenColorSpans,0,'Transparent RGB cannot provide color evidence');
assert.throws(()=>layers.run(input,{...reference,data:new Uint8Array(4)},engine,geometry),/RGBA/);
assert.throws(()=>layers.run(input,{...reference,width:1e7},engine,geometry),/RGBA/);
// Optional private real-image outputs test topology and exact controls too.
for(const file of process.argv.slice(2)){
  const after=JSON.parse(fs.readFileSync(file,'utf8')),before=JSON.parse(fs.readFileSync(file.replace('-after.json','-before.json'),'utf8'));
  const key=s=>JSON.stringify(['p0','c1','c2','p3'].flatMap(k=>[+s[k].x.toFixed(7),+s[k].y.toFixed(7)]));
  assert.deepEqual(after.items.flatMap(layers.curves).map(key).sort(),before.items.flatMap(layers.curves).map(key).sort(),'Every original cubic is retained exactly once in the fill graph');
  const a=faces(after).map(f=>+f.area.toFixed(4)).sort((a,b)=>a-b),b=faces(before).map(f=>+f.area.toFixed(4)).sort((a,b)=>a-b);
  assert.equal(a.length,b.length,'Separating line visibility does not remove fill faces');
  for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<.01,'Fill area must be conserved');
  console.log(JSON.stringify({file,faces:a.length,visible:after.structure.visible,closures:after.structure.closures}));
}
console.log('Anime structural layers: source evidence, independent fills, protected ink/earrings, opt-out and geometry preservation passed.');
