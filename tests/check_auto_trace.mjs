import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=new URL('..',import.meta.url);
const context=vm.createContext({Math,Number,Map,Set,Uint8Array,Int32Array});
vm.runInContext(fs.readFileSync(new URL('../app/auto-trace.js',import.meta.url),'utf8')+'\nthis.trace=AutoTrace;',context);
const trace=context.trace;
const image=(w=100,h=100)=>({width:w,height:h,data:new Uint8Array(w*h*4).fill(255)});
function line(im,a,b,width=3){for(let t=0;t<=1;t+=1/(Math.hypot(b.x-a.x,b.y-a.y)*2)){const x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);for(let dy=-Math.floor(width/2);dy<=Math.floor(width/2);dy++)for(let dx=-Math.floor(width/2);dx<=Math.floor(width/2);dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=im.width||yy>=im.height)continue;const i=(yy*im.width+xx)*4;im.data[i]=18;im.data[i+1]=63;im.data[i+2]=140}}}
const t=image();line(t,{x:15,y:30},{x:85,y:30});line(t,{x:50,y:30},{x:50,y:85});
const result=trace.run(t);assert.equal(result.items.length,3,'T produces three branches, not one zigzag');assert.equal(result.stats.junctions,1);
const ends=result.items.flatMap(it=>Object.entries(it.pointJunctions).map(([i,key])=>({p:it.points[i],key})));
assert.equal(ends.length,3);assert.equal(new Set(ends.map(e=>e.key)).size,1);ends.forEach(e=>assert.deepEqual(e.p,ends[0].p));
const cross=image();line(cross,{x:10,y:50},{x:90,y:50});line(cross,{x:50,y:10},{x:50,y:90});const x=trace.run(cross);assert.equal(x.items.length,4);assert.ok(x.issues.some(i=>i.kind==='junction'));
const gap=image();line(gap,{x:10,y:50},{x:45,y:50});line(gap,{x:51,y:50},{x:90,y:50});const g=trace.run(gap);assert.equal(g.items.length,2);assert.equal(g.stats.junctions,0);assert.ok(g.issues.some(i=>i.kind==='gap'));
const circle=image();for(let a=0;a<Math.PI*2;a+=.02)line(circle,{x:50+30*Math.cos(a),y:50+30*Math.sin(a)},{x:50+30*Math.cos(a+.02),y:50+30*Math.sin(a+.02)},3);
const c=trace.run(circle);assert.equal(c.items.length,1);assert.equal(c.items[0].closed,true);assert.ok(c.items[0].points.length>=3);assert.ok(c.items[0].points.length<45);
assert.equal(trace.run(image()).items.length,0);
const opaque=image();opaque.data.fill(0);for(let i=3;i<opaque.data.length;i+=4)opaque.data[i]=255;assert.throws(()=>trace.run(opaque),/深色面積/);
const transparent=image();transparent.data.fill(0);assert.equal(trace.run(transparent).items.length,0);
const edge=image();line(edge,{x:0,y:20},{x:90,y:20});assert.equal(trace.run(edge).items.length,1,'Image edge remains traceable');
for(const it of [...result.items,...c.items]){assert.ok(it.points.every(p=>Number.isFinite(p.x+p.y)));assert.equal(it.endHead,false);assert.equal(it.fillOpacity,0);assert.ok(Object.values(it.pointHandleAngles).every(h=>h.inLength<=600&&h.outLength<=600))}
console.log(`Auto trace synthetic tests OK: T, cross, disconnected gap, circle, blank/transparent/dense images and boundary pixels.`);

const bend=[];for(let y=0;y<=35;y++)bend.push({x:0,y});for(let x=1;x<=35;x++)bend.push({x,y:35});
const cornerCurves=trace.fit(bend,{x:0,y:1},{x:-1,y:0},5);
assert.ok(cornerCurves.some(c=>c.p3.x===0&&c.p3.y===35),'Broad fitting preserves a genuine sharp corner');
const fineCircle=trace.run({...circle,options:{accuracy:1,simplify:65}});
assert.ok(c.items[0].points.length<=fineCircle.items[0].points.length,'Broad pen steps do not add anchors on a circle');
for(const it of result.items)assert.ok(it.points.length<=3,'Straight T branches use long steps, not pixel-sized segments');

