/* Local, reversible curve fairing. Anchor positions and unselected handles stay fixed. */
const LocalSmoothing = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const delta = (a, b) => ({x:a.x-b.x, y:a.y-b.y});
  const angle = v => Math.atan2(v.y,v.x)*180/Math.PI;

  function buildPlan(item, selected, controls) {
    const base=clone(item), points=base.points;
    const duplicate=base.closed && points.length>2 && distance(points[0],points.at(-1))<.01;
    const count=points.length-(duplicate?1:0), selectedSet=new Set(selected.map(i=>duplicate&&i===count?0:i).filter(i=>Number.isInteger(i)&&i>=0&&i<count));
    const segments=Array.from({length:base.closed?count:count-1},(_,i)=>controls(i));
    const h=segments.map(s=>Math.max(.001,distance(s.p1,s.p2)));
    const original=new Map(), targets=new Map(), protectedIndices=[];
    for(const i of selectedSet) {
      if(!base.closed&&(i===0||i===count-1)) {protectedIndices.push(i);continue;}
      const previous=(i-1+count)%count, incoming=delta(segments[previous].c2,points[i]), outgoing=delta(segments[i].c1,points[i]);
      const inLength=Math.hypot(incoming.x,incoming.y), outLength=Math.hypot(outgoing.x,outgoing.y);
      // A sharp point, zero-amplitude point, or deliberately opposed travel
      // directions is a protected corner/cusp, not a bump to erase.
      const bendCos=inLength&&outLength?-(incoming.x*outgoing.x+incoming.y*outgoing.y)/(inLength*outLength):1;
      if(base.pointKinds?.[i]==='sharp'||(base.pointSmoothness?.[i]!=null&&Number(base.pointSmoothness[i])===0)||bendCos<Math.cos(50*Math.PI/180)||h[previous]<.01||h[i]<.01) {protectedIndices.push(i);continue;}
      original.set(i,{incoming,outgoing});
    }
    // Chord-length cubic-spline derivatives. Selected runs share one solve;
    // at their boundaries we use the existing (unselected) control handles.
    const derivatives=Array.from({length:count},()=>({x:0,y:0}));
    for(let sweep=0;sweep<48;sweep++) for(const i of original.keys()) {
      const previous=(i-1+count)%count, next=(i+1)%count, hp=h[previous], hn=h[i];
      const left=original.has(previous)?derivatives[previous]:{x:3*(segments[previous].c1.x-points[previous].x)/hp,y:3*(segments[previous].c1.y-points[previous].y)/hp};
      const right=original.has(next)?derivatives[next]:{x:3*(points[next].x-segments[i].c2.x)/hn,y:3*(points[next].y-segments[i].c2.y)/hn};
      for(const axis of ['x','y']) derivatives[i][axis]=(3*(hn*(points[i][axis]-points[previous][axis])/hp+hp*(points[next][axis]-points[i][axis])/hn)-hn*left[axis]-hp*right[axis])/(2*(hp+hn));
    }
    for(const i of original.keys()) {
      const previous=(i-1+count)%count, v=derivatives[i], length=Math.hypot(v.x,v.y);
      // A shared cap preserves tangent alignment while avoiding long loops.
      const factor=length?Math.min(1,1.35/length,1800/(Math.max(h[previous],h[i])*length)):1;
      targets.set(i,{incoming:{x:-v.x*factor*h[previous]/3,y:-v.y*factor*h[previous]/3},outgoing:{x:v.x*factor*h[i]/3,y:v.y*factor*h[i]/3}});
    }
    return {base,original,targets,selectedCount:selectedSet.size,protectedIndices};
  }

  function apply(plan, amount) {
    const result=clone(plan.base), strength=Math.max(0,Math.min(300,Number(amount)||0)), t=Math.min(1,strength/100);
    if(!t||!plan.targets.size)return result;
    result.pointHandleAngles=result.pointHandleAngles||{};
    result.pointAngles=result.pointAngles||{};
    for(const [i,target] of plan.targets) {
      const old=plan.original.get(i);
      // Beyond 100, extend the solved, aligned tangent pair for more roundness.
      // Do not extrapolate the old handles: that can reverse one side of a cusp.
      let boost=1;
      if(strength>100) {
        const pts=plan.base.points, duplicate=plan.base.closed&&distance(pts[0],pts.at(-1))<.01,count=pts.length-(duplicate?1:0);
        const incomingLength=Math.hypot(target.incoming.x,target.incoming.y),outgoingLength=Math.hypot(target.outgoing.x,target.outgoing.y);
        const before=distance(pts[i],pts[(i-1+count)%count]),after=distance(pts[i],pts[(i+1)%count]);
        boost=Math.min(1+(strength-100)/200,
          incomingLength?Math.min(600,before*.75)/incomingLength:Infinity,
          outgoingLength?Math.min(600,after*.75)/outgoingLength:Infinity);
        boost=Math.max(1,boost);
      }
      const mix=side=>({x:old[side].x*(1-t)+target[side].x*t*boost,y:old[side].y*(1-t)+target[side].y*t*boost});
      const incoming=mix('incoming'), outgoing=mix('outgoing');
      result.pointHandleAngles[i]={in:angle(incoming),out:angle(outgoing),inLength:Math.hypot(incoming.x,incoming.y),outLength:Math.hypot(outgoing.x,outgoing.y),linked:t===1};
      result.pointAngles[i]=angle(outgoing);
    }
    result.curved=true;
    return result;
  }
  return {buildPlan,apply};
})();
