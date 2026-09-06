/* Separate source color regions from structural ink.
 * This optional developer-only stage does not run or download a neural model.
 * All source pixels and every input cubic remain unchanged.
 */
const AnimeStructureColors=(()=>{
  function preserveShading(result,sourceColors){
    const {width,height}=result;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width*height>5e6||width!==sourceColors.width||height!==sourceColors.height)throw Error('Sketch and source colors must have identical aligned dimensions.');
    if(!Array.isArray(result.items)||result.items.some(it=>it.autoTraceColored)||!Array.isArray(sourceColors.colorItems))throw Error('Expected separate structural ink and source color regions.');
    if(sourceColors.colorItems.length>1800)throw Error('Too many source color regions.');
    const colorItems=sourceColors.colorItems.map((source,index)=>{
      if(source.type!=='arrow'||!source.closed||!source.points?.length||!/^#[0-9a-f]{6}$/i.test(source.fill))throw Error('Expected closed source color regions.');
      // Keep ALL source color contours, including shadows absent from the
      // neural sketch graph. Do not import the color tracer's outline network.
      const item=JSON.parse(JSON.stringify(source));
      return{...item,id:`source-color-${index}`,name:'色彩／陰影（無邊框）',width:0,fillOpacity:1,
        startHead:false,endHead:false,autoTraceColored:true,autoTraceMode:'anime-experimental',structureRole:'color'};
    });
    return{...result,colorItems,colorSampling:{method:'independent-source-shading-v2',
      sourceRegions:colorItems.length,visibleColorOutlines:0},
      stats:{...result.stats,regions:colorItems.length,colorMode:'source-shading',
        sourceColorAnchors:colorItems.reduce((n,it)=>n+it.points.length,0)}};
  }
  function curves(item){
    return item.points.slice(0,item.closed?undefined:-1).map((p,i)=>{
      const j=(i+1)%item.points.length,q=item.points[j],a=item.pointHandleAngles[i],b=item.pointHandleAngles[j];
      return{p0:p,c1:{x:p.x+Math.cos(a.out*Math.PI/180)*a.outLength,y:p.y+Math.sin(a.out*Math.PI/180)*a.outLength},
        c2:{x:q.x+Math.cos(b.in*Math.PI/180)*b.inLength,y:q.y+Math.sin(b.in*Math.PI/180)*b.inLength},p3:q};
    });
  }
  function labelFaces(faces,width,height){
    const labels=new Int32Array(width*height).fill(-1);
    // Smaller nested faces own their pixels. Parent colors cannot sample an
    // earring, eye, or other small inset and mistake it for the surrounding skin.
    const order=faces.map((f,i)=>i).sort((a,b)=>faces[b].area-faces[a].area);
    for(const owner of order){
      const points=faces[owner].polygon;
      const y0=Math.max(0,Math.ceil(Math.min(...points.map(p=>p.y))-.5));
      const y1=Math.min(height-1,Math.floor(Math.max(...points.map(p=>p.y))-.5));
      for(let y=y0;y<=y1;y++){
        const scan=y+.5,xs=[];
        for(let i=0,j=points.length-1;i<points.length;j=i++){
          const a=points[j],b=points[i];
          if((a.y>scan)!==(b.y>scan))xs.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));
        }
        xs.sort((a,b)=>a-b);
        for(let k=0;k+1<xs.length;k+=2){
          const start=Math.max(0,Math.ceil(xs[k]-.5)),end=Math.min(width,Math.ceil(xs[k+1]-.5));
          if(end>start)labels.fill(owner,y*width+start,y*width+end);
        }
      }
    }
    return labels;
  }
  function run(result,{data,width,height},geometry){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width*height>5e6||data?.length!==width*height*4)throw Error('Expected aligned RGBA reference, at most 5 million pixels.');
    if(!Array.isArray(result.items)||result.items.some(it=>it.autoTraceColored))throw Error('Expected uncolored structural curves.');
    const faces=geometry.build(result.items.map((it,i)=>({id:it.id||String(i),closed:it.closed,width:it.width,segments:curves(it)})));
    const labels=labelFaces(faces,width,height),bins=faces.map(()=>new Map()),fallback=faces.map(()=>new Map()),pixels=new Uint32Array(faces.length);
    const boxes=faces.map(f=>({x0:Math.min(...f.polygon.map(p=>p.x)),x1:Math.max(...f.polygon.map(p=>p.x)),y0:Math.min(...f.polygon.map(p=>p.y)),y1:Math.max(...f.polygon.map(p=>p.y))}));
    const parents=faces.map((face,i)=>{
      const b=boxes[i];let parent=-1;
      for(let j=0;j<faces.length;j++){
        const p=boxes[j];
        if(faces[j].area<=face.area||b.x0<=p.x0||b.y0<=p.y0||b.x1>=p.x1||b.y1>=p.y1)continue;
        if((parent<0||faces[j].area<faces[parent].area)&&face.polygon.every(point=>geometry.contains(point,faces[j].polygon)))parent=j;
      }
      return parent;
    });
    function add(map,r,g,b){const key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);let bin=map.get(key);if(!bin){bin=[0,0,0,0];map.set(key,bin)}bin[0]++;bin[1]+=r;bin[2]+=g;bin[3]+=b}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x,owner=labels[i];if(owner<0||data[i*4+3]<128)continue;
      pixels[owner]++;const j=i*4,r=data[j],g=data[j+1],b=data[j+2];add(fallback[owner],r,g,b);
      // Do not sample the antialiased line itself. Very small faces fall back
      // to their own pixels, never to a neighboring region or a global palette.
      if(x>=2&&x<width-2&&y>=2&&y<height-2&&labels[i-2]===owner&&labels[i+2]===owner&&labels[i-2*width]===owner&&labels[i+2*width]===owner)add(bins[owner],r,g,b);
    }
    const evidence=[],colorItems=[];
    // Back-to-front nesting also preserves holes visually in ordinary SVG/PPT.
    for(const i of faces.map((_,i)=>i).sort((a,b)=>faces[b].area-faces[a].area)){
      const palette=bins[i].size?bins[i]:fallback[i];if(!palette.size)continue;
      const groups=[...palette.values()].sort((a,b)=>b[0]-a[0]),best=groups[0],total=groups.reduce((n,b)=>n+b[0],0);
      const color='#'+best.slice(1).map(v=>Math.round(v/best[0]).toString(16).padStart(2,'0')).join('');
      const segments=[...faces[i].segments],origin=segments[0].p0;
      for(let child=0;child<faces.length;child++)if(parents[child]===i){
        const hole=faces[child].segments.slice().reverse().map(s=>({p0:s.p3,c1:s.c2,c2:s.c1,p3:s.p0}));
        segments.push(geometry.line(origin,hole[0].p0),...hole,geometry.line(hole[0].p0,origin));
      }
      const item=geometry.toItem({...faces[i],segments},`structural-color-${i}`,color);
      item.autoTraceColored=true;item.autoTraceMode='anime-experimental';item.structureRole='color';
      item.name='結構區域填色';colorItems.push(item);
      evidence.push({face:i,parent:parents[i],pixels:pixels[i],sampledPixels:total,dominantShare:best[0]/total,color,usedBoundaryFallback:!bins[i].size});
    }
    return{...result,colorItems,colorSampling:{method:'structural-face-owned-mode-v1',evidence},
      stats:{...result.stats,regions:colorItems.length,structuralFaces:faces.length}};
  }
  // run is the earlier flat-face experiment, retained for controlled comparisons.
  return{run,preserveShading,labelFaces,curves};
})();
