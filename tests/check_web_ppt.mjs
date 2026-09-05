import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const client=fs.readFileSync(new URL('../app/web-ppt-client.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const streamCode=html.split('\n').find(line=>line.startsWith('async function readNativeStream('));
const requests=[],timers=new Map();let nextTimer=0,handler;
const response=(events,status=200)=>new Response(events.map(event=>JSON.stringify(event)).join('\n')+'\n',
  {status,headers:{'Content-Type':'application/x-ndjson'}});
const okCopy=()=>response([{type:'progress',stage:'copy',percent:70},{type:'result',ok:true,count:3}]);
const status=()=>Response.json({ok:true,protocol:1,capabilities:['inline-copy','prepare','cache-contexts','cancel-prepare']});
const ctx=vm.createContext({
  location:{protocol:'https:',origin:'https://evan6007.github.io'},
  AbortController,TextDecoder,Uint8Array,Response,
  window:{open(){throw new Error('Copy must stay in the same page')},addEventListener(){}},
  setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  fetch:async(url,options={})=>{requests.push({url,options});return handler(url,options);},
});
vm.runInContext(streamCode+'\n'+client,ctx);
const body='{"items":[{"id":"a","type":"box","x":20,"y":30,"w":60,"h":40}]}';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const reset=()=>{vm.runInContext('webPptSession=null',ctx);requests.length=0;};
handler=url=>url.endsWith('/status')?status():okCopy();
ctx.initializeWebPptClient();
assert.equal(requests.length,0,'Loading the editor must not connect or trigger permission');
assert.equal(ctx.canWebPptPrepare(),false);
await assert.rejects(ctx.requestWebPptPrepare(body),/尚未就緒/);
assert.equal(requests.length,0,'No background Office work before first user copy');
const progress=[];
assert.equal((await ctx.requestWebPptCopy(body,event=>progress.push(event))).count,3);
assert.deepEqual(requests.map(r=>r.url),['http://127.0.0.1:8766/web-ppt/status','http://127.0.0.1:8766/web-ppt/copy']);
assert.equal(requests[1].options.body,body);
for(const {options} of requests)assert.equal(options.credentials,'omit');
assert.equal(requests[1].options.headers['Content-Type'],'application/json');
assert.ok(progress.some(event=>event.percent===70));
assert.equal(ctx.canWebPptPrepare(),true);assert.equal(timers.size,0);
await ctx.requestWebPptCopy(body);
assert.equal(requests.filter(r=>r.url.endsWith('/status')).length,1,'Reuse connection without another permission flow');
// Foreground copy must not await an in-flight background build.
let releasePrepare;
handler=url=>url.endsWith('/prepare')?new Promise(resolve=>releasePrepare=resolve)
  :url.endsWith('/cancel-prepare')?Response.json({ok:true}):okCopy();
const warm=ctx.requestWebPptPrepare(body);
await flush();await ctx.cancelWebPptPrepare();
assert.ok(requests.some(r=>r.url.endsWith('/cancel-prepare')));
const copy=ctx.requestWebPptCopy(body);await flush();
assert.equal(requests.at(-1).url,'http://127.0.0.1:8766/web-ppt/copy');
assert.equal((await copy).count,3);
releasePrepare(response([{type:'result',ok:true,prepared:true,count:3}]));await warm;
assert.equal(timers.size,0);
// Duplicate foreground requests are rejected; exactly one POST is issued.
let releaseCopy;
handler=()=>new Promise(resolve=>releaseCopy=resolve);
const pending=ctx.requestWebPptCopy(body);await flush();
await assert.rejects(ctx.requestWebPptCopy(body),/尚未完成/);
releaseCopy(okCopy());await pending;
// A network failure after POST is ambiguous, so never retry automatically.
reset();handler=url=>url.endsWith('/status')?status():Promise.reject(new TypeError('disconnected'));
await assert.rejects(ctx.requestWebPptCopy(body),/連線中斷/);
assert.equal(requests.filter(r=>r.options.method==='POST').length,1);
assert.equal(ctx.canWebPptPrepare(),false);
assert.equal(timers.size,0);
// Probe errors, old service, blocked local-network access never send artwork.
for(const probe of [()=>new Response('',{status:404}),()=>Response.json({ok:true,protocol:0}),()=>Promise.reject(new TypeError('denied'))]){
  reset();handler=probe;await assert.rejects(ctx.requestWebPptCopy(body),/更新|啟動/);
  assert.equal(requests.length,1);assert.equal(requests[0].options.method,undefined);
  assert.equal(ctx.canWebPptPrepare(),false);assert.equal(timers.size,0);
}
// Stream completion is necessary. Progress, a failed result, or zero objects is not success.
for(const result of [
  ()=>response([{type:'progress',percent:100}]),
  ()=>response([{type:'result',ok:false,error:'Office unavailable'}]),
  ()=>response([{type:'result',ok:true,count:0}]),
  ()=>new Response('{bad json}\n'),
]){
  reset();handler=url=>url.endsWith('/status')?status():result();
  await assert.rejects(ctx.requestWebPptCopy(body));
  assert.equal(requests.filter(r=>r.options.method==='POST').length,1);
  assert.equal(timers.size,0);
}
reset();ctx.location.protocol='file:';
await assert.rejects(ctx.requestWebPptCopy(body),/HTML/);assert.equal(requests.length,0);
console.log('Inline web PPT OK: click-only connection, no popup, origin-specific direct requests, progress, copy priority, preparation, old-service handling and no retry after ambiguous writes.');

// A running old HTTP server can still serve an updated same-origin helper.
reset();ctx.location.protocol='https:';ctx.URLSearchParams=URLSearchParams;
let channelSequence=0,frameListener,frame;const posted=[];
ctx.crypto={randomUUID:()=>String(++channelSequence)};
ctx.window.addEventListener=(name,listener)=>{if(name==='message')frameListener=listener;};
ctx.window.removeEventListener=(name,listener)=>{if(frameListener===listener)frameListener=null;};
ctx.document={createElement:()=>frame={isConnected:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},
  remove(){this.isConnected=false;},contentWindow:{postMessage:(data,origin)=>posted.push({data,origin})}},
  body:{appendChild(value){value.isConnected=true;}}};
handler=()=>{throw new TypeError('old status route has no CORS');};
const fallbackCopy=ctx.requestWebPptCopy(body);await flush();
assert.equal(frame.hidden,true);assert.equal(frame.tabIndex,-1);
assert.equal(posted.length,0,'No artwork before a validated helper handshake');
const channel=new URL(frame.src).hash.match(/channel=([^&]+)/)[1];
const frameReply=(type,extra={})=>frameListener({origin:'http://127.0.0.1:8766',source:frame.contentWindow,data:{kind:'skechu-ppt',channel,type,...extra}});
frameListener({origin:'https://evil.example',source:frame.contentWindow,data:{kind:'skechu-ppt',channel,type:'approved',capabilities:['inline-copy']}});
assert.equal(posted.length,0);
frameReply('ready',{capabilities:['inline-copy','prepare']});
assert.equal(posted[0].data.type,'connect');assert.equal(posted[0].data.body,undefined);
frameReply('approved',{capabilities:['inline-copy','prepare']});await flush();
assert.equal(posted.at(-1).data.type,'copy');assert.equal(posted.at(-1).data.body,body);
const copyId=posted.at(-1).data.id;
frameReply('result',{id:copyId,result:{ok:true,count:3}});await fallbackCopy;
assert.equal(requests.length,1,'After failed probing, no HTTP copy is sent in parallel with the helper copy');
assert.ok(posted.every(message=>message.origin==='http://127.0.0.1:8766'));
assert.equal(posted.filter(message=>message.data.type==='copy').length,1);
assert.equal(timers.size,0);

// Verify the helper's parent/origin/channel boundary and automatic inline-only connection.
const helper=fs.readFileSync(new URL('../app/web-ppt-helper.js',import.meta.url),'utf8');
const helperNodes=new Map(),helperReplies=[];let helperListener,helperFetches=0;
const parent={postMessage:(data,origin)=>helperReplies.push({data,origin})};
const helperCtx=vm.createContext({location:{protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:8766',hash:'#origin=https%3A%2F%2Fevan6007.github.io&channel=test'},
  URLSearchParams,TextDecoder,Uint8Array,window:{parent,addEventListener:(event,listener)=>helperListener=listener},
  document:{getElementById:id=>{if(!helperNodes.has(id))helperNodes.set(id,{textContent:'',hidden:false});return helperNodes.get(id);}},
  fetch:async()=>{helperFetches++;return okCopy();}});
vm.runInContext(helper,helperCtx);
const event={origin:'https://evan6007.github.io',source:parent,data:{kind:'skechu-ppt',channel:'test',type:'copy',id:'copy',body}};
await helperListener(event);assert.equal(helperFetches,0,'No copying before a known parent initiates connection');
await helperListener({...event,origin:'https://evil.example',data:{...event.data,type:'connect'}});
await helperListener({...event,source:{},data:{...event.data,type:'connect'}});
await helperListener(event);assert.equal(helperFetches,0);
await helperListener({...event,data:{...event.data,type:'connect'}});
assert.equal(helperReplies.at(-1).data.type,'approved');
await helperListener(event);assert.equal(helperFetches,1);
assert.equal(helperReplies.at(-1).data.result.count,3);
for(const src of ['C:/private.png','assets/../private.png','https://example.com/image.png']){
  await helperListener({...event,data:{...event.data,body:JSON.stringify({items:[{type:'image',src}]})}});
}
assert.equal(helperFetches,1,'Unsafe paths never reach Office');
helperNodes.get('disconnect').onclick();await helperListener(event);assert.equal(helperFetches,1);
console.log('Compatibility copy OK: automatic hidden connection, exact message boundary, one copy per keypress, no second button and no image downgrade.');
