/* Gradient-domain partitioning. Pixels have exactly one owner throughout.
 * Local affine RGB fields locate coherent shading; adjacent fields are fitted
 * directly to source samples before any vector object exists. No palette
 * quantization, underpainting stack, overpaint removal or image-specific ROI.
 */
const GradientRegions=(function createGradientRegions(){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const unit=(a,b)=>{const n=Math.hypot(b.x-a.x,b.y-a.y)||1;return{x:(b.x-a.x)/n,y:(b.y-a.y)/n}};
 const reverse=c=>({p0:c.p3,c1:c.c2,c2:c.c1,p3:c.p0});
 const line=(a,b)=>({p0:a,c1:{x:(2*a.x+b.x)/3,y:(2*a.y+b.y)/3},c2:{x:(a.x+2*b.x)/3,y:(a.y+2*b.y)/3},p3:b});
 const subset=(a,n)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.floor((i+.5)*a.length/n)]);
 function localFields(data,w,h,progress,precise=false){
  const n=w*h,step=Math.max(4,Math.round(Math.sqrt(n/(precise?2600:2200)))),seeds=[],labels=new Int32Array(n),dist=new Float32Array(n);
  const at=(x,y,c)=>data[(clamp(y,0,h-1)*w+clamp(x,0,w-1))*4+c];
  const seed=(x,y)=>{const color=[0,1,2].map(c=>at(x,y,c));seeds.push({x,y,color,dx:[0,0,0],dy:[0,0,0]})};
  for(let y=Math.floor(step/2);y<h;y+=step)for(let x=Math.floor(step/2);x<w;x+=step)seed(x,y);
  if(!seeds.length)seed(w>>1,h>>1);
  for(let pass=0;pass<5;pass++){
   dist.fill(Infinity);labels.fill(-1);
   for(let id=0;id<seeds.length;id++){
    const s=seeds[id],radius=step*2;
    for(let y=Math.max(0,Math.floor(s.y-radius));y<Math.min(h,Math.ceil(s.y+radius));y++)for(let x=Math.max(0,Math.floor(s.x-radius));x<Math.min(w,Math.ceil(s.x+radius));x++){
     const i=y*w+x,dx=x-s.x,dy=y-s.y;let cost=(precise?48:64)*(dx*dx+dy*dy)/(step*step);
     for(let c=0;c<3;c++)cost+=(data[i*4+c]-clamp(s.color[c]+dx*s.dx[c]+dy*s.dy[c],0,255))**2/3;
     if(cost<dist[i]){dist[i]=cost;labels[i]=id}
    }
   }
   // A small high-contrast island must get a field of its own even when no
   // regular seed fell inside it. This is source residual, not face detection.
   if(pass===1){const occupied=new Uint8Array(n);for(const s of seeds)occupied[Math.round(s.y)*w+Math.round(s.x)]=1;
    for(let y=1;y<h-1;y+=2)for(let x=1;x<w-1;x+=2){const i=y*w+x;if(dist[i]<(precise?22:26)**2)continue;let near=false;
     for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&occupied[(y+dy)*w+x+dx]){near=true;break}
     if(!near&&seeds.length<6000){seed(x,y);occupied[i]=1}
    }
   }
   const sums=seeds.map(()=>new Float64Array(15));
   for(let i=0;i<n;i++){const id=labels[i];if(id<0)continue;const a=sums[id],x=i%w,y=Math.floor(i/w);a[0]++;a[1]+=x;a[2]+=y;a[3]+=x*x;a[4]+=x*y;a[5]+=y*y;for(let c=0;c<3;c++){const v=data[i*4+c];a[6+c]+=v;a[9+c]+=x*v;a[12+c]+=y*v}}
   for(let id=0;id<seeds.length;id++){const a=sums[id],s=seeds[id],count=a[0];if(!count)continue;s.x=a[1]/count;s.y=a[2]/count;const xx=a[3]-a[1]*s.x+count*.2,xy=a[4]-a[1]*s.y,yy=a[5]-a[2]*s.y+count*.2,det=xx*yy-xy*xy;
    for(let c=0;c<3;c++){s.color[c]=a[6+c]/count;const vx=a[9+c]-a[1]*s.color[c],vy=a[12+c]-a[2]*s.color[c];s.dx[c]=clamp((vx*yy-vy*xy)/det,-4,4);s.dy[c]=clamp((vy*xx-vx*xy)/det,-4,4)}
   }
   progress(12+pass*5,'以原圖光影建立連續漸層區域');
  }
  // Connectivity is explicit: same numerical field does not join islands.
  const connected=new Int32Array(n).fill(-1),queue=new Int32Array(n);let count=0;
  for(let i=0;i<n;i++)if(connected[i]<0){if(count>=14000)throw Error('底圖含太多細碎紋理，請裁切要上色的範圍後重試');let head=0,tail=1;queue[0]=i;connected[i]=count;while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&connected[q]<0&&labels[q]===labels[p]){connected[q]=count;queue[tail++]=q}}count++}
  return{labels:connected,count};
 }
 class Heap{
  constructor(){this.values=[]}
  push(v){const a=this.values;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].cost<=v.cost)break;a[i]=a[p];i=p}a[i]=v}
  pop(){const a=this.values,top=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].cost<a[c].cost)c++;if(a[c].cost>=last.cost)break;a[i]=a[c];i=c}a[i]=last}return top}
 }
 function partition(data,w,h,progress=()=>{},options={}){
  const precise=!!options.precise,fit=(samples,bounds)=>GradientTrace.fit(samples,bounds,{multiAngle:!!options.multiAngle,precise});
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>4200000||data.length!==w*h*4)throw Error('漸層區域影像超出處理範圍');
  for(let i=3;i<data.length;i+=4)if(data[i]<250)throw Error('來源漸層需要不透明底圖；含透明背景請選平塗填色');
  const cleaned=IllustrationTrace.denoise(data,w,h,precise?.4:clamp(.65+.11*(options.minLength??5),.65,3)),initial=localFields(cleaned,w,h,progress,precise),{labels}=initial;
  const groups=Array.from({length:initial.count},(_,id)=>({id,parent:id,version:0,area:0,pixels:[],samples:[],bounds:{x1:w,y1:h,x2:0,y2:0},neighbours:new Set()}));
  const sample=p=>[p%w+.5,Math.floor(p/w)+.5,data[p*4],data[p*4+1],data[p*4+2]];
  for(let p=0;p<labels.length;p++){const g=groups[labels[p]],x=p%w,y=Math.floor(p/w),b=g.bounds;g.pixels.push(p);g.area++;b.x1=Math.min(b.x1,x);b.x2=Math.max(b.x2,x+1);b.y1=Math.min(b.y1,y);b.y2=Math.max(b.y2,y+1);
   for(const q of [x<w-1?p+1:-1,y<h-1?p+w:-1])if(q>=0&&labels[q]!==labels[p]){g.neighbours.add(labels[q]);groups[labels[q]].neighbours.add(g.id)}
  }
  for(const g of groups){g.samples=subset(g.pixels,precise?512:192).map(sample);g.model=fit(g.samples,g.bounds)}
  // Optimize pixel ownership against the fitted fields and boundary length,
  // before creating vector geometry. Intermediate antialias colors should
  // describe one smooth boundary, not become a row of miniature objects.
  for(let pass=0;pass<5;pass++){
   let changes=0;
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const p=y*w+x,owner=labels[p],ns=[labels[p-1],labels[p+1],labels[p-w],labels[p+w]];if(ns.every(id=>id===owner))continue;
    const point=sample(p),candidates=new Set([owner,...ns]),colors=new Map([...candidates].map(id=>[id,GradientTrace.predict(groups[id].model,groups[id].bounds,point)]));let best=owner,bestCost=Infinity;
    for(const id of candidates){const q=colors.get(id);let cost=0;for(let c=0;c<3;c++)cost+=(q[c]-point[c+2])**2/3;
     // A boundary pixel can be partial coverage of two fields, rather than
     // a third material. Only the segment between the two colors qualifies:
     // a darker ink stroke or brighter glint cannot be explained this way.
     for(const [other,r] of colors){if(other===id||other===owner)continue;const v=r.map((c,k)=>c-q[k]),den=v.reduce((s,c)=>s+c*c,0);if(den<900)continue;const t=v.reduce((s,c,k)=>s+c*(point[k+2]-q[k]),0)/den;if(t<0||t>.5)continue;const residual=v.reduce((s,c,k)=>s+(point[k+2]-q[k]-t*c)**2,0)/3;if(residual<16)cost=Math.min(cost,residual+t*40)}
     cost+=(precise?20+2*(options.minLength??5):50+7*(options.minLength??5))*ns.reduce((n,a)=>n+(a!==id?1:0),0);if(cost<bestCost){bestCost=cost;best=id}
    }
    if(best!==owner){labels[p]=best;changes++}
   }
   if(!changes)break;
  }
  // Rebuild connected responsibilities after boundary optimization. A fitted
  // field may own several islands, but those islands never share a fake edge.
  const connected=new Int32Array(w*h).fill(-1),queue=new Int32Array(w*h),fresh=[];
  for(let p=0;p<labels.length;p++)if(connected[p]<0){const id=fresh.length,g={id,parent:id,version:0,area:0,pixels:[],samples:[],bounds:{x1:w,y1:h,x2:0,y2:0},neighbours:new Set()};let head=0,tail=1;queue[0]=p;connected[p]=id;
   while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w),b=g.bounds;g.pixels.push(i);g.area++;b.x1=Math.min(b.x1,x);b.y1=Math.min(b.y1,y);b.x2=Math.max(b.x2,x+1);b.y2=Math.max(b.y2,y+1);for(const q of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(q>=0&&connected[q]<0&&labels[q]===labels[i]){connected[q]=id;queue[tail++]=q}}
   g.samples=subset(g.pixels,precise?512:192).map(sample);g.model=fit(g.samples,g.bounds);fresh.push(g);
  }
  groups.length=0;groups.push(...fresh);labels.set(connected);
  for(let p=0;p<labels.length;p++)for(const q of [p%w<w-1?p+1:-1,p<w*(h-1)?p+w:-1])if(q>=0&&labels[p]!==labels[q]){groups[labels[p]].neighbours.add(labels[q]);groups[labels[q]].neighbours.add(labels[p])}
  const root=id=>{while(groups[id].parent!==id){groups[id].parent=groups[groups[id].parent].parent;id=groups[id].parent}return id};
  const error=(model,bounds,samples)=>{let sum=0,peak=0;for(const p of samples){const q=GradientTrace.predict(model,bounds,p);let e=0;for(let c=0;c<3;c++)e+=(q[c]-p[c+2])**2/3;sum+=e;peak=Math.max(peak,e)}return{mean:sum/Math.max(1,samples.length),peak}};
  const tolerance=options.fieldError??(precise?clamp(3.5+(120-(options.threshold??120))*.02,1.6,5):clamp(8.5+(120-(options.threshold??120))*.035,4,12)),heap=new Heap();let attempts=0,accepted=0,rejectedDense=0;
  const current=p=>groups[p.a].parent===p.a&&groups[p.b].parent===p.b&&groups[p.a].version===p.va&&groups[p.b].version===p.vb;
  function compactQueue(){const live=heap.values.filter(current);heap.values=[];for(const p of live)heap.push(p)}
  function propose(a,b){
   if(a===b)return;const ga=groups[a],gb=groups[b],ba=ga.bounds,bb=gb.bounds,bounds={x1:Math.min(ba.x1,bb.x1),y1:Math.min(ba.y1,bb.y1),x2:Math.max(ba.x2,bb.x2),y2:Math.max(ba.y2,bb.y2)};
   // Equal representation of both responsibilities prevents a large cheek
   // from averaging a tiny iris/reflection out of the objective.
   if(heap.values.length>30000)compactQueue();
   if(++attempts>(precise?750000:250000)||heap.values.length>60000)throw Error('光影分區超過計算預算，請裁切需要的區域後重試');
   const samples=[...subset(ga.samples,precise?256:96),...subset(gb.samples,precise?256:96)],model=fit(samples,bounds);
   const ea=error(model,bounds,ga.samples),eb=error(model,bounds,gb.samples),limit=tolerance*tolerance;
   if(ea.mean>Math.max(limit,ga.model.error+limit*.35)||eb.mean>Math.max(limit,gb.model.error+limit*.35))return;
   // Tiny residuals are allowed at antialiased boundaries, not whole islands.
   if(ea.peak>Math.max(limit*9,error(ga.model,ga.bounds,ga.samples).peak+limit)||eb.peak>Math.max(limit*9,error(gb.model,gb.bounds,gb.samples).peak+limit))return;
   // Prefer comparable responsibilities when source errors tie. A huge field
   // swallowing one seed at a time repeatedly refits the same long frontier.
   // This changes queue order, never the pixel-fidelity acceptance limits.
   const cost=Math.max(ea.mean,eb.mean)+.04*(model.gradient?.stops.length||1)+(precise?.12*Math.abs(Math.log2(ga.area/gb.area)):0);
   heap.push({a,b,va:ga.version,vb:gb.version,cost,model,bounds});
  }
  for(const g of groups)for(const b of g.neighbours)if(b>g.id)propose(g.id,b);
  while(heap.values.length){const p=heap.pop(),ga=groups[p.a],gb=groups[p.b];if(ga.parent!==p.a||gb.parent!==p.b||ga.version!==p.va||gb.version!==p.vb)continue;
   // A merge can look good on a sparse sample while deleting a narrow rim or
   // tiny reflection. Validate EVERY source pixel before accepting it. Keep
   // that validated model: refitting after acceptance used to change the very
   // ramp on which the merge decision had been based.
   if(precise){let valid=true;for(const g of [ga,gb]){let sum=0,prior=0,misses=0;for(const pixel of g.pixels){const s=sample(pixel),a=GradientTrace.predict(p.model,p.bounds,s),b=GradientTrace.predict(g.model,g.bounds,s);let e=0,old=0;for(let c=0;c<3;c++){e+=(a[c]-s[c+2])**2/3;old+=(b[c]-s[c+2])**2/3}sum+=e;prior+=old;if(e>tolerance*tolerance*9&&e>old+tolerance*tolerance)misses++}if(sum/g.area>Math.max(tolerance*tolerance,prior/g.area+tolerance*tolerance*.2)||misses>Math.floor(g.area*.005)){valid=false;break}}if(!valid){rejectedDense++;continue}}
   // This is region inference before vectorization, not pruning generated
   // objects: the source fit is recomputed for each new responsibility.
   gb.parent=p.a;ga.version++;ga.area+=gb.area;ga.pixels=ga.pixels.concat(gb.pixels);gb.pixels=[];ga.samples=subset(ga.pixels,precise?768:256).map(sample);ga.bounds=p.bounds;ga.model=precise?{...p.model,error:error(p.model,p.bounds,ga.samples).mean}:fit(ga.samples,ga.bounds);accepted++;
   const neighbours=new Set([...ga.neighbours,...gb.neighbours].map(root));neighbours.delete(p.a);ga.neighbours=neighbours;gb.neighbours.clear();
   for(const b of neighbours){groups[b].neighbours.delete(p.b);groups[b].neighbours.add(p.a);propose(p.a,b)}
   if(accepted%250===0)progress(40+Math.min(30,30*accepted/initial.count),'用同一個漸層解釋相鄰光影');
  }
  const active=groups.filter(g=>g.parent===g.id),ids=new Map(active.map((g,i)=>[g.id,i]));for(let p=0;p<labels.length;p++)labels[p]=ids.get(root(labels[p]));
  return{labels,groups:active,stats:{engine:'gradient-fields',initialFields:initial.count,regions:active.length,attempts,precise,rejectedDense,pixelOwnership:'exclusive'}};
 }
 function vectorize(data,w,h,geometry,progress=()=>{},options={}){
  const result=partition(data,w,h,progress,options),{labels,groups}=result;
  const seams=groups.map(()=>[]);
  for(let p=0;p<labels.length;p++)for(const q of [p%w<w-1?p+1:-1,p<w*(h-1)?p+w:-1]){
   if(q<0||labels[p]===labels[q])continue;const contrast=Math.hypot(...[0,1,2].map(c=>data[p*4+c]-data[q*4+c]));if(contrast>9)continue;
   const point=[((p%w)+(q%w)+1)/2,(Math.floor(p/w)+Math.floor(q/w)+1)/2,...[0,1,2].map(c=>(data[p*4+c]+data[q*4+c])/2)];
   seams[labels[p]].push(point);seams[labels[q]].push(point);
  }
  progress(75,'建立共用邊界，不堆疊色塊');
  const stride=w+1,vertices=new Map(),edges=[];
  const vertex=id=>{if(!vertices.has(id))vertices.set(id,[]);return vertices.get(id)};
  const add=(a,b,right,left)=>{if(edges.length>=200000)throw Error('共用邊界太複雜，請裁切需要的區域後重試');const e={a,b,right,left,used:false,pair:Math.min(right,left)+':'+Math.max(right,left)};edges.push(e);vertex(a).push(e);vertex(b).push(e)};
  for(let y=0;y<=h;y++)for(let x=0;x<w;x++){const above=y?labels[(y-1)*w+x]:-1,below=y<h?labels[y*w+x]:-1;if(above!==below)add(y*stride+x,y*stride+x+1,below,above)}
  for(let x=0;x<=w;x++)for(let y=0;y<h;y++){const left=x?labels[y*w+x-1]:-1,right=x<w?labels[y*w+x]:-1;if(left!==right)add(y*stride+x,(y+1)*stride+x,left,right)}
  const boundary=groups.map(()=>[]),point=id=>({x:id%stride,y:Math.floor(id/stride)});
  let sharedChains=0,boundarySegmentsBefore=0,boundarySegmentsAfter=0;
  function walk(first,start){const points=[point(start)];let e=first,v=start;const ownerRight=e.a===v?e.right:e.left,ownerLeft=e.a===v?e.left:e.right;
   while(e&&!e.used){e.used=true;v=e.a===v?e.b:e.a;points.push(point(v));if(v===start)break;const ns=vertices.get(v);if(ns.length!==2)break;e=ns.find(q=>!q.used&&q.pair===first.pair)}
   if(points.length<2)return;
   // The chain is fitted ONCE and reversed verbatim for its other owner.
   // Endpoints/junctions and all image edges remain fixed.
   const paper=ownerRight<0||ownerLeft<0,closed=v===start;
   let smooth=points;
   if(!paper&&points.length>4){smooth=points.map((p,i)=>{if(!i||i===points.length-1)return p;const a=points[i-1],b=points[i+1];return{x:(a.x+2*p.x+b.x)/4,y:(a.y+2*p.y+b.y)/4}})}
   // Fit the shared chain at source-pixel precision BEFORE giving it to either
   // owner. Increasing the simplification setting now genuinely reduces fill
   // anchors. Small islands and short chains keep a stricter error budget.
   const box={x1:Infinity,y1:Infinity,x2:-Infinity,y2:-Infinity};for(const p of points){box.x1=Math.min(box.x1,p.x);box.y1=Math.min(box.y1,p.y);box.x2=Math.max(box.x2,p.x);box.y2=Math.max(box.y2,p.y)}const extent={w:box.x2-box.x1,h:box.y2-box.y1};
   const oldError=paper?.05:clamp(.2+.04*(options.accuracy??3.5)+.0012*(options.simplify??90),.22,.65);
   const desired=paper?.05:options.precise?clamp(.12+.025*(options.accuracy??3.5)+.001*(options.simplify??90),.12,.36):clamp(.12+.12*(options.accuracy??3.5)+.0052*(options.simplify??90),.15,1.2);
   const error=Math.min(desired,closed&&Math.min(extent.w,extent.h)<5?.25:Math.max(extent.w,extent.h)<10?.35:Math.max(extent.w,extent.h)<22?.65:1.2);
   const fitPart=ps=>{
    const left=unit(ps[0],ps[Math.min(4,ps.length-1)]),right=unit(ps.at(-1),ps[Math.max(0,ps.length-5)]),prior=geometry.fit(ps,left,right,oldError);
    const candidate=error===oldError?prior:geometry.fit(ps,left,right,error),curves=error<oldError||candidate.length<prior.length?candidate:prior;
    boundarySegmentsBefore+=prior.length;boundarySegmentsAfter+=curves.length;return curves;
   };
   let curves;if(closed){const mid=Math.floor((smooth.length-1)/2);curves=[...fitPart(smooth.slice(0,mid+1)),...fitPart(smooth.slice(mid))]}else curves=fitPart(smooth);
   if(!curves.length)curves=points.slice(1).map((p,i)=>line(points[i],p));
   if(ownerRight>=0)boundary[ownerRight].push(...curves);if(ownerLeft>=0)boundary[ownerLeft].push(...curves.map(reverse).reverse());sharedChains++;
  }
  for(const e of edges)if(!e.used&&(vertices.get(e.a).length!==2||vertices.get(e.b).length!==2))walk(e,vertices.get(e.a).length!==2?e.a:e.b);
  for(const e of edges)if(!e.used)walk(e,e.a);
  const allLoops=boundary.map(edges=>{const loops=IllustrationTrace.geometry.boundaryLoops(edges);if(!loops)throw Error('漸層共用邊界無法封閉，未產生不完整物件');return loops});
  const curveKey=c=>{const points=[c.p0,c.c1,c.c2,c.p3].map(p=>p.x+','+p.y);return[points.join(';'),points.slice().reverse().join(';')].sort()[0]},mustSplit=new Set();
  for(const loops of allLoops)for(const loop of loops)if(loop.length<3)loop.forEach(c=>mustSplit.add(curveKey(c)));
  const half=c=>{const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),a=mid(c.p0,c.c1),b=mid(c.c1,c.c2),d=mid(c.c2,c.p3),e=mid(a,b),f=mid(b,d),p=mid(e,f);return[{p0:c.p0,c1:a,c2:e,p3:p},{p0:p,c1:f,c2:d,p3:c.p3}]};
  // Native closed freeforms need three anchors. Subdivide both owners here,
  // before toItem could split just one side of a two-curve lens / hole.
  const nativeLoops=allLoops.map(loops=>loops.map(loop=>loop.flatMap(c=>mustSplit.has(curveKey(c))?half(c):[c])));
  const colorItems=[];
  for(let id=0;id<groups.length;id++){
   if(options.precise&&id%100===0)progress(78+Math.round(20*id/groups.length),'逐區校正反光、漸層色標與邊界');
   const g=groups[id],loops=nativeLoops[id];
   for(const region of IllustrationTrace.geometry.components(loops,g.model.color)){
    const joined=[];for(const loop of region.loops){if(joined.length){const origin=joined[0].p0;joined.push(line(origin,loop[0].p0),...loop,line(loop[0].p0,origin))}else joined.push(...loop)}
    const item=geometry.toItem({closed:true},joined,g.model.color,0,new Set());if(!item)continue;
    const bounds=GradientTrace.bounds(item),border=subset(seams[id],96),cost=(model,ps)=>ps.reduce((sum,p)=>sum+GradientTrace.predict(model,bounds,p).reduce((n,v,c)=>n+(v-p[c+2])**2,0),0)/Math.max(1,3*ps.length);
    const settings={multiAngle:!!options.multiAngle,precise:!!options.precise,refine:!!options.precise};
    let model=GradientTrace.fit(g.samples,bounds,settings);
    if(border.length>8){const coupled=GradientTrace.fit([...subset(g.samples,options.precise?512:128),...border,...border],bounds,settings);if(cost(coupled,border)<cost(model,border)*.85&&cost(coupled,g.samples)<cost(model,g.samples)+(options.precise?.5:9))model=coupled}
    item.fill=model.color;if(model.gradient)item.fillGradient=model.gradient;item.fillOpacity=1;item.autoTraceMode='illustration';item.autoTraceColored=true;item.autoTraceRegion=id;stamp(item,'gradient-fields');colorItems.push(item);
   }
  }
  if(colorItems.length>(options.precise?3200:1800)||colorItems.reduce((n,it)=>n+it.points.length,0)>(options.precise?60000:40000))throw Error('漸層光影太複雜，請裁切需要的區域後重試；不會用重疊色塊代替 '+JSON.stringify({...result.stats,objects:colorItems.length,anchors:colorItems.reduce((n,it)=>n+it.points.length,0)}));
  for(const it of colorItems){it.fillPartition.count=colorItems.length;it.fillPartition.frame=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}]}
  const shading={...result.stats,gradients:colorItems.filter(it=>it.fillGradient).length,multiAngle:!!options.multiAngle,sharedChains,boundarySegmentsBefore,boundarySegmentsAfter,sourceRegions:groups.length,merged:0};
  progress(100,'封閉漸層區域完成');return{items:[],colorItems,issues:[],stats:{mode:'gradient',paths:colorItems.length,anchors:colorItems.reduce((n,it)=>n+it.points.length,0),regions:colorItems.length,junctions:0,reviewCount:0,shading}};
 }
 // Additive coverage avoids white antialias gutters between exact cutout
 // neighbours. It is a renderer operation, not extra geometry or paint layers.
 // Once geometry/opacity changes, use ordinary compositing for that object.
 function geometryKey(it){const origin=it.points[0],relative=it.points.map(p=>({x:p.x-origin.x,y:p.y-origin.y})),s=JSON.stringify([relative,it.pointHandleAngles||{},it.pointKinds||{},it.pointSmoothness||{},it.pointAngles||{},!!it.closed,!!it.curved,!!it.explicitBezier,!!it.centerlineLocked,it.r||0],(_k,v)=>typeof v==='number'?Math.round(v*1e6)/1e6:v);let hash=2166136261;for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619);return(hash>>>0).toString(36)}
 function stamp(it,id){const previous=it.fillPartition;it.fillPartition={id,origin:{...it.points[0]},geometry:geometryKey(it),...(previous?.count?{count:previous.count,frame:previous.frame}: {})}}
 function coverageKey(it){const field=it.fillPartition;if(!field?.origin||it.type!=='arrow'||!it.closed||it.width!==0||it.fillOpacity!==1||it.fillGradient?.stops.some(s=>s.opacity!==1)||field.geometry!==geometryKey(it))return null;const p=it.points[0];return field.id+'|'+(it.layerGroup?.id||it.autoTraceBatch||'')+'@'+Math.round((p.x-field.origin.x)*1e5)+','+Math.round((p.y-field.origin.y)*1e5)}
 function coverageFrame(it){const f=it.fillPartition;if(!Number.isInteger(f?.count)||f.count<1||f.frame?.length!==4||!f.frame.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;const dx=it.points[0].x-f.origin.x,dy=it.points[0].y-f.origin.y;return{count:f.count,points:f.frame.map(p=>({x:p.x+dx,y:p.y+dy}))}}
 function compose(entries,prefix='scene'){
  let out='';for(let start=0;start<entries.length;){const first=entries[start];if(!first.key){out+=first.markup;start++;continue}let end=start+1;while(end<entries.length&&entries[end].key===first.key)end++;
   const batch=entries.slice(start,end),frame=first.frame,complete=frame&&frame.count===batch.length&&batch.every(e=>e.frame?.count===frame.count&&JSON.stringify(e.frame.points)===JSON.stringify(frame.points));
   // Leave headroom while summing coverage. Without it, tiny scan-converter
   // overlaps saturate alpha at 1 before RGB is normalized, making white rims.
   const paint='<g style="isolation:isolate" data-gradient-partition="true">'+batch.map(e=>'<g style="mix-blend-mode:plus-lighter"'+(complete?' opacity="0.5"':'')+'>'+e.markup+'</g>').join('')+'</g>';
   if(complete){
    // Complementary scan conversion can leave subpixel alpha deficits even
    // without geometric holes. Normalize only a COMPLETE unedited partition,
    // then clip to the original paper quad to retain exterior antialiasing.
    // Subset exports and hidden/deleted/edited regions never take this path.
    const id='coverage-'+Array.from(prefix).map(c=>c.charCodeAt(0).toString(16)).join('-')+'-'+start;
    out+=`<defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="discrete" tableValues="0 ${Array(255).fill(1).join(' ')}"/></feComponentTransfer></filter><clipPath id="${id}-clip" clipPathUnits="userSpaceOnUse"><polygon points="${frame.points.map(p=>p.x+','+p.y).join(' ')}"/></clipPath></defs><g clip-path="url(#${id}-clip)" data-coverage-normalized="true"><g filter="url(#${id})">${paint}</g></g>`;
   }else out+=paint;start=end;
  }return out;
 }
 return{partition,vectorize,stamp,coverageKey,coverageFrame,compose,workerSource:()=>`const GradientRegions=(${createGradientRegions.toString()})();`};
})();
