import assert from 'node:assert/strict';
import {fit,predict,rasterize} from '../experiments/gradient-trace/color-field.mjs';

// Crossed color directions + an off-centre glint cannot be explained by one
// RGB ramp. One continuous field must fit them without emitting patch objects.
const truth=(x,y)=>[60+90*x+20*y,45+40*y+65*Math.exp(-((x-.31)**2/.027+(y-.61)**2/.06)),
  65+70*y+40*x*y+25*Math.sin(x*4)*Math.sin(y*2)];
const samples=[];
for(let y=0;y<48;y++)for(let x=0;x<64;x++)samples.push([(x+.5)/64,(y+.5)/48,...truth((x+.5)/64,(y+.5)/48)]);
const original=JSON.stringify(samples),box={x1:0,y1:0,x2:1,y2:1};
const result=fit(samples,box,{minSpacing:1/32,targetRmse:.5});
assert.equal(JSON.stringify(samples),original);
assert.equal(result.type,'bicubic-color-field');
assert.equal(result.stats.nativePowerPointGradient,false);
assert(result.stats.trainingRmse<.5);
assert(result.stats.controls<2000);
assert.equal(result.levels.length,1);assert.equal(result.stats.gridStrategy,'single-grid');assert.equal(result.stats.controls,result.levels[0].coefficients.length/3);
assert(!JSON.stringify(result).includes('data:image'));
for(let i=1;i<result.stats.history.length;i++)assert(result.stats.history[i]<result.stats.history[i-1]);

// Held-out locations, not only training nodes.
let squared=0,n=0;
for(let y=0;y<33;y++)for(let x=0;x<41;x++){
  const u=(x+.17)/41,v=(y+.73)/33,a=predict(result,u,v),b=truth(u,v);
  for(let c=0;c<3;c++){squared+=(a[c]-b[c])**2;n++}
}
assert(Math.sqrt(squared/n)<.6);
const raster=rasterize(result,23,17);
for(let y=0;y<17;y++)for(let x=0;x<23;x++){
 const direct=predict(result,(x+.5)/23,(y+.5)/17);
 for(let c=0;c<3;c++)assert(Math.abs(raster[(y*23+x)*4+c]-direct[c])<=.51);
}
assert.deepEqual(predict(JSON.parse(JSON.stringify(result)),.4,.6),predict(result,.4,.6));

// Value and first derivative continuity across every knot in each level.
const epsilon=1e-5;
for(const level of result.levels)for(let i=1;i<level.nx;i++){
  const x=i/level.nx,a=predict(result,x-epsilon,.371,false),b=predict(result,x,.371,false),c=predict(result,x+epsilon,.371,false);
  for(let k=0;k<3;k++){
    assert(Math.abs(a[k]-c[k])<.02);
    assert(Math.abs((b[k]-a[k])/epsilon-(c[k]-b[k])/epsilon)<.2);
  }
}
for(const level of result.levels)for(let i=1;i<level.ny;i++){
  const y=i/level.ny,a=predict(result,.473,y-epsilon,false),b=predict(result,.473,y,false),c=predict(result,.473,y+epsilon,false);
  for(let k=0;k<3;k++){
    assert(Math.abs(a[k]-c[k])<.02);
    assert(Math.abs((b[k]-a[k])/epsilon-(c[k]-b[k])/epsilon)<.2);
  }
}
// Coefficient edits alter a continuous neighborhood without adding objects.
const changed=structuredClone(result),last=changed.levels.at(-1);
const at=Math.floor((last.ny+3)/2)*(last.nx+3)+Math.floor((last.nx+3)/2);
last.coefficients[at*3]+=40;
assert.notDeepEqual(predict(changed,.5,.5),predict(result,.5,.5));
assert.equal(changed.levels.length,result.levels.length);
const budget=fit(samples,box,{maxControls:10});
assert.equal(budget.stats.reason,'control-budget');
assert.equal(budget.stats.controls,0);
assert(budget.stats.trainingRmse>10); // Never report that a budget-limited fit succeeded.
const solid=fit([[.2,.4,90,80,70],[.8,.9,90,80,70]],box);
assert.equal(solid.levels.length,0);
assert.deepEqual(predict(solid,.5,.6),[90,80,70]);
assert.equal(rasterize(solid,31,17).length,31*17*4);
assert.throws(()=>fit(samples,box,{checkAbort:()=>{throw Error('cancelled')}}),/cancelled/);
assert.throws(()=>fit([[.5,.5,NaN,0,0]],box),/sample/);
assert.throws(()=>fit(samples,box,{iterations:100000}),/iterations/);
assert.throws(()=>rasterize(result,1e6,1e6),/dimensions/);
console.log(JSON.stringify({pass:true,controls:result.stats.controls,trainRmse:result.stats.trainingRmse,heldOutRmse:Math.sqrt(squared/n)}));
