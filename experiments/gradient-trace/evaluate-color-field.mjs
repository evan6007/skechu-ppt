// Private, image-only proof of the color representation. The caller supplies
// rectangular domains: this is NOT automatic semantic region detection.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fit,rasterize} from './color-field.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const [input,baseline,output,domainsJson]=process.argv.slice(2);
if(!domainsJson)throw Error('Usage: INPUT BASELINE.svg PRIVATE_OUTPUT [[x,y,w,h],...]');
const domains=JSON.parse(domainsJson),out=path.resolve(output);
if(!Array.isArray(domains)||!domains.length||domains.length>8||domains.some(r=>!Array.isArray(r)||r.length!==4||r.some(v=>!Number.isInteger(v)||v<0)||!r[2]||!r[3]||r[2]*r[3]>100000))throw Error('Invalid proof domains');
fs.mkdirSync(out,{recursive:true});
const source='data:image/'+(/\.png$/i.test(input)?'png':'jpeg')+';base64,'+fs.readFileSync(input).toString('base64');
const old='data:image/svg+xml;base64,'+fs.readFileSync(baseline).toString('base64');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1450,height:1800}});
  await page.setContent('<body style="margin:0"><canvas id="proof"></canvas></body>');
  const sources=await page.evaluate(async({source,old,domains})=>{
    const load=async src=>{const im=new Image();im.src=src;await im.decode();return im};
    const [im,prior]=await Promise.all([load(source),load(old)]);
    if(im.width!==prior.width||im.height!==prior.height)throw Error('Mismatched baseline dimensions');
    return domains.map(([x,y,w,h])=>{
      if(x+w>im.width||y+h>im.height)throw Error('Domain exceeds image');
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');ctx.drawImage(im,x,y,w,h,0,0,w,h);
      const rgba=Array.from(ctx.getImageData(0,0,w,h).data),original=canvas.toDataURL();
      ctx.clearRect(0,0,w,h);ctx.drawImage(prior,x,y,w,h,0,0,w,h);
      return {rgba,original,baseline:canvas.toDataURL(),baselineRgba:Array.from(ctx.getImageData(0,0,w,h).data)};
    });
  },{source,old,domains});
  const results=[];
  for(let index=0;index<domains.length;index++){
    const [x,y,w,h]=domains[index],data=sources[index],samples=[];
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const offset=(yy*w+xx)*4;samples.push([xx+.5,yy+.5,...data.rgba.slice(offset,offset+3)]);
    }
    const start=performance.now(),field=fit(samples,{x1:0,y1:0,x2:w,y2:h},{minSpacing:1.5,maxLevels:8,targetRmse:1.5});
    const fitMs=performance.now()-start,rgba=rasterize(field,w,h);
    const rmse=q=>{let s=0,n=0;for(let i=0;i<rgba.length;i+=4)for(let c=0;c<3;c++){s+=(data.rgba[i+c]-q[i+c])**2;n++}return Math.sqrt(s/n)};
    const scale=Math.min(3,Math.floor(1000/Math.max(w,h))),zoom=rasterize(field,w*scale,h*scale);
    const result={domain:[x,y,w,h],controls:field.stats.controls,levels:field.levels.length,
      fitMs:Math.round(fitMs),baselineRmse:rmse(data.baselineRgba),fieldRmse:rmse(rgba),stop:field.stats.reason,
      scope:'caller-supplied rectangular domain; no automatic segmentation or PPT export'};
    results.push(result);
    fs.writeFileSync(path.join(out,`field-${index+1}.json`),JSON.stringify(field));
    sources[index].fieldRgba=Array.from(zoom);sources[index].fieldWidth=w*scale;sources[index].fieldHeight=h*scale;
    sources[index].result=result;
  }
  await page.evaluate(({sources,domains})=>{
    const c=document.getElementById('proof'),cw=430,pad=15;
    c.width=cw*3;c.height=94+domains.reduce((s,r)=>s+400*r[3]/r[2]+62,0);
    const g=c.getContext('2d');g.fillStyle='#eff2f6';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#183049';g.font='bold 22px Microsoft JhengHei';
    ['原圖','v84 線性漸層分區','二維色場原型'].forEach((label,i)=>g.fillText(label,i*cw+pad,31));
    g.font='16px Microsoft JhengHei';g.fillText('右欄：每個指定範圍是一份連續色場，尚未自動辨識輪廓，也尚未匯出 PPT。',pad,63);
    return (async()=>{
      let y=85;
      for(let k=0;k<sources.length;k++){
        const row=sources[k],h=400*domains[k][3]/domains[k][2];
        for(let col=0;col<3;col++){
          let im;
          if(col<2){im=new Image();im.src=col===0?row.original:row.baseline;await im.decode()}
          else{im=document.createElement('canvas');im.width=row.fieldWidth;im.height=row.fieldHeight;im.getContext('2d').putImageData(new ImageData(Uint8ClampedArray.from(row.fieldRgba),im.width,im.height),0,0)}
          g.drawImage(im,col*cw+pad,y,400,h);
        }
        g.font='16px Microsoft JhengHei';g.fillStyle='#183049';
        g.fillText(`範圍 ${k+1} · 原始 ${domains[k][2]} × ${domains[k][3]} px`,pad,y+h+25);
        g.fillText(`RGB 誤差 ${row.result.baselineRmse.toFixed(2)}`,cw+pad,y+h+25);
        g.fillText(`RGB 誤差 ${row.result.fieldRmse.toFixed(2)} · 色場控制點 ${row.result.controls}`,2*cw+pad,y+h+25);
        y+=h+62;
      }
    })();
  },{sources,domains});
  await page.locator('#proof').screenshot({path:path.join(out,'comparison.png')});
  fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {await browser.close()}
