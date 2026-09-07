import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto(process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/');
 const metrics=await page.evaluate(async()=>{
  const code=`importScripts(new URL('image-upscale-core.js',${JSON.stringify(location.href)}).href,new URL('vendor/super-resolution/tf-4.22.0.min.js',${JSON.stringify(location.href)}).href);
  onmessage=async()=>{let model;try{await tf.setBackend('webgl');await tf.ready();tf.env().set('WEBGL_CPU_FORWARD',false);tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD',0);
   model=await SkechuUpscale.loadModel(tf,new URL('vendor/super-resolution/',${JSON.stringify(location.href)}));
   const width=145,height=137,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;data[i]=(x*2+y)%256;data[i+1]=(x*3+y*5)%256;data[i+2]=((x>>2)^(y>>3))*15%256;data[i+3]=255}
   const full={x:0,y:0,w:width,h:height,left:0,top:0,width,height},values=await SkechuUpscale.infer(tf,model,SkechuUpscale.tileInput(data,width,full),width,height),results=[];
   for(const size of [64,128]){
    const out=new Uint8ClampedArray(width*height*16*4),expected=new Uint8ClampedArray(out.length);SkechuUpscale.copyTile(expected,width*4,values,full,4);const idle=tf.memory().numTensors;
    for(const tile of SkechuUpscale.tiles(width,height,size)){const v=await SkechuUpscale.infer(tf,model,SkechuUpscale.tileInput(data,width,tile),tile.width,tile.height);SkechuUpscale.copyTile(out,width*4,v,tile,4)}
    let sum=0,max=0,seamMax=0,count=0;for(let y=0;y<height*4;y++)for(let x=0;x<width*4;x++)for(let c=0;c<3;c++){const i=(y*width*4+x)*4+c,d=Math.abs(out[i]-expected[i]);sum+=d*d;max=Math.max(max,d);count++;if(x%(size*4)<4||y%(size*4)<4)seamMax=Math.max(seamMax,d)}
    results.push({tileSize:size,rmse:Math.sqrt(sum/count),max,seamMax,tensorLeak:tf.memory().numTensors!==idle});
   }model.dispose();model=null;postMessage({results,remainingTensors:tf.memory().numTensors});
  }catch(error){postMessage({error:error.message})}finally{model?.dispose()}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));return await new Promise((resolve,reject)=>{const w=new Worker(url);w.onerror=e=>{w.terminate();URL.revokeObjectURL(url);reject(Error(e.message))};w.onmessage=e=>{w.terminate();URL.revokeObjectURL(url);resolve(e.data)};w.postMessage({})});
 });
 assert.ok(!metrics.error,metrics.error);for(const m of metrics.results){assert.ok(m.max<=1&&m.seamMax<=1&&m.rmse<.15,'Retained cores must match whole-image inference within 8-bit rounding');assert.equal(m.tensorLeak,false)}assert.equal(metrics.remainingTensors,0);console.log('AI tiling vs whole-image WebGL:',JSON.stringify(metrics));
 // Transparent AI input must fail before it even loads a GPU runtime.
 const heavy=[];page.on('request',r=>{if(/tf-4\.22|anime-v3/.test(r.url()))heavy.push(r.url())});
 const transparent=await page.evaluate(async()=>await new Promise(resolve=>{const w=new Worker('image-upscale-worker.js');w.onmessage=e=>{if(e.data.type==='progress')return;w.terminate();resolve(e.data)};w.postMessage({width:4,height:4,scale:2,method:'anime',data:new Uint8ClampedArray(64)})}));assert.equal(transparent.type,'error');assert.match(transparent.message,/透明/);assert.equal(heavy.length,0);
 // Force a GPU-unavailable runtime response; no silent neural CPU fallback.
 await page.route('**/tf-4.22.0.min.js',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.tf={setBackend:async()=>false,ready:async()=>{},getBackend:()=>"cpu"};'}));
 const unavailable=await page.evaluate(async()=>await new Promise(resolve=>{const w=new Worker('image-upscale-worker.js');w.onmessage=e=>{if(e.data.type==='progress')return;w.terminate();resolve(e.data)};w.postMessage({width:4,height:4,scale:2,method:'anime',data:new Uint8ClampedArray(64).fill(255)})}));assert.equal(unavailable.type,'error');assert.match(unavailable.message,/一般放大/);assert.ok(!heavy.some(url=>url.includes('anime-v3')));
 console.log('AI failure gates OK: transparent input and unavailable GPU are explicit; model not fetched, no CPU fallback.');
}finally{await browser.close()}
