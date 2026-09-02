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
  HAS_NATIVE_PPT_BRIDGE:true,traceDraft:null,traceJoinMode:false,
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
hasSelection=false;assert.deepEqual(press().calls,[]);hasSelection=true;
context.HAS_NATIVE_PPT_BRIDGE=false;
assert.deepEqual(press().calls,['internal']);
assert.match(status.textContent,/Windows 本機版/);
console.log('Clipboard shortcuts OK: native + internal copy, text editing, empty selection, repeat guard, web fallback and paste.');
