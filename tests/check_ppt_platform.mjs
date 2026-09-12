import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const nodes=new Map(),saved=new Map(),effects=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:false,textContent:'',value:'',setAttribute(){},removeAttribute(){}});return nodes.get(id)};
const context=vm.createContext({navigator:{},location:{protocol:'https:'},document:{getElementById:node},
  localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
  sessionStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID:()=> 'test'},
  HAS_NATIVE_PPT_BRIDGE:true,pptPrepareTimer:null,pptPrepareWanted:null,clearTimeout(){},
  copySelectedObjects(){effects.push('copy')},fetch(){effects.push('network')},download(){effects.push('download')},canWebPptPrepare:()=>true,
});
for(const file of ['clipboard-controls.js','portable-ppt-controls.js','ppt-preparation.js'])vm.runInContext(fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),context);
const fixtures=[
  ['windows',{userAgentData:{platform:'Windows'},platform:'Win32',maxTouchPoints:10}],
  ['windows',{platform:'Win32',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}],
  ['windows',{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}],
  ['mac',{userAgentData:{platform:'macOS'},platform:'MacIntel',maxTouchPoints:0}],
  ['mac',{platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}],
  ['ios',{platform:'MacIntel',maxTouchPoints:5,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/604.1'}],
  ['ios',{platform:'iPhone',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}],
  ['ios',{platform:'iPad',maxTouchPoints:5}],
  ['android',{platform:'Linux armv8l',userAgent:'Mozilla/5.0 (Linux; Android 15)'}],
  ['android',{userAgentData:{platform:'Android'},platform:'Linux aarch64'}],
  ['linux',{platform:'Linux x86_64',userAgent:'Mozilla/5.0 (X11; Ubuntu; Linux x86_64)'}],
  ['linux',{userAgentData:{platform:'Linux'}}],
  ['chromeos',{userAgentData:{platform:'Chrome OS'}}],
  ['chromeos',{platform:'Linux x86_64',userAgent:'Mozilla/5.0 (X11; CrOS x86_64 15917.0.0)'}],
  ['other',{userAgent:'Mozilla/5.0 (Windows Phone 10.0; Android 6.0)'}],
  ['unknown',{}],['unknown',{platform:'',userAgent:'Mozilla/5.0'}],
];
for(const [expected,nav] of fixtures){
  context.navigator=nav;vm.runInContext("pptTransferMode='auto'",context);
  assert.equal(context.detectPptPlatform().id,expected);
  context.initializeClipboardControls();
  assert.equal(context.clipboardNeedsWindows(),expected!=='windows');
  assert.equal(context.canPreparePpt(),expected==='windows','No background Office preparation on non-Windows, even at localhost');
  assert.match(node('ppt-platform-note').textContent,/自動辨識/);
  if(expected!=='windows'){
    context.portableCopyGuidance();
    assert.equal(node('clipboard-setup').hidden,true);
    assert.equal(node('clipboard-portable-actions').hidden,false);
    assert.match(node('clipboard-message').textContent,/不會寫入原生系統剪貼簿/);
  }
}
context.navigator={};
node('ppt-transfer-mode').onchange({target:{value:'windows'}});
assert.equal(context.clipboardNeedsWindows(),false);
assert.match(node('ppt-platform-note').textContent,/手動模式：未辨識系統/);
assert.equal(saved.get('skechu-ppt-transfer-mode-v1'),'windows');
context.initializeClipboardControls();assert.equal(context.clipboardNeedsWindows(),false,'Explicit correction persists');
node('ppt-transfer-mode').onchange({target:{value:'portable'}});
assert.equal(context.canPreparePpt(),false);
node('ppt-transfer-mode').onchange({target:{value:'not-valid'}});
assert.equal(saved.get('skechu-ppt-transfer-mode-v1'),'auto');
assert.equal(context.clipboardNeedsWindows(),true);
assert.deepEqual(effects,[],'OS checks and manual correction never connect, copy or download');
console.log(`Platform routing: ${fixtures.length} Windows/Mac/iPad/iPhone/Android/Linux/ChromeOS/unknown cases, localhost isolation, explicit persisted correction and zero side effects passed.`);
