import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const client=fs.readFileSync(new URL('../app/web-ppt-client.js',import.meta.url),'utf8');
const helper=fs.readFileSync(new URL('../app/web-ppt-helper.js',import.meta.url),'utf8');
const messages=[],timers=new Map(),polls=new Map();let seq=0,opened=0;
const popup={closed:false,focus(){},postMessage:(data,origin)=>messages.push({data,origin})};
const ctx=vm.createContext({location:{protocol:'https:',origin:'https://evan6007.github.io'},crypto:{randomUUID:()=>String(++seq)},URLSearchParams,
  window:{open:()=>{opened++;return popup},addEventListener(){}},
  setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),
  setInterval:fn=>{const id=++seq;polls.set(id,fn);return id},clearInterval:id=>polls.delete(id)});
vm.runInContext(client,ctx);
const request=()=>ctx.requestWebPptCopy('{"items":[{"type":"box"}]}',()=>{});
const reply=(type,extra={})=>ctx.handleWebPptMessage({origin:'http://127.0.0.1:8766',source:popup,data:{kind:'skechu-ppt',channel:vm.runInContext('webPptSession.channel',ctx),type,...extra}});
let promise=request();assert.equal(opened,1);assert.equal(messages.length,0,'No drawing is sent before explicit permission');
ctx.handleWebPptMessage({origin:'https://evil.example',source:popup,data:{kind:'skechu-ppt',type:'approved',channel:'1'}});assert.equal(messages.length,0);
ctx.handleWebPptMessage({origin:'http://127.0.0.1:8766',source:{},data:{kind:'skechu-ppt',type:'approved',channel:'1'}});assert.equal(messages.length,0);
reply('ready');assert.equal(messages.length,0);reply('approved');assert.equal(messages.length,1);assert.equal(messages[0].origin,'http://127.0.0.1:8766');
reply('result',{id:messages[0].data.id,result:{ok:true,count:3}});assert.equal((await promise).count,3);assert.equal(timers.size,0);assert.equal(polls.size,0);
promise=request();assert.equal(opened,1,'Approved companion reused without a popup for every copy');
reply('result',{id:messages.at(-1).data.id,result:{ok:false,error:'Office blocked'}});await assert.rejects(promise,/Office blocked/);
promise=request();popup.closed=true;[...polls.values()][0]();await assert.rejects(promise,/已關閉/);popup.closed=false;
ctx.window.open=()=>null;await assert.rejects(request(),/封鎖/);
ctx.window.open=()=>popup;promise=request();[...timers.values()].find(t=>t.ms===10000).fn();await assert.rejects(promise,/找不到/);
promise=request();reply('ready');reply('revoked');await assert.rejects(promise,/中斷/);
promise=request();assert.ok([...timers.values()].some(t=>t.ms===120000),'Already-open unapproved companion gets an approval deadline');
[...timers.values()].find(t=>t.ms===120000).fn();await assert.rejects(promise,/允許連接/);
// The localhost helper accepts only the known opener, origin and channel after consent.
const nodes=new Map(),replies=[];let listener,fetches=0;
const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,value:0});return nodes.get(id)};
const opener={postMessage:(data,origin)=>replies.push({data,origin})};
const local=vm.createContext({location:{protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:8766',hash:'#origin=https%3A%2F%2Fevan6007.github.io&channel=test'},
  window:{opener,addEventListener:(event,fn)=>listener=fn},document:{getElementById:el},URLSearchParams,TextDecoder,Uint8Array,
  fetch:async()=>{fetches++;let read=false;return{ok:true,body:{getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:new TextEncoder().encode('{"type":"progress","stage":"copy","percent":50}\n{"type":"result","ok":true,"count":2}\n')})})}}}});
