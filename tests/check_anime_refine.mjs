import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const scope = vm.createContext({});
for (const file of ['app/auto-trace.js', 'app/region-fill.js', 'app/trace-boundary.js', 'experiments/anime-trace/refine.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), scope);
const {engine, refine:core} = vm.runInContext('({engine:AutoTrace, refine:AnimeLineRefine})', scope);
// Keep the non-crop topology regressions independent of the optional rim.
const refine={...core,run:(input,engine,progress)=>core.run({...input,options:{closeBorder:false,...input.options}},engine,progress)};
const regions = vm.runInContext('RegionFill', scope);
const image = (width = 100, height = 100) => ({width, height, data: new Uint8Array(width*height*4).fill(255)});
function stroke(im, x1, y1, x2, y2, value = 30, radius = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2-x1, y2-y1)*3));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x1+(x2-x1)*s/steps), y = Math.round(y1+(y2-y1)*s/steps);
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const xx = x+dx, yy = y+dy;
      if (xx < 0 || yy < 0 || xx >= im.width || yy >= im.height) continue;
      const i = (yy*im.width+xx)*4;
      im.data[i] = im.data[i+1] = im.data[i+2] = value;
    }
  }
}
const trace = (im, options = {}) => refine.run({...im, options}, engine);
const clipped=image();stroke(clipped,0,50,99,50);
assert.equal(core.run(clipped,engine).items.filter(it=>it.traceBoundary==='rim').length,1,'Default refinement closes image-clipped strokes');
assert.equal(core.run({...clipped,options:{closeBorder:false}},engine).items.some(it=>it.traceBoundary),false);
const faint = image();
stroke(faint, 12, 50, 43, 50); stroke(faint, 49, 50, 88, 50); stroke(faint, 45, 50, 47, 50, 232, 0);
const before = Array.from(faint.data), fixed = trace(faint);
assert.equal(fixed.refinement.repairs.length, 1, 'Facing endpoints with faint line evidence reconnect');
assert.equal(fixed.items.length, 1, 'A supported short break becomes one editable stroke');
assert.deepEqual(Array.from(faint.data), before, 'Input probabilities are never mutated');
assert.equal(trace(faint, {maxGap: 0}).items.length, 2, 'Repair can be disabled for comparison');

const whiteGap = image(); stroke(whiteGap, 12, 50, 43, 50); stroke(whiteGap, 49, 50, 88, 50);
assert.equal(trace(whiteGap).refinement.repairs.length, 0, 'Proximity alone cannot join disconnected strokes');
assert.equal(trace(whiteGap).items.length, 2);
const colorReference = image();
for (let y=0;y<100;y++) for (let x=0;x<100;x++) {
  const color=y<50?[35,48,65]:[230,180,130],i=(y*100+x)*4;
  for(let k=0;k<3;k++) colorReference.data[i+k]=color[k];
}
const colorGap=refine.run({...whiteGap,referenceData:colorReference.data},engine);
assert.equal(colorGap.stats.colorRepairs,1,'A missing sketch edge can use the source color boundary');
assert.equal(colorGap.items.length,1);
assert.equal(refine.run({...whiteGap,referenceData:colorReference.data,options:{maxColorGap:0}},engine).stats.colorRepairs,0,'Color assistance can be disabled');
assert.equal(colorGap.refinement.repairs[0].source,'color','Source-assisted repairs remain identifiable');
assert.equal(refine.run({...whiteGap,referenceData:image().data},engine).stats.colorRepairs,0,'Flat source color is not evidence');
assert.equal(refine.run({...image(),referenceData:colorReference.data},engine).items.length,0,'Color changes alone never generate a new line drawing');
const hiddenColor=new Uint8Array(colorReference.data);for(let i=3;i<hiddenColor.length;i+=4)hiddenColor[i]=0;
assert.equal(refine.run({...whiteGap,referenceData:hiddenColor},engine).stats.colorRepairs,0,'Transparent RGB cannot supply a fake edge');
assert.throws(()=>refine.run({...whiteGap,referenceData:new Uint8Array(4)},engine),/Expected/);
const parallel = image(); stroke(parallel, 12, 47, 60, 47); stroke(parallel, 12, 53, 60, 53);
assert.equal(trace(parallel).refinement.repairs.length, 0, 'Close parallel lines remain independent');
const angled = image(); stroke(angled, 12, 50, 43, 50); stroke(angled, 49, 50, 49, 88); stroke(angled, 45, 50, 47, 50, 232, 0);
assert.equal(trace(angled).refinement.repairs.length, 0, 'No forced 90-degree connection');
const cornerShape=image(),cornerSource=image();
stroke(cornerShape,24,20,80,20);stroke(cornerShape,80,20,80,80);stroke(cornerShape,80,80,20,80);stroke(cornerShape,20,80,20,24);
for(let y=20;y<=80;y++)for(let x=20;x<=80;x++){const i=(y*100+x)*4;cornerSource.data[i]=80;cornerSource.data[i+1]=110;cornerSource.data[i+2]=140;}
const closedCorner=refine.run({...cornerShape,referenceData:cornerSource.data},engine);
assert.equal(closedCorner.stats.cornerRepairs,1,'A source-backed sharp corner can close without pretending its tangents are collinear');
assert.ok(closedCorner.items.some(it=>it.closed));
assert.equal(refine.run({...cornerShape,referenceData:image().data},engine).stats.cornerRepairs,0,'No unsupported corner closure');

