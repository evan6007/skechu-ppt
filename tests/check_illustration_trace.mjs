import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const context=vm.createContext({WebAssembly,TextDecoder,TextEncoder}),wasm=fs.readFileSync(new URL('../app/vendor/vtracer.wasm',import.meta.url));
for(const file of ['vendor/vtracer.js','illustration-trace.js','auto-trace.js','region-fill.js'])vm.runInContext(fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),context);
context.bytes=wasm;vm.runInContext('VTracerWasm.init(bytes);this.engine=AutoTrace;this.adapter=IllustrationTrace;this.region=RegionFill',context);
const {engine,adapter,region}=context;
const holeSVG='<svg><path fill="#cc5533" d="M0 0L100 0L100 100L0 100Z M30 30L30 70L70 70L70 30Z"/></svg>';
const hole=adapter.fromSVG(holeSVG,engine);assert.equal(hole.items.length,2);assert.equal(hole.colorItems.length,1);
function curves(it){return it.points.map((p,i)=>{const j=(i+1)%it.points.length,q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j];return{p0:p,c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},p3:q}})}
const samples=curves(hole.colorItems[0]).flatMap(c=>region.flatten(c).slice(0,-1));assert.ok(region.contains({x:10,y:10},samples));assert.ok(!region.contains({x:50,y:50},samples),'A hole stays empty; the fill cannot spill into its neighbour');
for(const item of [...hole.items,...hole.colorItems]){assert.equal(item.closed,true);assert.equal(item.explicitBezier,false);assert.ok(!('src' in item));assert.ok(item.points.length>=3);for(const handle of Object.values(item.pointHandleAngles))assert.ok(Object.values(handle).every(Number.isFinite))}
assert.equal(hole.colorItems[0].width,0,'Zero-area hole connectors are never stroked');
assert.equal(JSON.stringify(adapter.parsePath('m10 10h20v20h-20z')),JSON.stringify(adapter.parsePath('M10 10L30 10L30 30L10 30Z')));
assert.throws(()=>adapter.parsePath('M0 0L1 1'),/未封閉/);assert.throws(()=>adapter.parsePath('M0 0C1 2'),/不完整/);
// Own noisy, high-contrast oval fixture: cleanup cannot flatten a small dark
// inset into its brown surround or erase the narrow light reflection.
const ovalW=100,ovalH=110,oval=new Uint8Array(ovalW*ovalH*4);
for(let y=0;y<ovalH;y++)for(let x=0;x<ovalW;x++){
 let c=[165,83,49];if(((x-50)/21)**2+((y-58)/38)**2<1)c=[37,32,31];
 if(((x-43)/5)**2+((y-45)/19)**2<1)c=[183,170,143];
 const noise=((x*17+y*23)%9)-4;oval.set([...c.map(v=>v+noise),255],(y*ovalW+x)*4);
}
const originalOval=oval.slice(),cleanedOval=adapter.denoise(oval,ovalW,ovalH,5);
assert.deepEqual(oval,originalOval,'Denoising never modifies the reference pixels');
assert.equal(adapter.denoise(oval,ovalW,ovalH,0),oval,'Zero cleanup bypasses denoising');
assert.ok(cleanedOval[(58*ovalW+50)*4]<55);assert.ok(cleanedOval[(45*ovalW+43)*4]>160);
const alphaPixels=new Uint8Array([255,0,255,0,30,40,50,255,255,0,255,0]);
assert.deepEqual([...adapter.denoise(alphaPixels,3,1,5)],[255,0,255,0,30,40,50,255,255,0,255,0],'Transparent RGB cannot bleed into an opaque edge');
const ovalResult=engine.run({data:oval,width:ovalW,height:ovalH,options:{mode:'illustration',threshold:120,accuracy:3.5,simplify:90,minLength:5}});
const ovalAt=(x,y)=>ovalResult.colorItems.filter(it=>region.contains({x,y},curves(it).flatMap(c=>region.flatten(c).slice(0,-1))));
for(const p of [[50,65],[43,45],[20,65]])assert.equal(ovalAt(...p).length,1,'Each oval detail is a unique closed fill region');
assert.notEqual(ovalAt(50,65)[0].autoTraceRegion,ovalAt(20,65)[0].autoTraceRegion);
assert.notEqual(ovalAt(50,65)[0].autoTraceRegion,ovalAt(43,45)[0].autoTraceRegion);
assert.ok(ovalResult.stats.regions<=8,'Noise does not become a swarm of tiny regions');
const width=160,height=140,data=new Uint8Array(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 let c=[244,229,190];if(x>25&&x<135&&y>15&&y<125)c=[38,50,77];if(x>45&&x<115&&y>40&&y<106)c=[225,160,112];if(x>58&&x<99&&y>62&&y<66)c=[29,35,44];if(x>72&&x<76&&y>21&&y<34)c=[125,144,164];data.set([...c,255],(y*width+x)*4);
}
const input={width,height,data,options:{mode:'illustration',threshold:120,accuracy:2.5,minLength:2}},result=engine.run(input);
assert.ok(result.colorItems.length>=4&&result.colorItems.length<40);assert.ok(result.items.every(i=>i.closed));
assert.equal(JSON.stringify(engine.run(input)),JSON.stringify(result),'Repeated traces do not jitter or randomly change');
const containing=(x,y)=>result.colorItems.filter(it=>region.contains({x,y},curves(it).flatMap(c=>region.flatten(c).slice(0,-1))));
assert.equal(containing(60,60).length,1);assert.equal(containing(80,64).length,1);assert.notEqual(containing(60,60)[0].autoTraceRegion,containing(80,64)[0].autoTraceRegion,'A thin dark facial feature stays separate from the surrounding face');
assert.notEqual(containing(73,27)[0].autoTraceRegion,containing(40,27)[0].autoTraceRegion,'A light feature inside a dark region survives');
const messages=[],self={postMessage:message=>messages.push(message)};vm.runInNewContext(engine.workerSource(),{self,WebAssembly,TextDecoder,TextEncoder});self.onmessage({data:{...input,vectorWasm:wasm}});assert.equal(JSON.stringify(messages.at(-1).result),JSON.stringify(result),'Browser worker and direct geometry are identical');
assert.ok(!messages.at(-1).error);
const nativeItems=[...hole.colorItems,...result.colorItems],native=spawnSync(process.env.PYTHON||'python',['-c','import json,sys;sys.path.insert(0,"app");import bridge;print(json.dumps([bridge.freeform_node_points(it) for it in json.load(sys.stdin)]))'],{cwd:new URL('..',import.meta.url),input:JSON.stringify(nativeItems),encoding:'utf8'});
assert.equal(native.status,0,native.stderr);JSON.parse(native.stdout).forEach((nodes,i)=>{const cs=curves(nativeItems[i]),expected=[cs[0].p0,...cs.flatMap(c=>[c.c1,c.c2,c.p3])];assert.equal(nodes.length,expected.length);nodes.forEach((p,j)=>assert.ok(Math.hypot(p.x-expected[j].x,p.y-expected[j].y)<1e-8,'Native PowerPoint retains every closed curve and hole connector'))});
console.log('Illustration OK: deterministic closed regions, thin dark/light details, exact holes, editable cubic anchors, local WASM and worker parity.');