function ellipseCurves(steps=50,start=-Math.PI/2,span=-Math.PI){const curves=[];for(let i=0;i<steps;i++){const a=start+span*i/steps,b=start+span*(i+1)/steps,k=4/3*Math.tan((b-a)/4),p0={x:180+90*Math.cos(a),y:180+150*Math.sin(a)},p3={x:180+90*Math.cos(b),y:180+150*Math.sin(b)};curves.push({p0,p3,c1:{x:p0.x-k*90*Math.sin(a),y:p0.y+k*150*Math.cos(a)},c2:{x:p3.x+k*90*Math.sin(b),y:p3.y-k*150*Math.cos(b)}})}return curves}
const denseCurves=ellipseCurves(),denseArc=trace.toItem({start:0,end:1,closed:false},denseCurves,'#123f8c',2.5,new Set([0,1]));denseArc.id='dense-test';
const denseBefore=JSON.stringify(denseArc),sparseArc=trace.simplifyItem(denseArc,denseCurves,1.5);
assert.equal(JSON.stringify(denseArc),denseBefore,'Simplification must not mutate the original before commit');
assert.ok(sparseArc.points.length<=3,`Simple half ellipse should use <=3 anchors, got ${sparseArc.points.length}`);
assert.equal(JSON.stringify(sparseArc.points[0]),JSON.stringify(denseArc.points[0]));assert.equal(JSON.stringify(sparseArc.points.at(-1)),JSON.stringify(denseArc.points.at(-1)));
assert.equal(sparseArc.pointJunctions[0],'j0');assert.equal(sparseArc.pointJunctions[sparseArc.points.length-1],'j1');
const reviewArc={...denseArc,autoTraceReview:{25:'inspect'},pointJunctions:{...denseArc.pointJunctions,25:'trunk'}};
const sparseReview=trace.simplifyItem(reviewArc,denseCurves,1.5),reviewIndex=Number(Object.keys(sparseReview.autoTraceReview)[0]);assert.equal(JSON.stringify(sparseReview.points[reviewIndex]),JSON.stringify(denseArc.points[25]));assert.equal(sparseReview.pointJunctions[reviewIndex],'trunk','Interior T positions and review markers survive');
const closedCurves=ellipseCurves(80,0,Math.PI*2),denseClosed=trace.toItem({start:0,end:0,closed:true},closedCurves,'#123f8c',2.5,new Set([0]));
const sparseClosed=trace.simplifyItem(denseClosed,closedCurves,1.5);assert.ok(sparseClosed.closed&&sparseClosed.points.length>=3&&sparseClosed.points.length<=7);assert.equal(sparseClosed.pointJunctions[0],'j0');
function itemCurves(it){return it.points.slice(0,it.closed?it.points.length:-1).map((p,i)=>{const j=(i+1)%it.points.length,q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j];return{p0:p,c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},p3:q}})}
const referenceSamples=denseCurves.flatMap(c=>Array.from({length:11},(_,i)=>trace.at(c,i/10))),sparseSamples=itemCurves(sparseArc).flatMap(c=>Array.from({length:401},(_,i)=>trace.at(c,i/400)));
for(const [a,b] of [[referenceSamples,sparseSamples],[sparseSamples,referenceSamples]])for(const p of a)assert.ok(Math.min(...b.map(q=>Math.hypot(p.x-q.x,p.y-q.y)))<1.6,'Simplified arc stays within tolerance in both directions');
console.log(`Sparse editable arc OK: ${denseArc.points.length} -> ${sparseArc.points.length} anchors; exact endpoints, interior T, review and closure preserved.`);