vm.runInContext(helper,local);assert.equal(replies[0].data.type,'ready');
const event={origin:'https://evan6007.github.io',source:opener,data:{kind:'skechu-ppt',channel:'test',type:'copy',id:'copy1',body:'{"items":[{"type":"box"}]}'}};
await listener(event);assert.equal(fetches,0,'Local copy is denied before user consent');el('allow').onclick();
await listener({...event,origin:'https://evil.example'});await listener({...event,source:{}});await listener({...event,data:{...event.data,channel:'stale'}});assert.equal(fetches,0);
await listener(event);assert.equal(fetches,1);assert.equal(replies.at(-1).data.result.count,2);
assert.ok(replies.every(m=>m.origin==='https://evan6007.github.io'),'No wildcard postMessage target');
for(const src of ['C:/private.png','assets/../private.png','assets/..\\private.png','https://example.com/a.png'])assert.throws(()=>local.validWebPptPayload(JSON.stringify({items:[{type:'image',src}]})),/本機檔案/);
assert.throws(()=>local.validWebPptPayload('{"items":[]}'),/沒有可複製/);
el('disconnect').onclick();await listener(event);assert.equal(fetches,1,'Revocation stops new operations');
const originalSelected=JSON.stringify({items:[{type:'arrow',points:[{x:0,y:0},{x:1,y:2}]}]});assert.equal(local.validWebPptPayload(originalSelected).items.length,1);
// New helpers advertise preparation; old helpers remain copy-compatible without warming.
assert.equal(ctx.canWebPptPrepare(),false);reply('approved',{capabilities:['prepare','cache-contexts']});assert.equal(ctx.canWebPptPrepare(),true);
const warmProgress=[];let warm=ctx.requestWebPptPrepare(originalSelected,event=>warmProgress.push(event));const prepareMessage=messages.at(-1).data;assert.equal(prepareMessage.type,'prepare');
promise=request();assert.equal(messages.at(-1).data.type,'copy','Foreground copy immediately preempts in-flight preparation');
const priorityCopy=messages.at(-1).data;
reply('prepare-result',{id:'stale',result:{ok:true,prepared:true,count:1}});assert.equal(messages.at(-1).data.type,'copy');
reply('progress',{id:prepareMessage.id,event:{stage:'建立 PowerPoint 物件',percent:42}});assert.equal(warmProgress[0].percent,42,'Background preparation progress reaches the main editor');
reply('prepare-result',{id:prepareMessage.id,result:{ok:true,prepared:true,count:1}});await warm;
reply('result',{id:priorityCopy.id,result:{ok:true,count:1}});await promise;
warm=ctx.requestWebPptPrepare(originalSelected);reply('revoked');await assert.rejects(warm,/中斷/);assert.equal(ctx.canWebPptPrepare(),false);
const warmRequests=[];
local.fetch=async(url,options)=>{warmRequests.push({url,body:JSON.parse(options.body)});let done=false;return {ok:true,body:{getReader:()=>({read:async()=>done?{done:true}:(done=true,{done:false,value:new TextEncoder().encode('{"type":"progress","stage":"build","percent":50}\n{"type":"result","ok":true,"prepared":true,"count":1,"seconds":0.01}\n')})})}}};
el('allow').onclick();await listener({...event,data:{...event.data,type:'prepare',body:'{"cacheId":"test:all","items":[{"type":"box"}]}'}});
assert.equal(warmRequests[0].url,'/prepare');assert.equal(replies.at(-1).data.type,'prepare-result');assert.equal(replies.at(-1).data.result.prepared,true);
assert.ok(replies.some(message=>message.data.type==='progress'&&message.data.event.percent===50),'Local companion forwards background progress');
el('disconnect').onclick();await listener({...event,data:{...event.data,type:'prepare'}});assert.equal(warmRequests.length,1);
assert.throws(()=>local.validWebPptPayload('{"cacheId":{},"items":[{"type":"box"}]}'),/快取/);
console.log('Web-native PPT OK: consent handshake, strict origin/source/channel, no premature data, reusable session, timeout/popup/close errors, streamed results and unsafe path rejection.');
