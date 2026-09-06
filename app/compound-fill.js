/* Recover true fill contours from legacy retraced hole bridges.
 * Never match nearby edges: only coincident reverse cubics cancel. The editable
 * legacy source remains untouched; rendering/export receive separate contours.
 */
const CompoundFill = (() => {
  const cache=new WeakMap(),pointKey=p=>`${Math.round(p.x*1e5)},${Math.round(p.y*1e5)}`;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function curves(item){
    return item.points.map((p,i)=>{
      const j=(i+1)%item.points.length,q=item.points[j],a=item.pointHandleAngles?.[i],b=item.pointHandleAngles?.[j];
      if(item.curved===false)return{p0:p,c1:{x:(2*p.x+q.x)/3,y:(2*p.y+q.y)/3},c2:{x:(p.x+2*q.x)/3,y:(p.y+2*q.y)/3},p3:q};
      if(!a||!b)return null;
      return{p0:p,c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},p3:q};
    });
  }
  function asItem(source,segments){
    segments=[...segments];
    const mix=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    while(segments.length<3){
      const s=segments.shift(),a=mix(s.p0,s.c1),b=mix(s.c1,s.c2),c=mix(s.c2,s.p3),d=mix(a,b),e=mix(b,c),p=mix(d,e);
      segments.unshift({p0:s.p0,c1:a,c2:d,p3:p},{p0:p,c1:e,c2:c,p3:s.p3});
    }
    const points=segments.map(s=>({...s.p0})),handles={};
    segments.forEach((s,i)=>{const prev=segments[(i-1+segments.length)%segments.length],a={x:prev.c2.x-s.p0.x,y:prev.c2.y-s.p0.y},b={x:s.c1.x-s.p0.x,y:s.c1.y-s.p0.y};handles[i]={in:Math.atan2(a.y,a.x)*180/Math.PI,out:Math.atan2(b.y,b.x)*180/Math.PI,inLength:Math.hypot(a.x,a.y),outLength:Math.hypot(b.x,b.y)}});
    return{type:'arrow',closed:true,curved:true,explicitBezier:false,points,pointHandleAngles:handles,pointKinds:{},pointSmoothness:{},pointAngles:{},pointJunctions:{},color:source.color,width:source.width,fill:source.fill,fillOpacity:source.fillOpacity,startHead:false,endHead:false};
  }
  function recover(item){
    if(item?.type!=='arrow'||!item.closed||!item.autoTraceColored||item.explicitBezier||!item.points?.length)return null;
    const signature=JSON.stringify([item.points,item.pointHandleAngles,item.curved]);
    const saved=cache.get(item);if(saved?.signature===signature)return saved.parts;
    const segments=curves(item);
    if(segments.some(s=>!s||[s.p0,s.c1,s.c2,s.p3].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))){
      cache.set(item,{signature,parts:null});return null;
    }
    const waiting=new Map(),removed=new Set();
    segments.forEach((s,i)=>{
      const forward=[s.p0,s.c1,s.c2,s.p3].map(pointKey),key=forward.join(';'),reverse=[...forward].reverse().join(';');
      if(key===reverse)return;
      const opposing=waiting.get(reverse);
      if(opposing?.length){removed.add(i);removed.add(opposing.pop())}else{if(!waiting.has(key))waiting.set(key,[]);waiting.get(key).push(i)}
    });
    if(!removed.size){cache.set(item,{signature,parts:null});return null}
    const kept=segments.filter((_,i)=>!removed.has(i)),loops=[];let current=[];
    // All connector pairs must cancel cleanly. Do not guess a repair when an
    // edited old path no longer decomposes into closed, independent contours.
    for(const s of kept){
      if(current.length&&distance(current.at(-1).p3,s.p0)>1e-4){cache.set(item,{signature,parts:null});return null}
      current.push(s);
      if(distance(current[0].p0,s.p3)<1e-4){loops.push(current);current=[]}
    }
    const parts=!current.length&&loops.length>1?loops.map(loop=>asItem(item,loop)):null;
    cache.set(item,{signature,parts});return parts;
  }
  function path(parts){return parts.map(it=>{const s=curves(it);return`M${s[0].p0.x} ${s[0].p0.y}`+s.map(c=>`C${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.p3.x} ${c.p3.y}`).join('')+'Z'}).join(' ')}
  return{recover,path,curves};
})();
