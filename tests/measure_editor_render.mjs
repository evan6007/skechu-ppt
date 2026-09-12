/* Isolated synthetic scenes only; no user projects or clipboard changes. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/')+'?mode=web&storage=render-bench-'+Date.now());
 await page.waitForFunction(()=>workspaceReady);
 const result=await page.evaluate(async(expanded)=>{
  items=Array.from({length:1800},(_,i)=>({id:'bench-'+i,name:'line '+i,type:'arrow',points:[{x:(i%60)*15,y:Math.floor(i/60)*20},{x:(i%60)*15+10,y:Math.floor(i/60)*20+12}],width:2,color:'#173454',endHead:false,startHead:false,layerGroup:{id:'bench',name:'Benchmark',collapsed:!expanded}}));
  selected='bench-0';selectedIds=new Set([selected]);render();fitView();
  const timings={};
  for(const name of ['sceneMarkup','renderLayers','syncControls','syncAutoJunctions','syncArrowAttachments','renderSelection','renderWorkspacePages']){
   const original=window[name];window[name]=(...args)=>{const t=performance.now();try{return original(...args)}finally{(timings[name]??=[]).push(performance.now()-t)}};
  }
  const full=[];for(let i=0;i<8;i++){items[0].points[1].x+=1;const t=performance.now();render();full.push(performance.now()-t)}
  const input=document.getElementById('line-color');input.focus();input.value='#ee3344';input.dispatchEvent(new Event('input',{bubbles:true}));
  const beforeConfirmation=items[0].color;
  const inputMs=[];
  for(let i=0;i<12;i++){const t=performance.now();input.value=i%2?'#33aa66':'#ee3344';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);inputMs.push(performance.now()-t)}
  input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();
  const start=performance.now();selectedIds=new Set(items.map(it=>it.id));deleteSelectedObjects();const deleteMs=performance.now()-start;
  return{count:1800,expanded,beforeConfirmation,fullMs:full,inputFrameMs:inputMs,deleteMs,timings};
 },process.env.SKECHU_BENCH_EXPANDED==='1');
 fs.mkdirSync('.codex-tmp/color-perf',{recursive:true});
 const name=process.argv[2]||'latest';fs.writeFileSync('.codex-tmp/color-perf/'+name+'.json',JSON.stringify(result,null,2));
 const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
 console.log(JSON.stringify({count:result.count,beforeConfirmation:result.beforeConfirmation,renderMedian:median(result.fullMs),colorFrameMedian:median(result.inputFrameMs),deleteMs:result.deleteMs,components:Object.fromEntries(Object.entries(result.timings).map(([k,v])=>[k,median(v)]))}));
}finally{await browser.close()}
