import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source = read('app/mobile-controls.js'), css = read('app/mobile-controls.css'), html = read('app/index.html');
for (const file of ['mobile-controls.js','mobile-controls.css']) {
  const version='?v=69-copy-paste';
  assert.ok(html.includes(file+version));
  assert.ok(read('app/service-worker.js').includes(file+version));
  assert.ok(read('.github/workflows/windows-release.yml').includes('app/'+file+';.'));
}
assert.ok(html.includes('initializeMobileControls();') && html.includes('syncMobileControls();'));
assert.ok(css.includes('@media(max-width:900px)'));
assert.ok(css.includes('height:clamp(180px,32dvh,280px)'),'Sheets stay compact instead of becoming full-screen sidebars');
assert.ok(css.includes('min-height:44px'),'Direct actions have touch-sized targets');
assert.ok(css.includes('.topbar #undo,.topbar #redo{display:none}'),'Select all remains accessible while undo/redo move to the dock');
assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(source),'Icons cannot depend on OS emoji rendering');
const button = () => ({disabled:false,hidden:false,attributes:{},setAttribute(k,v){this.attributes[k]=v},classList:{toggle(){}}});
const classes = new Set();
const workspace = {dataset:{},classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:(...keys)=>keys.forEach(k=>classes.delete(k))}};
const panel = () => ({inert:false,title:{textContent:''},querySelector(){return this.title}});
const ui = {media:{matches:true},sidebar:panel(),inspector:panel(),tabs:Object.fromEntries(['pages','palette','layers','properties'].map(k=>[k,button()])),
  actions:button(),count:{},remove:button(),copy:button(),paste:button(),clear:button(),finish:button(),undo:button(),redo:button()};
const ctx=vm.createContext({workspace,items:[],selectedIds:new Set(),internalClipboard:[],traceDraft:null,history:[],future:[],ui});
ctx.closeMobilePanels=()=>{classes.clear();ctx.syncMobilePanels()};
vm.runInContext(source+'\nmobileEditorUi=ui;',ctx);
ctx.syncMobileControls();assert.equal(ui.actions.hidden,true);assert.equal(ui.tabs.properties.disabled,true);
ctx.items=[{id:'a'},{id:'locked',locked:true}];ctx.selectedIds=new Set(['a']);ctx.syncMobileControls();
assert.equal(ui.actions.hidden,false);assert.equal(ui.remove.disabled,false);assert.equal(ui.count.textContent,'1 個物件');
ctx.selectedIds=new Set(['locked']);ctx.syncMobileControls();assert.equal(ui.remove.disabled,true);
ctx.selectedIds=new Set(['a','locked']);ctx.syncMobileControls();assert.equal(ui.remove.disabled,false,'Mixed selections can still remove their unlocked members');
ctx.traceDraft={};ctx.syncMobileControls();assert.equal(ui.finish.hidden,false);assert.equal(ui.remove.disabled,true);
ctx.traceDraft=null;ctx.history=['before'];ctx.future=['after'];ctx.syncMobileControls();assert.equal(ui.undo.disabled,false);assert.equal(ui.redo.disabled,false);
ctx.toggleMobileSheet('layers');assert.equal(workspace.dataset.mobileSheet,'layers');assert.deepEqual([...classes],['show-inspector']);assert.equal(ui.sidebar.inert,true);assert.equal(ui.inspector.inert,false);
ctx.toggleMobileSheet('palette');assert.equal(workspace.dataset.mobileSheet,'palette');assert.deepEqual([...classes],['show-assets']);assert.equal(ui.inspector.inert,true);assert.equal(ui.sidebar.inert,false);
ctx.toggleMobileSheet('palette');assert.equal(workspace.dataset.mobileSheet,undefined);assert.equal(ui.sidebar.inert,true);assert.equal(ui.inspector.inert,true);
ui.media.matches=false;ctx.syncMobilePanels();assert.equal(ui.sidebar.inert,false);assert.equal(ui.inspector.inert,false,'Desktop panels must not inherit mobile inert state');
ctx.toggleMobileSheet('layers');assert.equal(classes.size,0,'Mobile sheet controls cannot change desktop layout');
for(const name of ['select','pen','trace','delete','layers','pages','palette','properties','undo','redo'])assert.match(ctx.editorIcon(name),/<svg.*aria-hidden="true"/);

