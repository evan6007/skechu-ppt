/* Experimental post-processing of a predicted sketch, not of the color image.
 * No model downloads, training, source-image upload, or app state changes.
 * All distances are in the prediction's pixel coordinates.
 */
const AnimeLineRefine = (() => {
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unit = (x, y) => { const n = Math.hypot(x, y) || 1; return {x: x/n, y: y/n}; };
  const dot = (a, b) => a.x*b.x + a.y*b.y;
  const clip = (x, a, b) => Math.max(a, Math.min(b, x));

  function readLuma(data, width, height) {
    const n = width*height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || n > 5e6 || data?.length !== n*4) {
      throw new Error('Expected RGBA sketch pixels, at most 5 million pixels.');
    }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i*4, a = data[p+3]/255;
      out[i] = a*(.2126*data[p] + .7152*data[p+1] + .0722*data[p+2]) + 255*(1-a);
      if (!Number.isFinite(out[i]) || out[i] < 0 || out[i] > 255.001) throw new Error('Invalid sketch pixel.');
    }
    return out;
  }

  function smoothLuma(source, width, height) {
    const out = new Float32Array(source.length), tmp = new Float32Array(source.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y*width+x;
      tmp[i] = (source[y*width+Math.max(0, x-1)] + 4*source[i] + source[y*width+Math.min(width-1, x+1)])/6;
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y*width+x;
      out[i] = (tmp[Math.max(0, y-1)*width+x] + 4*tmp[i] + tmp[Math.min(height-1, y+1)*width+x])/6;
    }
    return out;
  }

  function suppressBorderStripes(mask, referenceLuma, width, height) {
    if (!referenceLuma || Math.min(width,height)<20) return [];
    const removed=[];
    for (const side of ['left','right','top','bottom']) {
      const vertical=side==='left'||side==='right', length=vertical?height:width;
      const pixel=(depth,along)=>vertical ? along*width+(side==='left'?depth:width-1-depth)
        : (side==='top'?depth:height-1-depth)*width+along;
      for(let thickness=1;thickness<=2;thickness++) {
        let votes=0,extended=0;
        for(let along=0;along<length;along++) {
          const inside=referenceLuma[pixel(thickness,along)],next=referenceLuma[pixel(thickness+1,along)];
          let strip=0;for(let k=0;k<thickness;k++)strip+=referenceLuma[pixel(k,along)]/thickness;
          if(inside-strip>35 && Math.abs(inside-next)<20)votes++;
          if(mask[pixel(thickness+2,along)])extended++;
        }
        // Only an almost full-edge, isolated 1–2 px dark stripe. A broad dark
        // subject touching the image boundary is not a frame artifact.
        if(votes/length<.9 || extended/length>.3)continue;
        let pixels=0;
        for(let along=0;along<length;along++)for(let k=0;k<=thickness;k++) {
          const i=pixel(k,along);pixels+=mask[i];mask[i]=0;
        }
        if(pixels)removed.push({side,thickness,evidenceFraction:votes/length,pixels});
        break;
      }
    }
    return removed;
  }

  function removePinholes(mask, luma, width, height, maxArea) {
    // Only low-confidence pores INSIDE a stroke. White holes and large/narrow
    // real regions (earring rims, eye openings) must not disappear.
    const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
    let removed = 0;
    for (let seed = 0; seed < mask.length; seed++) {
      if (mask[seed] || seen[seed]) continue;
      let head = 0, tail = 1, border = false, lightest = 0;
      let xmin = width, xmax = 0, ymin = height, ymax = 0;
      queue[0] = seed; seen[seed] = 1;
      while (head < tail) {
        const i = queue[head++], x = i%width, y = Math.floor(i/width);
        xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
        ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
        lightest = Math.max(lightest, luma[i]);
        if (!x || !y || x === width-1 || y === height-1) border = true;
        for (const j of [x ? i-1 : -1, x < width-1 ? i+1 : -1, y ? i-width : -1, y < height-1 ? i+width : -1]) {
          if (j < 0 || seen[j] || mask[j]) continue;
          seen[j] = 1; queue[tail++] = j;
        }
      }
      if (!border && tail <= maxArea && xmax-xmin <= 12 && ymax-ymin <= 12 && lightest < 248) {
        for (let k = 0; k < tail; k++) mask[queue[k]] = 1;
        removed++;
      }
    }
    return removed;
  }

  function skeletonGraph(mask, width, height, engine) {
    const w = width+2, h = height+2, padded = new Uint8Array(w*h);
    for (let y = 0; y < height; y++) padded.set(mask.subarray(y*width, (y+1)*width), (y+1)*w+1);
    const pixels = engine.thin(padded, w, h);
    if (pixels.length > 180000) throw new Error('Too many sketch pixels; reduce prediction resolution.');
    const graph = engine.graph(padded, w, h, pixels);
    return {graph, padded, w, h};
  }

  function endpoints(graph) {
    const out = [];
    for (const node of graph.nodes) {
      if (node.edges.length !== 1) continue;
      const edge = node.edges[0], points = edge.path.points;
      const p = edge.side === 'start' ? points[0] : points.at(-1);
      let inner = p;
      for (let step = 1; step < points.length; step++) {
        inner = edge.side === 'start' ? points[step] : points.at(-1-step);
        if (distance(p, inner) >= 5) break;
      }
      if (distance(p, inner) < 3) continue;
      out.push({id: node.id, path:edge.path, point: {x: p.x-1, y: p.y-1}, tangent: unit(p.x-inner.x, p.y-inner.y)});
    }
    return out;
  }

  function sample(luma, width, height, p) {
    const x = clip(p.x-.5, 0, width-1), y = clip(p.y-.5, 0, height-1);
    const ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy;
    const a = iy*width+ix, b = iy*width+Math.min(width-1, ix+1);
    const c = Math.min(height-1, iy+1)*width+ix, d = Math.min(height-1, iy+1)*width+Math.min(width-1, ix+1);
    return (luma[a]*(1-fx)+luma[b]*fx)*(1-fy)+(luma[c]*(1-fx)+luma[d]*fx)*fy;
  }

  function sampleColor(data, width, height, p) {
    const x = clip(p.x-.5, 0, width-1), y = clip(p.y-.5, 0, height-1);
    const ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy, out = [0, 0, 0];
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const i = (Math.min(height-1, iy+dy)*width+Math.min(width-1, ix+dx))*4;
      const weight = (dx ? fx : 1-fx)*(dy ? fy : 1-fy), alpha = data[i+3]/255;
      for (let channel = 0; channel < 3; channel++) out[channel] += weight*(data[i+channel]*alpha+255*(1-alpha));
    }
    return out;
  }

  function collapseStrokeRibbons(mask, referenceData, width, height) {
    if(!referenceData)return [];
    const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),ribbons=[];
    for(let seed=0;seed<mask.length;seed++) {
      if(mask[seed]||seen[seed])continue;
      let head=0,tail=1,border=false;queue[0]=seed;seen[seed]=1;
      while(head<tail) {
        const i=queue[head++],x=i%width,y=Math.floor(i/width);
        if(!x||!y||x===width-1||y===height-1)border=true;
        for(const j of[x?i-1:-1,x<width-1?i+1:-1,y?i-width:-1,y<height-1?i+width:-1]) {
          if(j<0||seen[j]||mask[j])continue;seen[j]=1;queue[tail++]=j;
        }
      }
      if(border||tail<8||tail>700)continue;
      let cx=0,cy=0;
      for(let k=0;k<tail;k++){const i=queue[k];cx+=(i%width+.5)/tail;cy+=(Math.floor(i/width)+.5)/tail;}
      let xx=0,xy=0,yy=0;
      for(let k=0;k<tail;k++){const i=queue[k],dx=i%width+.5-cx,dy=Math.floor(i/width)+.5-cy;xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
      const angle=.5*Math.atan2(2*xy,xx-yy),u={x:Math.cos(angle),y:Math.sin(angle)},v={x:-u.y,y:u.x};
      let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
      for(let k=0;k<tail;k++) {
        const i=queue[k],dx=i%width+.5-cx,dy=Math.floor(i/width)+.5-cy,a=dx*u.x+dy*u.y,b=dx*v.x+dy*v.y;
        amin=Math.min(amin,a);amax=Math.max(amax,a);bmin=Math.min(bmin,b);bmax=Math.max(bmax,b);
      }
      const length=amax-amin+1,span=bmax-bmin+1;
      if(length<12||length>120||span>8||length/span<4.5)continue;
      const evidence=[];
      for(const t of[-.3,-.15,0,.15,.3]) {
        const p={x:cx+u.x*length*t,y:cy+u.y*length*t},offset=span/2+2;
        const center=sampleColor(referenceData,width,height,p);
        const a=sampleColor(referenceData,width,height,{x:p.x+v.x*offset,y:p.y+v.y*offset});
        const b=sampleColor(referenceData,width,height,{x:p.x-v.x*offset,y:p.y-v.y*offset});
        const delta=center.map((c,k)=>c-(a[k]+b[k])/2),contrast=Math.hypot(...delta),sideDifference=Math.hypot(...a.map((c,k)=>c-b[k]));
        evidence.push({delta,contrast,sideDifference});
      }
      if(evidence.some(e=>e.contrast<20||e.sideDifference>Math.max(12,e.contrast*.3)))continue;
      const mean=[0,0,0];for(const e of evidence)for(let k=0;k<3;k++)mean[k]+=e.delta[k]/evidence.length;
      const magnitude=Math.hypot(...mean);
      if(!magnitude||evidence.some(e=>e.delta.reduce((s,c,k)=>s+c*mean[k],0)/(e.contrast*magnitude)<.9))continue;
      // Both sides have the same source color, while the center is a consistent
      // narrow light/dark ridge: these are two outlines of ONE source stroke,
      // not the boundary of a white hole. Filling this binary ribbon allows
      // thinning to recover its centerline without changing the reference.
      for(let k=0;k<tail;k++)mask[queue[k]]=1;
      ribbons.push({center:{x:cx,y:cy},length,width:span,pixels:tail,contrast:magnitude,
        sideDifference:Math.max(...evidence.map(e=>e.sideDifference)),polarity:mean.reduce((s,c)=>s+c,0)>0?'light':'dark'});
    }
    return ribbons;
  }

  function colorBridge(points, data, width, height) {
    const shifted = points.map(p => ({...p})), evidence = [];
    for (let i = 1; i < points.length-1; i++) {
      const p = points[i], prev = points[i-1], next = points[i+1];
      const tangent = unit(next.x-prev.x, next.y-prev.y), normal = {x:-tangent.y,y:tangent.x};
      let best = null;
      // Follow the strongest nearby color transition, with a center preference.
      // A small search corridor cannot wander off to unrelated distant edges.
      for (let offset = -2; offset <= 2; offset += .5) {
        const q = {x:p.x+normal.x*offset,y:p.y+normal.y*offset};
        const plus = sampleColor(data,width,height,{x:q.x+normal.x*1.5,y:q.y+normal.y*1.5});
        const minus = sampleColor(data,width,height,{x:q.x-normal.x*1.5,y:q.y-normal.y*1.5});
        const delta = plus.map((v,k) => v-minus[k]), contrast = Math.hypot(...delta);
        const score = contrast-4*Math.abs(offset);
        if (!best || score > best.score) best = {q,delta,contrast,score,offset};
      }
      const t = i/(points.length-1), taper = Math.min(1, t*5, (1-t)*5);
      shifted[i] = {x:p.x+normal.x*best.offset*taper,y:p.y+normal.y*best.offset*taper};
      if (t >= .2 && t <= .8) evidence.push(best);
    }
    if (!evidence.length || evidence.some(e => e.contrast < 16)) return null;
    const average = [0,0,0];
    for (const e of evidence) for (let k = 0; k < 3; k++) average[k] += e.delta[k]/evidence.length;
    const strength = Math.hypot(...average);
    if (strength < 24 || evidence.some(e => e.delta.reduce((s,v,k) => s+v*average[k],0)/(e.contrast*strength) < .8)) return null;
    // Smooth the selected offsets once; keep the endpoints exactly unchanged.
    const smooth = shifted.map(p => ({...p}));
    for (let i = 1; i < shifted.length-1; i++) smooth[i] = {
      x:(shifted[i-1].x+2*shifted[i].x+shifted[i+1].x)/4,
      y:(shifted[i-1].y+2*shifted[i].y+shifted[i+1].y)/4};
    return {points:smooth, contrast:strength};
  }

  function candidate(a, b, luma, mask, width, height, maxGap, referenceData = null, sketchMaxGap = maxGap) {
    const length = distance(a.point, b.point);
    if (length < 1.5 || length > maxGap) return null;
    const direction = unit(b.point.x-a.point.x, b.point.y-a.point.y);
    const agreement = Math.min(dot(a.tangent, direction), -dot(b.tangent, direction));
    // A sharp cusp has two non-collinear end tangents. Only an aligned color
    // reference can justify its very short missing corner; weak sketch pixels
    // alone must not lower the normal facing-endpoint requirement.
    const curving=agreement<.88&&agreement>=.5&&!!referenceData&&length>8;
    const corner=agreement<.88&&!curving;
    if(corner && (!referenceData || length>8 || agreement<-.35))return null;
    const points = [], steps = Math.max(8, Math.ceil(length*3));
    let sum = 0, weak = 0, samples = 0, middle = 255, whitest = 0;
    for (let k = 0; k <= steps; k++) {
      const t = k/steps, u = 1-t;
      const ta=corner?direction:a.tangent,tb=corner?{x:-direction.x,y:-direction.y}:b.tangent;
      const c1 = {x: a.point.x+ta.x*length/3, y: a.point.y+ta.y*length/3};
      const c2 = {x: b.point.x+tb.x*length/3, y: b.point.y+tb.y*length/3};
      const p = {x: u**3*a.point.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t**3*b.point.x,
        y: u**3*a.point.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t**3*b.point.y};
      points.push(p);
      if (t < .25 || t > .75) continue;
      const value = sample(luma, width, height, p);
      whitest = Math.max(whitest, value);
      if (k === Math.floor(steps/2)) middle = value;
      sum += value; samples++; if (value < 248) weak++;
      // Do not turn a near miss into a new T/crossing through existing ink.
      if (distance(p, a.point) > 2 && distance(p, b.point) > 2 && mask[Math.floor(p.y)*width+Math.floor(p.x)]) return null;
    }
    const mean = sum/samples;
    const sketchSupported = !corner && !curving && length <= sketchMaxGap && mean < 243 && middle < 248 && whitest < 250 && weak/samples >= .8;
    if (sketchSupported) return {a, b, points, length, mean, source:'sketch', score: length*(2-agreement)+Math.max(0, mean-220)/15};
    if (!referenceData) return null;
    const color = colorBridge(points, referenceData, width, height);
    if (!color) return null;
    for (const p of color.points) if (distance(p,a.point)>2 && distance(p,b.point)>2 && mask[Math.floor(p.y)*width+Math.floor(p.x)]) return null;
    return {a,b,points:color.points,length,mean,source:'color',contrast:color.contrast,corner,score:length*(2-agreement)+4};
  }

  function repairJunctions(graph, ends, usedEnds, mask, occupied, luma, width, height, sketchMaxGap, referenceData, maxColorGap, radius) {
    if(!radius)return [];
    const buckets=new Map(), segments=[];
    for(const path of graph.paths)for(let i=1;i<path.points.length;i++) {
      const a={x:path.points[i-1].x-1,y:path.points[i-1].y-1},b={x:path.points[i].x-1,y:path.points[i].y-1};
      const index=segments.length;segments.push({a,b,path,index,position:i});
      const xmin=Math.floor(Math.min(a.x,b.x)/radius),xmax=Math.floor(Math.max(a.x,b.x)/radius);
      const ymin=Math.floor(Math.min(a.y,b.y)/radius),ymax=Math.floor(Math.max(a.y,b.y)/radius);
      for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++) {
        const key=`${x}:${y}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(index);
      }
    }
    const proposals=[];
    for(const end of ends) {
      if(usedEnds.has(end.id))continue;
      const bx=Math.floor(end.point.x/radius),by=Math.floor(end.point.y/radius),near=new Set();
      for(let y=by-1;y<=by+1;y++)for(let x=bx-1;x<=bx+1;x++)for(const index of buckets.get(`${x}:${y}`)||[])near.add(index);
      const byPath=new Map();
      for(const index of near) {
        const segment=segments[index],{a,b,path}=segment;if(path===end.path)continue;
        // Pair-to-pair repair handles terminal targets. T repair only meets an
        // interior branch, not a second endpoint under a different name.
        if(segment.position<3 || segment.position>path.points.length-3)continue;
        const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;if(!den)continue;
        const t=clip(((end.point.x-a.x)*dx+(end.point.y-a.y)*dy)/den,0,1),point={x:a.x+t*dx,y:a.y+t*dy};
        const length=distance(end.point,point);if(length<1.5||length>radius)continue;
        const direction=unit(point.x-end.point.x,point.y-end.point.y);
        if(dot(end.tangent,direction)<.9 || Math.abs(dot(end.tangent,unit(dx,dy)))>.7)continue;
        const previous=byPath.get(path);if(!previous||length<previous.length)byPath.set(path,{point,length});
      }
      const choices=[];
      for(const [path,target] of byPath) {
        const direction=unit(target.point.x-end.point.x,target.point.y-end.point.y);
        const destination={point:target.point,tangent:{x:-direction.x,y:-direction.y}};
        const color=target.length<=maxColorGap?referenceData:null;
        const c=candidate(end,destination,luma,occupied,width,height,radius,color,sketchMaxGap);
        if(c)choices.push({...c,targetPath:path,kind:'junction'});
      }
      choices.sort((a,b)=>a.score-b.score);
      if(choices.length && (choices.length===1||choices[1].score>choices[0].score*1.5))proposals.push(choices[0]);
    }
    const repairs=[],targets=[];
    for(const c of proposals.sort((a,b)=>a.score-b.score)) {
      if(usedEnds.has(c.a.id)||targets.some(p=>distance(p,c.b.point)<4))continue;
      const color=c.length<=maxColorGap?referenceData:null;
      const current=candidate(c.a,c.b,luma,occupied,width,height,radius,color,sketchMaxGap);if(!current)continue;
      for(const p of current.points) {
        const x=Math.floor(p.x),y=Math.floor(p.y);if(x>=0&&y>=0&&x<width&&y<height)mask[y*width+x]=occupied[y*width+x]=1;
      }
      targets.push(c.b.point);usedEnds.add(c.a.id);
      repairs.push({start:c.a.point,end:c.b.point,length:c.length,evidenceLuma:current.mean,source:current.source,
        contrast:current.contrast,points:current.points,kind:'junction'});
    }
    return repairs;
  }

  function repairGaps(mask, luma, width, height, engine, maxGap, referenceData = null, maxColorGap = 24, maxJunctionGap = 8) {
    if (!maxColorGap) referenceData = null;
    const sketchMaxGap = maxGap;
    if (referenceData) maxGap = Math.max(maxGap, maxColorGap);
    if (!maxGap) return [];
    const {graph, padded, w} = skeletonGraph(mask, width, height, engine);
    const occupied = new Uint8Array(mask.length);
    for (let y = 0; y < height; y++) occupied.set(padded.subarray((y+1)*w+1, (y+1)*w+1+width), y*width);
    const ends = endpoints(graph), candidates = [], buckets = new Map();
    if (ends.length > 5000) throw new Error('Too many disconnected sketch endpoints.');
    // Spatial buckets keep endpoint matching local rather than quadratic.
    for (const end of ends) {
      const x = Math.floor(end.point.x/maxGap), y = Math.floor(end.point.y/maxGap);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const other of buckets.get(`${x+dx}:${y+dy}`) || []) {
          const color = distance(end.point,other.point)<=maxColorGap ? referenceData : null;
          const hit = candidate(end, other, luma, occupied, width, height, maxGap, color, sketchMaxGap);
          if (hit) candidates.push(hit);
        }
      }
      const key = `${x}:${y}`; if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(end);
    }
    const choices = new Map();
    for (const c of candidates) for (const end of [c.a, c.b]) {
      if (!choices.has(end.id)) choices.set(end.id, []);
      choices.get(end.id).push(c);
    }
    for (const list of choices.values()) list.sort((a, b) => a.score-b.score);
    const unambiguous = (end, c) => {
      const list = choices.get(end.id);
      return list[0] === c && (list.length === 1 || list[1].score > c.score*1.5);
    };
    const repairs = [], usedEnds=new Set();
    for (const c of candidates.sort((a, b) => a.score-b.score)) {
      if (!unambiguous(c.a, c) || !unambiguous(c.b, c)) continue;
      // Recheck after earlier accepted bridges: disjoint endpoint IDs alone do
      // not prevent two proposed bridges from crossing in empty space.
      const color = c.length<=maxColorGap ? referenceData : null;
      const current = candidate(c.a, c.b, luma, occupied, width, height, maxGap, color, sketchMaxGap);
      if (!current) continue;
      for (const p of current.points) {
        const x = Math.floor(p.x), y = Math.floor(p.y);
        if (x >= 0 && y >= 0 && x < width && y < height) mask[y*width+x] = occupied[y*width+x] = 1;
      }
      repairs.push({start: c.a.point, end: c.b.point, length: c.length, evidenceLuma: c.mean,
        source:current.source, contrast:current.contrast, points:current.points,kind:current.corner?'corner':'endpoints'});
      usedEnds.add(c.a.id);usedEnds.add(c.b.id);
    }
    repairs.push(...repairJunctions(graph,ends,usedEnds,mask,occupied,luma,width,height,sketchMaxGap,referenceData,maxColorGap,Math.min(maxGap,maxJunctionGap)));
    return repairs;
  }

  function run({data, width, height, referenceData = null, options = {}}, engine, progress = () => {}) {
    if (!engine?.run || !engine?.thin || !engine?.graph) throw new Error('AutoTrace engine is required.');
    const threshold = clip(Number(options.threshold ?? 226), 150, 240);
    const maxGap = clip(Number(options.maxGap ?? 8), 0, 12);
    const maxHoleArea = clip(Number(options.maxHoleArea ?? 25), 0, 40);
    const maxColorGap = clip(Number(options.maxColorGap ?? 48), 0, 64);
    const maxJunctionGap = clip(Number(options.maxJunctionGap ?? 8), 0, 12);
    if (![threshold, maxGap, maxHoleArea, maxColorGap, maxJunctionGap].every(Number.isFinite)) throw new Error('Invalid refinement options.');
    const referenceLuma=referenceData ? readLuma(referenceData,width,height) : null;
    const raw = readLuma(data, width, height), luma = smoothLuma(raw, width, height);
    // Smoothing may suppress dark spikes, but must not paint over a high-
    // confidence white opening or invent ink between genuinely separate lines.
    const mask = Uint8Array.from(luma, (value, i) => value < threshold && raw[i] < 250 ? 1 : 0);
    if (mask.reduce((n, p) => n+p, 0) > width*height*.32) throw new Error('Provide an extracted sketch, not the colored source image.');
    const borderStripes=options.suppressBorderStripes===false?[]:suppressBorderStripes(mask,referenceLuma,width,height);
    progress(5, '清理低可信度細孔');
    // Confidence is measured on the unblurred map so smoothing cannot erase a
    // true white opening and then claim that the opening was low confidence.
    const pinholes = maxHoleArea ? removePinholes(mask, raw, width, height, maxHoleArea) : 0;
    const strokeRibbons=options.collapseRibbons===false?[]:collapseStrokeRibbons(mask,referenceData,width,height);
    progress(10, '檢查斷口方向與線條證據');
    const repairs = repairGaps(mask, raw, width, height, engine, maxGap, referenceData, maxColorGap, maxJunctionGap);
    const pixels = new Uint8Array(data.length).fill(255);
    for (let i = 0; i < mask.length; i++) if (mask[i]) pixels[i*4] = pixels[i*4+1] = pixels[i*4+2] = 0;
    const result = engine.run({width, height, data: pixels, options: {mode: 'line', threshold: 128,
      accuracy: options.accuracy ?? 1.5, simplify: options.simplify ?? 85, minLength: options.minLength ?? 6}}, progress);
    for (const item of result.items) { item.color = '#242b34'; item.width = 1.7; item.autoTraceMode = 'anime-experimental'; }
    const bounded=options.closeBorder===false?result:TraceBoundary.close(result,width,height);
    return {...bounded, refinement: {pinholes, repairs, borderStripes,strokeRibbons}, stats: {...bounded.stats, mode: 'anime-experimental', pinholes,
      repairedGaps: repairs.length, colorRepairs:repairs.filter(r => r.source === 'color').length,
      junctionRepairs:repairs.filter(r=>r.kind==='junction').length,cornerRepairs:repairs.filter(r=>r.kind==='corner').length,
      borderStripes:borderStripes.length,collapsedRibbons:strokeRibbons.length}};
  }
  return {run, readLuma, smoothLuma, removePinholes, repairGaps};
})();
