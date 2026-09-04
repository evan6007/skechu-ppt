/* Local line-art and silhouette vectorization. No raster data is retained in output.
 * Binary thinning follows the published Zhang-Suen deletion conditions:
 * https://docs.opencv.org/3.4.12/df/d2d/group__ximgproc.html
 * Junction graph extraction and constrained cubic fitting are implemented here.
 */
const AutoTrace = (function createAutoTrace() {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
  const unit=v=>{const n=Math.hypot(v.x,v.y)||1;return{x:v.x/n,y:v.y/n}};
  const neg=v=>({x:-v.x,y:-v.y});
  const dot=(a,b)=>a.x*b.x+a.y*b.y;
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const at=(c,t)=>{const u=1-t;return{x:u**3*c.p0.x+3*u*u*t*c.c1.x+3*u*t*t*c.c2.x+t**3*c.p3.x,y:u**3*c.p0.y+3*u*u*t*c.c1.y+3*u*t*t*c.c2.y+t**3*c.p3.y}};
  function split(c){const a=mix(c.p0,c.c1,.5),b=mix(c.c1,c.c2,.5),d=mix(c.c2,c.p3,.5),e=mix(a,b,.5),f=mix(b,d,.5),p=mix(e,f,.5);return[{p0:c.p0,c1:a,c2:e,p3:p},{p0:p,c1:f,c2:d,p3:c.p3}]}
  function thin(mask,w,h,progress){
    const remove=new Int32Array(mask.length),active=[];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(mask[y*w+x])active.push(y*w+x);
    let changed=true,round=0;
    while(changed&&round<128){
      changed=false;
      for(let pass=0;pass<2;pass++){
        let count=0;
        for(const i of active){
          if(!mask[i])continue;
          const n=[mask[i-w],mask[i-w+1],mask[i+1],mask[i+w+1],mask[i+w],mask[i+w-1],mask[i-1],mask[i-w-1]];
          const b=n.reduce((a,v)=>a+v,0);if(b<2||b>6)continue;
          let transitions=0;for(let k=0;k<8;k++)if(!n[k]&&n[(k+1)%8])transitions++;
          if(transitions!==1)continue;
          if(pass===0?(n[0]*n[2]*n[4]||n[2]*n[4]*n[6]):(n[0]*n[2]*n[6]||n[0]*n[4]*n[6]))continue;
          remove[count++]=i;
        }
        for(let k=0;k<count;k++)mask[remove[k]]=0;
        changed=changed||count>0;
      }
      round++;if(round%8===0)progress?.(Math.min(45,15+round),'抽出單線骨架');
    }
    if(changed)throw new Error('深色區域太厚，無法辨識成細線；請降低辨識門檻或換用線稿底圖。');
    return active.filter(i=>mask[i]);
  }
  function graph(mask,w,h,pixels){
    function adjacent(i){
      const x=i%w,y=Math.floor(i/w),out=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
        const j=i+dy*w+dx;if(!mask[j])continue;
        // Do not add a diagonal shortcut across an existing orthogonal link.
        if(dx&&dy&&(mask[i+dx]||mask[i+dy*w]))continue;
        out.push(j);
      }
      return out;
    }
    const adj=new Map(pixels.map(i=>[i,adjacent(i)])),owners=new Map(),nodes=[];
    const xy=i=>({x:i%w+.5,y:Math.floor(i/w)+.5});
    for(const p of pixels){
      const degree=adj.get(p).length;if(degree===2||owners.has(p))continue;
      const cluster=[p];owners.set(p,nodes.length);
      if(degree>=3)for(let k=0;k<cluster.length;k++)for(const q of adj.get(cluster[k]))if(adj.get(q).length>=3&&!owners.has(q)){owners.set(q,nodes.length);cluster.push(q)}
      const center=cluster.reduce((a,i)=>{const q=xy(i);a.x+=q.x/cluster.length;a.y+=q.y/cluster.length;return a},{x:0,y:0});
      nodes.push({id:nodes.length,point:center,pixels:cluster,edges:[]});
    }
    const used=new Set(),paths=[];
    const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
    function walk(node,p,q){
      const indices=[p],points=[node.point];let prev=p,cur=q;
      used.add(edgeKey(p,q));
      while(true){
        indices.push(cur);
        if(owners.has(cur)){
          const end=nodes[owners.get(cur)];points.push(end.point);
          if(points.length>2||node.id!==end.id){const path={points,indices,start:node.id,end:end.id,closed:node.id===end.id};paths.push(path);node.edges.push({path,side:'start'});end.edges.push({path,side:'end'})}
          return;
        }
        points.push(xy(cur));
        const next=adj.get(cur).find(i=>i!==prev&&!used.has(edgeKey(cur,i)));
        if(next===undefined)return;
        used.add(edgeKey(cur,next));prev=cur;cur=next;
      }
    }
    for(const node of nodes)for(const p of node.pixels)for(const q of adj.get(p)){
      if(owners.get(q)===node.id||used.has(edgeKey(p,q)))continue;walk(node,p,q);
    }
    // Components containing only degree-two pixels are genuine closed loops.
    for(const p of pixels){const q=adj.get(p).find(q=>!used.has(edgeKey(p,q)));if(q===undefined||owners.has(p))continue;const node={id:nodes.length,point:xy(p),pixels:[p],edges:[],loop:true};nodes.push(node);owners.set(p,node.id);walk(node,p,q)}
    return {nodes,paths};
  }
  function length(points){let n=0;for(let i=1;i<points.length;i++)n+=dist(points[i-1],points[i]);return n}
  function smooth(points,closed){
    const result=points.map(p=>({...p}));
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],b=points[i],c=points[i+1];result[i]={x:(a.x+2*b.x+c.x)/4,y:(a.y+2*b.y+c.y)/4};
    }
    if(closed)result[result.length-1]={...result[0]};return result;
  }
  function tangent(points,start=true){const a=start?0:points.length-1,step=start?1:-1;let b=a;while(b+step>=0&&b+step<points.length&&Math.abs(b-a)<7&&dist(points[a],points[b])<6)b+=step;return unit(sub(points[b],points[a]))}
  function fit(points,t0,t1,error){
    const segments=[];
    function recur(p,left,right,depth){
      if(p.length<2)return;
      const a=p[0],b=p.at(-1),chord=dist(a,b),u=[0];let total=0;
      for(let i=1;i<p.length;i++){total+=dist(p[i-1],p[i]);u.push(total)}
      if(total<1e-6)return;for(let i=1;i<u.length;i++)u[i]/=total;
      function solve(parameters){let aa=0,ab=0,bb=0,ax=0,bx=0;
      for(let i=0;i<p.length;i++){
        const t=parameters[i],v=1-t,b0=v**3,b1=3*v*v*t,b2=3*v*t*t,b3=t**3;
        const q={x:p[i].x-a.x*(b0+b1)-b.x*(b2+b3),y:p[i].y-a.y*(b0+b1)-b.y*(b2+b3)};
        aa+=b1*b1;ab+=b1*b2*dot(left,right);bb+=b2*b2;ax+=b1*dot(left,q);bx+=b2*dot(right,q);
      }
      const det=aa*bb-ab*ab;let l=det? (ax*bb-bx*ab)/det:chord/3,r=det?(bx*aa-ax*ab)/det:chord/3;
      if(l<.001||r<.001||!Number.isFinite(l+r)){l=r=chord/3}
      l=Math.min(l,total*.65);r=Math.min(r,total*.65);
      return {p0:a,c1:{x:a.x+left.x*l,y:a.y+left.y*l},c2:{x:b.x+right.x*r,y:b.y+right.y*r},p3:b}}
      function measure(c,parameters){let worst=0,index=Math.floor(p.length/2);for(let i=1;i<p.length-1;i++){const d=dist(at(c,parameters[i]),p[i]);if(d>worst){worst=d;index=i}}return{worst,index}}
      let c=solve(u),{worst,index}=measure(c,u),parameters=u;
      // Refine where samples sit on the same cubic before adding an anchor.
      // A poor chord-length parameterization should not force tiny pen steps.
      for(let pass=0;pass<5&&worst>error&&worst<error*6;pass++){
        const next=parameters.map((t,i)=>{
          if(!i||i===p.length-1)return t;
          const v=1-t,q=at(c,t),d1={x:3*(v*v*(c.c1.x-a.x)+2*v*t*(c.c2.x-c.c1.x)+t*t*(b.x-c.c2.x)),y:3*(v*v*(c.c1.y-a.y)+2*v*t*(c.c2.y-c.c1.y)+t*t*(b.y-c.c2.y))},d2={x:6*(v*(c.c2.x-2*c.c1.x+a.x)+t*(b.x-2*c.c2.x+c.c1.x)),y:6*(v*(c.c2.y-2*c.c1.y+a.y)+t*(b.y-2*c.c2.y+c.c1.y))},delta=sub(q,p[i]),den=dot(d1,d1)+dot(delta,d2);
          return Math.abs(den)<1e-9?t:clamp(t-dot(delta,d1)/den,0,1);
        });
        if(next.some((t,i)=>i&&t<=next[i-1]))break;
        const candidate=solve(next),measured=measure(candidate,next);if(measured.worst>=worst)break;
        c=candidate;parameters=next;worst=measured.worst;index=measured.index;
      }
      if(p.length<=2||worst<=error||depth>=24){segments.push(c);return}
      // Keep both halves useful: a near-end fitting residual must not peel off
      // tiny segments repeatedly along an otherwise simple arc.
      if(index<p.length*.35||index>p.length*.65)index=Math.floor(p.length/2);
      index=clamp(index,1,p.length-2);
      const span=Math.min(3,index,p.length-1-index),center=unit(sub(p[index+span],p[index-span]));
      recur(p.slice(0,index+1),left,neg(center),depth+1);recur(p.slice(index),center,right,depth+1);
    }
    // Preserve concentrated, genuine corners between two near-straight legs.
    // Curved bends and single-pixel stair steps do not meet both leg tests.
    const corners=[];
    for(let i=1;i<points.length-1;i++){
      let l=i-1,r=i+1;while(l>0&&dist(points[i],points[l])<10)l--;while(r<points.length-1&&dist(points[i],points[r])<10)r++;
      const left=sub(points[i],points[l]),right=sub(points[r],points[i]),dl=Math.hypot(left.x,left.y),dr=Math.hypot(right.x,right.y);if(dl<9||dr<9||dot(unit(left),unit(right))>.34)continue;
      const deviation=(start,end,v,n)=>{let worst=0;for(let j=start+1;j<end;j++){const q=sub(points[j],points[start]);worst=Math.max(worst,Math.abs(q.x*v.y-q.y*v.x)/n)}return worst};
      if(deviation(l,i,left,dl)>.65||deviation(i,r,right,dr)>.65)continue;
      const candidate={i,score:dot(unit(left),unit(right))},last=corners.at(-1);
      if(last&&dist(points[last.i],points[i])<8){if(candidate.score<last.score)corners[corners.length-1]=candidate}else corners.push(candidate);
    }
    let start=0,left=t0;
    for(const {i} of corners){const part=points.slice(start,i+1);recur(part,left,tangent(part,false),0);start=i;left=tangent(points.slice(i))}
    recur(points.slice(start),left,t1,0);return segments;
  }
  function toItem(path,segments,color,width,junctions){
    const curves=[];function add(c){if(dist(c.p0,c.c1)>580||dist(c.p3,c.c2)>580)split(c).forEach(add);else curves.push(c)}segments.forEach(add);
    if(!curves.length)return null;
    while(path.closed&&curves.length<3){const c=curves.shift();curves.unshift(...split(c))}
    const points=[curves[0].p0,...curves.map(c=>c.p3)];if(path.closed)points.pop();
    const handles={};
    curves.forEach((c,i)=>{const j=(i+1)%points.length,a=sub(c.c1,c.p0),b=sub(c.c2,c.p3);handles[i]={...(handles[i]||{in:0,inLength:0}),out:Math.atan2(a.y,a.x)*180/Math.PI,outLength:Math.hypot(a.x,a.y)};handles[j]={...(handles[j]||{out:0,outLength:0}),in:Math.atan2(b.y,b.x)*180/Math.PI,inLength:Math.hypot(b.x,b.y)}});
    const links={};if(junctions.has(path.start))links[0]=`j${path.start}`;if(junctions.has(path.end))links[path.closed?0:points.length-1]=`j${path.end}`;
    return {type:'arrow',name:'自動描圖線',points,pointHandleAngles:handles,pointJunctions:links,curved:true,explicitBezier:false,closed:path.closed,color,width,startHead:false,endHead:false,style:'solid',fill:'#dbeafe',fillOpacity:0,autoTrace:true};
  }
  function hasSolidAreas(mask,w,h,ink){
    // Look for substantial stroke interiors, not just global image coverage:
    // a small solid logo on a large blank page needs contours too.
    let core=0;
    for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
      const i=y*w+x;if(!mask[i])continue;
      if(mask[i-3]&&mask[i+3]&&mask[i-3*w]&&mask[i+3*w]&&mask[i-3*w-3]&&mask[i-3*w+3]&&mask[i+3*w-3]&&mask[i+3*w+3])core++;
    }
    return ink>w*h*.32||core>ink*.18;
  }
  function contours(mask,w,h){
    // Oriented pixel-cell edges keep holes and image-border outlines closed.
    // At diagonal contacts turn right: touching islands are not merged into a
    // self-crossing figure eight. The dark region stays on the right.
    const stride=w+1,edges=new Set(),delta=[1,stride,-1,-stride],loops=[];
    const add=(x,y,d)=>{edges.add((y*stride+x)*4+d);if(edges.size>300000)throw new Error('輪廓細節太多；請減少淺色辨識或縮小底圖後重試。')};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){
      const i=y*w+x;
      if(!y||!mask[i-w])add(x,y,0);
      if(x===w-1||!mask[i+1])add(x+1,y,1);
      if(y===h-1||!mask[i+w])add(x+1,y+1,2);
      if(!x||!mask[i-1])add(x,y+1,3);
    }
    while(edges.size){
      const first=edges.values().next().value,start=Math.floor(first/4),points=[];let key=first;
      while(true){
        const vertex=Math.floor(key/4),d=key%4;edges.delete(key);
        points.push({x:vertex%stride,y:Math.floor(vertex/stride)});
        const next=vertex+delta[d];if(next===start)break;
        const turn=[(d+1)%4,d,(d+3)%4,(d+2)%4].find(dir=>edges.has(next*4+dir));
        if(turn===undefined)throw new Error('輪廓未能封閉，請調整深淺辨識後重試。');
        key=next*4+turn;
      }
      loops.push(points);
    }
    return loops;
  }
  function fitContour(points,error){
    const n=points.length,cyclic=i=>points[(i+n)%n],corners=[];
    // Detect corners around the entire ring, including its seam. Only two
    // genuinely straight legs qualify; raster stairs and round caps do not.
    for(let i=0;i<n;i++){
      let l=1,r=1;while(l<n/2&&dist(cyclic(i),cyclic(i-l))<6)l++;while(r<n/2&&dist(cyclic(i),cyclic(i+r))<6)r++;
      const a=cyclic(i-l),b=cyclic(i),c=cyclic(i+r),left=sub(b,a),right=sub(c,b),dl=dist(a,b),dr=dist(b,c),score=dot(unit(left),unit(right));
      if(dl<5||dr<5||score>.65)continue;
      let deviation=0;
      for(let j=1;j<l;j++){const v=sub(cyclic(i-l+j),a);deviation=Math.max(deviation,Math.abs(v.x*left.y-v.y*left.x)/dl)}
      for(let j=1;j<r;j++){const v=sub(cyclic(i+j),b);deviation=Math.max(deviation,Math.abs(v.x*right.y-v.y*right.x)/dr)}
      if(deviation>.65)continue;
      const last=corners.at(-1);
      if(last&&dist(points[last.i],b)<6){if(score<last.score)corners[corners.length-1]={i,score}}else corners.push({i,score});
    }
    if(corners.length>1&&dist(points[corners[0].i],points[corners.at(-1).i])<6){if(corners[0].score<=corners.at(-1).score)corners.pop();else corners.shift()}
    const protectedPoints=new Set(corners.map(c=>c.i)),straightStarts=new Map(),straightEnds=new Map();
    // Keep long horizontal/vertical Logo edges truly straight. Fitting the
    // whole rounded rectangle at once can otherwise bow its long sides.
    const direction=i=>{const a=cyclic(i),b=cyclic(i+1);return b.x>a.x?0:b.y>a.y?1:b.x<a.x?2:3};
    for(let i=0;i<n;i++)if(direction(i)!==direction((i+n-1)%n)){
      let span=1;while(span<n&&direction((i+span)%n)===direction(i))span++;
      if(span<30)continue;
      const end=(i+span)%n;straightStarts.set(i,end);straightEnds.set(end,i);protectedPoints.add(i);protectedPoints.add(end);
    }
    const filtered=points.map((b,i)=>protectedPoints.has(i)?b:{x:(cyclic(i-1).x+2*b.x+cyclic(i+1).x)/4,y:(cyclic(i-1).y+2*b.y+cyclic(i+1).y)/4});
    if(protectedPoints.size){
      const boundaries=[...protectedPoints].sort((a,b)=>a-b),sharp=new Set(corners.map(c=>c.i));
      const segments=[];
      for(let k=0;k<boundaries.length;k++){
        const start=boundaries[k],end=boundaries[(k+1)%boundaries.length],span=(end-start+n)%n||n,part=Array.from({length:span+1},(_,j)=>filtered[(start+j)%n]);
        if(straightStarts.get(start)===end){const a=points[start],b=points[end];segments.push({p0:a,c1:mix(a,b,1/3),c2:mix(a,b,2/3),p3:b});continue}
        const left=!sharp.has(start)&&straightEnds.has(start)?unit(sub(points[start],points[straightEnds.get(start)])):tangent(part);
        const right=!sharp.has(end)&&straightStarts.has(end)?unit(sub(points[end],points[straightStarts.get(end)])):tangent(part,false);
        segments.push(...fit(part,left,right,error));
      }
      return segments;
    }
    const mid=Math.floor(n/2),part=filtered.concat([filtered[0]]),span=Math.min(3,Math.floor(n/4)),seam=unit(sub(filtered[span],filtered[n-span])),t=unit(sub(filtered[mid+span],filtered[mid-span]));
    return fit(part.slice(0,mid+1),seam,neg(t),error).concat(fit(part.slice(mid),t,neg(seam),error));
  }
  function traceContours(mask,w,h,ink,accuracy,simplify,minLength,progress){
    progress(25,'沿 Logo 外框與內部留白描圖');
    const loops=contours(mask,w,h),items=[];let boundaryPixels=0;
    for(let k=0;k<loops.length;k++){
      const points=loops[k];boundaryPixels+=points.length;
      if(points.length<Math.max(4,minLength))continue;
      // Logo features may be only 2–3px wide; use a tighter fitting budget
      // than centerlines so the nib slit/holes survive the default setting.
      const segments=fitContour(points,accuracy*(.4+.006*simplify)*.4),item=toItem({closed:true},segments,'#123f8c',2.5,new Set());
      if(item){item.autoTraceMode='contour';items.push(item)}
      if(items.length>2500)throw new Error('產生太多小輪廓；請增加「細節清理」或減少淺色辨識。');
      if(k%20===0)progress(50+Math.round(k/loops.length*45),'將輪廓擬合成可編輯曲線');
    }
    progress(100,'預覽完成');
    return {items,issues:[],stats:{mode:'contour',inkPixels:ink,boundaryPixels,skeletonPixels:0,paths:items.length,anchors:items.reduce((sum,it)=>sum+it.points.length,0),junctions:0,reviewCount:0}};
  }
  function photoBackground(data,w,h){
    // Find the dominant colour in a broad inner border. The few outer rows are
    // deliberately ignored because screenshots and JPEGs often contain a frame.
    const bins=new Map(),depth=Math.max(8,Math.round(Math.min(w,h)*.16)),edge=Math.max(2,Math.round(Math.min(w,h)*.015));
    for(let y=edge;y<h-edge;y++)for(let x=edge;x<w-edge;x++){
      if(x>=depth&&x<w-depth&&y>=depth&&y<h-depth)continue;
      const i=(y*w+x)*4;if(data[i+3]<128)continue;
      const r=data[i],g=data[i+1],b=data[i+2];
      if(r+g+b<60)continue;
      const key=(r>>5)*64+(g>>5)*8+(b>>5),entry=bins.get(key)||{count:0,r:0,g:0,b:0};
      entry.count++;entry.r+=r;entry.g+=g;entry.b+=b;bins.set(key,entry);
    }
    let best=null;for(const entry of bins.values())if(!best||entry.count>best.count)best=entry;
    if(!best)return {r:255,g:255,b:255,tolerance:48};
    const bg={r:best.r/best.count,g:best.g/best.count,b:best.b/best.count};let variance=0,count=0;
    for(let y=edge;y<h-edge;y++)for(let x=edge;x<w-edge;x++){
      if(x>=depth&&x<w-depth&&y>=depth&&y<h-depth)continue;
      const i=(y*w+x)*4,dr=data[i]-bg.r,dg=data[i+1]-bg.g,db=data[i+2]-bg.b,d=Math.hypot(dr,dg,db);
      if(d<70){variance+=d*d;count++}
    }
    return {...bg,tolerance:clamp(42+Math.sqrt(variance/Math.max(1,count))*1.35,48,78)};
  }
  function closeMask(mask,w,h){
    const expanded=new Uint8Array(mask.length),result=new Uint8Array(mask.length);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;for(let dy=-1;dy<=1&&!expanded[i];dy++)for(let dx=-1;dx<=1;dx++)if(mask[i+dy*w+dx]){expanded[i]=1;break}}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;let full=1;for(let dy=-1;dy<=1&&full;dy++)for(let dx=-1;dx<=1;dx++)if(!expanded[i+dy*w+dx]){full=0;break}result[i]=full}
    return result;
  }
  function largestComponent(mask,w,h){
    const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),components=[];
    for(let start=0;start<mask.length;start++)if(mask[start]&&!seen[start]){
      let head=0,tail=1;queue[0]=start;seen[start]=1;const pixels=[];
      while(head<tail){const i=queue[head++];pixels.push(i);const x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const j=ny*w+nx;if(mask[j]&&!seen[j]){seen[j]=1;queue[tail++]=j}}}
      components.push(pixels);
    }
    components.sort((a,b)=>b.length-a.length);const out=new Uint8Array(mask.length);
    // The subject is one coherent component. Keeping only it also removes a
    // dark image frame and isolated grass/JPEG speckles.
    for(const i of components[0]||[])out[i]=1;
    return out;
  }
  function fillPhotoPinholes(mask,w,h,maxArea){
    const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
    for(let start=0;start<mask.length;start++)if(!mask[start]&&!seen[start]){
      let head=0,tail=1,touches=false;queue[0]=start;seen[start]=1;const pixels=[];
      while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);pixels.push(i);if(!x||x===w-1||!y||y===h-1)touches=true;for(const j of [i-1,i+1,i-w,i+w]){if(j<0||j>=mask.length||seen[j]||mask[j])continue;const nx=j%w;if(Math.abs(nx-x)>1)continue;seen[j]=1;queue[tail++]=j}}
      if(!touches&&pixels.length<=maxArea)for(const i of pixels)mask[i]=1;
    }
    return mask;
  }
  function erodeMask(mask,w,h,radius){
    const out=new Uint8Array(mask.length);
    for(let y=radius;y<h-radius;y++)for(let x=radius;x<w-radius;x++){let full=1;for(let dy=-radius;dy<=radius&&full;dy++)for(let dx=-radius;dx<=radius;dx++)if(!mask[(y+dy)*w+x+dx]){full=0;break}out[y*w+x]=full}
    return out;
  }
  function smoothLuma(data,w,h,radius=2){
    const horizontal=new Uint16Array(w*h),out=new Uint8Array(w*h),span=radius*2+1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let dx=-radius;dx<=radius;dx++){const j=(y*w+clamp(x+dx,0,w-1))*4;sum+=.2126*data[j]+.7152*data[j+1]+.0722*data[j+2]}horizontal[y*w+x]=Math.round(sum)}
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let dy=-radius;dy<=radius;dy++)sum+=horizontal[clamp(y+dy,0,h-1)*w+x];out[y*w+x]=Math.round(sum/(span*span))}
    return out;
  }
  function tracePhoto(data,w,h,threshold,accuracy,simplify,minLength,progress){
    progress(8,'分離角色與照片背景');
    const bg=photoBackground(data,w,h),raw=new Uint8Array(w*h);
    for(let i=0;i<raw.length;i++){
      const j=i*4,a=data[j+3]/255,r=data[j]*a+255*(1-a),g=data[j+1]*a+255*(1-a),b=data[j+2]*a+255*(1-a);
      raw[i]=Math.hypot(r-bg.r,g-bg.g,b-bg.b)>bg.tolerance?1:0;
    }
    const subject=fillPhotoPinholes(largestComponent(closeMask(raw,w,h),w,h),w,h,Math.max(20,Math.round(w*h*.0012))),ink=subject.reduce((n,v)=>n+v,0);
    if(ink<w*h*.01)throw new Error('找不到明確主體；這個模式需要背景與角色顏色有差異。');
    progress(35,'描出角色外框');
    const outline=traceContours(subject,w,h,ink,Math.max(accuracy,6),Math.max(simplify,95),Math.max(minLength,10),()=>{});
    for(const item of outline.items)item.autoTraceMode='photo-outline';
    progress(58,'整理五官與斑紋');
    const inside=erodeMask(subject,w,h,2),luma=smoothLuma(data,w,h,2),edges=new Uint8Array(w*h);
    // The familiar detail slider controls edge strength here: left keeps only
    // decisive features, right admits softer facial and colour boundaries.
    const edgeLimit=clamp(100-(threshold-40)*.24,48,100);
    for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
      const i=y*w+x;if(!inside[i])continue;
      const gx=Math.abs(luma[i+1]-luma[i-1])+Math.abs(luma[i+w+1]-luma[i+w-1])+Math.abs(luma[i-w+1]-luma[i-w-1]);
      const gy=Math.abs(luma[i+w]-luma[i-w])+Math.abs(luma[i+w+1]-luma[i-w+1])+Math.abs(luma[i+w-1]-luma[i-w-1]);
      if(gx+gy>edgeLimit*2.2)edges[i]=1;
    }
    const pixels=new Uint8Array(w*h*4);for(let i=0;i<edges.length;i++){const c=edges[i]?0:255,j=i*4;pixels[j]=pixels[j+1]=pixels[j+2]=c;pixels[j+3]=255}
    let details={items:[],issues:[],stats:{paths:0,anchors:0,junctions:0,reviewCount:0}};
    try{details=run({width:w,height:h,data:pixels,options:{mode:'line',threshold:128,accuracy:Math.max(accuracy,3.5),simplify:Math.max(simplify,94),minLength:Math.max(minLength*2.5,12)}},()=>{})}catch(error){if(!/大面積實心色塊|找不到|太多碎線/.test(error.message))throw error}
    for(const item of details.items)item.autoTraceMode='photo-detail';
    const items=outline.items.concat(details.items);progress(100,'照片角色預覽完成');
    return {items,issues:[],stats:{mode:'photo',inkPixels:ink,background:{r:Math.round(bg.r),g:Math.round(bg.g),b:Math.round(bg.b)},paths:items.length,outlinePaths:outline.items.length,detailPaths:details.items.length,anchors:items.reduce((sum,it)=>sum+it.points.length,0),junctions:details.stats.junctions||0,reviewCount:0}};
  }
  function run({width:w,height:h,data,options={}},progress=()=>{}){
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<3||h<3||w*h>5e6||data.length!==w*h*4)throw new Error('圖片尺寸或像素資料不正確（最多 500 萬像素）。');
    const threshold=clamp(Number(options.threshold)||150,40,220),accuracy=clamp(Number(options.accuracy)||2.5,.3,6),simplify=clamp(Number.isFinite(Number(options.simplify))?Number(options.simplify):90,0,100),minLength=clamp(Number.isFinite(Number(options.minLength))?Number(options.minLength):3,0,30);
    const mask=new Uint8Array(w*h);let ink=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,j=i*4,a=data[j+3]/255,lum=(.2126*data[j]+.7152*data[j+1]+.0722*data[j+2])*a+255*(1-a);if(lum<threshold){mask[i]=1;ink++}}
    const requested=['line','contour','photo'].includes(options.mode)?options.mode:'auto',mode=requested==='auto'?(hasSolidAreas(mask,w,h,ink)?'contour':'line'):requested;
    if(!ink)return {items:[],issues:[],stats:{mode,inkPixels:0,paths:0,anchors:0,junctions:0,reviewCount:0}};
    if(mode==='photo')return tracePhoto(data,w,h,threshold,accuracy,simplify,minLength,progress);
    if(mode==='contour')return traceContours(mask,w,h,ink,accuracy,simplify,minLength,progress);
    if(ink>w*h*.32)throw new Error('這張圖有大面積實心色塊，請切換「自動判斷」或「Logo 輪廓」。');
    progress(12,'辨識深色筆畫');
    // Pad with white so outlines touching the image boundary are not cut off.
    const pw=w+2,ph=h+2,padded=new Uint8Array(pw*ph);
    for(let y=0;y<h;y++)padded.set(mask.subarray(y*w,(y+1)*w),(y+1)*pw+1);
    const pixels=thin(padded,pw,ph,progress);progress(48,'辨識 T 型與分岔');
    if(pixels.length>180000)throw new Error('細節太多；請降低辨識門檻或縮小底圖後重試。');
    const g=graph(padded,pw,ph,pixels),issues=[];
    for(const node of g.nodes){node.point.x--;node.point.y--}
    // Graph endpoints share node.point objects; shift interior samples only.
    for(const p of g.paths){for(let i=1;i<p.points.length-1;i++){p.points[i].x--;p.points[i].y--}p.length=length(p.points);p.smoothed=smooth(p.points,p.closed);p.t0=tangent(p.smoothed);p.t1=tangent(p.smoothed,false)}
    const paths=g.paths.filter(p=>p.length>=minLength||g.nodes[p.start].edges.length>1&&g.nodes[p.end].edges.length>1);
    if(paths.length>2500)throw new Error('產生太多碎線；請提高忽略碎線或降低辨識門檻。');
    const valid=new Set(paths),junctions=new Set(),sharedNodes=new Set();
    for(const node of g.nodes){
      const edges=node.edges.filter(e=>valid.has(e.path));node.active=edges;
      if(edges.length<2||node.loop)continue;sharedNodes.add(node.id);if(edges.length>=3)junctions.add(node.id);
      const pairs=[];
      for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){const a=edges[i],b=edges[j],ta=a.side==='start'?a.path.t0:a.path.t1,tb=b.side==='start'?b.path.t0:b.path.t1;pairs.push({a,b,ta,tb,score:dot(ta,tb)})}
      pairs.sort((a,b)=>a.score-b.score);const paired=new Set();
      for(const pair of pairs){if(pair.score>-.65||paired.has(pair.a)||paired.has(pair.b))continue;const t=unit(sub(pair.ta,pair.tb));pair.a.path[pair.a.side==='start'?'t0':'t1']=t;pair.b.path[pair.b.side==='start'?'t0':'t1']=neg(t);paired.add(pair.a);paired.add(pair.b)}
      if(edges.length>3||!paired.size)issues.push({...node.point,kind:'junction',message:'交叉或多向接點，請確認是否要相連'});
    }
    // Flag near misses; never silently bridge separate components.
    const ends=g.nodes.filter(n=>n.active?.length===1);
    for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){const a=ends[i],b=ends[j],d=dist(a.point,b.point);if(d>1.2&&d<=7&&a.active[0].path!==b.active[0].path)issues.push({...mix(a.point,b.point,.5),kind:'gap',message:'兩個端點很接近，可能有斷口；不會自動補線'})}
    for(const end of ends){
      let best=null;const p=end.point;
      for(const path of paths){if(path===end.active[0].path)continue;for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],v=sub(b,a),den=dot(v,v),t=den?clamp(dot(sub(p,a),v)/den,0,1):0,q=mix(a,b,t),d=dist(p,q);if(d>1.2&&d<4&&(!best||d<best.distance))best={q,distance:d}}}
      if(best&&!issues.some(i=>dist(i,p)<7))issues.push({...mix(p,best.q,.5),kind:'gap',message:'端點接近另一條線，可能是未接上的 T 接點；請手動確認'});
    }
    const result=[];
    for(let k=0;k<paths.length;k++){
      const p=paths[k],error=accuracy*(.4+.006*simplify);let segments;
      if(p.closed){const mid=Math.floor((p.smoothed.length-1)/2),t=unit(sub(p.smoothed[Math.min(mid+3,p.smoothed.length-1)],p.smoothed[Math.max(0,mid-3)])),seam=unit(sub(p.smoothed[Math.min(3,mid)],p.smoothed[Math.max(mid,p.smoothed.length-4)]));segments=fit(p.smoothed.slice(0,mid+1),seam,neg(t),error).concat(fit(p.smoothed.slice(mid),t,neg(seam),error))}
      else segments=fit(p.smoothed,p.t0,p.t1,error);
      let r=0,green=0,b=0,count=0;
      for(const index of p.indices){const x=index%pw-1,y=Math.floor(index/pw)-1;if(x<0||x>=w||y<0||y>=h)continue;let best=null;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const j=(yy*w+xx)*4,l=data[j]+data[j+1]+data[j+2];if(!best||l<best.l)best={j,l}}
        if(best){r+=data[best.j];green+=data[best.j+1];b+=data[best.j+2];count++}
      }
      const color='#'+[r,green,b].map(v=>Math.round(v/(count||1)).toString(16).padStart(2,'0')).join('');
      const item=toItem(p,segments,color,clamp(ink/Math.max(1,pixels.length)*.85,1,7),sharedNodes);if(item)result.push(item);
      if(k%20===0)progress(55+Math.round(k/paths.length*40),'擬合可編輯曲線');
    }
    if(result.length>2500)throw new Error('產生太多碎線；請提高忽略碎線或降低辨識門檻。');
    progress(100,'預覽完成');
    return {items:result,issues:issues.slice(0,300),stats:{mode,inkPixels:ink,skeletonPixels:pixels.length,paths:result.length,anchors:result.reduce((sum,it)=>sum+it.points.length,0),junctions:junctions.size,reviewCount:issues.length}};
  }
  function simplifyItem(source,curves,error=1.5){
    if(!source?.points?.length||curves.length!==(source.closed?source.points.length:source.points.length-1))throw new Error('這條線的曲線結構不適合直接精簡');
    const count=source.points.length,protectedIndices=new Set([0,source.closed?0:count-1]);
    for(const key of ['pointJunctions','autoTraceReview','pointKinds'])for(const i of Object.keys(source[key]||{}))protectedIndices.add(Number(i));
    // Preserve authored cusps even when they use split handles rather than a sharp flag.
    for(let i=1;i<(source.closed?count:count-1);i++){const before=curves[(i-1+curves.length)%curves.length],after=curves[i%curves.length],a=sub(before.p3,before.c2),b=sub(after.c1,after.p0);if(Math.hypot(a.x,a.y)>.01&&Math.hypot(b.x,b.y)>.01&&dot(unit(a),unit(b))<.5)protectedIndices.add(i)}
    if(source.closed&&protectedIndices.size<2)protectedIndices.add(Math.floor(count/2));
    const boundaries=[...protectedIndices].filter(i=>i>=0&&i<count).sort((a,b)=>a-b);if(source.closed)boundaries.push(count);
    const output=[],mapping=new Map();let sampled=0;
    for(let k=0;k<boundaries.length-1;k++){
      const from=boundaries[k],to=boundaries[k+1],samples=[curves[from].p0];mapping.set(from,output.length);
      for(let i=from;i<to;i++){const c=curves[i],steps=Math.max(2,Math.ceil((dist(c.p0,c.c1)+dist(c.c1,c.c2)+dist(c.c2,c.p3))/.75));sampled+=steps;if(sampled>120000)throw new Error('這條線太複雜，請分段後精簡');for(let j=1;j<=steps;j++)samples.push(at(c,j/steps))}
      const first=curves[from],last=curves[to-1],a=sub(first.c1,first.p0),b=sub(last.c2,last.p3),left=Math.hypot(a.x,a.y)>.001?unit(a):tangent(samples),right=Math.hypot(b.x,b.y)>.001?unit(b):tangent(samples,false);
      const fitted=fit(samples,left,right,clamp(error,.1,6));
      // Match toItem's handle-length split before assigning metadata indices.
      function append(c){if(dist(c.p0,c.c1)>580||dist(c.p3,c.c2)>580)split(c).forEach(append);else output.push(c)}fitted.forEach(append);
      mapping.set(to%count,output.length);
    }
    if(source.closed){mapping.set(0,0);while(output.length<3){const splitAt=output.length-1;output.splice(splitAt,1,...split(output[splitAt]))}}
    const fitted=toItem({closed:!!source.closed,start:0,end:1},output,source.color,source.width,new Set());
    if(!fitted||fitted.points.length>=count)return null;
    const result={...source,points:fitted.points,pointHandleAngles:fitted.pointHandleAngles,curved:true,explicitBezier:false,centerlineLocked:false,edgeLocked:false,pointSmoothness:{},pointAngles:{},manualAnchorIndices:[]};
    for(const key of ['pointJunctions','autoTraceReview','pointKinds'])result[key]=Object.fromEntries(Object.entries(source[key]||{}).filter(([i])=>mapping.has(Number(i))).map(([i,value])=>[mapping.get(Number(i)),value]));
    return result;
  }
  const workerSource=()=>`const AutoTrace=(${createAutoTrace.toString()})();(${autoTraceWorkerRuntime.toString()})();`;
  return {run,thin,graph,fit,at,toItem,simplifyItem,workerSource};
})();

function autoTraceWorkerRuntime() {
  self.onmessage=event=>{
    try {const result=AutoTrace.run(event.data,(percent,stage)=>self.postMessage({type:'progress',percent,stage}));self.postMessage({type:'result',result});}
    catch(error){self.postMessage({type:'error',message:error.message||String(error)});}
  };
}