const ui=fs.readFileSync(new URL('../app/auto-trace-ui.js',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
function loadFunction(source,name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);const rest=source.slice(start),end=rest.slice(1).search(/\n(?:async )?function |\ndocument\./);vm.runInContext(end<0?rest:rest.slice(0,end+1),context)}
context.deepCopy=x=>JSON.parse(JSON.stringify(x));context.autoJunctionPositions=new Map();context.selected=null;
vm.runInContext(app.split('\n').find(l=>l.startsWith('function tracePenStrokeStyle(')),context);
for(const name of ['transformAutoTraceItems','autoJunctionMembers','syncAutoJunctions'])loadFunction(ui,name);
let seq=0;const transformed=context.transformAutoTraceItems(result,{x:10,y:20,w:200,h:100,r:30},100,100,'test',()=>`test-${seq++}`);
for(const it of transformed){assert.equal(it.color,'#123f8c');assert.equal(it.width,2.5,'Applied curves use the manual pen style')}
context.items=transformed;context.syncAutoJunctions();
const members=[...context.autoJunctionMembers().values()][0];context.selected=members[1].it.id;
members[1].it.points[members[1].index]={x:80,y:90};context.syncAutoJunctions();
for(const m of members)assert.deepEqual(JSON.parse(JSON.stringify(m.it.points[m.index])),{x:80,y:90},'Moving any T member moves the common anchor');
const restored=JSON.parse(JSON.stringify(transformed));context.items=restored;context.autoJunctionPositions.clear();context.syncAutoJunctions();assert.equal([...context.autoJunctionMembers().values()][0].length,3,'Save/reload retains topology');
delete context.items[1].pointJunctions[Object.keys(context.items[1].pointJunctions)[0]];
assert.equal([...context.autoJunctionMembers().values()][0].length,2,'Detaching only one branch leaves the other members connected');
const htmlLines=app.split('\n');
for(const name of ['shiftIndexedPointValues','shiftPointKinds','reversePointKinds'])vm.runInContext(htmlLines.find(l=>l.startsWith('function '+name+'(')),context);
const indexed={type:'arrow',pointJunctions:{0:'a',3:'b'}};context.shiftPointKinds(indexed,1,1);assert.equal(indexed.pointJunctions[4],'b');context.shiftPointKinds(indexed,2,-1);assert.equal(indexed.pointJunctions[3],'b');
assert.equal(context.reversePointKinds(indexed.pointJunctions,4)[0],'b');
assert.ok(app.includes("if(document.getElementById('auto-trace-dialog')?.open)return"),'Modal blocks background edit shortcuts');
assert.ok(app.includes("junctionMap.set(key,uid('junction'))"),'Copied branches get globally unique junction groups even after reload');
assert.ok(app.includes('requested.some(index=>it.pointJunctions?.[index])'),'Deleting shared anchors requires explicit detachment');
context.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
for(const name of ['normalizeAngle','pointIsSharp','pointSmoothnessValue','automaticTangentDelta','pointTangentAngle','pointTangentDelta','splitHandleAngles','splitHandleDelta','limitedControl','curveSegmentControls','arrowDefaultSmoothness','arrowSegmentControls'])vm.runInContext(htmlLines.find(l=>l.startsWith('function '+name+'(')),context);
loadFunction(ui,'mergeAutoTraceProperties');
const a=JSON.parse(JSON.stringify(result.items[0])),b=JSON.parse(JSON.stringify(result.items[1])),joined={points:a.points.concat(b.points.slice(1))};
context.mergeAutoTraceProperties(a,b,joined,a.points.length-1);
assert.equal(joined.pointJunctions[a.points.length-1],a.pointJunctions[a.points.length-1]);
assert.equal(joined.pointHandleAngles[joined.points.length-1].inLength,b.pointHandleAngles[b.points.length-1].inLength,'Merging auto paths preserves the far-end controls');
const review=context.transformAutoTraceItems({...result,issues:[{...result.items[0].points[0],message:'review'}]},{x:0,y:0,w:100,h:100,r:0},100,100,'review',()=>`review-${seq++}`);
assert.ok(review.some(it=>Object.values(it.autoTraceReview||{}).includes('review')),'Review marks survive Apply and serialization');

const nativeItems=context.transformAutoTraceItems({items:[...result.items,...c.items,sparseArc,sparseClosed]}, {x:0,y:0,w:100,h:100,r:0},100,100,'native',()=>`native-${seq++}`);
const nativeCode='import sys,json;sys.path.insert(0,"app");import bridge;print(json.dumps([bridge.freeform_node_points(it) for it in json.load(sys.stdin)]))';
const native=spawnSync(process.env.PYTHON||'python',['-X','utf8','-c',nativeCode],{cwd:root,input:JSON.stringify(nativeItems),encoding:'utf8'});assert.equal(native.status,0,native.stderr);
const nativeNodes=JSON.parse(native.stdout);
for(let k=0;k<nativeItems.length;k++){const it=nativeItems[k],expected=[it.points[0]];for(let i=0;i<(it.closed?it.points.length:it.points.length-1);i++){const j=(i+1)%it.points.length,a=it.pointHandleAngles[i],b=it.pointHandleAngles[j],p=it.points[i],q=it.points[j];expected.push({x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},q)}assert.equal(expected.length,nativeNodes[k].length);expected.forEach((p,i)=>assert.ok(Math.hypot(p.x-nativeNodes[k][i].x,p.y-nativeNodes[k][i].y)<1e-8))}
console.log('Auto trace editor tests OK: shared-node movement, detach, save/reload, index shifts, clone isolation, modal guard and SVG/native geometry.');

// Exercise the production dialog controller with deterministic worker/timer replies.
assert.ok(!ui.includes('auto-trace-preview'),'No regenerate button or dependency remains');
const elements=new Map(),timers=new Map(),workers=[];let timerId=0;
const defaults={'auto-trace-threshold':['150',40,220],'auto-trace-accuracy':['2.5',.3,6],'auto-trace-simplify':['90',0,100],'auto-trace-min-length':['3',0,30]};
function element(id){if(!elements.has(id)){const [value='',min=-Infinity,max=Infinity]=defaults[id]||[];elements.set(id,{value,innerHTML:'',textContent:'',disabled:false,open:false,attributes:{},style:{},insertAdjacentHTML(){},addEventListener(){},showModal(){this.open=true},close(){this.open=false},setAttribute(k,v){this.attributes[k]=v},checkValidity(){return this.value!==''&&Number.isFinite(Number(this.value))&&Number(this.value)>=min&&Number(this.value)<=max}})}return elements.get(id)}
const reference={id:'ref',type:'image',referenceOnly:true,preserveFull:true,src:'data:image/png;base64,fixture',x:0,y:0,w:100,h:100,r:0};
const controller=vm.createContext({console,URL,Uint8Array,Map,Number,Math,JSON,selected:'ref',items:[reference],traceDraft:null,activeProjectId:'project',activePageId:'page',deepCopy:context.deepCopy,esc:String,byId:id=>id==='ref'?reference:null,
 document:{baseURI:'http://localhost/',body:element('body'),querySelector:()=>element('toolbar'),getElementById:element,createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array(40000)})})})},
 Image:class{naturalWidth=100;naturalHeight=100;decode(){return Promise.resolve()}},
 Worker:class{constructor(){workers.push(this)}terminate(){this.terminated=true}postMessage(payload){this.payload=payload}},
 setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)});
