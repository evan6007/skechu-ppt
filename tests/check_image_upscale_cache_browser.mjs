import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage(),heavy=[];p.on('request',r=>{if(/tf-4\.22|anime-v3/.test(r.url()))heavy.push(r.url())});await p.goto(process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/');
 const installed=await p.evaluate(async()=>{
  await navigator.serviceWorker.register('./service-worker.js');await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  const name=(await caches.keys()).find(k=>k.startsWith('skechu-ppt-v'));const cache=await caches.open(name);return(await cache.keys()).map(r=>r.url);
 });
 assert.ok(installed.some(url=>url.includes('image-upscale-ui.js')));assert.equal(heavy.length,0,'Installing the app shell must not fetch engine/model');assert.ok(!installed.some(url=>/tf-4\.22|anime-v3/.test(url)));
 await p.evaluate(async()=>{await fetch('vendor/super-resolution/anime-v3.json');await fetch('vendor/super-resolution/anime-v3-f32.bin');await fetch('vendor/super-resolution/tf-4.22.0.min.js')});
 await p.waitForFunction(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('skechu-ppt-v')),keys=await(await caches.open(name)).keys();return keys.filter(r=>/tf-4\.22|anime-v3/.test(r.url)).length===3});await p.context().setOffline(true);
 const sizes=await p.evaluate(async()=>await Promise.all(['anime-v3.json','anime-v3-f32.bin','tf-4.22.0.min.js'].map(async file=>{const r=await fetch('vendor/super-resolution/'+file);return(await r.arrayBuffer()).byteLength})));assert.deepEqual(sizes,[3157,2485696,1469843]);
 console.log('Static-site cache OK: engine/model excluded from installation; used assets served offline with exact bytes.');
}finally{await browser.close()}
