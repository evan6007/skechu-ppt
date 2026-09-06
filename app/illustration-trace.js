/* Closed-region vectorization, adapted to native editable Skechu curves.
 * VTracer's cutout fits a shared boundary once for both neighbouring regions.
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
  function fromSVG(svg,geometry){
    const items=[],colorItems=[];let anchors=0,region=0;
    for(const match of svg.matchAll(/<path\b([^>]+)>/g)){
      const attr=match[1],d=attr.match(/\bd="([^"]+)"/)?.[1],color=attr.match(/\bfill="(#[0-9a-f]{6})"/i)?.[1];
      if(!d||!color||/\btransform=/.test(attr))throw Error('向量色區格式不正確');
      const loops=parsePath(d),joined=[];
      for(const curves of loops){
        const item=geometry.toItem({closed:true},curves,'#182c49',1.25,new Set());if(!item)continue;
        item.autoTraceMode='illustration';item.autoTraceColor=color;item.autoTraceRegion=region;items.push(item);anchors+=item.points.length;
        // Zero-area, retraced connectors preserve hole winding in native PPT
        // Freeform fills. This representation is never used for visible strokes.
        if(joined.length){const origin=joined[0].p0;joined.push(line(origin,curves[0].p0),...curves,line(curves[0].p0,origin))}else joined.push(...curves);
      }
      if(joined.length){const fill=geometry.toItem({closed:true},joined,color,0,new Set());fill.fill=color;fill.fillOpacity=1;fill.autoTraceMode='illustration';fill.autoTraceColored=true;fill.autoTraceRegion=region;colorItems.push(fill)}
      if(++region>1800||anchors>40000)throw new Error('細碎色區太多；請降低「插畫細節」或增加「細節清理」後重試。');
    }
    return{items,colorItems,issues:[],stats:{mode:'illustration',paths:items.length,anchors,regions:colorItems.length,junctions:0,reviewCount:0}};
  }
  function run(data,w,h,options,geometry,progress){
    if(typeof VTracerWasm==='undefined')throw Error('插畫描圖元件尚未載入，請重新整理頁面。');
    progress(10,'保留細小邊緣，去除壓縮雜訊');
    const cleaned=denoise(data,w,h,options.minLength);
    progress(25,'分離深色細節與周圍陰影');
    const svg=VTracerWasm.convertPixels(cleaned,w,h,{clustering:'color-cluster',hierarchical:'cutout',mode:'spline',colorPrecision:6,layerDifference:Math.round(72-(options.threshold-40)*.3),filterSpeckle:Math.max(1,Math.round(options.minLength)),simplify:Math.max(.2,options.accuracy*(.13+.003*options.simplify)),pathPrecision:4,optimize:0});
    progress(75,'共用邊界平滑，轉成可編輯封閉曲線');
    const result=fromSVG(svg,geometry);progress(100,'封閉插畫區域預覽完成');return result;
  }
  return{run,fromSVG,parsePath,denoise,wasmBytes,workerSource:()=>`${VTracerWasm.workerSource()}const IllustrationTrace=(${createIllustrationTrace.toString()})();`};
})();
