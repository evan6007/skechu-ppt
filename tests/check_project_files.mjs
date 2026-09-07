import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const code=fs.readFileSync(new URL('../app/project-file-store.js',import.meta.url),'utf8');
const ctx=vm.createContext({TextEncoder,crypto:webcrypto,Uint8Array,Map,Promise,setTimeout,clearTimeout,console});
vm.runInContext(code+';globalThis.api=ProjectFileStore',ctx);const api=ctx.api;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await sleep(5)}throw Error('Timed out')}
const fresh=()=>({id:'test',name:'Ten pages',extra:{preserve:true},pages:Array.from({length:10},(_,i)=>({id:'p'+i,name:'Page '+i,items:[{id:'t'+i,type:'text',text:'Editable '+i,formula:'x^2',hidden:i===9}],custom:'keep'}))});
function handle(initial){
 const h={name:'test.skc',text:initial,permission:'granted',writes:0,requests:0,aborts:0,active:0,maxActive:0};
 h.queryPermission=async()=>h.permission;
 h.requestPermission=async()=>{h.requests++;if(h.requestError)throw h.requestError;return h.permission=h.grant?'granted':'denied'};
 h.getFile=async()=>({arrayBuffer:async()=>new TextEncoder().encode(h.text).buffer});
 h.isSameEntry=async other=>h===other;
 h.createWritable=async()=>{h.active++;h.maxActive=Math.max(h.active,h.maxActive);let text;return{
  write:async bytes=>{text=new TextDecoder().decode(bytes);if(h.pause)await h.pause();if(h.writeError)throw h.writeError},
  close:async()=>{if(h.closeError)throw h.closeError;h.text=text;h.writes++;h.active--},
  abort:async()=>{h.aborts++;h.active--}
 }};return h;
}
async function setup(options={}){const p=fresh(),h=handle(api.serialize(p)),saved=[];const s=api.create({delay:10,persist:async r=>saved.push({...r}),...options});await s.attach(p,h);return{p,h,s,saved,r:s.records.get(p.id)}}
{
 const {p,h,s}=await setup();s.observe([p]);await sleep(30);assert.equal(h.writes,0);assert.equal(await s.save(p),true);assert.equal(s.records.get(p.id).running,null);
 p.pages[8].items[0].text='Newest ninth page';s.observe([p]);await until(()=>h.writes===1);assert.deepEqual(JSON.parse(h.text).project,p);assert.equal(s.hasPending([p]),false);
 p.pages[0].items[0].text='Second edit';await s.save(p);assert.equal(h.writes,2,'A no-op save cannot leave the writer permanently running');
}
{
 const {p,h,s}=await setup();let release;h.pause=()=>new Promise(resolve=>{release=resolve});p.name='A';const saving=s.save(p);await until(()=>release);
 const before=h.text;p.name='B';s.observe([p]);h.pause=null;release();assert.equal(await saving,true);assert.notEqual(h.text,before);assert.equal(JSON.parse(h.text).project.name,'B');assert.equal(h.writes,2);assert.equal(h.maxActive,1);
}
{
 const {p,h,s,r}=await setup();h.permission='prompt';p.name='Need permission';s.observe([p]);await until(()=>r.error);assert.equal(h.requests,0);assert.equal(h.writes,0);
 assert.equal(await s.save(p),false);assert.equal(h.requests,1);h.grant=true;assert.equal(await s.save(p),true);assert.equal(h.writes,1);
 h.permission='prompt';h.requestError=Object.assign(Error('gesture expired'),{name:'SecurityError'});p.name='Not lost';assert.equal(await s.save(p),false);assert.match(r.message,/授權/);
}
{
 const {p,h,s,r}=await setup();const external=h.text.replace('Ten pages','New pages');assert.equal(external.length,h.text.length);h.text=external;p.name='Local changes';
 assert.equal(await s.save(p),false);assert.equal(h.text,external);assert.equal(h.writes,0);assert.ok(r.blocked);s.observe([p]);await sleep(40);assert.equal(h.writes,0);
 const clean=await setup();clean.h.text='externally changed';assert.equal(await clean.s.save(clean.p),false,'No-op Ctrl+S also detects external changes');
}
{
 const {p,h,s,r}=await setup();const old=h.text,oldHash=r.diskHash;p.name='Failure';h.closeError=Error('Disk full');assert.equal(await s.save(p),false);assert.equal(h.text,old);assert.equal(r.diskHash,oldHash);assert.equal(h.aborts,1);assert.equal(s.hasPending([p]),true);
 h.closeError=null;assert.equal(await s.save(p),true);assert.equal(JSON.parse(h.text).project.name,'Failure');
}
{
 const {p,h,s}=await setup();h.pause=async()=>{h.text='Changed while writing'};p.name='No overwrite';assert.equal(await s.save(p),false);assert.equal(h.text,'Changed while writing');assert.equal(h.aborts,1);
}
{
 const {p,h,s}=await setup();await s.setAuto(p.id,false);p.name='Manual';s.observe([p]);await sleep(40);assert.equal(h.writes,0);assert.equal(await s.save(p),true);assert.equal(h.writes,1);
}
{
 const {p,h,s}=await setup();let release;h.pause=()=>new Promise(resolve=>{release=resolve});p.name='Started';const work=s.save(p);await until(()=>release);await s.setAuto(p.id,false);p.name='After disabling';s.observe([p]);h.pause=null;release();assert.equal(await work,false);assert.equal(JSON.parse(h.text).project.name,'Started');assert.equal(s.hasPending([p]),true);await s.save(p);assert.equal(JSON.parse(h.text).project.name,'After disabling');
}
{
 const {p,h,s,r}=await setup({persist:async()=>{throw Object.assign(Error('IDB quota'),{name:'QuotaExceededError'})}});p.name='Disk is authoritative';assert.equal(await s.save(p),true);assert.equal(JSON.parse(h.text).project.name,p.name);assert.ok(r.persistenceError);
}
{
 const {p,h,s,saved}=await setup();p.name='Persisted';await s.save(p);const restored=api.create();await restored.attach(p,h,saved.at(-1));assert.equal(restored.hasPending([p]),false);assert.equal(await restored.find(h),restored.records.get(p.id));assert.ok(!Object.hasOwn(saved.at(-1),'wantedText'),'No project contents in file-link metadata');
}
{
 const {p,h,s}=await setup();const other=fresh();other.id='other';other.name='Other';const second=handle(api.serialize(other));await s.attach(other,second);p.name='Only first';await s.save(p);assert.equal(second.writes,0);assert.equal(JSON.parse(h.text).project.name,'Only first');
}
for(const file of ['project-file-store.js','project-files.js','project-files.css']){
 for(const [path,marker] of [['app/index.html',file+'?v=89-file-save'],['app/service-worker.js','./'+file+'?v=89-file-save'],['.github/workflows/windows-release.yml','app/'+file+';.']])assert.ok(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').includes(marker),path+' missing '+file);
 if(file.endsWith('.js'))new Function(fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8'));
}
console.log('SKC file store OK: 10-page lossless saves, no-op/queued edits, permissions, external changes, atomic failure/abort, auto-off, persistence recovery, project isolation and packaged assets.');
