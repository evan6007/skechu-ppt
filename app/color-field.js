/**
 * Experimental, single-domain 2D color field. Preview only; not a PPT fill.
 *
 * A field is a sum of tensor-product cubic B-spline functions, not SVG shapes
 * or an embedded copy of the input. Its coefficients remain resolution-free.
 * Hierarchical B-spline approximation is established work (Lee et al., 1997);
 * this implementation uses regularized least squares with matrix-free PCG.
 * It does NOT imply that PowerPoint supports editable mesh-gradient stops.
 */
globalThis.SkechuColorField = (function createColorField() {
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const weights = t => [(1-t)**3/6, (3*t**3-6*t*t+4)/6,
  (-3*t**3+3*t*t+3*t+1)/6, t**3/6];

function basis(u, v, nx, ny) {
  const x=clamp(u,0,1)*nx, y=clamp(v,0,1)*ny;
  const ix=Math.min(nx-1,Math.floor(x)), iy=Math.min(ny-1,Math.floor(y));
  const wx=weights(x-ix), wy=weights(y-iy), ids=[], ws=[];
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    ids.push((iy+j)*(nx+3)+ix+i); ws.push(wx[i]*wy[j]);
  }
  return {ids,ws};
}

function gridDesign(samples, bounds, nx, ny) {
  const ids=new Uint32Array(samples.length*16), ws=new Float64Array(ids.length);
  const w=bounds.x2-bounds.x1, h=bounds.y2-bounds.y1;
  for(let i=0;i<samples.length;i++){
    const b=basis((samples[i][0]-bounds.x1)/w,(samples[i][1]-bounds.y1)/h,nx,ny);
    ids.set(b.ids,i*16); ws.set(b.ws,i*16);
  }
  return {ids,ws,nx,ny,size:(nx+3)*(ny+3)};
}

function secondDifferences(design, fn) {
  const w=design.nx+3,h=design.ny+3;
  for(let y=0;y<h;y++)for(let x=1;x<w-1;x++)fn(y*w+x-1,y*w+x,y*w+x+1);
  for(let y=1;y<h-1;y++)for(let x=0;x<w;x++)fn((y-1)*w+x,y*w+x,(y+1)*w+x);
}

function solve(design, residual, channel, options) {
  const {ids,ws,size}=design, ridge=options.ridge, smooth=options.smooth;
  const rhs=new Float64Array(size), diagonal=new Float64Array(size).fill(ridge);
  for(let k=0;k<ids.length;k++){
    rhs[ids[k]]+=ws[k]*residual[Math.floor(k/16)*3+channel];
    diagonal[ids[k]]+=ws[k]*ws[k];
  }
  secondDifferences(design,(a,b,c)=>{diagonal[a]+=smooth;diagonal[b]+=4*smooth;diagonal[c]+=smooth});
  function multiply(input, output) {
    for(let j=0;j<size;j++)output[j]=ridge*input[j];
    for(let row=0;row<ids.length;row+=16){
      let value=0;
      for(let j=0;j<16;j++)value+=ws[row+j]*input[ids[row+j]];
      for(let j=0;j<16;j++)output[ids[row+j]]+=ws[row+j]*value;
    }
    secondDifferences(design,(a,b,c)=>{
      const d=smooth*(input[a]-2*input[b]+input[c]);
      output[a]+=d;output[b]-=2*d;output[c]+=d;
    });
  }
  const x=new Float64Array(size), r=rhs.slice(), z=new Float64Array(size);
  for(let i=0;i<size;i++)z[i]=r[i]/diagonal[i];
  const p=z.slice(), ap=new Float64Array(size);
  let rz=0;for(let i=0;i<size;i++)rz+=r[i]*z[i];
  const initial=rz;
  for(let iteration=0;iteration<options.iterations && rz>initial*1e-10 && rz>1e-12;iteration++){
    options.checkAbort();multiply(p,ap);
    let pap=0;for(let i=0;i<size;i++)pap+=p[i]*ap[i];
    if(pap<=1e-15)break;
    const alpha=rz/pap;
    let next=0;
    for(let i=0;i<size;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];z[i]=r[i]/diagonal[i];next+=r[i]*z[i]}
    const beta=next/rz;for(let i=0;i<size;i++)p[i]=z[i]+beta*p[i];rz=next;
  }
  return x;
}

