import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source = read('app/mobile-controls.js'), css = read('app/mobile-controls.css'), html = read('app/index.html');
for (const file of ['mobile-controls.js','mobile-controls.css']) {
  const version=file.endsWith('.css')?'?v=68-touch-gestures':'?v=67-touch-shell';
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
  actions:button(),count:{},remove:button(),duplicate:button(),finish:button(),undo:button(),redo:button()};
const ctx=vm.createContext({workspace,items:[],selectedIds:new Set(),traceDraft:null,history:[],future:[],ui});
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

let commits=0,renders=0;
Object.assign(ctx,{selected:'locked',selectedPoints:new Set([1]),commit(){commits++},render(){renders++}});
vm.runInContext(html.split('\n').find(line=>line.startsWith('function deleteSelectedObjects(')),ctx);
ctx.deleteSelectedObjects();assert.deepEqual(ctx.items.map(it=>it.id),['locked']);assert.equal(commits,1);assert.equal(renders,1);assert.equal(ctx.selectedIds.size,0);
ctx.selectedIds.add('locked');ctx.deleteSelectedObjects();assert.equal(commits,1,'Locked-only selections cannot change history');
assert.ok(source.includes('remove.onclick = () => { deleteSelectedObjects();'),'Touch trash uses the same locking/history command as desktop');
console.log('Mobile controls OK: SVG icons, compact exclusive sheets, desktop isolation, selection actions, locked deletion, tracing completion, undo/redo and packaged/offline assets.');
