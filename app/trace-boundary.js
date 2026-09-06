/* Close clipped tracing regions against the actual image rectangle.
 * This is explicit crop geometry, not inferred artist ink. Source curves and
 * their controls are kept intact; short joins and a zero-stroke editable rim
 * form ordinary native paths, so fills survive moving the reference or export.
 */
const TraceBoundary = (() => {
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function straight(points,closed,kind,junctions={}) {
    const handles={};
    points.forEach((p,i)=>{
      const prev=points[(i-1+points.length)%points.length],next=points[(i+1)%points.length];
      handles[i]={in:Math.atan2(prev.y-p.y,prev.x-p.x)*180/Math.PI,out:Math.atan2(next.y-p.y,next.x-p.x)*180/Math.PI,
        inLength:!closed&&i===0?0:distance(p,prev)/3,outLength:!closed&&i===points.length-1?0:distance(p,next)/3};
    });
    return {type:'arrow',name:kind==='rim'?'底圖邊緣（填色邊界）':'接至底圖邊緣',points,closed,curved:false,
      width:kind==='rim'?0:1.7,color:'#242b34',fill:'#ffffff',fillOpacity:0,startHead:false,endHead:false,
      autoTrace:true,traceBoundary:kind,pointHandleAngles:handles,pointJunctions:junctions,pointKinds:{},pointSmoothness:{}};
  }
  function close(result,width,height,{maxGap=6}={}) {
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Number.isFinite(maxGap)||maxGap<0||maxGap>32)throw new Error('Invalid image boundary');
    if(!result?.items?.length||result.items.some(it=>it.traceBoundary)||maxGap===0)return result;
    const ends=[],counts=new Map(),key=p=>`${p.x.toFixed(3)}:${p.y.toFixed(3)}`;
    result.items.forEach((it,index)=>{
      if(it.closed||it.autoTraceColored||it.points?.length<2)return;
      for(const at of [0,it.points.length-1]){
        const p=it.points[at];if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
        const k=key(p);counts.set(k,(counts.get(k)||0)+1);ends.push({index,at,p,k});
      }
    });
    const contacts=[];
    for(const end of ends){
      if(counts.get(end.k)!==1)continue;const {p}=end;
      if(p.x<0||p.y<0||p.x>width||p.y>height)continue;
      const candidates=[{x:0,y:p.y},{x:width,y:p.y},{x:p.x,y:0},{x:p.x,y:height}];
      candidates.sort((a,b)=>distance(a,p)-distance(b,p));
      const q=candidates[0],length=distance(p,q);if(length>maxGap)continue;
      const perimeter=q.y===0?q.x:q.x===width?width+q.y:q.y===height?width+height+width-q.x:2*(width+height)-q.y;
      contacts.push({...end,q,length,perimeter});
    }
    if(!contacts.length)return result;
    const items=JSON.parse(JSON.stringify(result.items)),joins=[],vertices=[
      {p:{x:0,y:0},t:0},{p:{x:width,y:0},t:width},
      {p:{x:width,y:height},t:width+height},{p:{x:0,y:height},t:2*width+height}];
    contacts.forEach((contact,i)=>{
      const it=items[contact.index];it.pointJunctions||={};
      const start=it.pointJunctions[contact.at]||`paper-end-${i}`,finish=contact.length<.001?start:`paper-rim-${i}`;
      it.pointJunctions[contact.at]=start;
      if(contact.length>=.001)joins.push(straight([{...contact.p},{...contact.q}],false,'join',{0:start,1:finish}));
      vertices.push({p:{...contact.q},t:contact.perimeter,junction:finish});
    });
    vertices.sort((a,b)=>a.t-b.t);
    const unique=[];
    for(const v of vertices){const prev=unique.at(-1);if(prev&&distance(v.p,prev.p)<.001){if(v.junction)prev.junction=v.junction}else unique.push(v)}
    const rim=straight(unique.map(v=>v.p),true,'rim',Object.fromEntries(unique.flatMap((v,i)=>v.junction?[[i,v.junction]]:[])));
    items.push(...joins,rim);
    return {...result,items,boundary:{width,height,maxGap,contacts:contacts.map(c=>({item:c.index,anchor:c.at,from:c.p,to:c.q,length:c.length}))},
      stats:{...result.stats,paths:items.length,anchors:items.reduce((n,it)=>n+it.points.length,0),borderJoins:joins.length}};
  }
  return {close};
})();