// Exercise the actual copy/paste commands, not a duplicate-shaped mock.
const plain=value=>JSON.parse(JSON.stringify(value));
let sequence=0,blocked=false,copyNotes=0;
const status={};
Object.assign(ctx,{document:{getElementById:()=>status},canvasPasteBlocked:()=>blocked,canvasTouchNavigation:false,
  deepCopy:plain,id:()=>`clone-${++sequence}`,uid:()=>`junction-${++sequence}`,cloneLayerGroups(){},
  noteInternalCopy(){copyNotes++},copySelectionToClipboard(){throw Error('Mobile copy must not open the Windows PPT bridge')},
  commit(){ctx.history.push(plain(ctx.items))},render(){ctx.syncMobileControls()},
  items:[{id:'a',x:10,y:15,name:'Shape'}],selected:'a',selectedIds:new Set(['a']),selectedPoints:new Set(),history:[],future:[]});
for(const name of ['copyInternalSelection','pasteInternalSelection'])
  vm.runInContext(html.split('\n').find(line=>line.startsWith(`function ${name}(`)),ctx);
ctx.copyMobileSelection();
assert.equal(ctx.items.length,1,'Copy cannot add an object');
assert.equal(ctx.history.length,0,'Copy cannot create an undo entry');
assert.equal(copyNotes,1);assert.equal(ctx.internalClipboard.length,1);
assert.equal(ui.count.textContent,'已複製 1 個');assert.match(status.textContent,/按「貼上」/);
ctx.items[0].x=99;assert.equal(ctx.internalClipboard[0].x,10,'Clipboard holds a snapshot');
ctx.items[0].x=10;
ctx.selectedIds.clear();ctx.selected=null;ctx.syncMobileControls();
assert.equal(ui.actions.hidden,false,'Paste remains available after deselecting');
assert.equal(ui.copy.hidden,true);assert.equal(ui.clear.hidden,true);assert.equal(ui.paste.disabled,false);
ctx.pasteMobileSelection();assert.equal(ctx.items.length,2);assert.equal(ctx.history.length,1);
assert.equal(ctx.items[1].x,30);assert.equal(ctx.items[1].y,35);assert.notEqual(ctx.items[1].id,'a');
ctx.items=ctx.history.pop();assert.equal(ctx.items.length,1,'One undo removes exactly the pasted objects');
ctx.items=[];ctx.selectedIds.clear();ctx.selected=null;ctx.syncMobileControls();
assert.equal(ui.paste.disabled,false,'Internal clipboard remains usable on another page');
ctx.pasteMobileSelection();assert.equal(ctx.items.length,1);assert.equal(ctx.items[0].x,30);
const afterPaste=plain(ctx.items),historySize=ctx.history.length;
blocked=true;ctx.copyMobileSelection();ctx.pasteMobileSelection();
blocked=false;ctx.canvasTouchNavigation=true;ctx.copyMobileSelection();ctx.pasteMobileSelection();
assert.deepEqual(plain(ctx.items),afterPaste);assert.equal(ctx.history.length,historySize);assert.equal(copyNotes,1);
ctx.canvasTouchNavigation=false;ctx.traceDraft={};ctx.syncMobileControls();
assert.equal(ui.copy.hidden,true);assert.equal(ui.paste.hidden,true);assert.equal(ui.finish.hidden,false);
ctx.traceDraft=null;ui.media.matches=true;
let desktopCalls=0;const desktopDuplicate=()=>{desktopCalls++};
ctx.duplicateForViewport({currentTarget:{}},desktopDuplicate);
assert.equal(desktopCalls,0);assert.equal(copyNotes,2,'Mobile properties copy follows the same copy-only path');
ui.media.matches=false;ctx.duplicateForViewport({currentTarget:{}},desktopDuplicate);
assert.equal(desktopCalls,1,'Desktop properties retain their original duplicate command');
assert.ok(source.includes('copy.onclick = copyMobileSelection;') && source.includes('paste.onclick = pasteMobileSelection;'));

let commits=0,renders=0;
Object.assign(ctx,{items:[{id:'a'},{id:'locked',locked:true}],selectedIds:new Set(['a','locked']),selected:'locked',selectedPoints:new Set([1]),commit(){commits++},render(){renders++}});
vm.runInContext(html.split('\n').find(line=>line.startsWith('function deleteSelectedObjects(')),ctx);
ctx.deleteSelectedObjects();assert.deepEqual(ctx.items.map(it=>it.id),['locked']);assert.equal(commits,1);assert.equal(renders,1);assert.equal(ctx.selectedIds.size,0);
ctx.selectedIds.add('locked');ctx.deleteSelectedObjects();assert.equal(commits,1,'Locked-only selections cannot change history');
assert.ok(source.includes('remove.onclick = () => { deleteSelectedObjects();'),'Touch trash uses the same locking/history command as desktop');
console.log('Mobile controls OK: copy-only/paste separation, clipboard snapshots and cross-page paste, gesture guards, desktop isolation, compact sheets, SVG icons, locked deletion, undo/redo and offline assets.');
