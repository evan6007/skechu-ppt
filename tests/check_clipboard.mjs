import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
const lines=html.split('\n');
const copy=lines.find(line=>line.startsWith('function copySelectedObjects('));
const keydown=lines.find(line=>line.startsWith("window.addEventListener('keydown',"));
assert.ok(copy&&keydown);
const status={textContent:''},calls=[];
let handler,hasSelection=true;
const context=vm.createContext({
  HAS_NATIVE_PPT_BRIDGE:true,traceDraft:null,traceJoinMode:false,pptCopyRunning:false,
  internalClipboard:[{}],document:{getElementById:()=>status},
  window:{addEventListener:(event,callback)=>{if(event==='keydown')handler=callback}},
  copyInternalSelection:()=>{if(!hasSelection)return false;calls.push('internal');return true},
  copySelectionToClipboard:()=>calls.push('native'),
  pasteInternalSelection:()=>calls.push('paste'),
});
vm.runInContext(copy+'\n'+keydown,context);
const press=(overrides={})=>{calls.length=0;let prevented=false;handler({key:'c',ctrlKey:true,metaKey:false,shiftKey:false,repeat:false,target:{tagName:'svg',isContentEditable:false},preventDefault:()=>{prevented=true},...overrides});return{calls:[...calls],prevented}};
assert.deepEqual(press(),{calls:['internal','native'],prevented:true});
assert.deepEqual(press({ctrlKey:false,metaKey:true,key:'C'}).calls,['internal','native']);
assert.deepEqual(press({shiftKey:true}).calls,['native']);
assert.deepEqual(press({key:'v'}).calls,['paste']);
assert.deepEqual(press({repeat:true}).calls,[]);
for(const tagName of ['INPUT','TEXTAREA','SELECT'])assert.deepEqual(press({target:{tagName}}),{calls:[],prevented:false});
assert.deepEqual(press({target:{tagName:'SPAN',isContentEditable:true}}),{calls:[],prevented:false});
hasSelection=false;assert.deepEqual(press().calls,['native']);hasSelection=true;
context.HAS_NATIVE_PPT_BRIDGE=false;
assert.deepEqual(press().calls,['internal','native'],'Web copy reaches the explicit PPT options, not just the internal clipboard');
context.pptCopyRunning=true;assert.deepEqual(press().calls,[]);
console.log('Clipboard shortcuts OK: native + internal copy, text editing, empty selection, repeat guard, web fallback and paste.');