vm.runInContext(app.split('\n').find(l=>l.startsWith('function tracePenStrokeStyle('))+'\n'+ui+'\nthis.actions={open:openAutoTrace,change:invalidateAutoTrace,cancel:cancelAutoTrace};',controller);
const settle=async()=>{await Promise.resolve();await Promise.resolve()};
const flush=async()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn()}await settle()};
const reply=(worker,data)=>worker.onmessage({data});
await controller.actions.open();assert.equal(workers.length,1,'Opening predicts immediately');
assert.equal(workers[0].payload.options.accuracy,2.5);assert.equal(workers[0].payload.options.simplify,90);
reply(workers[0],{type:'result',result});
assert.equal((element('auto-trace-anchors').innerHTML.match(/data-preview-anchor=/g)||[]).length,result.stats.anchors,'Preview displays every actual editable anchor');
assert.equal(context.transformAutoTraceItems(result,{x:0,y:0,w:100,h:100},100,100,'count',()=>`count-${seq++}`).reduce((n,it)=>n+it.points.length,0),result.stats.anchors,'Apply cannot add hidden anchors');
assert.match(element('auto-trace-lines').innerHTML,/ C/,'Preview draws cubic pen paths');
assert.match(element('auto-trace-lines').innerHTML,/stroke="#123f8c"/);assert.equal(element('auto-trace-apply').disabled,false);
const previousLines=element('auto-trace-lines').innerHTML;
element('auto-trace-accuracy').value='1';controller.actions.change();element('auto-trace-accuracy').value='3';controller.actions.change();
assert.equal(timers.size,1,'Rapid input coalesces into one prediction');assert.equal(element('auto-trace-apply').disabled,true);
assert.equal(element('auto-trace-lines').innerHTML,previousLines,'Old preview remains visibly faded during update');assert.equal(element('auto-trace-svg').attributes['aria-busy'],'true');
reply(workers[0],{type:'result',result:{items:[],issues:[],stats:{paths:0}}});assert.equal(element('auto-trace-lines').innerHTML,previousLines,'Superseded worker cannot overwrite the preview');
await flush();assert.equal(workers.length,2);assert.equal(workers[1].payload.options.accuracy,3);
reply(workers[1],{type:'result',result});assert.equal(element('auto-trace-apply').disabled,false);assert.equal(element('auto-trace-svg').attributes['aria-busy'],'false');
element('auto-trace-accuracy').value='';controller.actions.change();assert.equal(timers.size,0);assert.equal(element('auto-trace-apply').disabled,true);
element('auto-trace-accuracy').value='7';controller.actions.change();assert.equal(timers.size,0,'Out-of-range values wait for correction');
element('auto-trace-accuracy').value='2.5';controller.actions.change();await flush();reply(workers.at(-1),{type:'error',message:'test failure'});
assert.equal(element('auto-trace-lines').innerHTML,'');assert.equal(element('auto-trace-apply').disabled,true);
controller.actions.change();await flush();const pending=workers.at(-1);controller.actions.cancel();reply(pending,{type:'result',result});
assert.ok(pending.terminated);assert.equal(element('auto-trace-dialog').open,false);assert.equal(element('auto-trace-lines').innerHTML,'','Canceled reply cannot resurrect lines');
await controller.actions.open();controller.actions.change();controller.actions.cancel();assert.equal(timers.size,0,'Cancel stops a scheduled prediction');
assert.equal(controller.items.length,1,'Preview and cancel never create canvas objects');
console.log('Auto trace live preview OK: immediate pen lines, broad defaults, automatic input updates, stale results, validation, errors and cancellation.');

