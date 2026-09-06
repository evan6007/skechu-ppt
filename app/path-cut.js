/* Exact cubic subdivision. No raster erasing, deleted spans or re-fitting. */
const PathCut = (() => {
  const E=1e-7, copy=value=>JSON.parse(JSON.stringify(value));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const sampled=s=>{
    const samples=RegionFill.flatten(s,.05),pts=[s.p0,s.c1,s.c2,s.p3];
    return {...s,samples,box:{x0:Math.min(...pts.map(p=>p.x)),y0:Math.min(...pts.map(p=>p.y)),x1:Math.max(...pts.map(p=>p.x)),y1:Math.max(...pts.map(p=>p.y))}};
  };
  function prepare(boundary) { return {...boundary,segments:boundary.segments.map(sampled)}; }
  function closest(boundary,p) {
    let best=null;
    boundary.segments.forEach((s,index)=>{const near=RegionFill.nearest(s.samples?s:sampled(s),p);if(!best||near.distance<best.distance)best={...near,index,at:index+near.t};});
    return best;
  }
  function intersections(boundary,knife) {
    const hits=[];
    for(let j=1;j<knife.length;j++){
      if(distance(knife[j-1],knife[j])<E)continue;
      const b=sampled(RegionFill.line(knife[j-1],knife[j]));
      boundary.segments.forEach((s,index)=>{
        const box=s.box;if(box&&(box.x1<b.box.x0-E||b.box.x1<box.x0-E||box.y1<b.box.y0-E||b.box.y1<box.y0-E))return;
        for(const hit of RegionFill.intersections(s.samples?s:sampled(s),b)){
          const at=index+hit.ta;
          if(!hits.some(h=>Math.abs(h.at-at)<1e-5))hits.push({at,index,t:hit.ta,point:RegionFill.point(s,hit.ta)});
        }
      });
    }
    return hits.sort((a,b)=>a.at-b.at);
  }
  function ranges(boundary,locations) {
    const n=boundary.segments.length;
    const cuts=[...new Set(locations.filter(Number.isFinite).map(v=>{
      v=Math.max(0,Math.min(n,v));if(Math.abs(v-Math.round(v))<E)v=Math.round(v);
      return boundary.closed&&v===n?0:v;
    }))].sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>E);
    const interior=boundary.closed?cuts:cuts.filter(t=>t>E&&t<n-E);
    if(!interior.length)return [];
    const breaks=boundary.closed?interior.concat(interior[0]+n):[0,...interior,n];
    return breaks.slice(0,-1).map((a,i)=>({a,b:breaks[i+1]}));
  }
  function pieces(boundary,locations) {
    const n=boundary.segments.length;
    return ranges(boundary,locations).map(range=>{
      const segments=[];
      for(let cursor=range.a;cursor<range.b-E;){
        const index=Math.floor(cursor),end=Math.min(index+1,range.b);
        const s=RegionFill.slice(boundary.segments[index%n],cursor-index,end-index);
        // The editor caps handles at 600; subdivide long handles without changing geometry.
        const append=c=>{if(Math.max(distance(c.p0,c.c1),distance(c.p3,c.c2))>590)RegionFill.split(c,.5).forEach(append);else segments.push(c);};
        append(s);cursor=end;
      }
      return {...range,segments};
    });
  }
  function toItem(source,boundary,piece,newId) {
    const curves=piece.segments,pts=[curves[0].p0,...curves.map(s=>s.p3)].map(copy);
    const it={...copy(source),id:newId,type:'arrow',points:pts,closed:false,curved:true,explicitBezier:false,
      edgeLocked:false,centerlineLocked:false,smoothnessDefault:100,fill:'none',fillOpacity:0,
      color:source.type==='arrow'?source.color:source.stroke,width:source.type==='arrow'?source.width:source.strokeWidth,
      pointKinds:{},pointSmoothness:{},pointAngles:{},pointHandleAngles:{},pointJunctions:{},autoTraceReview:{},attachments:{}};
    delete it.regionFill;delete it.networkId;
    const first=!boundary.closed&&piece.a===0,last=!boundary.closed&&piece.b===boundary.segments.length;
    it.startHead=first&&!!source.startHead;it.endHead=last&&source.type==='arrow'&&source.endHead!==false;
    if(first&&source.attachments?.start)it.attachments.start=copy(source.attachments.start);
    if(last&&source.attachments?.end)it.attachments.end=copy(source.attachments.end);
    for(let i=0;i<pts.length;i++){
      const p=pts[i],incoming=i?curves[i-1].c2:p,outgoing=i<curves.length?curves[i].c1:p;
      it.pointHandleAngles[i]={in:Math.atan2(incoming.y-p.y,incoming.x-p.x)*180/Math.PI,out:Math.atan2(outgoing.y-p.y,outgoing.x-p.x)*180/Math.PI,inLength:distance(p,incoming),outLength:distance(p,outgoing)};
      const severed=(i===0&&!first)||(i===pts.length-1&&!last);
      if(!severed){const old=(source.points||[]).findIndex(q=>distance(p,q)<E);if(old>=0)for(const key of ['pointJunctions','autoTraceReview'])if(source[key]?.[old]!==undefined)it[key][i]=copy(source[key][old]);}
    }
    return it;
  }
  function insertAnchors(source,boundary,locations){
    const n=boundary.segments.length;
    const cuts=locations.filter(t=>Number.isFinite(t)&&t>E&&t<n-E&&Math.abs(t-Math.round(t))>1e-5).sort((a,b)=>a-b).filter((t,i,all)=>!i||t-all[i-1]>1e-5);
    if(!cuts.length)return null; // Crossing an existing node does not duplicate it.
    const segments=[],positions=[0];
    const append=(s,a,b)=>{
      if(Math.max(distance(s.p0,s.c1),distance(s.p3,s.c2))>590){const [left,right]=RegionFill.split(s,.5),mid=(a+b)/2;append(left,a,mid);append(right,mid,b);}
      else {segments.push(s);positions.push(b);}
    };
    boundary.segments.forEach((s,index)=>{
      const breaks=[0,...cuts.filter(t=>t>index&&t<index+1).map(t=>t-index),1];
      for(let i=1;i<breaks.length;i++)append(RegionFill.slice(s,breaks[i-1],breaks[i]),index+breaks[i-1],index+breaks[i]);
    });
    const item=toItem(source,boundary,{a:0,b:n,segments},source.id);
    item.closed=!!boundary.closed;
    if(item.closed){item.points.pop();positions.pop();}
    // Insertion retains the same object, its fill, endpoint attachments and T links.
    item.fill=source.fill;item.fillOpacity=source.type==='arrow'?source.fillOpacity:(source.opacity??1);
    item.startHead=source.type==='arrow'&&!!source.startHead;item.endHead=source.type==='arrow'&&source.endHead!==false;
    item.attachments=copy(source.attachments||{});
    if(source.networkId!==undefined)item.networkId=source.networkId;
    const props=['pointKinds','pointSmoothness','pointAngles','pointJunctions','autoTraceReview'];
    for(const key of props)item[key]={};item.pointHandleAngles={};item.manualAnchorIndices=[];
    for(let i=0;i<item.points.length;i++){
      const p=item.points[i],incoming=i?segments[i-1].c2:item.closed?segments.at(-1).c2:p,outgoing=i<segments.length?segments[i].c1:p;
      item.pointHandleAngles[i]={in:Math.atan2(incoming.y-p.y,incoming.x-p.x)*180/Math.PI,out:Math.atan2(outgoing.y-p.y,outgoing.x-p.x)*180/Math.PI,inLength:distance(p,incoming),outLength:distance(p,outgoing)};
      const at=positions[i];let old=-1;
      if(Math.abs(at-Math.round(at))<E){
        if(source.type==='arrow'&&!source.explicitBezier&&n===source.points.length-(source.closed?0:1))old=Math.round(at);
        else if(source.explicitBezier&&!source.closed)old=Math.round(at)*3;
        else old=(source.points||[]).findIndex(q=>distance(p,q)<E);
      }
      if(old>=0){for(const key of props)if(source[key]?.[old]!==undefined)item[key][i]=copy(source[key][old]);if(source.manualAnchorIndices?.includes(old))item.manualAnchorIndices.push(i);}
    }
    return {item,addedIndices:positions.flatMap((t,i)=>cuts.some(c=>Math.abs(t-c)<E)?[i]:[])};
  }
  return {prepare,closest,intersections,ranges,pieces,toItem,insertAnchors};
})();