function predict(field, x, y, clip=true) {
  const b=field.bounds,u=(x-b.x1)/(b.x2-b.x1),v=(y-b.y1)/(b.y2-b.y1);
  const color=field.base.slice();
  for(const level of field.levels){
    const {ids,ws}=basis(u,v,level.nx,level.ny);
    for(let k=0;k<16;k++)for(let c=0;c<3;c++)color[c]+=ws[k]*level.coefficients[ids[k]*3+c];
  }
  return clip?color.map(v=>clamp(v,0,255)):color;
}

function fit(samples, bounds, settings={}) {
  if(!Array.isArray(samples)||!samples.length||samples.length>100000)
    throw Error('A field requires 1–100000 samples');
  if(!bounds||!['x1','y1','x2','y2'].every(k=>Number.isFinite(bounds[k]))||bounds.x2<=bounds.x1||bounds.y2<=bounds.y1)
    throw Error('Invalid field bounds');
  if(samples.some(p=>!Array.isArray(p)||p.length!==5||p.some(v=>!Number.isFinite(v))||p.slice(2).some(v=>v<0||v>255)
    ||p[0]<bounds.x1||p[0]>bounds.x2||p[1]<bounds.y1||p[1]>bounds.y2))throw Error('Invalid field sample');
  const options={ridge:.015,smooth:.035,iterations:32,targetRmse:2,minSpacing:2,
    maxLevels:7,maxControls:12000,singleGrid:true,checkAbort:()=>{},onProgress:()=>{},...settings};
  for(const name of ['ridge','smooth','targetRmse','minSpacing'])if(!Number.isFinite(options[name])||options[name]<=0)throw Error('Invalid '+name);
  for(const [name,limit] of [['iterations',100],['maxLevels',9],['maxControls',60000]])
    if(!Number.isInteger(options[name])||options[name]<1||options[name]>limit)throw Error('Invalid '+name);
  if(typeof options.checkAbort!=='function')throw Error('Invalid cancellation callback');
  if(typeof options.onProgress!=='function')throw Error('Invalid progress callback');
  if(typeof options.singleGrid!=='boolean')throw Error('Invalid grid strategy');
  const base=[0,0,0];for(const p of samples)for(let c=0;c<3;c++)base[c]+=p[c+2]/samples.length;
  const field={version:1,type:'bicubic-color-field',bounds:{...bounds},base,levels:[]};
  let residual=Float64Array.from(samples.flatMap(p=>p.slice(2).map((v,c)=>v-base[c])));
  const sourceResidual=residual.slice();
  const rmse=values=>Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);
  const history=[rmse(residual)], w=bounds.x2-bounds.x1,h=bounds.y2-bounds.y1;
  let controls=0, reason='level-budget';
  for(let step=0;step<options.maxLevels;step++){
    options.checkAbort();
    if(history.at(-1)<=options.targetRmse){reason='target-error';break}
    const spacing=Math.max(options.minSpacing,Math.max(w,h)/(2*2**step));
    const nx=Math.max(1,Math.ceil(w/spacing)),ny=Math.max(1,Math.ceil(h/spacing));
    if(field.levels.at(-1)?.nx===nx&&field.levels.at(-1)?.ny===ny){reason='source-spacing';break}
    if((options.singleGrid?0:controls)+(nx+3)*(ny+3)>options.maxControls){reason='control-budget';break}
    // Refit one complete field directly to source colors. Earlier coarse
    // grids are search candidates, not permanent overlapping coefficient
    // layers. Retain the old field unless the new one actually fits better.
    const target=options.singleGrid?sourceResidual:residual;
    const design=gridDesign(samples,bounds,nx,ny),channels=[0,1,2].map(c=>solve(design,target,c,options));
    const coefficients=Array.from({length:design.size*3},(_,i)=>channels[i%3][Math.floor(i/3)]);
    const next=target.slice();
    for(let row=0;row<samples.length;row++)for(let j=0;j<16;j++)for(let c=0;c<3;c++)
      next[row*3+c]-=design.ws[row*16+j]*coefficients[design.ids[row*16+j]*3+c];
    const error=rmse(next);
    if(error>=history.at(-1)-1e-6){reason='no-improvement';break}
    if(options.singleGrid){field.levels.length=0;controls=0}
    field.levels.push({nx,ny,coefficients});controls+=design.size;residual=next;history.push(error);
    options.onProgress({level:step+1,controls,error});
  }
  return {...field,stats:{samples:samples.length,controls,history,trainingRmse:history.at(-1),reason,
    representation:'one-color-field',gridStrategy:options.singleGrid?'single-grid':'hierarchical-residual',nativePowerPointGradient:false}};
}

