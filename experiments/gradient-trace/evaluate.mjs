// Isolated local browser runner. Original images and derived assets stay local.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const [input,destination,roiArgument,optionsArgument]=process.argv.slice(2);if(!input||!destination)throw Error('Usage: node experiments/gradient-trace/evaluate.mjs INPUT_IMAGE OUTPUT_DIRECTORY [x,y,width,height] [OPTIONS_JSON]');
const traceOptions=optionsArgument?JSON.parse(optionsArgument):{};
// Optional crop is for reporting only: never pass it to the vectorizer.
const roi=roiArgument?roiArgument.split(',').map(Number):null;
if(roi&&(roi.length!==4||roi.some(v=>!Number.isFinite(v)||v<0)||!roi[2]||!roi[3]))throw Error('Invalid reporting crop');
const out=path.resolve(destination);fs.mkdirSync(out,{recursive:true});
const mime=/\.png$/i.test(input)?'image/png':/\.webp$/i.test(input)?'image/webp':'image/jpeg';
const source='data:'+mime+';base64,'+fs.readFileSync(input).toString('base64');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',message=>{if(message.type()==='info')console.log(message.text())});
 await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/')+'?storage=source-gradient-private-'+Date.now());await page.waitForFunction(()=>workspaceReady);
 if(!await page.evaluate(()=>typeof GradientTrace!=='undefined'))await page.addScriptTag({path:path.join(root,'app/source-gradient.js')});
 const result=await page.evaluate(async ({source,roi,traceOptions})=>{
  const im=new Image();im.src=source;await im.decode();const scale=Math.min(1,1024/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.round(im.naturalWidth*scale),h=Math.round(im.naturalHeight*scale);
  const c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d');cx.drawImage(im,0,0,w,h);const data=cx.getImageData(0,0,w,h).data;
  VTracerWasm.init(await IllustrationTrace.wasmBytes());const started=performance.now(),progress=(percent,stage)=>console.info(JSON.stringify({percent,stage})),enhanced=traceOptions.mode?AutoTrace.run({data,width:w,height:h,options:traceOptions},progress):GradientTrace.vectorize(data,w,h,AutoTrace,progress,traceOptions),ms=performance.now()-started;
  const baseline=IllustrationTrace.run(data,w,h,{threshold:120,accuracy:3.5,simplify:90,minLength:5},AutoTrace,()=>{});
  const fills=enhanced.colorItems.map((it,i)=>({...it,id:'source-fill-'+i,name:'色區 '+(i+1),layerGroup:{id:'source-gradients',name:'自動漸層填色（實驗）',collapsed:true}}));
  const ref={id:'source-ref',type:'image',name:'原圖對照',referenceOnly:true,preserveFull:true,src:source,x:0,y:0,w,h,r:0,opacity:.5,locked:false};
  const p=makeProject('來源導引漸層填色',[ref,...fills],{width:w,height:h});p.pages[0].canvasColor='#ffffff';p.pages[0].canvasOpacity=1;
  const project={version:2,project:p};
  // Match the real editor's hit-target CSS; bare sceneMarkup otherwise paints
  // the invisible interaction paths black in a standalone SVG.
  const svgFor=(items,prefix)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>.arrow-hit{fill:none;stroke:none}</style>${sceneMarkup(items.map((it,i)=>({...it,id:prefix+i})),prefix)}</svg>`;
  const after=svgFor(fills,'after-'),before=svgFor(baseline.colorItems,'before-'),solid=svgFor(fills.map(it=>({...it,fillGradient:null})),'solid-');
  const metrics={};for(const [name,markup] of [['baseline',before],['sameGeometrySolid',solid],['sourceFit',after]]){const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(markup);await image.decode();cx.clearRect(0,0,w,h);cx.drawImage(image,0,0);const q=cx.getImageData(0,0,w,h).data;
   const error=([x,y,rw,rh])=>{let sum=0,n=0;for(let yy=y;yy<Math.min(h,y+rh);yy++)for(let xx=x;xx<Math.min(w,x+rw);xx++){const i=(yy*w+xx)*4;for(let k=0;k<3;k++){sum+=(data[i+k]-q[i+k])**2;n++}}return Math.sqrt(sum/n)};
   metrics[name]={rgbRmse:error([0,0,w,h]),...(roi?{cropRgbRmse:error(roi)}:{})};
  }
  projects=[p];activeProjectId=p.id;activePageId=p.activePageId;items=[ref,...fills];resetEditorState();applyCanvasSize();renderProjectNav();render();fitView();
  return{before,after,solid,project,stats:enhanced.stats,metrics,ms:Math.round(ms),w,h};
 },{source,roi,traceOptions});
 fs.writeFileSync(path.join(out,'source-fit.skc'),JSON.stringify(result.project,null,2));
 fs.writeFileSync(path.join(out,'source-fit.svg'),result.after);fs.writeFileSync(path.join(out,'baseline.svg'),result.before);
 fs.writeFileSync(path.join(out,'same-geometry-solid.svg'),result.solid);
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({stats:result.stats,metrics:result.metrics,ms:result.ms,w:result.w,h:result.h},null,2));
 // Inspect the actual editor output, then a separate all-selected screenshot.
 await page.screenshot({path:path.join(out,'editor.png')});
 const native=await page.evaluate(()=>{document.getElementById('select-all').click();return nativeBody(items)});fs.writeFileSync(path.join(out,'native-payload.json'),native);
 await page.screenshot({path:path.join(out,'editable.png')});
 // Exercise recolor/Undo on one generated gradient without losing other regions.
 const interaction=await page.evaluate(()=>{const it=items.find(it=>it.fillGradient);if(!it)return{gradients:0};const original=state();setOnlySelected(it.id);commit();applyColorToItem(it,'#ff3366',true);render();const colored=byId(it.id).fill==='#ff3366'&&!byId(it.id).fillGradient;document.getElementById('undo').click();return{colored,undoExact:state()===original}});
 if(interaction.gradients!==0&&(!interaction.colored||!interaction.undoExact))throw Error('Independent color/Undo regression');
 if(errors.length)throw Error(errors.join('\n'));
 // Clean image-only proof, generated from exactly the editor renderer above.
 const cells=[['原圖',source],['現行預設填色',result.before],['細色區 · 不用漸層',result.solid],['來源導引 · 自動漸層',result.after]].map(([label,src])=>({label,src:src.startsWith('data:')?src:'data:image/svg+xml;base64,'+Buffer.from(src).toString('base64')}));
 await page.setContent('<body style="margin:0"><canvas id="comparison"></canvas></body>');
 await page.evaluate(async({cells,w,h,roi})=>{const cellWidth=400,gap=12,imageWidth=cellWidth-gap*2,fullHeight=imageWidth*h/w,rowHeight=fullHeight+56,cropHeight=roi?imageWidth*roi[3]/roi[2]+40:0,c=document.getElementById('comparison');c.width=cellWidth*4;c.height=Math.ceil(rowHeight+cropHeight);const g=c.getContext('2d');g.fillStyle='#f3f5f9';g.fillRect(0,0,c.width,c.height);for(let i=0;i<cells.length;i++){const im=new Image();im.src=cells[i].src;await im.decode();g.fillStyle='#172a46';g.font='bold 20px Microsoft JhengHei';g.fillText(cells[i].label,i*cellWidth+gap,30);g.drawImage(im,i*cellWidth+gap,44,imageWidth,fullHeight);if(roi){g.font='14px Microsoft JhengHei';g.fillText('同一位置放大',i*cellWidth+gap,rowHeight+22);g.drawImage(im,...roi,i*cellWidth+gap,rowHeight+32,imageWidth,cropHeight-40)}}},{cells,w:result.w,h:result.h,roi});
 await page.locator('#comparison').screenshot({path:path.join(out,'comparison.png')});
 console.log(JSON.stringify({input:path.basename(input),stats:result.stats,metrics:result.metrics,ms:result.ms,interaction}));
}finally{await browser.close()}
