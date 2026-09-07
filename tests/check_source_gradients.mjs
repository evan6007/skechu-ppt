import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx=vm.createContext({WebAssembly,TextDecoder,TextEncoder,Math,Array,Number,Object,JSON,Map,Set,WeakMap,Int32Array,Uint8Array,Float32Array,Float64Array,Uint8ClampedArray});
for(const name of ['app/vendor/vtracer.js','app/illustration-trace.js','app/source-gradient.js','app/gradient-regions.js','app/auto-trace.js'])vm.runInContext(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),ctx);
vm.runInContext('globalThis.G=GradientTrace;globalThis.R=GradientRegions;globalThis.I=IllustrationTrace;globalThis.V=VTracerWasm;globalThis.A=AutoTrace;',ctx);ctx.V.init(fs.readFileSync(new URL('../app/vendor/vtracer.wasm',import.meta.url)));
const plain=x=>JSON.parse(JSON.stringify(x));
const points=[];for(let y=1;y<39;y+=2)for(let x=1;x<99;x+=2)points.push([x,y,25+2*x,40+x,220-2*x]);
const before=JSON.stringify(points),fit=ctx.G.fit(points,{x1:0,y1:0,x2:100,y2:40});
assert.ok(fit.gradient&&fit.error<1);assert.ok(fit.gradient.stops.length<=8);assert.equal(JSON.stringify(points),before);
const flat=ctx.G.fit(points.map(p=>[p[0],p[1],40,80,120]),{x1:0,y1:0,x2:100,y2:40});assert.equal(flat.gradient,null);
const reflection=[];for(let y=0;y<40;y++)for(let x=0;x<60;x++){const z=((y+.5)/40*2-1)**2;reflection.push([x+.5,y+.5,60+120*z,100+12*x/60,80+100*z])}
const directional=ctx.G.fit(reflection,{x1:0,y1:0,x2:60,y2:40}),multi=ctx.G.fit(reflection,{x1:0,y1:0,x2:60,y2:40},{multiAngle:true});assert.ok(multi.gradient&&multi.error<directional.error*.1,'Multi-angle native ramp captures a reflection missed by the best plane');assert.equal(multi.gradient.type,'linear');assert.ok(multi.gradient.stops.length<=8);
const glint=[];for(let y=0;y<12;y++)for(let x=0;x<160;x++){const t=(x+.5)/160,v=90*Math.max(0,1-Math.abs(t-.37)/.043);glint.push([x+.5,y+.5,32+v,70+v,130+v])}
const box={x1:0,y1:0,x2:160,y2:12},uniform=ctx.G.fit(glint,box,{multiAngle:true}),adaptive=ctx.G.fit(glint,box,{multiAngle:true,precise:true,refine:true});assert.ok(adaptive.error<uniform.error*.25,'Source-positioned color stops must retain a narrow off-center glint');assert.ok(adaptive.gradient.stops.length<=8&&adaptive.gradient.stops.some((s,i,a)=>Math.abs(s.position-i/(a.length-1))>.02),'Native stops are adaptive, not only equal-spaced');assert.deepEqual(plain(adaptive),plain(ctx.G.fit(glint,box,{multiAngle:true,precise:true,refine:true})));
const geometry=ctx.A;
const width=120,height=80,data=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;data.set([40+x,90+x*.6,210-x*.4,255],i);if((x-44)**2+(y-40)**2<11**2)data.set([30,45,110,255],i);if((x-41)**2+(y-37)**2<3**2)data.set([230,245,255,255],i)}
const original=data.slice(),result=ctx.G.vectorize(data,width,height,geometry);
assert.deepEqual(data,original,'Source cannot be repainted');assert.equal(result.items.length,0,'No fake shadow-outline network');assert.ok(result.colorItems.length>=3);assert.ok(result.colorItems.some(it=>it.fillGradient));
assert.ok(result.colorItems.every(it=>it.closed&&it.width===0&&it.fillOpacity===1));
assert.ok(result.colorItems.some(it=>parseInt(it.fill.slice(1,3),16)>200),'Small highlight survives');
assert.ok(result.colorItems.some(it=>parseInt(it.fill.slice(1,3),16)<50&&parseInt(it.fill.slice(3,5),16)<65),'Dark small island survives');
assert.deepEqual(plain(result),plain(ctx.G.vectorize(data,width,height,geometry)),'Deterministic source fit');
assert.ok(result.colorItems.every(it=>it.points.every(p=>p.x>=-.8&&p.y>=-.8&&p.x<=width+.8&&p.y<=height+.8)),'Subpixel trace returns original image coordinates: '+JSON.stringify(result.colorItems.flatMap(it=>it.points).filter(p=>p.x<-.8||p.y<-.8||p.x>width+.8||p.y>height+.8).slice(0,8)));
assert.equal(ctx.G.recommend(data,width,height).mode,'gradient');
const solidPixels=data.map((v,i)=>i%4===3?255:[50,90,130][i%4]);assert.equal(ctx.G.recommend(solidPixels,width,height).mode,'illustration');
const transparent=data.slice();transparent[3]=0;assert.equal(ctx.G.recommend(transparent,width,height).mode,'illustration');assert.throws(()=>ctx.G.vectorize(transparent,width,height,geometry),/不透明/);
const recommended=ctx.A.run({width,height,data,options:{mode:'fill-auto'}});assert.equal(recommended.stats.fillRecommendation.chosen,'native2d');assert.equal(recommended.stats.shading.precise,true,'Continuous shading recommends fidelity, not the fast approximation');assert.equal(ctx.A.needsIllustration({data,options:{mode:'gradient'}}),false,'Gradient fields do not use the VTracer WASM');
// Rotated, non-square references must keep the shading fixed to the image.
const rectangle=[{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}],curves=rectangle.map((p,i)=>{const q=rectangle[(i+1)%4];return{p0:p,c1:{x:(2*p.x+q.x)/3,y:(2*p.y+q.y)/3},c2:{x:(p.x+2*q.x)/3,y:(p.y+2*q.y)/3},p3:q}});
const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
const sample=(gradient,b,p)=>{const a=gradient.angle*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),t=Math.max(0,Math.min(1,.5+(((p.x-b.x1)/(b.x2-b.x1)-.5)*dx+((p.y-b.y1)/(b.y2-b.y1)-.5)*dy)/(Math.abs(dx)+Math.abs(dy))));let i=0;while(i<gradient.stops.length-2&&t>gradient.stops[i+1].position)i++;const l=gradient.stops[i],r=gradient.stops[i+1],u=Math.max(0,Math.min(1,(t-l.position)/(r.position-l.position)));return rgb(l.color).map((v,k)=>v*(1-u)+rgb(r.color)[k]*u)};
for(const rotation of [0,30,90,180,270])for(const angle of [7,45,137]){const source=geometry.toItem({closed:true},curves,'#000000',0,new Set());source.fillGradient={type:'linear',angle,stops:[{position:0,color:'#102030',opacity:1},{position:.4,color:'#7090b0',opacity:1},{position:1,color:'#e0d0c0',opacity:1}]};const rad=rotation*Math.PI/180,scale=1.7,transform=p=>({x:50+scale*(p.x*Math.cos(rad)-p.y*Math.sin(rad)),y:80+scale*(p.x*Math.sin(rad)+p.y*Math.cos(rad))});const target=geometry.toItem({closed:true},curves.map(c=>Object.fromEntries(Object.entries(c).map(([key,p])=>[key,transform(p)]))),'#000000',0,new Set());const gradient=ctx.G.transformGradient(source,target,transform,rotation,scale);assert.ok(gradient.stops.length<=10);for(let y=10;y<100;y+=20)for(let x=10;x<200;x+=30){const p={x,y},expected=sample(source.fillGradient,ctx.G.bounds(source),p),actual=sample(gradient,ctx.G.bounds(target),transform(p));assert.ok(Math.max(...actual.map((v,k)=>Math.abs(v-expected[k])))<1.1,'Rotated gradient must match the same source pixel')}}
// New production engine infers a partition, never a paint stack.
assert.throws(()=>ctx.R.partition(data,5000,5000),/範圍/);
const ownership=ctx.R.partition(data,width,height);
assert.equal(ownership.labels.length,width*height);
assert.equal(ownership.stats.engine,'gradient-fields');
const visited=new Uint8Array(width*height);
for(let id=0;id<ownership.groups.length;id++)for(const pixel of ownership.groups[id].pixels){assert.equal(visited[pixel]++,0,'Exactly one owner, no hidden underpaint');assert.equal(ownership.labels[pixel],id)}
assert.ok(visited.every(v=>v===1),'The paper edges are also owned, without holes');
const edgeUses=new Map();for(const it of result.colorItems)for(let i=0;i<it.points.length;i++){const j=(i+1)%it.points.length,p=it.points[i],q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j],ps=[p,{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},q];const frame=[['x',0],['x',width],['y',0],['y',height]].some(([k,v])=>ps.every(p=>Math.abs(p[k]-v)<1e-5));if(frame)continue;const forward=ps.map(p=>[p.x,p.y].map(v=>Math.round(v*1e5)).join(',')).join(';'),backward=ps.slice().reverse().map(p=>[p.x,p.y].map(v=>Math.round(v*1e5)).join(',')).join(';'),key=[forward,backward].sort()[0];edgeUses.set(key,(edgeUses.get(key)||0)+1)}
assert.ok([...edgeUses.values()].every(n=>n%2===0),'Every internal cubic is shared exactly, including reversed hole connectors');
const pristine=plain(result.colorItems[0]),key=ctx.R.coverageKey(pristine);assert.ok(key);
pristine.fill='#aabbcc';assert.equal(ctx.R.coverageKey(pristine),key,'Recolor does not invalidate shared geometry');
pristine.points[0].x+=1;assert.equal(ctx.R.coverageKey(pristine),null,'Moved objects return to normal compositing');
const entries=result.colorItems.map(it=>({key:ctx.R.coverageKey(it),frame:ctx.R.coverageFrame(it),markup:'<path/>'}));assert.match(ctx.R.compose(entries),/data-coverage-normalized/);assert.doesNotMatch(ctx.R.compose(entries.slice(1)),/data-coverage-normalized/,'Deleting or exporting part of a partition must not fill missing objects');assert.doesNotMatch(ctx.R.compose(entries.map((e,i)=>i?e:{...e,key:null})),/data-coverage-normalized/,'An edited boundary must disable whole-partition coverage');
const translated=plain(result.colorItems[0]);translated.points.forEach(p=>{p.x+=30;p.y+=20});assert.ok(ctx.R.coverageKey(translated));assert.notEqual(ctx.R.coverageKey(translated),ctx.R.coverageKey(result.colorItems[0]),'An individual translation separates its coverage group; a whole-group translation can retain shared coverage');
assert.ok(!ctx.G.run,'No legacy paint-stack compactor in production');
const source=['source-gradient.js','gradient-regions.js'].map(file=>fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8')).join('\n');
assert.ok(!/Gojo|五條|7740aeb0|110,113|274,111/.test(source),'No character identity, source filename or eye-coordinate shortcuts');
console.log('Source gradients: automatic fitting, bounded stops, immutable pixels, highlight/dark-island preservation, closed fills, no extra ink, deterministic output and no sample-specific coordinates passed.');