// A diagnostic sampler, not a source bitmap stored in the model. Callers can
// re-evaluate the same coefficients at a new resolution or after color edits.
function rasterize(field, width, height) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16000000)
    throw Error('Invalid field preview dimensions');
  const rgba=new Uint8ClampedArray(width*height*4),values=new Float64Array(width*height*3);
  for(let i=0;i<values.length;i++)values[i]=field.base[i%3];
  // Cache separable basis values once instead of allocating sixteen weights
  // for every pixel at every scale. All rendering runs in a cancellable Worker.
  for(const level of field.levels){
    const xs=Array.from({length:width},(_,x)=>{const v=(x+.5)/width*level.nx,i=Math.min(level.nx-1,Math.floor(v));return {i,w:weights(v-i)}});
    const ys=Array.from({length:height},(_,y)=>{const v=(y+.5)/height*level.ny,i=Math.min(level.ny-1,Math.floor(v));return {i,w:weights(v-i)}});
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const sx=xs[x],sy=ys[y],out=(y*width+x)*3;
      let r=0,g=0,b=0;
      for(let j=0;j<4;j++)for(let i=0;i<4;i++){
        const index=((sy.i+j)*(level.nx+3)+sx.i+i)*3,weight=sx.w[i]*sy.w[j];
        r+=weight*level.coefficients[index];g+=weight*level.coefficients[index+1];b+=weight*level.coefficients[index+2];
      }
      values[out]+=r;values[out+1]+=g;values[out+2]+=b;
    }
  }
  for(let i=0;i<width*height;i++){rgba[i*4]=values[i*3];rgba[i*4+1]=values[i*3+1];rgba[i*4+2]=values[i*3+2];rgba[i*4+3]=255}
  return rgba;
}

function handleWorkerMessage(event) {
  try {
    const {width,height,data,quality}=event.data||{};
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>100000
      ||!(data instanceof Uint8ClampedArray)||data.length!==width*height*4)throw Error('二維預覽尺寸不正確或超過運算上限');
    const samples=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      if(data[i+3]<250)throw Error('二維實驗預覽尚未支援透明底圖，請改用平塗色區');
      samples.push([x+.5,y+.5,data[i],data[i+1],data[i+2]]);
    }
    const started=performance.now(),detail=quality==='detail';
    const model=fit(samples,{x1:0,y1:0,x2:width,y2:height},{minSpacing:detail?1.5:3,maxLevels:8,targetRmse:detail?1.5:3,
      onProgress:s=>postMessage({type:'progress',stage:'擬合二維色場',percent:Math.min(80,10+s.level*9)})});
    const fitMs=performance.now()-started,scale=Math.min(3,640/Math.max(width,height));
    const renderWidth=Math.max(2,Math.round(width*scale)),renderHeight=Math.max(2,Math.round(height*scale));
    postMessage({type:'progress',stage:'繪製連續光影預覽',percent:88});
    const rgba=rasterize(model,renderWidth,renderHeight);
    postMessage({type:'result',rgba,width:renderWidth,height:renderHeight,
      stats:{...model.stats,fitMs:Math.round(fitMs),previewMs:Math.round(performance.now()-started),fitWidth:width,fitHeight:height}},[rgba.buffer]);
  } catch(error) {postMessage({type:'error',message:error.message||String(error)})}
}

return {fit,predict,rasterize,handleWorkerMessage,
  workerSource:()=>`globalThis.SkechuColorField=(${createColorField.toString()})();self.onmessage=SkechuColorField.handleWorkerMessage;`};
})();