const source=fs.readFileSync(new URL('../app/clipboard-controls.js',import.meta.url),'utf8');
const nodes=new Map(),writes=[],downloads=[];let requestCount=0,failNative=false,failWrite=false;
function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',dataset:{},disabled:false,setAttribute(){},removeAttribute(){},click(){this.onclick?.()}});return nodes.get(id)}
const ctx=vm.createContext({
  performance:{now:()=>0},
  requestWebPptCopy:async(body,progress)=>{assert.deepEqual(JSON.parse(body).items,[{id:'a',type:'box'}]);progress({stage:'已連接本機服務',percent:10});return{ok:true,count:1}},
  location:{protocol:'https:'},
  HAS_NATIVE_PPT_BRIDGE:true,pptCopyRunning:false,pptPrepareTimer:null,pptPrepareWanted:null,pptPreparedBody:null,pptPreparePromise:null,pptPreparingBody:null,traceDraft:null,
  queueNativePrepare(){},noteNativeCopy(){},
  selected:'a',selectedIds:new Set(['a']),items:[{id:'ref',type:'image',referenceOnly:true},{id:'a',type:'box'}],
  document:{getElementById:node},clearTimeout(){},
  exportableItems:items=>items.filter(it=>!it.referenceOnly),nativeRequestBody:items=>JSON.stringify({items}),
  fetch:async(url,options)=>{requestCount++;assert.equal(url,'/copy');assert.deepEqual(JSON.parse(options.body).items,[{id:'a',type:'box'}]);return{}},
  readNativeStream:async(response,progress)=>{progress({stage:'寫入剪貼簿',percent:96});if(failNative)throw new Error('PowerPoint unavailable');return {ok:true,count:1}},
  navigator:{platform:'Win32',clipboard:{write:async entries=>{if(failWrite)throw new Error('NotAllowedError');writes.push(await entries[0].data['image/png'])},writeText(){throw new Error('Must never clear existing clipboard')}}},
  ClipboardItem:class{constructor(data){this.data=data}},
  selectionSvgBlob:async()=>({blob:'svg'}),svgToPng:async promise=>{await promise;return 'png'},download:(blob,name)=>downloads.push({blob,name}),
  copySelectedObjects:()=>ctx.copySelectionToClipboard(),
});
ctx.runLocalPptOperation=async(kind,body,progress)=>ctx.readNativeStream(await ctx.fetch('/'+kind,{body}),progress);
vm.runInContext(source,ctx);
vm.runInContext(fs.readFileSync(new URL('../app/portable-ppt-controls.js',import.meta.url),'utf8'),ctx);
ctx.initializeClipboardControls();
assert.equal(node('copy-ppt').hidden,false);assert.match(node('copy-ppt-mode').textContent,/可編輯/);
await node('copy-ppt').onclick();assert.equal(requestCount,1);assert.match(node('clipboard-title').textContent,/已複製/);assert.match(node('clipboard-message').textContent,/可編輯物件.*Ctrl\+V/);
assert.equal(node('clipboard-feedback').dataset.kind,'success');assert.equal(ctx.pptCopyRunning,false);
ctx.pptPreparePromise=new Promise(()=>{});await ctx.copySelectionToClipboard();assert.equal(requestCount,2,'A click must not await unrelated background preparation');ctx.pptPreparePromise=null;
failNative=true;await ctx.copySelectionToClipboard();assert.match(node('clipboard-title').textContent,/尚未確認/);assert.match(node('clipboard-message').textContent,/PowerPoint unavailable/);
assert.equal(node('clipboard-recovery').hidden,false);
assert.equal(node('clipboard-feedback').dataset.kind,'error');assert.equal(node('copy-ppt').disabled,false);failNative=false;
ctx.selected=null;ctx.selectedIds.clear();const countBefore=requestCount;await ctx.copySelectionToClipboard();
assert.match(node('clipboard-title').textContent,/還沒有/);assert.equal(requestCount,countBefore);
ctx.selected='ref';ctx.selectedIds=new Set(['ref']);await ctx.copySelectionToClipboard();assert.equal(requestCount,countBefore,'A lone reference does not need Office');assert.deepEqual(writes,['png']);writes.length=0;
node('select-all').onclick=()=>{ctx.selected='a';ctx.selectedIds=new Set(['a'])};await node('copy-all-ppt').onclick();
// The button starts the async request synchronously; wait for its completion.
await new Promise(resolve=>setTimeout(resolve,0));assert.equal(requestCount,countBefore+1);
ctx.HAS_NATIVE_PPT_BRIDGE=false;ctx.initializeClipboardControls();await ctx.copySelectionToClipboard();
assert.equal(node('copy-ppt').hidden,false);assert.match(node('copy-ppt-mode').textContent,/可編輯/);
assert.match(node('clipboard-title').textContent,/已複製/);
ctx.requestWebPptCopy=async()=>{const error=new Error('請更新並啟動 Windows 版');error.code='WEB_PPT_UPDATE';throw error};await ctx.copySelectionToClipboard();
assert.equal(node('clipboard-web-actions').hidden,true,'A failed Ctrl+C must not ask the user to copy again using a bitmap button');assert.match(node('clipboard-message').textContent,/請更新並啟動 Windows 版/);
assert.equal(node('clipboard-setup').hidden,false);assert.match(node('clipboard-install-label').textContent,/更新/);
ctx.requestWebPptCopy=async()=>{const error=new Error('Service unavailable');error.code='WEB_PPT_CONNECT';throw error};await ctx.copySelectionToClipboard();
assert.equal(node('clipboard-setup').hidden,false);assert.match(node('clipboard-title').textContent,/先安裝 Windows/);
assert.match(node('clipboard-install-label').textContent,/下載 Windows 必要/);
let retryBody,retryCount=0,completeRetry;
ctx.requestWebPptCopy=async body=>{retryCount++;retryBody=JSON.parse(body);return new Promise(resolve=>completeRetry=resolve)};
ctx.items.push({id:'new-selection',type:'box'});ctx.selected='new-selection';ctx.selectedIds=new Set(['new-selection']);
const retry=node('clipboard-retry').onclick();await node('clipboard-retry').onclick();
assert.equal(retryCount,1);assert.deepEqual(retryBody.items,[{id:'new-selection',type:'box'}]);
assert.equal(node('clipboard-retry').disabled,true);assert.equal(node('clipboard-setup').hidden,true);
completeRetry({ok:true,count:1});await retry;assert.match(node('clipboard-title').textContent,/已複製/);assert.equal(node('clipboard-setup').hidden,true);
ctx.requestWebPptCopy=async()=>{retryCount++;const error=new Error('Connection interrupted');error.code='WEB_PPT_INTERRUPTED';throw error};
await ctx.copySelectionToClipboard();assert.equal(node('clipboard-setup').hidden,true,'Uncertain writes never offer installation as if no copy was sent');
ctx.navigator.platform='MacIntel';const priorRetries=retryCount;await ctx.copySelectionToClipboard();
assert.equal(retryCount,priorRetries,'Non-Windows devices must not probe for a Windows companion');assert.equal(node('clipboard-setup').hidden,true);assert.match(node('clipboard-title').textContent,/可編輯 PPTX/);assert.equal(node('clipboard-portable-actions').hidden,false);
ctx.navigator.platform='Win32';ctx.selected='a';ctx.selectedIds=new Set(['a']);
const install=html.match(/<a id="clipboard-install"[^>]*>/)?.[0];assert.ok(install);
assert.match(install,/href="https:\/\/github.com\/evan6007\/skechu-ppt\/releases\/latest\/download\/Skechu-PPT-Windows-Setup.exe"/);
assert.ok(!/target=/.test(install),'Installer is a direct attachment download, not a new connection tab');
assert.match(html,/不含在此安裝包/);assert.match(html,/不用另裝 Python/);
const setupScript=fs.readFileSync(new URL('../packaging/windows/skechu.iss',import.meta.url),'utf8');
assert.match(setupScript,/Parameters: "--no-open-browser"/);assert.match(setupScript,/Start PowerPoint connector/);
assert.equal(writes.length,0,'Never silently downgrade native shapes into a bitmap');
await ctx.copySelectionPicture();assert.deepEqual(writes,['png']);assert.match(node('clipboard-title').textContent,/PNG 圖片/);
assert.match(node('clipboard-message').textContent,/不是可編輯錨點/);
failWrite=true;await ctx.copySelectionPicture();assert.match(node('clipboard-title').textContent,/未複製成功/);assert.match(node('clipboard-message').textContent,/下載 PNG/);failWrite=false;
await ctx.downloadClipboardSelection(true);await ctx.downloadClipboardSelection(false);assert.deepEqual(downloads,[{blob:'png',name:'skechu-selection.png'},{blob:'svg',name:'skechu-selection.svg'}]);
ctx.traceDraft={};const writeBefore=writes.length;await ctx.copySelectionPicture();assert.equal(writes.length,writeBefore);assert.match(node('clipboard-title').textContent,/先完成/);
ctx.traceDraft=null;ctx.location.protocol='file:';ctx.initializeClipboardControls();await ctx.copySelectionToClipboard();
assert.equal(node('file-entry-notice').hidden,false);assert.match(node('clipboard-message').textContent,/啟動Skechu-PPT.cmd/);
assert.match(node('copy-ppt-mode').textContent,/尚未連接/);
node('clipboard-dismiss').click();assert.equal(node('clipboard-feedback').hidden,true);
assert.ok(!html.includes('copyButton.hidden=true'),'PPT entry must remain visible in web mode');
assert.ok(html.includes("out.querySelectorAll('.arrow-hit,[data-region-preview]')"),'Image clipboard excludes transparent hit paths');
console.log('PPT copy UI OK: visible buttons, select-all action, native progress/errors, no silent raster fallback, explicit PNG write/download, empty/reference/draft guards.');