// Exercise hole cleanup independently from smoothing/thinning.
const mask = new Uint8Array(40*40), gray = new Float32Array(40*40).fill(255);
for (let y = 8; y < 15; y++) for (let x = 5; x < 14; x++) {mask[y*40+x] = 1; gray[y*40+x] = 30;}
mask[11*40+9] = 0; gray[11*40+9] = 235;
for (let y = 24; y < 31; y++) for (let x = 25; x < 32; x++) {mask[y*40+x] = 1; gray[y*40+x] = 30;}
mask[27*40+28] = 0; gray[27*40+28] = 255;
assert.equal(refine.removePinholes(mask, gray, 40, 40, 25), 1);
assert.equal(mask[11*40+9], 1, 'Low-confidence pore is removed');
assert.equal(mask[27*40+28], 0, 'Even a one-pixel genuine white opening is preserved');

const ring = image();
for (let t = 0; t < 2*Math.PI; t += .025) stroke(ring, 50+13*Math.cos(t), 50+23*Math.sin(t), 50+13*Math.cos(t+.025), 50+23*Math.sin(t+.025));
const rings = trace(ring);
assert.equal(rings.items.length, 1); assert.equal(rings.items[0].closed, true, 'Earring loop stays closed and hollow');
assert.equal(rings.refinement.repairs.length, 0);
const tinyRing = image();
stroke(tinyRing, 46, 46, 54, 46); stroke(tinyRing, 54, 46, 54, 54);
stroke(tinyRing, 54, 54, 46, 54); stroke(tinyRing, 46, 54, 46, 46);
assert.ok(trace(tinyRing).items.some(it => it.closed), 'Smoothing itself must preserve a small white opening');
const ribbon=image(),ridge=image();
stroke(ribbon,40,20,46,20,30,0);stroke(ribbon,46,20,46,80,30,0);stroke(ribbon,46,80,40,80,30,0);stroke(ribbon,40,80,40,20,30,0);
stroke(ridge,43,20,43,80,40,1);
const singleStroke=refine.run({...ribbon,referenceData:ridge.data},engine);
assert.equal(singleStroke.stats.collapsedRibbons,1,'Source ridge distinguishes one dark stroke from its doubled outlines');
assert.equal(singleStroke.items.length,1);assert.equal(singleStroke.items[0].closed,false,'A narrow stroke is recovered as one editable centerline');
const lightRidge=image();for(let i=0;i<ridge.data.length;i++)lightRidge.data[i]=i%4===3?255:255-ridge.data[i];
const brightStroke=refine.run({...ribbon,referenceData:lightRidge.data},engine);
assert.equal(brightStroke.stats.collapsedRibbons,1,'Light strokes, not only dark ink, recover a single centerline');
assert.equal(brightStroke.refinement.strokeRibbons[0].polarity,'light');
assert.equal(refine.run({...ribbon,referenceData:ridge.data,options:{collapseRibbons:false}},engine).items[0].closed,true,'Double-edge cleanup can be disabled');
assert.equal(refine.run({...ribbon,referenceData:image().data},engine).stats.collapsedRibbons,0,'A genuine white opening has no source ridge');
const stepReference=image();for(let y=0;y<100;y++)for(let x=0;x<43;x++){const i=(y*100+x)*4;stepReference.data[i]=stepReference.data[i+1]=stepReference.data[i+2]=40;}
assert.equal(refine.run({...ribbon,referenceData:stepReference.data},engine).stats.collapsedRibbons,0,'A color-region boundary must not be mistaken for a single stroke');
const tee = image(); stroke(tee, 15, 25, 85, 25); stroke(tee, 50, 25, 50, 85);
const t = trace(tee); assert.equal(t.items.length, 3); assert.equal(t.stats.junctions, 1);
const junctions = t.items.flatMap(it => Object.keys(it.pointJunctions).map(i => it.points[i]));
assert.equal(junctions.length, 3); assert.ok(junctions.every(p => JSON.stringify(p) === JSON.stringify(junctions[0])));
const divided = image();
stroke(divided, 12, 12, 88, 12); stroke(divided, 88, 12, 88, 88);
stroke(divided, 88, 88, 12, 88); stroke(divided, 12, 88, 12, 12);
stroke(divided, 50, 12, 50, 43); stroke(divided, 50, 49, 50, 88);
stroke(divided, 50, 45, 50, 47, 232, 0);
function faces(result) {
  return regions.build(result.items.map((it, id) => ({id:String(id), width:it.width, closed:it.closed,
    segments:it.points.slice(0,it.closed ? undefined : -1).map((p,i) => {
      const j=(i+1)%it.points.length,q=it.points[j],a=it.pointHandleAngles[i],b=it.pointHandleAngles[j];
      return {p0:p,p3:q,c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},
        c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength}};
    })})));
}
const joined = trace(divided), joinedFaces = faces(joined);
assert.equal(joined.refinement.repairs.length, 1);
assert.equal(joinedFaces.length, 2, 'Supported repair restores two independently fillable T-connected regions');
assert.notEqual(regions.find(joinedFaces,{x:25,y:50}).key,regions.find(joinedFaces,{x:75,y:50}).key);
assert.equal(faces(trace(divided,{maxGap:0})).length,1,'An actual gap remains one connected fill area when repair is disabled');
const missingDivider=image();missingDivider.data.set(divided.data);stroke(missingDivider,50,45,50,47,255,0);
const sideColors=image();
for(let y=0;y<100;y++)for(let x=0;x<100;x++){const i=(y*100+x)*4,c=x<50?[30,60,100]:[220,180,120];for(let k=0;k<3;k++)sideColors.data[i+k]=c[k];}
const colorDivided=refine.run({...missingDivider,referenceData:sideColors.data},engine);
assert.equal(colorDivided.stats.colorRepairs,1);
assert.equal(faces(colorDivided).length,2,'Source color restores separate fill regions even where the model drew no line');
const openT=image();
stroke(openT,12,12,88,12);stroke(openT,88,12,88,88);stroke(openT,88,88,12,88);stroke(openT,12,88,12,12);
stroke(openT,50,12,50,82);
const tAttached=refine.run({...openT,referenceData:sideColors.data},engine);
assert.equal(tAttached.stats.junctionRepairs,1,'An endpoint may attach to the middle of a supported color boundary');
assert.equal(faces(tAttached).length,2,'The new T restores two separate fillable faces');
assert.equal(faces(refine.run({...openT,referenceData:sideColors.data,options:{maxJunctionGap:0}},engine)).length,1,'T repair can be disabled');
assert.equal(trace(openT).stats.junctionRepairs,0,'A white unsupported T gap must remain open');
const stripe=image(),stripeReference=image();
stroke(stripe,0,0,0,99,30,0);stroke(stripe,0,70,80,70);
for(let y=0;y<100;y++){const i=y*100*4;stripeReference.data[i]=stripeReference.data[i+1]=stripeReference.data[i+2]=20;}
const borderClean=refine.run({...stripe,referenceData:stripeReference.data},engine);
assert.equal(borderClean.stats.borderStripes,1,'A reference-supported isolated full-edge stripe is recognized');
assert.ok(borderClean.items.every(it=>Math.max(...it.points.map(p=>p.y))-Math.min(...it.points.map(p=>p.y))<10),'Only the frame stripe disappears, not the crossing subject contour');
assert.equal(refine.run({...stripe,referenceData:stripeReference.data,options:{suppressBorderStripes:false}},engine).stats.borderStripes,0,'Intentional image frames can be retained');
const broadReference=image();
for(let y=0;y<100;y++)for(let x=0;x<10;x++){const i=(y*100+x)*4;broadReference.data[i]=broadReference.data[i+1]=broadReference.data[i+2]=20;}
assert.equal(refine.run({...stripe,referenceData:broadReference.data},engine).stats.borderStripes,0,'A broad dark subject along the image edge is not a stripe');
const edge = image(); stroke(edge, 0, 20, 80, 20); assert.equal(trace(edge).items.length, 1);
const transparent = image(); transparent.data.fill(0); assert.equal(trace(transparent).items.length, 0);
assert.throws(() => trace(image(), {maxGap: 'bad'}), /Invalid/);
assert.throws(() => trace({...image(), width: 100000}), /Expected/);
const solid = image(); solid.data.fill(0); for (let i = 3; i < solid.data.length; i += 4) solid.data[i] = 255;
assert.throws(() => trace(solid), /extracted sketch/);
assert.equal(JSON.stringify(trace(faint)), JSON.stringify(fixed), 'Refinement is deterministic');
function rotate(im){const out=image(im.height,im.width);for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)out.data.set(im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+4),(x*out.width+im.height-1-y)*4);return out;}
let rotatedT=openT,rotatedColors=sideColors,rotatedStripe=stripe,rotatedStripeSource=stripeReference;
for(let turn=0;turn<4;turn++){
  const r=refine.run({...rotatedT,referenceData:rotatedColors.data},engine);
  assert.equal(r.stats.junctionRepairs,1,'T repair works in each orientation');assert.equal(faces(r).length,2);
  assert.equal(refine.run({...rotatedStripe,referenceData:rotatedStripeSource.data},engine).stats.borderStripes,1,'Thin edge stripe detection works on all four sides');
  rotatedT=rotate(rotatedT);rotatedColors=rotate(rotatedColors);rotatedStripe=rotate(rotatedStripe);rotatedStripeSource=rotate(rotatedStripeSource);
}
assert.ok(fixed.items.every(it => it.type === 'arrow' && it.fillOpacity === 0 && it.points.every(p => Number.isFinite(p.x+p.y))));
console.log('Anime refinement OK: supported/color/corner gaps, T closure, all four orientations, source ridges, real holes, thin border vs subject, alpha, limits, native curves.');
