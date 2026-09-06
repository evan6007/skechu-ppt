/* Closed-region vectorization, adapted to native editable Skechu curves.
 * Cutout fits shared boundaries consistently, but repeats them in each region.
 * Fill loops remain closed; the visible stroke network emits each edge once.
 * No dilation, skeleton joining, raster overlays or generated image content.
 */
const IllustrationTrace=(function createIllustrationTrace(){
  let bytesPromise=null;
  function wasmBytes(){
    if(!bytesPromise)bytesPromise=fetch('vendor/vtracer.wasm?v=1.0.0-alpha.4').then(response=>{if(!response.ok)throw Error('插畫描圖引擎下載失敗');return response.arrayBuffer()}).then(buffer=>{const bytes=new Uint8Array(buffer);if(bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw Error('插畫描圖引擎檔案不正確');return bytes}).catch(error=>{bytesPromise=null;throw error});
    return bytesPromise.then(bytes=>bytes.slice());
  }
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const line=(a,b)=>({p0:a,c1:mix(a,b,1/3),c2:mix(a,b,2/3),p3:b});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const reverse=s=>({p0:s.p3,c1:s.c2,c2:s.c1,p3:s.p0});
  // Match only output precision, never a stroke-width neighbourhood. Nearby
  // parallel strokes (eyelids, highlights, earrings) must not be welded.
  const pointKey=p=>`${Math.round(p.x*1e4)},${Math.round(p.y*1e4)}`;
  const curveKey=s=>{const a=[s.p0,s.c1,s.c2,s.p3].map(pointKey),b=a.slice().reverse();return [a.join(';'),b.join(';')].sort()[0]};
  function flatten(s){
    const out=[s.p0];
    function visit(c,depth){
      const len=distance(c.p0,c.p3),dx=c.p3.x-c.p0.x,dy=c.p3.y-c.p0.y;
      const error=len?Math.max(...[c.c1,c.c2].map(p=>Math.abs((p.x-c.p0.x)*dy-(p.y-c.p0.y)*dx)/len)):Infinity;
      if(depth>=12||(error<.08&&distance(c.p0,c.c1)+distance(c.c1,c.c2)+distance(c.c2,c.p3)-len<.08)){out.push(c.p3);return}
      const a=mix(c.p0,c.c1,.5),b=mix(c.c1,c.c2,.5),d=mix(c.c2,c.p3,.5),e=mix(a,b,.5),f=mix(b,d,.5),p=mix(e,f,.5);
      visit({p0:c.p0,c1:a,c2:e,p3:p},depth+1);visit({p0:p,c1:f,c2:d,p3:c.p3},depth+1);
    }
    visit(s,0);return out;
  }
  const polygon=curves=>curves.flatMap(s=>flatten(s).slice(0,-1));
  const area=pts=>pts.reduce((n,p,i)=>{const q=pts[(i+1)%pts.length];return n+p.x*q.y-p.y*q.x},0)/2;
  function contains(p,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
  const length=s=>{const ps=flatten(s);return ps.slice(1).reduce((n,p,i)=>n+distance(ps[i],p),0)};
  function components(loops,color){
    const rings=loops.map(curves=>{const ps=polygon(curves);return{curves,ps,size:Math.abs(area(ps)),parent:null,depth:0}}).sort((a,b)=>b.size-a.size);
    for(let i=0;i<rings.length;i++){
      const r=rings[i];for(let j=i-1;j>=0;j--)if(contains(r.ps[0],rings[j].ps)){r.parent=rings[j];r.depth=r.parent.depth+1;break}
    }
    // Separate disconnected islands. Only actual holes belong to their outer
    // fill; do not connect unrelated same-colour pieces across the drawing.
    return rings.filter(r=>r.depth%2===0).map(r=>({color,loops:[r.curves,...rings.filter(h=>h.parent===r&&h.depth%2===1).map(h=>h.curves)]}));
  }
  function splitStraightEdges(regions){
    const groups=new Map(),straight=new Map();
    for(const r of regions)for(const s of r.loops.flat()){
      const len=distance(s.p0,s.p3);if(len<1e-6)continue;
      let x=(s.p3.x-s.p0.x)/len,y=(s.p3.y-s.p0.y)/len;if(x<0||(Math.abs(x)<1e-10&&y<0)){x=-x;y=-y}
      if([s.c1,s.c2].some(p=>Math.abs((p.x-s.p0.x)*y-(p.y-s.p0.y)*x)>1e-5))continue;
      const a=s.p0.x*x+s.p0.y*y,b=s.p3.x*x+s.p3.y*y;
      if([s.c1,s.c2].some(p=>p.x*x+p.y*y<Math.min(a,b)-1e-5||p.x*x+p.y*y>Math.max(a,b)+1e-5))continue;
      const key=`${Math.round(x*1e8)},${Math.round(y*1e8)},${Math.round((s.p0.y*x-s.p0.x*y)*1e4)}`;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a,b);straight.set(s,{key,a,b});
    }
    for(const [key,ts] of groups)groups.set(key,[...new Set(ts)].sort((a,b)=>a-b));
    for(const r of regions)r.loops=r.loops.map(loop=>loop.flatMap(s=>{
      const info=straight.get(s);if(!info)return[s];const {a,b,key}=info,lo=Math.min(a,b),hi=Math.max(a,b);
      const ts=groups.get(key).filter(t=>t>lo+1e-5&&t<hi-1e-5);if(a>b)ts.reverse();
      const pts=[s.p0,...ts.map(t=>mix(s.p0,s.p3,(t-a)/(b-a))),s.p3];return pts.slice(1).map((p,i)=>line(pts[i],p));
    }));
  }
  function edgeMap(regions){
    const edges=new Map();regions.forEach((r,owner)=>r.loops.flat().forEach(s=>{
      if(distance(s.p0,s.p3)+distance(s.p0,s.c1)+distance(s.p3,s.c2)<1e-5)return;
      const key=curveKey(s);if(!edges.has(key))edges.set(key,{curve:s,uses:[],length:length(s)});edges.get(key).uses.push({owner,curve:s});
    }));return edges;
  }
  function boundaryLoops(edges){
    const outgoing=new Map();edges.forEach(e=>{const k=pointKey(e.p0);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(e)});
    const used=new Set(),loops=[];
    for(const start of edges){
      if(used.has(start))continue;const loop=[];let e=start;
      while(e&&!used.has(e)){
        used.add(e);loop.push(e);if(pointKey(e.p3)===pointKey(start.p0))break;
        const candidates=(outgoing.get(pointKey(e.p3))||[]).filter(c=>!used.has(c));
        const back=Math.atan2(e.c2.y-e.p3.y,e.c2.x-e.p3.x);
        const turn=c=>(back-Math.atan2(c.c1.y-c.p0.y,c.c1.x-c.p0.x)+Math.PI*4)%(Math.PI*2);
        candidates.sort((a,b)=>turn(a)-turn(b));e=candidates[0];
      }
      if(pointKey(loop.at(-1).p3)!==pointKey(start.p0))return null;
      loops.push(loop);
    }
    return loops;
  }
  function cleanTransitionBands(regions,maxWidth){
    if(maxWidth<=0)return{regions,removed:0};
    const edges=edgeMap(regions),parent=regions.map((_,i)=>i),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
    const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
    const sizes=regions.map(r=>Math.abs(r.loops.reduce((n,c)=>n+area(polygon(c)),0))),colors=regions.map(r=>rgb(r.color));
    let removed=0;
    for(let pass=0;pass<6;pass++){
      const neighbours=regions.map(()=>new Map()),perimeters=regions.map(()=>0);
      for(const e of edges.values()){
        const owners=[...new Set(e.uses.map(u=>root(u.owner)))];if(owners.length===1&&e.uses.some(u=>u.owner!==e.uses[0].owner))continue;
        for(const a of owners){perimeters[a]+=e.length;for(const b of owners)if(a!==b)neighbours[a].set(b,(neighbours[a].get(b)||0)+e.length)}
      }
      const candidates=regions.map((_,i)=>i).filter(i=>root(i)===i&&perimeters[i]&&2*sizes[i]/perimeters[i]<=maxWidth).sort((a,b)=>sizes[a]-sizes[b]);
      let changed=false;
      for(const i of candidates){
        if(root(i)!==i)continue;
        const adjacent=new Map();for(const [j,len] of neighbours[i]){const k=root(j);if(k!==i)adjacent.set(k,(adjacent.get(k)||0)+len)}
        const ns=[...adjacent].sort((a,b)=>b[1]-a[1]);if(ns.length<2||ns[0][1]+ns[1][1]<perimeters[i]*.7)continue;
        const a=ns[0][0],b=ns[1][0],v=colors[b].map((n,k)=>n-colors[a][k]),den=v.reduce((n,c)=>n+c*c,0);
        if(den<32**2)continue;
        const t=colors[i].reduce((n,c,k)=>n+(c-colors[a][k])*v[k],0)/den;
        const residual=Math.hypot(...colors[i].map((c,k)=>c-colors[a][k]-t*v[k]));
        const luminance=c=>.2126*c[0]+.7152*c[1]+.0722*c[2],la=luminance(colors[a]),lb=luminance(colors[b]),li=luminance(colors[i]);
        // Only interpolation fringes qualify. A true dark ink stroke or light
        // reflection is outside the neighbouring colours, so keep it intact.
        if(t<.02||t>.98||li<=Math.min(la,lb)||li>=Math.max(la,lb)||residual>Math.min(48,Math.sqrt(den)*.3))continue;
        const target=t<=.5?a:b;if(sizes[target]<sizes[i]*2)continue;
        parent[i]=target;sizes[target]+=sizes[i];removed++;changed=true;
      }
      if(!changed)break;
    }
    if(!removed)return{regions,removed};
    const boundaries=new Map();
    for(const e of edges.values()){
      const byOwner=new Map();for(const u of e.uses){const k=root(u.owner);if(!byOwner.has(k))byOwner.set(k,[]);byOwner.get(k).push(u)}
      for(const [owner,uses] of byOwner){
        // Cancel opposing edges inside the union, preserving outer/hole winding.
        const forward=uses.filter(u=>pointKey(u.curve.p0)===pointKey(e.curve.p0)),backward=uses.filter(u=>!forward.includes(u));
        const remaining=forward.length>backward.length?forward.slice(backward.length):backward.slice(forward.length);
        if(!boundaries.has(owner))boundaries.set(owner,[]);boundaries.get(owner).push(...remaining.map(u=>u.curve));
      }
    }
    const cleaned=[];for(const [owner,boundary] of boundaries){const loops=boundaryLoops(boundary);if(!loops)return{regions,removed:0};cleaned.push(...components(loops,regions[owner].color))}
    return{regions:cleaned,removed};
  }
  function strokeNetwork(regions,geometry){
    const edges=edgeMap(regions),vertices=new Map();let originalEdges=0;
    const vertex=p=>{const key=pointKey(p);if(!vertices.has(key))vertices.set(key,{id:vertices.size,p,edges:[]});return vertices.get(key)};
    for(const e of edges.values()){e.a=vertex(e.curve.p0);e.b=vertex(e.curve.p3);e.a.edges.push(e);e.b.edges.push(e);originalEdges+=e.uses.length}
    const junctions=new Set([...vertices.values()].filter(v=>v.edges.length>2).map(v=>v.id)),items=[];
    function walk(start,first){
      const curves=[],owners=new Set();let v=start,e=first;
      while(e&&!e.visited){e.visited=true;curves.push(e.a===v?e.curve:reverse(e.curve));e.uses.forEach(u=>owners.add(u.owner));v=e.a===v?e.b:e.a;if(v===start||v.edges.length!==2)break;e=v.edges.find(c=>!c.visited)}
      const item=geometry.toItem({closed:v===start,start:start.id,end:v.id},curves,'#182c49',1.25,junctions);
      if(item){item.autoTraceMode='illustration';item.autoTraceRegions=[...owners].sort((a,b)=>a-b);items.push(item)}
    }
    for(const v of vertices.values())if(v.edges.length!==2)for(const e of v.edges)if(!e.visited)walk(v,e);
    for(const e of edges.values())if(!e.visited)walk(e.a,e);
    return{items,sharedEdgesRemoved:originalEdges-edges.size,junctions:junctions.size};
  }
  // Denoise before clustering, not by rounding already fitted boundaries.
  // A small bilateral neighbourhood suppresses JPEG/gradient speckles while
  // retaining high-contrast rims, narrow highlights and the original alpha.
  // It runs only in the illustration worker; it never edits the reference.
  function denoise(data,w,h,amount){
    if(amount<=0)return data;
    const sigma=Math.min(24,Math.max(4,amount*4.8)),range=new Float32Array(195076),kernel=[];
    for(let i=0;i<range.length;i++)range[i]=Math.exp(-i/(6*sigma*sigma));
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)kernel.push([dx,dy,Math.exp(-(dx*dx+dy*dy)/3)]);
    const out=new Uint8Array(data.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2],alpha=data[i+3];let rr=0,gg=0,bb=0,total=0;
      if(alpha)for(const [dx,dy,spatial] of kernel){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
        const j=(yy*w+xx)*4,dr=data[j]-r,dg=data[j+1]-g,db=data[j+2]-b;
        const weight=spatial*range[dr*dr+dg*dg+db*db]*data[j+3]/255;
        total+=weight;rr+=data[j]*weight;gg+=data[j+1]*weight;bb+=data[j+2]*weight;
      }
      out[i]=total?Math.round(rr/total):r;out[i+1]=total?Math.round(gg/total):g;out[i+2]=total?Math.round(bb/total):b;out[i+3]=alpha;
    }
    return out;
  }
  function parsePath(d){
    const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[],loops=[];let i=0,command='',p={x:0,y:0},start=null,curves=[];
    const number=()=>{if(i>=tokens.length||/^[a-z]$/i.test(tokens[i]))throw Error('向量輪廓座標不完整');const n=Number(tokens[i++]);if(!Number.isFinite(n))throw Error('向量輪廓座標不正確');return n};
    const close=()=>{if(!start)return;if(Math.hypot(p.x-start.x,p.y-start.y)>1e-7)curves.push(line(p,start));if(curves.length)loops.push(curves);p=start;start=null;curves=[]};
    while(i<tokens.length){
      if(/^[a-z]$/i.test(tokens[i]))command=tokens[i++];
      const lower=command.toLowerCase(),relative=command===lower,origin={...p},point=()=>({x:number()+(relative?origin.x:0),y:number()+(relative?origin.y:0)});
      if(lower==='m'){if(start)throw Error('向量輪廓未封閉');p=point();start=p;command=relative?'l':'L'}
      else if(lower==='z'){close();command=''}
      else if(!start)throw Error('向量輪廓缺少起點');
      else if(lower==='l'){const q=point();curves.push(line(p,q));p=q}
      else if(lower==='h'){const q={x:number()+(relative?p.x:0),y:p.y};curves.push(line(p,q));p=q}
      else if(lower==='v'){const q={x:p.x,y:number()+(relative?p.y:0)};curves.push(line(p,q));p=q}
      else if(lower==='c'){const c1=point(),c2=point(),q=point();curves.push({p0:p,c1,c2,p3:q});p=q}
      else if(lower==='q'){const c=point(),q=point();curves.push({p0:p,c1:mix(p,c,2/3),c2:mix(q,c,2/3),p3:q});p=q}
      else throw Error('不支援的向量輪廓指令：'+command);
    }
    if(start)throw Error('向量輪廓未封閉');return loops;
  }
  function fromSVG(svg,geometry,{maxTransitionWidth=0}={}){
    const sourceRegions=[];let inputAnchors=0;
    for(const match of svg.matchAll(/<path\b([^>]+)>/g)){
      const attr=match[1],d=attr.match(/\bd="([^"]+)"/)?.[1],color=attr.match(/\bfill="(#[0-9a-f]{6})"/i)?.[1];
      if(!d||!color||/\btransform=/.test(attr))throw Error('向量色區格式不正確');
      const loops=parsePath(d);inputAnchors+=loops.reduce((n,c)=>n+c.length,0);
      sourceRegions.push(...components(loops,color));
      if(sourceRegions.length>1800||inputAnchors>40000)throw new Error('細碎色區太多；請降低「插畫細節」或增加「細節清理」後重試。');
    }
    splitStraightEdges(sourceRegions);
    const cleaned=cleanTransitionBands(sourceRegions,maxTransitionWidth),regions=cleaned.regions;
    const network=strokeNetwork(regions,geometry),items=network.items,colorItems=[];
    regions.forEach(({loops,color},region)=>{
      const joined=[];
      for(const curves of loops){
        // Zero-area, retraced connectors preserve hole winding in native PPT
        // Freeform fills. This representation is never used for visible strokes.
        if(joined.length){const origin=joined[0].p0;joined.push(line(origin,curves[0].p0),...curves,line(curves[0].p0,origin))}else joined.push(...curves);
      }
      if(joined.length){const fill=geometry.toItem({closed:true},joined,color,0,new Set());fill.fill=color;fill.fillOpacity=1;fill.autoTraceMode='illustration';fill.autoTraceColored=true;fill.autoTraceRegion=region;colorItems.push(fill)}
    });
    return{items,colorItems,issues:[],stats:{mode:'illustration',paths:items.length,anchors:items.reduce((n,it)=>n+it.points.length,0),regions:colorItems.length,junctions:network.junctions,sharedEdgesRemoved:network.sharedEdgesRemoved,transitionBandsRemoved:cleaned.removed,reviewCount:0}};
  }
  function run(data,w,h,options,geometry,progress){
    if(typeof VTracerWasm==='undefined')throw Error('插畫描圖元件尚未載入，請重新整理頁面。');
    progress(10,'保留細小邊緣，去除壓縮雜訊');
    const cleaned=denoise(data,w,h,options.minLength);
    progress(25,'分離深色細節與周圍陰影');
    const svg=VTracerWasm.convertPixels(cleaned,w,h,{clustering:'color-cluster',hierarchical:'cutout',mode:'spline',colorPrecision:6,layerDifference:Math.round(72-(options.threshold-40)*.3),filterSpeckle:Math.max(1,Math.round(options.minLength)),simplify:Math.max(.2,options.accuracy*(.13+.003*options.simplify)),pathPrecision:4,optimize:0});
    progress(75,'清理過渡細帶，每段共用交界只描一次');
    const result=fromSVG(svg,geometry,{maxTransitionWidth:options.minLength>0?Math.min(6,1+options.minLength):0});progress(100,'獨立線稿與封閉填色區域預覽完成');return result;
  }
  return{run,fromSVG,parsePath,denoise,wasmBytes,workerSource:()=>`${VTracerWasm.workerSource()}const IllustrationTrace=(${createIllustrationTrace.toString()})();`};
})();
