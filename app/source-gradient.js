/* Source-fitted, editable multistop gradient models. Region inference lives
 * in gradient-regions.js; no paint-stack construction or pruning is used. */
const GradientTrace=(function createGradientTrace(){
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const hex=c=>'#'+c.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
 const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const predictionCache=new WeakMap();
 function predict(model,bounds,p){
  let cached=predictionCache.get(model);if(!cached){const a=(model.gradient?.angle||0)*Math.PI/180;cached={color:rgb(model.color),dx:Math.cos(a),dy:Math.sin(a),stops:model.gradient?.stops.map(s=>({...s,rgb:rgb(s.color)}))};predictionCache.set(model,cached)}
  if(!cached.stops)return cached.color;
  const {dx,dy,stops}=cached,t=clamp(.5+(((p[0]-bounds.x1)/Math.max(1,bounds.x2-bounds.x1)-.5)*dx+((p[1]-bounds.y1)/Math.max(1,bounds.y2-bounds.y1)-.5)*dy)/(Math.abs(dx)+Math.abs(dy)));
  let i=0;while(i<stops.length-2&&t>stops[i+1].position)i++;const u=clamp((t-stops[i].position)/(stops[i+1].position-stops[i].position)),left=stops[i].rgb,right=stops[i+1].rgb;return left.map((c,k)=>c*(1-u)+right[k]*u);
 }
 function solve(matrix,vector){
  const n=vector.length,a=matrix.map((row,i)=>[...row,vector[i]]);
  for(let i=0;i<n;i++){
   let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
   if(Math.abs(a[pivot][i])<1e-9)return null;[a[i],a[pivot]]=[a[pivot],a[i]];
   const d=a[i][i];for(let k=i;k<=n;k++)a[i][k]/=d;
   for(let j=0;j<n;j++)if(j!==i){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k]}
  }
  return a.map(row=>row[n]);
 }
 function sampleSubset(points,limit=256){
  if(points.length<=limit)return points;
  return Array.from({length:limit},(_,i)=>points[Math.floor((i+.5)*points.length/limit)]);
 }
 function fit(points,bounds,settings={}){
  if(!points.length)return null;
  const samples=sampleSubset(points,settings.precise?768:256),mean=[0,0,0];for(const p of samples)for(let k=0;k<3;k++)mean[k]+=p[k+2]/samples.length;
  const error=predict=>samples.reduce((sum,p)=>{const q=predict(p);return sum+p.slice(2).reduce((s,v,k)=>s+(v-q[k])**2,0)},0)/(samples.length*3);
  const solidError=error(()=>mean);let best={color:hex(mean),error:solidError,solidError,gradient:null};
  if(samples.length<8||solidError<(settings.precise?.16:1))return best;
  const width=Math.max(1,bounds.x2-bounds.x1),height=Math.max(1,bounds.y2-bounds.y1);
  const features=samples.map(p=>[1,(p[0]-bounds.x1)/width-.5,(p[1]-bounds.y1)/height-.5]);
  const m=Array.from({length:3},()=>[0,0,0]),v=Array.from({length:3},()=>[0,0,0]);
  features.forEach((f,i)=>{for(let j=0;j<3;j++){for(let k=0;k<3;k++)m[j][k]+=f[j]*f[k];for(let c=0;c<3;c++)v[c][j]+=f[j]*samples[i][c+2]}});
  for(let j=0;j<3;j++)m[j][j]+=1e-5;
  const planes=v.map(rhs=>solve(m,rhs));if(planes.some(p=>!p))return best;
  const xx=planes.reduce((s,p)=>s+p[1]*p[1],0),xy=planes.reduce((s,p)=>s+p[1]*p[2],0),yy=planes.reduce((s,p)=>s+p[2]*p[2],0);
  const principal=.5*Math.atan2(2*xy,xx-yy);
  // Search several native linear directions when a single plane's principal
  // direction cannot explain a reflection. Better source fits let neighbouring
  // domains share one editable ramp instead of becoming more objects.
  const angles=settings.multiAngle?[principal,principal+Math.PI/2,principal-Math.PI/4,principal+Math.PI/4]:[principal];
  for(const [direction,angle] of angles.entries()){
  if(direction&&best.error<(settings.precise?.5:4))break;
  const dx=Math.cos(angle),dy=Math.sin(angle),extent=Math.abs(dx)+Math.abs(dy);
  const projection=p=>clamp(.5+(((p[0]-bounds.x1)/width-.5)*dx+((p[1]-bounds.y1)/height-.5)*dy)/extent);
  for(const count of direction?[4,8]:[2,4,6,8]){
   if(best.error<(settings.precise?.3:1.4))break;
   const matrix=Array.from({length:count},()=>Array(count).fill(0)),vectors=Array.from({length:3},()=>Array(count).fill(0));
   for(const p of samples){const t=projection(p)*(count-1),i=Math.min(count-2,Math.floor(t)),u=t-i,weights=[[i,1-u],[i+1,u]];
    for(const [a,wa] of weights){for(const [b,wb] of weights)matrix[a][b]+=wa*wb;for(let c=0;c<3;c++)vectors[c][a]+=wa*p[c+2]}
   }
   // Tiny ridge prior stabilizes unsampled ends without hallucinating extremes.
   for(let i=0;i<count;i++){matrix[i][i]+=.03;for(let c=0;c<3;c++)vectors[c][i]+=.03*clamp(planes[c][0]+(i/(count-1)-.5)*extent*(planes[c][1]*dx+planes[c][2]*dy),0,255)}
   const channels=vectors.map(v=>solve(matrix,v));if(channels.some(c=>!c))continue;
   const colors=Array.from({length:count},(_,i)=>channels.map(c=>Math.round(clamp(c[i],0,255))));
   const cost=error(p=>{const t=projection(p)*(count-1),i=Math.min(count-2,Math.floor(t)),u=t-i;return colors[i].map((v,k)=>v*(1-u)+colors[i+1][k]*u)});
   if(cost+((settings.precise?.06:.65)*count)<best.error&&cost<solidError*(settings.precise?.995:.88))best={color:hex(mean),error:cost,solidError,gradient:{type:'linear',angle:((angle*180/Math.PI)%360+360)%360,stops:colors.map((c,i)=>({position:i/(count-1),color:hex(c),opacity:1}))}};
  }
  }
  // Spend the expensive search on the FINAL responsibility, not on every
  // tentative merge. Stop positions follow real changes in the source ramp;
  // equal spacing can miss a narrow reflection even with eight colors.
  if(settings.refine&&best.error>.3){
   const initialAngle=(best.gradient?.angle??principal*180/Math.PI)*Math.PI/180;
   const candidates=[initialAngle,...Array.from({length:12},(_,i)=>i*Math.PI/12)];
   const attempt=angle=>{
    const dx=Math.cos(angle),dy=Math.sin(angle),extent=Math.abs(dx)+Math.abs(dy),ts=samples.map(p=>clamp(.5+(((p[0]-bounds.x1)/width-.5)*dx+((p[1]-bounds.y1)/height-.5)*dy)/extent));
    let knots=[0,1];
    for(let count=2;count<=8;count++){
     const matrix=Array.from({length:count},()=>Array(count).fill(0)),vectors=Array.from({length:3},()=>Array(count).fill(0));
     const weights=ts.map(t=>{let i=0;while(i<count-2&&t>knots[i+1])i++;return[i,clamp((t-knots[i])/(knots[i+1]-knots[i]))]});
     weights.forEach(([i,u],j)=>{for(const [a,wa] of [[i,1-u],[i+1,u]]){for(const [b,wb] of [[i,1-u],[i+1,u]])matrix[a][b]+=wa*wb;for(let c=0;c<3;c++)vectors[c][a]+=wa*samples[j][c+2]}});
     for(let i=0;i<count;i++){matrix[i][i]+=.01;for(let c=0;c<3;c++)vectors[c][i]+=.01*mean[c]}
     const channels=vectors.map(v=>solve(matrix,v));if(channels.some(c=>!c))break;
     const colors=knots.map((_,i)=>channels.map(c=>Math.round(clamp(c[i],0,255))));let cost=0;
     const bins=Array.from({length:64},()=>({n:0,t:0,residual:[0,0,0]}));
     weights.forEach(([i,u],j)=>{const bin=bins[Math.min(63,Math.floor(ts[j]*64))];bin.n++;bin.t+=ts[j];for(let c=0;c<3;c++){const r=samples[j][c+2]-colors[i][c]*(1-u)-colors[i+1][c]*u;cost+=r*r;bin.residual[c]+=r}});cost/=samples.length*3;
     if(cost+.06*count<best.error)best={color:hex(mean),error:cost,solidError,gradient:{type:'linear',angle:(angle*180/Math.PI%360+360)%360,stops:knots.map((position,i)=>({position,color:hex(colors[i]),opacity:1}))}};
     if(cost<.3)break;
     // Aggregate signed residuals at the same projection. Perpendicular
     // variation cannot be fixed by adding a color stop on this direction.
     let knot=null,score=0;for(const bin of bins){if(!bin.n)continue;const t=bin.t/bin.n;if(knots.some(k=>Math.abs(k-t)<.018))continue;const s=bin.residual.reduce((sum,v)=>sum+v*v,0)/bin.n;if(s>score){score=s;knot=t}}
     if(knot===null)break;knots.push(knot);knots.sort((a,b)=>a-b);
    }
   };
   for(const angle of candidates){attempt(angle);if(best.error<.3)break}
   if(best.gradient&&best.error>.3){const a=best.gradient.angle*Math.PI/180;for(const d of [-5,5])attempt(a+d*Math.PI/180)}
  }
  return best;
 }
 function recommend(data,w,h){
  const bins=new Map();let n=0,white=0,soft=0,alpha=0;const stride=Math.max(1,Math.floor(Math.sqrt(w*h/16000)));
  for(let i=3;i<data.length;i+=4)if(data[i]<250){alpha=1;break}
  for(let y=0;y<h-1;y+=stride)for(let x=0;x<w-1;x+=stride){const i=(y*w+x)*4;n++;if(data[i+3]<250)alpha++;const r=data[i],g=data[i+1],b=data[i+2];if(Math.min(r,g,b)>220)white++;const key=(r>>3)*1024+(g>>3)*32+(b>>3);bins.set(key,(bins.get(key)||0)+1);const d=Math.max(Math.hypot(r-data[i+4],g-data[i+5],b-data[i+6]),Math.hypot(r-data[i+w*4],g-data[i+w*4+1],b-data[i+w*4+2]));if(d>.7&&d<22)soft++}
  const colors=[...bins.values()].filter(v=>v>n*.001).length,gradient=!alpha&&white/Math.max(1,n)<.58&&colors>24&&soft/Math.max(1,n)>.12;
  return{mode:gradient?'gradient':'illustration',reason:alpha?'底圖含透明像素，保留平塗色區':gradient?'偵測到連續色差與柔和光影':white/Math.max(1,n)>=.58?'以淺底線稿為主，避免多餘的陰影碎片':'以實色區域為主，平塗較乾淨',colors};
 }
 function bounds(item){
  const points=[];
  item.points.forEach((p,i)=>{const j=(i+1)%item.points.length,q=item.points[j],a=item.pointHandleAngles[i],b=item.pointHandleAngles[j],c1={x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},c2={x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength};points.push(p,q);
   for(const key of ['x','y']){const aa=-p[key]+3*c1[key]-3*c2[key]+q[key],bb=2*(p[key]-2*c1[key]+c2[key]),cc=c1[key]-p[key],d=bb*bb-4*aa*cc,roots=Math.abs(aa)<1e-10?(Math.abs(bb)<1e-10?[]:[-cc/bb]):d<0?[]:[(-bb+Math.sqrt(d))/(2*aa),(-bb-Math.sqrt(d))/(2*aa)];for(const t of roots)if(t>0&&t<1){const u=1-t;points.push({x:u**3*p.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t**3*q.x,y:u**3*p.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t**3*q.y})}}
  });return{x1:Math.min(...points.map(p=>p.x)),y1:Math.min(...points.map(p=>p.y)),x2:Math.max(...points.map(p=>p.x)),y2:Math.max(...points.map(p=>p.y))};
 }
 function transformGradient(source,target,transform,rotation,scale){
  if(!source.fillGradient||Math.abs(rotation)%360<1e-8)return source.fillGradient;
  const old=bounds(source),box=bounds(target),g=source.fillGradient,a=g.angle*Math.PI/180,e=Math.abs(Math.cos(a))+Math.abs(Math.sin(a)),qx=Math.cos(a)/(Math.max(1e-6,old.x2-old.x1)*e),qy=Math.sin(a)/(Math.max(1e-6,old.y2-old.y1)*e),r=rotation*Math.PI/180;
  const gx=(qx*Math.cos(r)-qy*Math.sin(r))/scale,gy=(qx*Math.sin(r)+qy*Math.cos(r))/scale,w=box.x2-box.x1,h=box.y2-box.y1,na=Math.atan2(gy*h,gx*w),extent=Math.abs(Math.cos(na))+Math.abs(Math.sin(na)),center=transform({x:(old.x1+old.x2)/2,y:(old.y1+old.y2)/2});
  const middle=.5+((box.x1+box.x2)/2-center.x)*gx+((box.y1+box.y2)/2-center.y)*gy,span=extent*(Math.cos(na)*w*gx+Math.sin(na)*h*gy),t0=middle-span/2;
  const at=t=>{t=clamp(t);let i=0;while(i<g.stops.length-2&&t>g.stops[i+1].position)i++;const a=g.stops[i],b=g.stops[i+1],u=clamp((t-a.position)/(b.position-a.position));return{color:hex(rgb(a.color).map((v,k)=>v*(1-u)+rgb(b.color)[k]*u)),opacity:a.opacity*(1-u)+b.opacity*u}};
  const stops=[0,...g.stops.map(s=>(s.position-t0)/span).filter(t=>t>1e-8&&t<1-1e-8),1].map(position=>({position,...at(t0+position*span)}));
  return{type:'linear',angle:(na*180/Math.PI+360)%360,stops};
 }
 const vectorize=(...args)=>GradientRegions.vectorize(...args);
 return{fit,predict,vectorize,recommend,bounds,transformGradient,workerSource:()=>`const GradientTrace=(${createGradientTrace.toString()})();`};
})();
