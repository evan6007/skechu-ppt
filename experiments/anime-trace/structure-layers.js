/* Local experiment: source-profile evidence is NOT semantic segmentation.
 * Preserve the complete cubic fill graph while deciding which spans need ink.
 * Uncertain contours stay visible; no color loop is promoted to an artist stroke.
 */
const AnimeStructureLayers = (() => {
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const median = a => [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)] ?? 0;
  function curves(item) {
    return item.points.slice(0,item.closed?undefined:-1).map((p,i)=>{
      const j=(i+1)%item.points.length,q=item.points[j],a=item.pointHandleAngles[i],b=item.pointHandleAngles[j];
      return {p0:{...p},c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},
        c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},p3:{...q}};
    });
  }
  function sample(data,w,h,x,y) {
    x=Math.max(0,Math.min(w-1,x-.5));y=Math.max(0,Math.min(h-1,y-.5));
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,out=[0,0,0];
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const i=(Math.min(h-1,iy+dy)*w+Math.min(w-1,ix+dx))*4,alpha=data[i+3]/255;
      const weight=(dx?fx:1-fx)*(dy?fy:1-fy);
      for(let k=0;k<3;k++)out[k]+=weight*(data[i+k]*alpha+255*(1-alpha));
    }
    return out;
  }
  const luma = c => c[0]*.2126+c[1]*.7152+c[2]*.0722;
  function profile(curve,t,data,w,h,geometry) {
    const p=geometry.point(curve,t),a=geometry.point(curve,Math.max(0,t-.01)),b=geometry.point(curve,Math.min(1,t+.01));
    const n=distance(a,b);if(n<1e-6)return {ink:false,step:false};
    const nx=-(b.y-a.y)/n,ny=(b.x-a.x)/n,colors=[];
    for(let offset=-7;offset<=7;offset++)colors.push(sample(data,w,h,p.x+nx*offset,p.y+ny*offset));
    const luminances=colors.map(luma),left=median(luminances.slice(0,3)),right=median(luminances.slice(-3));
    const center=luminances.slice(4,11),valley=Math.min(left,right)-Math.min(...center),ridge=Math.max(...center)-Math.max(left,right);
    // An ink valley (or light highlight ridge) must exist on BOTH sides.
    const ink=valley>=9||ridge>=12;
    const span=Math.abs(right-left),variation=luminances.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-luminances[i]),0);
    // Dark silhouettes/black earrings and faint uncertain edges are protected.
    // A mostly monotone transition between midtones is a fill-only candidate.
    const step=!ink&&Math.min(left,right)>65&&span>=18&&variation<=span*1.45+5;
    return {ink,step,valley,ridge,span,left,right,x:p.x,y:p.y};
  }
  function run(result,{data,width,height},engine,geometry,options={}) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width*height>5e6||data?.length!==width*height*4)throw new Error('Expected aligned RGBA reference, at most 5 million pixels.');
    if(!engine?.toItem||!geometry?.build)throw new Error('AutoTrace and RegionFill are required.');
    const sourcePaths=result.items.map((it,i)=>({id:String(i),closed:!!it.closed,width:it.width,segments:curves(it)}));
    const faces=geometry.build(sourcePaths);
    // Every rim-adjacent face is protected, not just whichever face is largest.
    const rims=new Set(result.items.flatMap((it,i)=>it.traceBoundary==='rim'?[String(i)]:[]));
    const exterior=faces.filter(face=>face.owners.some(owner=>rims.has(owner)));
    const items=[],decisions=[];
    result.items.forEach((original,index)=>{
      const segments=sourcePaths[index].segments;
      const labels=segments.map((s,segment)=>{
        if(original.traceBoundary)return {role:'closure',reason:'paper-boundary',segment};
        const length=geometry.flatten(s).reduce((n,p,i,a)=>n+(i?distance(p,a[i-1]):0),0);
        const count=Math.max(5,Math.min(41,Math.ceil(length/3))),evidence=[];
        for(let i=0;i<count;i++)evidence.push(profile(s,(i+.5)/count,data,width,height,geometry));
        const ink=evidence.filter(e=>e.ink).length/count,step=evidence.filter(e=>e.step).length/count;
        // Do not hide silhouettes or short uncertain connector/corner spans.
        const protectedExterior=exterior.some(face=>face.owners.includes(String(index)));
        const hide=options.hideColorSteps!==false&&!protectedExterior&&length>=5&&ink<.15&&step>=.7;
        return {segment,role:hide?'closure':'ink',reason:hide?'source-color-step':ink>=.3?'source-ridge':protectedExterior?'exterior':'uncertain-preserved',ink,step,length,protectedExterior};
      });
      // Hysteresis on a complete chain avoids a one-sample threshold creating
      // a stray arc in an otherwise uninked shadow loop. Strong ink survives.
      const total=labels.reduce((n,l)=>n+(l.length||0),0);
      const meanInk=labels.reduce((n,l)=>n+(l.ink||0)*(l.length||0),0)/(total||1);
      const meanStep=labels.reduce((n,l)=>n+(l.step||0)*(l.length||0),0)/(total||1);
      if(options.hideColorSteps!==false&&meanInk<.18&&meanStep>=.75&&!labels.some(l=>l.protectedExterior||l.ink>=.3)){
        for(const l of labels)if(l.reason!=='paper-boundary'){l.role='closure';l.reason='source-color-step'}
      }
      for(let i=0;i<labels.length;i++){
        const l=labels[i],prev=labels[(i-1+labels.length)%labels.length],next=labels[(i+1)%labels.length];
        if(l.reason==='uncertain-preserved'&&l.ink<.15&&l.step>=.6&&prev.role==='closure'&&next.role==='closure'&&(original.closed||i>0&&i<labels.length-1)){
          l.role='closure';l.reason='source-color-step';
        }
      }
      const groups=[];
      labels.forEach((label,i)=>{const last=groups.at(-1);if(last?.role===label.role){last.indices.push(i)}else groups.push({role:label.role,indices:[i]})});
      if(original.closed&&groups.length>1&&groups[0].role===groups.at(-1).role){groups[0].indices=groups.at(-1).indices.concat(groups[0].indices);groups.pop()}
      groups.forEach((group,g)=>{
        const closed=!!original.closed&&groups.length===1;
        const made=engine.toItem({closed},group.indices.map(i=>segments[i]),original.color,group.role==='closure'?0:original.width,new Set());
        const item={...JSON.parse(JSON.stringify(original)),...made,id:`structure-${index}-${g}`,pointJunctions:{},
          name:group.role==='closure'?'填色邊界（無描邊）':'結構筆畫',structureRole:group.role,
          structureSource:{item:index,segments:group.indices},fillOpacity:0};
        // Preserve authored junction identities, including newly split boundaries.
        for(let i=0;i<item.points.length;i++){
          const old=original.points.findIndex(p=>distance(p,item.points[i])<1e-8);
          if(old>=0&&original.pointJunctions?.[old])item.pointJunctions[i]=original.pointJunctions[old];
        }
        items.push(item);
      });
      decisions.push(...labels.map(label=>({item:index,...label})));
    });
    return {...result,items,structure:{decisions,visible:items.filter(it=>it.structureRole==='ink').length,
      closures:items.filter(it=>it.structureRole==='closure').length,hiddenColorSpans:decisions.filter(d=>d.reason==='source-color-step').length,
      uncertainSpans:decisions.filter(d=>d.reason==='uncertain-preserved').length,method:'conservative-source-profiles-v1'},
      stats:{...result.stats,paths:items.length,anchors:items.reduce((n,it)=>n+it.points.length,0)}};
  }
  return {run,curves,profile};
})();
