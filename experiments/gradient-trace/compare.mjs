// Compare private source artwork with two vector renders at identical scales.
// ROI coordinates are reporting inputs only; they never reach the algorithm.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const [input,before,after,destination,roiJson='{}']=process.argv.slice(2);
if(!destination)throw Error('Usage: compare.mjs ORIGINAL BEFORE.svg AFTER.svg OUTPUT_DIRECTORY [NAMED_ROIS_JSON]');
const uri=file=>'data:'+(/\.svg$/i.test(file)?'image/svg+xml':/\.png$/i.test(file)?'image/png':'image/jpeg')+';base64,'+fs.readFileSync(file).toString('base64');
const out=path.resolve(destination);fs.mkdirSync(out,{recursive:true});
const rois=JSON.parse(roiJson);for(const r of Object.values(rois))if(r.length!==4||r.some(v=>!Number.isInteger(v)||v<0)||!r[2]||!r[3])throw Error('Invalid reporting rectangle');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage();await page.setContent('<body style="margin:0"><canvas id="proof"></canvas></body>');
 const result=await page.evaluate(async({sources,rois})=>{
  const images=await Promise.all(sources.map(async src=>{const im=new Image();im.src=src;await im.decode();return im})),w=images[1].naturalWidth,h=images[1].naturalHeight;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d',{willReadFrequently:true});
  const pixels=images.map(im=>{c.clearRect(0,0,w,h);c.drawImage(im,0,0,w,h);return c.getImageData(0,0,w,h).data});
  const source=pixels[0],metrics={};
  for(const [label,rect] of Object.entries({full:[0,0,w,h],...rois})){const [x,y,rw,rh]=rect;metrics[label]={};
   for(let i=1;i<3;i++){let sum=0,count=0,edge=0,nEdge=0,alphaGaps=0;const errors=[];
    for(let yy=y;yy<Math.min(h,y+rh);yy++)for(let xx=x;xx<Math.min(w,x+rw);xx++){const p=(yy*w+xx)*4;let e=0;if(pixels[i][p+3]<250)alphaGaps++;for(let k=0;k<3;k++){e+=(source[p+k]-pixels[i][p+k])**2;for(const q of [xx+1<Math.min(w,x+rw)?p+4:-1,yy+1<Math.min(h,y+rh)?p+4*w:-1])if(q>=0){edge+=((source[q+k]-source[p+k])-(pixels[i][q+k]-pixels[i][p+k]))**2;nEdge++}}sum+=e;count+=3;errors.push(Math.sqrt(e/3))}
    errors.sort((a,b)=>a-b);metrics[label][i===1?'before':'after']={rgbRmse:Math.sqrt(sum/count),edgeRmse:Math.sqrt(edge/nEdge),p95:errors[Math.floor(errors.length*.95)],alphaGaps};
   }
  }
  const entries=Object.entries({全圖:[0,0,w,h],...rois}),width=480,pad=14,rowHeights=entries.map(([,r])=>Math.round((width-pad*2)*r[3]/r[2])+62),proof=document.getElementById('proof');proof.width=width*3;proof.height=rowHeights.reduce((a,b)=>a+b,0);const g=proof.getContext('2d');g.fillStyle='#edf1f7';g.fillRect(0,0,proof.width,proof.height);let top=0;
  entries.forEach(([name,r],row)=>{for(let i=0;i<3;i++){g.fillStyle='#17314c';g.font='bold 20px Microsoft JhengHei';g.fillText(['原圖','上一版 v87','細節優先'][i]+' · '+name,i*width+pad,top+30);const scale=images[i].naturalWidth/w;g.drawImage(images[i],...r.map(v=>v*scale),i*width+pad,top+46,width-pad*2,rowHeights[row]-62)}top+=rowHeights[row]});return{width:w,height:h,metrics};
 },{sources:[input,before,after].map(uri),rois});
 await page.locator('#proof').screenshot({path:path.join(out,'detail-comparison.png')});fs.writeFileSync(path.join(out,'detail-metrics.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}