if(process.env.SKECHU_TEST_POWERPOINT==='1'){
 const code=`import sys,json
sys.path.insert(0,"app")
import bridge
items=json.load(sys.stdin)
items.insert(0,{"id":"origin","type":"box","x":0,"y":0,"w":1,"h":1,"strokeWidth":0})
try:
    bridge.copy_native({"items":items},copy_clipboard=False)
    state=bridge.STATE;group=state["cached_group"]
    for item in items[1:]:
        shape=group.GroupItems.Item(state["item_shapes"][item["id"]][0])
        bridge.verify_freeform_nodes(shape,bridge.freeform_node_points(item),0,0,.75)
    print("Actual PowerPoint auto-trace node verification passed")
finally:
    pres=bridge.STATE.get("presentation")
    if pres is not None: pres.Saved=True;pres.Close()
`;
 const actual=spawnSync(process.env.PYTHON||'python',['-X','utf8','-c',code],{cwd:root,input:JSON.stringify(nativeItems),encoding:'utf8'});assert.equal(actual.status,0,actual.stderr);console.log(actual.stdout.trim());
}

if(process.argv[2]){
  const file=process.argv[2],read=spawnSync(process.env.PYTHON||'python',['-X','utf8','-c','from PIL import Image;import sys,struct;im=Image.open(sys.argv[1]).convert("RGBA");sys.stdout.buffer.write(struct.pack("<II",*im.size)+im.tobytes())',file],{maxBuffer:32*1024*1024});
  assert.equal(read.status,0,read.stderr?.toString());const w=read.stdout.readUInt32LE(0),h=read.stdout.readUInt32LE(4),data=new Uint8Array(read.stdout.subarray(8));
  const start=performance.now(),output=trace.run({width:w,height:h,data});
  console.log(JSON.stringify({...output.stats,seconds:(performance.now()-start)/1000}));
  const distances=[];
  for(const it of output.items)for(let i=0;i<(it.closed?it.points.length:it.points.length-1);i++){
    const j=(i+1)%it.points.length,p=it.points[i],q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j];
    const curve={p0:p,c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},p3:q};
    const steps=Math.max(3,Math.ceil((Math.hypot(p.x-curve.c1.x,p.y-curve.c1.y)+Math.hypot(curve.c1.x-curve.c2.x,curve.c1.y-curve.c2.y)+Math.hypot(q.x-curve.c2.x,q.y-curve.c2.y))/2));
    for(let k=0;k<=steps;k++){const sample=trace.at(curve,k/steps);let nearest=Infinity;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const x=Math.floor(sample.x)+dx,y=Math.floor(sample.y)+dy;if(x<0||x>=w||y<0||y>=h)continue;const offset=(y*w+x)*4;if(.2126*data[offset]+.7152*data[offset+1]+.0722*data[offset+2]<150)nearest=Math.min(nearest,Math.hypot(x+.5-sample.x,y+.5-sample.y))}distances.push(nearest)}
  }
  distances.sort((a,b)=>a-b);const p99=distances[Math.floor(distances.length*.99)],max=distances.at(-1);
  console.log(`Curve-to-ink checks: ${distances.length} samples, p99=${p99.toFixed(3)}px, max=${max.toFixed(3)}px`);
  assert.ok(p99<2&&max<5,'Detected curves must stay near the original dark ink');
  const out=path.join(new URL('../app/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),'.codex-tmp','auto-trace-qa');
  const dir=decodeURIComponent(out);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(output));
  const paths=output.items.map(it=>{let d=`M${it.points[0].x} ${it.points[0].y}`;for(let i=0;i<(it.closed?it.points.length:it.points.length-1);i++){const j=(i+1)%it.points.length,p=it.points[i],q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j];d+=` C${p.x+Math.cos(a.out*Math.PI/180)*a.outLength} ${p.y+Math.sin(a.out*Math.PI/180)*a.outLength} ${q.x+Math.cos(b.in*Math.PI/180)*b.inLength} ${q.y+Math.sin(b.in*Math.PI/180)*b.inLength} ${q.x} ${q.y}`}if(it.closed)d+='Z';return`<path d="${d}" fill="none" stroke="${it.color}" stroke-width="${it.width}" stroke-linecap="round"/>`}).join('');
  const issues=output.issues.map(i=>`<circle cx="${i.x}" cy="${i.y}" r="6" fill="none" stroke="red"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="white"/>${paths}${issues}</svg>`;
  fs.writeFileSync(path.join(dir,'traced.svg'),svg);
  fs.writeFileSync(path.join(dir,'overlay.svg'),svg.replace(paths,`<image href="data:image/png;base64,${fs.readFileSync(file).toString('base64')}" width="${w}" height="${h}" opacity=".25"/>${paths}`));
  // A disposable copy of the real editor with a reference-only starter fixture.
  // No test hooks are added to production and no existing project is touched.
  const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  const fixture={id:'qa-brain-reference',type:'image',name:'大腦測試底圖',src:'data:image/png;base64,'+fs.readFileSync(file).toString('base64'),x:100,y:20,w:930,h:930*h/w,r:0,opacity:.25,preserveFull:true,referenceOnly:true,locked:true};
  const testPage=html.replace('<head>','<head><base href="/">').replace(/const STARTER_ITEMS=\[[\s\S]*?\n\];/,()=>`const STARTER_ITEMS=${JSON.stringify([fixture])};`);
  assert.notEqual(testPage,html);fs.writeFileSync(path.join(dir,'editor.html'),testPage);
  const denseFixture={...JSON.parse(JSON.stringify(denseArc)),name:'51 點圓滑弧線',id:'qa-dense-arc'};
  const branchFixtures=[{...JSON.parse(JSON.stringify(denseArc)),id:'qa-top-branch',name:'上方支線',points:[denseArc.points[0],{x:245,y:30}],pointHandleAngles:{},pointJunctions:{0:'j0'},curved:false},{...JSON.parse(JSON.stringify(denseArc)),id:'qa-bottom-branch',name:'下方支線',points:[denseArc.points.at(-1),{x:245,y:330}],pointHandleAngles:{},pointJunctions:{0:'j1'},curved:false}];
  fs.writeFileSync(path.join(dir,'dense.html'),html.replace('<head>','<head><base href="/">').replace(/const STARTER_ITEMS=\[[\s\S]*?\n\];/,()=>`const STARTER_ITEMS=${JSON.stringify([denseFixture,...branchFixtures])};`));
  if(process.env.SKECHU_TEST_POWERPOINT==='1'){
    const items=context.transformAutoTraceItems(output,{x:100,y:20,w:930,h:930*h/w,r:0},w,h,'brain-native',()=>`brain-${seq++}`);
    const code=`import sys,json,pathlib
sys.path.insert(0,"app")
import bridge
items=json.load(sys.stdin);items.insert(0,{"id":"origin","type":"box","x":0,"y":0,"w":1,"h":1,"strokeWidth":0})
try:
    result=bridge.copy_native({"items":items},copy_clipboard=False)
    s=bridge.STATE;g=s["cached_group"]
    for item in items[1:]:
        bridge.verify_freeform_nodes(g.GroupItems.Item(s["item_shapes"][item["id"]][0]),bridge.freeform_node_points(item),0,0,.75)
    out=pathlib.Path(".codex-tmp/auto-trace-native-qa").resolve();out.mkdir(parents=True,exist_ok=True)
    s["presentation"].Slides(1).Export(str(out/"brain.png"),"PNG",1200,675)
    print("Full brain native verification:",len(items)-1,"curves;",result["seconds"],"seconds")
finally:
    pres=bridge.STATE.get("presentation")
    if pres is not None:pres.Saved=True;pres.Close()
`;
    const whole=spawnSync(process.env.PYTHON||'python',['-X','utf8','-c',code],{cwd:root,input:JSON.stringify(items),encoding:'utf8'});assert.equal(whole.status,0,whole.stderr);console.log(whole.stdout.trim());
  }
  console.log(dir);
}
