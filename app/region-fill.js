/* Bounded faces of editable vector paths. Raster/reference images are never inputs. */
const RegionFill = (() => {
  const EPS = 1e-7;
  const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
  const mix = (a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const cross = (a,b) => a.x*b.y-a.y*b.x;
  const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
  const line = (a,b) => ({p0:a,c1:mix(a,b,1/3),c2:mix(a,b,2/3),p3:b});
  const point = (s,t) => {const u=1-t;return {x:u**3*s.p0.x+3*u*u*t*s.c1.x+3*u*t*t*s.c2.x+t**3*s.p3.x,y:u**3*s.p0.y+3*u*u*t*s.c1.y+3*u*t*t*s.c2.y+t**3*s.p3.y}};
  const derivative = (s,t) => {const u=1-t;return {x:3*u*u*(s.c1.x-s.p0.x)+6*u*t*(s.c2.x-s.c1.x)+3*t*t*(s.p3.x-s.c2.x),y:3*u*u*(s.c1.y-s.p0.y)+6*u*t*(s.c2.y-s.c1.y)+3*t*t*(s.p3.y-s.c2.y)}};
  function split(s,t) {
    const a=mix(s.p0,s.c1,t),b=mix(s.c1,s.c2,t),c=mix(s.c2,s.p3,t),d=mix(a,b,t),e=mix(b,c,t),p=mix(d,e,t);
    return [{p0:s.p0,c1:a,c2:d,p3:p},{p0:p,c1:e,c2:c,p3:s.p3}];
  }
  function slice(s,a,b) {return a<=EPS?split(s,b)[0]:split(split(s,a)[1],(b-a)/(1-a))[0]}
  const reverse = s => ({p0:s.p3,c1:s.c2,c2:s.c1,p3:s.p0});
  function flatten(s,tolerance=.15) {
    const out=[{...s.p0,t:0}];
    function visit(c,a,b,depth) {
      const chord=sub(c.p3,c.p0),length=dist(c.p0,c.p3);
      const error=length?Math.max(Math.abs(cross(sub(c.c1,c.p0),chord)),Math.abs(cross(sub(c.c2,c.p0),chord)))/length:Math.max(dist(c.c1,c.p0),dist(c.c2,c.p0));
      const excess=dist(c.p0,c.c1)+dist(c.c1,c.c2)+dist(c.c2,c.p3)-length;
      if(depth>=14||(error<=tolerance&&excess<=tolerance)){out.push({...c.p3,t:b});return}
      const [l,r]=split(c,.5),m=(a+b)/2;visit(l,a,m,depth+1);visit(r,m,b,depth+1);
    }
    visit(s,0,1,0);return out;
  }
  function arc(cx,cy,rx,ry,start,span) {
    const n=Math.max(1,Math.ceil(Math.abs(span)/(Math.PI/4))),result=[];
    for(let i=0;i<n;i++){
      const a=start+span*i/n,b=start+span*(i+1)/n,k=4/3*Math.tan((b-a)/4);
      result.push({p0:{x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)},c1:{x:cx+rx*(Math.cos(a)-k*Math.sin(a)),y:cy+ry*(Math.sin(a)+k*Math.cos(a))},c2:{x:cx+rx*(Math.cos(b)+k*Math.sin(b)),y:cy+ry*(Math.sin(b)-k*Math.cos(b))},p3:{x:cx+rx*Math.cos(b),y:cy+ry*Math.sin(b)}});
    }
    return result;
  }
  function contains(p,polygon) {
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  const area = pts => pts.reduce((sum,p,i)=>sum+cross(p,pts[(i+1)%pts.length]),0)/2;
  function nearest(s,p) {
    let best={distance:Infinity,t:0};
    for(let i=1;i<s.samples.length;i++){
      const a=s.samples[i-1],b=s.samples[i],v=sub(b,a),den=v.x*v.x+v.y*v.y;
      const u=den?clamp(((p.x-a.x)*v.x+(p.y-a.y)*v.y)/den):0,q=mix(a,b,u),d=dist(p,q);
      if(d<best.distance)best={distance:d,t:a.t+(b.t-a.t)*u};
    }
    let t=best.t;
    for(let i=0;i<10;i++){
      const q=point(s,t),d=derivative(s,t),u=1-t,dd={x:6*(u*(s.c2.x-2*s.c1.x+s.p0.x)+t*(s.p3.x-2*s.c2.x+s.c1.x)),y:6*(u*(s.c2.y-2*s.c1.y+s.p0.y)+t*(s.p3.y-2*s.c2.y+s.c1.y))};
      const den=d.x*d.x+d.y*d.y+(q.x-p.x)*dd.x+(q.y-p.y)*dd.y;
      if(Math.abs(den)<EPS)break;
      const next=clamp(t-((q.x-p.x)*d.x+(q.y-p.y)*d.y)/den);
      if(Math.abs(t-next)<EPS){t=next;break}t=next;
    }
    const q=point(s,t);return {t,point:q,distance:dist(p,q)};
  }
  function intersections(a,b) {
    const hits=[];
    for(let i=1;i<a.samples.length;i++)for(let j=1;j<b.samples.length;j++){
      const p=a.samples[i-1],q=b.samples[j-1],r=sub(a.samples[i],p),s=sub(b.samples[j],q),den=cross(r,s);
      if(Math.abs(den)<EPS)continue;
      const delta=sub(q,p),u=cross(delta,s)/den,v=cross(delta,r)/den;
      if(u<-EPS||u>1+EPS||v<-EPS||v>1+EPS)continue;
      let ta=p.t+(a.samples[i].t-p.t)*clamp(u),tb=q.t+(b.samples[j].t-q.t)*clamp(v);
      // Refine on the original cubics, not on the hit-test polylines.
      for(let n=0;n<10;n++){
        const d=sub(point(a,ta),point(b,tb)),da=derivative(a,ta),db=derivative(b,tb),det=cross(da,db);
        if(Math.abs(det)<EPS)break;
        ta=clamp(ta-cross(d,db)/det);tb=clamp(tb-cross(d,da)/det);
        if(Math.hypot(d.x,d.y)<1e-6)break;
      }
      const pa=point(a,ta),pb=point(b,tb);
      if(dist(pa,pb)<.01&&!hits.some(h=>Math.abs(h.ta-ta)<1e-5&&Math.abs(h.tb-tb)<1e-5))hits.push({ta,tb,p:mix(pa,pb,.5)});
    }
    return hits;
  }
  function build(paths) {
    const curves=[];
    for(const path of paths)path.segments.forEach((s,index)=>{
      if(![s.p0,s.c1,s.c2,s.p3].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return;
      const samples=flatten(s),xs=samples.map(p=>p.x),ys=samples.map(p=>p.y);
      curves.push({...s,owner:path.id,index,width:path.width||1,first:!path.closed&&index===0,last:!path.closed&&index===path.segments.length-1,samples,box:{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)},cuts:[{t:0,p:s.p0},{t:1,p:s.p3}]});
    });
    const cut=(s,t,p)=>{const existing=s.cuts.find(c=>Math.abs(c.t-t)<1e-6);if(existing)existing.p=p;else s.cuts.push({t,p})};
    for(let i=0;i<curves.length;i++)for(let j=i+1;j<curves.length;j++){
      const a=curves[i],b=curves[j];
      if(a.box.x1+.3<b.box.x0||b.box.x1+.3<a.box.x0||a.box.y1+.3<b.box.y0||b.box.y1+.3<a.box.y0)continue;
      for(const hit of intersections(a,b)){cut(a,hit.ta,hit.p);cut(b,hit.tb,hit.p)}
    }
    // A T attachment may be a fraction of a pixel off because snapping samples
    // a path. Only open endpoints may bridge this small stroke-width gap.
    for(const a of curves)for(const end of [a.first?0:null,a.last?1:null]){
      if(end===null)continue;const p=end?a.p3:a.p0;let best=null;
      for(const b of curves){
        if(b.owner===a.owner)continue;
        const tolerance=Math.min(2.5,Math.max(.4,(a.width+b.width)/4));
        if(p.x<b.box.x0-tolerance||p.x>b.box.x1+tolerance||p.y<b.box.y0-tolerance||p.y>b.box.y1+tolerance)continue;
        const near=nearest(b,p);if(near.distance<=tolerance&&(!best||near.distance<best.distance))best={...near,curve:b};
      }
      if(best){cut(a,end,best.point);cut(best.curve,best.t,best.point)}
    }
    const vertices=[],buckets=new Map(),edges=[];
    function vertex(p){
      const x=Math.round(p.x*1000),y=Math.round(p.y*1000);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const v=buckets.get(`${x+dx},${y+dy}`);if(v&&dist(v.p,p)<.002)return v}
      const v={id:vertices.length,p,out:[]};vertices.push(v);buckets.set(`${x},${y}`,v);return v;
    }
    const duplicates=new Set();
    for(const c of curves){
      c.cuts.sort((a,b)=>a.t-b.t);
      for(let i=1;i<c.cuts.length;i++){
        const a=c.cuts[i-1],b=c.cuts[i];if(b.t-a.t<EPS)continue;
        const part=slice(c,a.t,b.t),from=vertex(a.p),to=vertex(b.p);
        if(from===to&&dist(part.c1,part.p0)+dist(part.c2,part.p0)<.01)continue;
        // Move only the endpoint's own control when welding a subpixel gap.
        part.c1={x:part.c1.x+from.p.x-part.p0.x,y:part.c1.y+from.p.y-part.p0.y};
        part.c2={x:part.c2.x+to.p.x-part.p3.x,y:part.c2.y+to.p.y-part.p3.y};part.p0=from.p;part.p3=to.p;
        const mid=point(part,.5),key=`${Math.min(from.id,to.id)}:${Math.max(from.id,to.id)}:${mid.x.toFixed(3)},${mid.y.toFixed(3)}`;
        if(duplicates.has(key))continue;duplicates.add(key);
        const e={from,to,curve:part,owner:c.owner,token:`${c.owner}:${c.index}:${i-1}`,dead:false};
        const twin={from:to,to:from,curve:reverse(part),owner:c.owner,token:e.token,dead:false};e.twin=twin;twin.twin=e;from.out.push(e);to.out.push(twin);edges.push(e,twin);
      }
    }
    // Strip dangling branches: a T by itself must never invent a filled area.
    const queue=vertices.filter(v=>v.out.length<2);
    while(queue.length){const v=queue.pop();for(const e of v.out){if(e.dead)continue;e.dead=e.twin.dead=true;if(e.to.out.filter(x=>!x.dead).length<2)queue.push(e.to)}}
    for(const v of vertices){
      v.out=v.out.filter(e=>!e.dead);
      for(const e of v.out){let d=sub(e.curve.c1,e.curve.p0);if(Math.hypot(d.x,d.y)<EPS)d=sub(point(e.curve,.001),e.curve.p0);e.angle=Math.atan2(d.y,d.x)}
      v.out.sort((a,b)=>a.angle-b.angle);
    }
    const faces=[];
    for(const start of edges){
      if(start.dead||start.visited)continue;let current=start;const walk=[];
      while(current&&!current.visited&&walk.length<=edges.length){current.visited=true;walk.push(current);const exits=current.to.out,index=exits.indexOf(current.twin);current=exits[(index-1+exits.length)%exits.length]}
      if(current!==start||walk.length<2)continue;
      const segments=walk.map(e=>e.curve),polygon=segments.flatMap(s=>flatten(s).slice(0,-1)),size=area(polygon);
      if(size<=.5)continue;
      const tokens=walk.map(e=>e.token+(e.from.id<e.to.id?'+':'-'));
      // Canonical cyclic key is independent of the edge chosen to start walking.
      let key=tokens.join('|');for(let i=1;i<tokens.length;i++){const k=tokens.slice(i).concat(tokens.slice(0,i)).join('|');if(k<key)key=k}
      faces.push({key,segments,polygon,area:size,owners:[...new Set(walk.map(e=>e.owner))]});
    }
    return faces.sort((a,b)=>a.area-b.area);
  }
  const find = (faces,p) => faces.find(f=>contains(p,f.polygon))||null;
  const path = face => 'M'+face.segments[0].p0.x+' '+face.segments[0].p0.y+face.segments.map(s=>` C${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.p3.x} ${s.p3.y}`).join('')+' Z';
  function toItem(face,id,color) {
    const segments=[];
    function add(s){if(dist(s.p0,s.c1)>590||dist(s.p3,s.c2)>590){split(s,.5).forEach(add)}else segments.push(s)}
    face.segments.forEach(add);
    while(segments.length<3){const s=segments.shift();segments.unshift(...split(s,.5))}
    // Normal editable anchors with explicit, independent incoming/outgoing controls.
    const points=segments.map(s=>({...s.p0})),handles={};
    segments.forEach((s,i)=>{const p=s.p0,previous=segments[(i-1+segments.length)%segments.length],a=sub(previous.c2,p),b=sub(s.c1,p);handles[i]={in:Math.atan2(a.y,a.x)*180/Math.PI,out:Math.atan2(b.y,b.x)*180/Math.PI,inLength:Math.hypot(a.x,a.y),outLength:Math.hypot(b.x,b.y)}});
    return {id,type:'arrow',name:'區域填色',points,pointHandleAngles:handles,curved:true,closed:true,explicitBezier:false,color,width:0,style:'solid',startHead:false,endHead:false,fill:color,fillOpacity:1,regionFill:{key:face.key,sources:face.owners}};
  }
  return {line,point,split,slice,flatten,arc,contains,build,find,path,toItem};
})();
