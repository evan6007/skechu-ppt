/* Replace redundant thin dark color regions with already-present structural ink.
 * Union the region into an adjacent fill; never leave a transparent crack.
 * This experiment does not simplify or move any remaining contour coordinates.
 */
const AnimeInkFillSimplify=(()=>{
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),key=p=>`${Math.round(p.x*1e4)},${Math.round(p.y*1e4)}`;
  const reverse=s=>({p0:s.p3,c1:s.c2,c2:s.c1,p3:s.p0});
  const curveKey=s=>{const p=[s.p0,s.c1,s.c2,s.p3].map(key);return[p.join(';'),p.reverse().join(';')].sort()[0]};
  const area=p=>p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a.x*b.y-a.y*b.x},0)/2;
  const luma=c=>.2126*parseInt(c.slice(1,3),16)+.7152*parseInt(c.slice(3,5),16)+.0722*parseInt(c.slice(5,7),16);
  function run(structural,source,{geometry,compound,trace,engine,colors},{maxWidth=3,inkDistance=3.5,minCoverage=.94}={}){
    const {width,height}=structural;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width*height>5e6||width!==source.width||height!==source.height)throw Error('Structural ink and colors must be aligned.');
    if(!Array.isArray(structural.items)||!Array.isArray(source.colorItems)||source.colorItems.length>1800)throw Error('Expected bounded structural ink and color regions.');
    if(source.colorItems.some(it=>it.type!=='arrow'||!it.closed||!it.points?.length||!/^#[0-9a-f]{6}$/i.test(it.fill)))throw Error('Expected closed source color regions.');
    if(!(maxWidth>0&&maxWidth<=4&&inkDistance>0&&inkDistance<=5&&minCoverage>=.9&&minCoverage<=1))throw Error('Invalid thin-ink limits.');
    const regions=source.colorItems.map(it=>{
      const loops=(compound.recover(it)||[it]).map(colors.curves);
      const signed=loops.map(loop=>area(loop.flatMap(c=>geometry.flatten(c).slice(0,-1))));
      const outer=signed.reduce((best,n,i)=>Math.abs(n)>Math.abs(signed[best])?i:best,0);
      // SVG even-odd fills do not require a winding direction. Boolean union
      // does: normalize the outer/hole directions without moving any curve.
      return{color:it.fill,loops:loops.map((loop,i)=>(signed[i]>0)===(i===outer)?loop:loop.slice().reverse().map(reverse))};
    });
    const edges=new Map(),parent=regions.map((_,i)=>i),grid=new Map();
    const root=i=>{while(parent[i]!==i)i=parent[i];return i};
    const cell=(x,y)=>`${Math.floor(x/16)},${Math.floor(y/16)}`;
    for(const it of structural.items)if(it.width>0&&!it.autoTraceColored){
      for(const c of colors.curves(it)){
        const ps=geometry.flatten(c);
        for(let i=1;i<ps.length;i++){
          const a=ps[i-1],b=ps[i],entry={a,b};
          for(let x=Math.floor((Math.min(a.x,b.x)-inkDistance)/16);x<=Math.floor((Math.max(a.x,b.x)+inkDistance)/16);x++)for(let y=Math.floor((Math.min(a.y,b.y)-inkDistance)/16);y<=Math.floor((Math.max(a.y,b.y)+inkDistance)/16);y++){
            const k=`${x},${y}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(entry);
          }
        }
      }
    }
    function nearInk(p){
      return(grid.get(cell(p.x,p.y))||[]).some(({a,b})=>{
        const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));
        return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y)<=inkDistance;
      });
    }
    const perimeter=new Float64Array(regions.length),sizes=new Float64Array(regions.length),neighbours=regions.map(()=>new Map());
    regions.forEach((r,owner)=>{
      for(const loop of r.loops){
        const ps=loop.flatMap(c=>geometry.flatten(c).slice(0,-1));sizes[owner]+=area(ps);
        for(const c of loop){const k=curveKey(c);let e=edges.get(k);if(!e){const points=geometry.flatten(c);e={curve:c,uses:[],points,length:points.slice(1).reduce((n,p,i)=>n+dist(p,points[i]),0)};edges.set(k,e)}e.uses.push({owner,curve:c});perimeter[owner]+=e.length}
      }
      sizes[owner]=Math.abs(sizes[owner]);
    });
    for(const e of edges.values())for(const a of e.uses)for(const b of e.uses)if(a.owner!==b.owner)neighbours[a.owner].set(b.owner,(neighbours[a.owner].get(b.owner)||0)+e.length);
    const merged=[];
    for(let i=0;i<regions.length;i++){
      const width=2*sizes[i]/(perimeter[i]||1),elongation=perimeter[i]**2/(4*Math.PI*(sizes[i]||1));
      if(width>maxWidth||perimeter[i]<20||elongation<5||regions[i].loops.length!==1)continue;
      const adjacent=[...neighbours[i]];if(!adjacent.length)continue;
      const dark=luma(regions[i].color);if(adjacent.some(([j])=>dark+14>=luma(regions[j].color)))continue;
      let total=0,near=0;
      for(const c of regions[i].loops[0]){
        const points=geometry.flatten(c);
        for(let j=1;j<points.length;j++){
          const a=points[j-1],b=points[j],n=Math.max(1,Math.ceil(dist(a,b)/1.5));
          for(let k=0;k<n;k++){const t=(k+.5)/n;total++;if(nearInk({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))near++}
        }
      }
      if(!total||near/total<minCoverage)continue;
      adjacent.sort((a,b)=>b[1]-a[1]||a[0]-b[0]);const target=root(adjacent[0][0]);if(target===i)continue;
      parent[i]=target;merged.push({region:i,target,width,elongation,coverage:near/total,color:regions[i].color});
    }
    if(!merged.length)return{...source,inkSimplification:{merged:[],method:'thin-dark-source-supported-union-v1'}};
    const boundaries=new Map(),changedOwners=new Set(merged.map(m=>root(m.target)));
    for(const e of edges.values()){
      const owners=new Map();for(const u of e.uses){const owner=root(u.owner);if(!owners.has(owner))owners.set(owner,[]);owners.get(owner).push(u)}
      for(const [owner,uses] of owners){
        if(!changedOwners.has(owner))continue;
        const forward=uses.filter(u=>key(u.curve.p0)===key(e.curve.p0)),back=uses.filter(u=>key(u.curve.p0)!==key(e.curve.p0));
        const remaining=forward.length>back.length?forward.slice(back.length):back.slice(forward.length);
        if(!boundaries.has(owner))boundaries.set(owner,[]);boundaries.get(owner).push(...remaining.map(u=>u.curve));
      }
    }
    const paths=[];
    for(const [owner,segments] of boundaries){
      const outgoing=new Map(),used=new Set(),loops=[];
      for(const c of segments){const k=key(c.p0);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(c)}
      for(const start of segments){
        if(used.has(start))continue;const loop=[];let c=start;
        while(c&&!used.has(c)){
          used.add(c);loop.push(c);if(key(c.p3)===key(start.p0))break;
          const back=Math.atan2(c.c2.y-c.p3.y,c.c2.x-c.p3.x),turn=n=>(back-Math.atan2(n.c1.y-n.p0.y,n.c1.x-n.p0.x)+Math.PI*4)%(Math.PI*2);
          c=(outgoing.get(key(c.p3))||[]).filter(n=>!used.has(n)).sort((a,b)=>turn(a)-turn(b))[0];
        }
        if(key(loop.at(-1).p3)!==key(start.p0))return{...source,inkSimplification:{merged:[],rejected:'open-union',method:'thin-dark-source-supported-union-v1'}};
        loops.push(loop);
      }
      const d=loops.map(loop=>`M${loop[0].p0.x} ${loop[0].p0.y}`+loop.map(c=>`C${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.p3.x} ${c.p3.y}`).join('')+'Z').join(' ');
      paths.push(`<path fill="${regions[owner].color}" d="${d}"/>`);
    }
    const rebuilt=trace.fromSVG('<svg>'+paths.join('')+'</svg>',engine);
    const colorItems=source.colorItems.filter((it,i)=>root(i)===i&&!changedOwners.has(i)).concat(rebuilt.colorItems);
    const beforeArea=sizes.reduce((n,v)=>n+v,0),afterArea=colorItems.reduce((n,it)=>{
      const sizes=(compound.recover(it)||[it]).map(part=>Math.abs(area(colors.curves(part).flatMap(c=>geometry.flatten(c).slice(0,-1)))));
      return n+2*Math.max(...sizes)-sizes.reduce((n,v)=>n+v,0);
    },0);
    if(Math.abs(beforeArea-afterArea)>Math.max(.05,beforeArea*1e-7))return{...source,inkSimplification:{merged:[],rejected:'area-change',method:'thin-dark-source-supported-union-v1'}};
    if(colorItems.length>=source.colorItems.length)return{...source,inkSimplification:{merged:[],rejected:'fragmented-union',method:'thin-dark-source-supported-union-v1'}};
    return{...source,colorItems,inkSimplification:{merged,beforeRegions:regions.length,afterRegions:colorItems.length,method:'thin-dark-source-supported-union-v1'}};
  }
  return{run};
})();
