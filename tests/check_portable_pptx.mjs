import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context=vm.createContext({TextEncoder,Uint8Array,Uint32Array,DataView});
vm.runInContext(fs.readFileSync(new URL('../app/portable-pptx.js',import.meta.url),'utf8')+'\nglobalThis.api=PortablePptx;',context);
const api=context.api;
const line=(p0,p3)=>({p0,c1:{x:(2*p0.x+p3.x)/3,y:(2*p0.y+p3.y)/3},c2:{x:(p0.x+2*p3.x)/3,y:(p0.y+2*p3.y)/3},p3});
const loop=(points)=>({closed:true,segments:points.map((p,i)=>line(p,points[(i+1)%points.length]))});
const rectangle=(x,y,w,h,reverse=false)=>{const points=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];return loop(reverse?points.reverse():points)};
export const fixture={version:1,shapes:[
  {kind:'path',x:0,y:0,w:180,h:120,contours:[rectangle(0,0,180,120),rectangle(55,35,70,50,true)],fill:{type:'linear',angle:35,opacity:.8,stops:[{position:0,color:'#ff7920',opacity:1},{position:.4,color:'#00cc88',opacity:.8},{position:1,color:'#123abc',opacity:.5}]},stroke:{color:'#172033',width:2}},
  {kind:'path',x:220,y:0,w:140,h:120,contours:[{closed:false,segments:[{p0:{x:220,y:100},c1:{x:230,y:0},c2:{x:350,y:0},p3:{x:360,y:100}}]}],fill:null,stroke:{color:'#ff7920',width:4}},
  {kind:'path',x:0,y:155,w:180,h:60,rotation:15,contours:[rectangle(0,155,180,60)],fill:{type:'solid',color:'#95ccee',opacity:1}},
  {kind:'text',x:220,y:150,w:280,h:85,text:'Skechu & <editable>\n原生漸層',size:23,font:'Arial',color:'#172033',bold:true,lineHeight:1.2}
]};
const original=JSON.stringify(fixture),parts=api.parts(fixture),bytes=api.encode(fixture);
assert.equal(JSON.stringify(fixture),original,'Export must not mutate input');
assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
const slide=parts['ppt/slides/slide1.xml'];
assert.equal((slide.match(/<p:sp>/g)||[]).length,4);
assert.equal((slide.match(/<a:moveTo>/g)||[]).length,4,'Two independent contours, one open cubic, one rectangle');
assert.equal((slide.match(/<a:close\/>/g)||[]).length,3);
assert.equal((slide.match(/<a:gs pos=/g)||[]).length,3);
assert.match(slide,/Skechu &amp; &lt;editable&gt;/);
assert.match(slide,/原生漸層/);
assert.match(slide,/<a:alpha val="40000"/);
assert.match(slide,/ang="2100000"/);
assert.ok(!Object.keys(parts).some(name=>/media/.test(name)));
assert.ok(!Object.values(parts).some(text=>/blipFill|TargetMode="External"|oleObj|macro/i.test(text)));
for(const patch of [{version:2},{shapes:[]},{shapes:[...fixture.shapes,{kind:'image'}]}])assert.throws(()=>api.encode({...fixture,...patch}));
for(const patch of [{x:NaN},{w:Infinity},{rotation:'2'},{fill:{type:'solid',color:'red'}},{fill:{type:'linear',angle:0,stops:[]}}])assert.throws(()=>api.encode({version:1,shapes:[{...fixture.shapes[0],...patch}]}));
const disconnected=structuredClone(fixture);disconnected.shapes[0].contours[0].segments[1].p0={x:100,y:0};
assert.throws(()=>api.encode(disconnected),/中途斷開/);
const unclosed=structuredClone(fixture);unclosed.shapes[0].contours[0].segments.at(-1).p3={x:100,y:0};
assert.throws(()=>api.encode(unclosed),/首尾/);
const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
for(const name of ['portable-pptx.js','portable-ppt-controls.js']){
  assert.ok(html.includes(name));
  assert.ok(fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes('./'+name));
  assert.ok(fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/'+name+';.'));
}
const worker=fs.readFileSync(new URL('../app/portable-ppt-worker.js',import.meta.url),'utf8');
assert.match(worker,/postMessage\(\{bytes\},\[bytes.buffer\]\)/);
assert.ok(fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes('./portable-ppt-worker.js'));
assert.ok(fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/portable-ppt-worker.js;.'));
const out=new URL('../.codex-tmp/portable-pptx-qa/',import.meta.url);fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(new URL('native-fixture.pptx',out),bytes);
fs.writeFileSync(new URL('native-fixture.json',out),JSON.stringify(fixture));
console.log(`Portable PPTX: native cubics, independent contours, multistop alpha, text, rotations, validation, no mutation/network/media; ${bytes.length} bytes.`);
