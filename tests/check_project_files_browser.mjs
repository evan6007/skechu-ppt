import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1500,height:950}}),errors=[],base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/',key='file-save-qa-'+Date.now(),out='.codex-tmp/file-save-browser';fs.mkdirSync(out,{recursive:true});
// Use real private filesystem handles; substitute only the OS picker. No user
// document, authenticated browser profile or scientific project is modified.
await context.addInitScript(()=>{
 window.__pickerCalls={open:0,save:0};
 window.showOpenFilePicker=async()=>{window.__pickerCalls.open++;if(window.__cancel)throw new DOMException('Cancelled','AbortError');return[window.__openTarget]};
 window.showSaveFilePicker=async()=>{window.__pickerCalls.save++;if(window.__cancel)throw new DOMException('Cancelled','AbortError');return window.__saveTarget};
});
const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
const ready=()=>p.waitForFunction(()=>workspaceReady&&projectFileController);
const saved=()=>p.waitForFunction(()=>{const r=projectFileController.records.get(activeProjectId);return r&&r.message==='已回存原檔'&&!r.running&&!r.error});
const disk=()=>p.evaluate(async()=>JSON.parse(await(await window.__openTarget.getFile()).text()));
async function diskUntil(predicate){for(let i=0;i<150;i++){if(predicate(await disk()))return;await new Promise(r=>setTimeout(r,100))}throw Error('Disk content did not update')}
const menu=async()=>{if(!await p.locator('.export-menu').evaluate(n=>n.open))await p.locator('.export-menu>summary').click()};
try{
 await p.goto(base+'?v=89-file-save&storage='+key);await ready();
 const original=await p.evaluate(async key=>{
  const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(key,{create:true});window.__testDirectory=dir;
  const h=await dir.getFileHandle('ten-pages.skc',{create:true});window.__openTarget=h;window.__saveTarget=await dir.getFileHandle('saved-as.skc',{create:true});
  const source={version:2,project:{id:'source',name:'十頁測試',custom:{keep:'metadata'},activePageId:'page-4',pages:Array.from({length:10},(_,i)=>({id:'page-'+i,name:'圖 '+(i+1),customPage:i,canvasWidth:400,canvasHeight:260,canvasColor:'#fffafa',canvasOpacity:1,items:[{id:'line-'+i,type:'arrow',points:[{x:30,y:40},{x:280,y:190}],color:'#1555aa',width:3,hidden:i===9,locked:false,closed:false},{id:'text-'+i,type:'text',x:40,y:70,w:240,h:60,text:'Editable '+i,fontSize:20,color:'#222222'}]}))}};
  const s=await h.createWritable();await s.write(JSON.stringify(source));await s.close();return source;
 },key);
 await menu();await p.locator('#load-button').click();await p.waitForFunction(()=>projectFileController.records.has(activeProjectId));
 assert.equal(await p.evaluate(()=>activeProject().pages.length),10);assert.equal(await p.evaluate(()=>activePage().name),'圖 5');assert.deepEqual(await disk(),original,'Opening must not rewrite the source');
 await p.locator('#project-name').fill('快捷鍵儲存測試');await p.keyboard.press('Control+s');await saved();
 let stored=(await disk()).project;assert.equal(stored.name,'快捷鍵儲存測試');assert.equal(stored.pages.length,10);assert.deepEqual(stored.custom,{keep:'metadata'});assert.equal(stored.pages[9].items[0].hidden,true);assert.equal(stored.pages[7].customPage,7);
 await p.evaluate(()=>{items[1].text='Page five updated';render();openPage(activeProject().pages[8].id);items[1].text='Page nine updated';render()});
 await diskUntil(d=>d.project.pages[8].items[1].text==='Page nine updated');await saved();
 stored=(await disk()).project;assert.equal(stored.pages[4].items[1].text,'Page five updated');assert.equal(stored.pages[8].items[1].text,'Page nine updated');
 const active=await p.evaluate(()=>activeProjectId);await p.evaluate(()=>writeWorkspace(workspacePayload()));await p.reload();await ready();await p.waitForFunction(id=>projectFileController.records.has(id),active);
 await p.evaluate(id=>{window.__openTarget=projectFileController.records.get(id).handle},active);assert.equal(await p.evaluate(()=>projectFileController.records.get(activeProjectId).blocked),false);
 await p.locator('#project-name').fill('重新開啟後自動存');await diskUntil(d=>d.project.name==='重新開啟後自動存');await saved();
 await menu();await p.locator('#file-auto-save').uncheck();await p.locator('#project-name').fill('手動模式');await p.waitForTimeout(1900);assert.equal((await disk()).project.name,'重新開啟後自動存');await p.keyboard.press('Control+s');await saved();assert.equal((await disk()).project.name,'手動模式');
 const count=await p.evaluate(()=>projects.length);await menu();await p.locator('#load-button').click();await p.waitForFunction(()=>!projectFilePickerBusy);assert.equal(await p.evaluate(()=>projects.length),count);
 await p.evaluate(async()=>{const s=await window.__openTarget.createWritable();await s.write('{"external":"do not overwrite"}');await s.close()});await p.locator('#project-name').fill('尚未回存');await p.keyboard.press('Control+s');await p.waitForFunction(()=>projectFileController.records.get(activeProjectId).blocked);assert.deepEqual(await disk(),{external:'do not overwrite'});assert.match(await p.locator('#file-save-status').textContent(),/回存失敗/);
 await p.evaluate(async key=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(key);window.__saveTarget=await dir.getFileHandle('saved-as.skc')},key);await p.keyboard.press('Control+Shift+s');await saved();assert.equal(await p.evaluate(()=>projectFileController.records.get(activeProjectId).name),'saved-as.skc');assert.deepEqual(await disk(),{external:'do not overwrite'});
 assert.equal(await p.evaluate(async()=>JSON.parse(await(await window.__saveTarget.getFile()).text()).project.name),'尚未回存');
 await p.evaluate(()=>window.__cancel=true);await p.keyboard.press('Control+Shift+s');await p.waitForFunction(()=>!projectFilePickerBusy);assert.equal(await p.evaluate(()=>projectFileController.records.get(activeProjectId).name),'saved-as.skc');await p.evaluate(()=>window.__cancel=false);
 await p.locator('#project-name').fill('Final saved');await p.keyboard.press('Control+s');await saved();await p.locator('#project-name').blur();await p.screenshot({path:out+'/desktop.png'});
 // Simulate stale browser recovery, e.g. disk saved before IndexedDB committed.
 await p.evaluate(async()=>{const payload=workspacePayload();payload.projects.find(p=>p.id===activeProjectId).name='Stale browser copy';await writeWorkspace(payload)});
 await p.reload();await ready();await p.waitForFunction(()=>projectFileController.records.get(activeProjectId)?.blocked);await p.waitForTimeout(1900);assert.equal(await p.evaluate(async()=>JSON.parse(await(await projectFileController.records.get(activeProjectId).handle.getFile()).text()).project.name),'Final saved');
 await p.evaluate(async key=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(key);window.__saveTarget=await dir.getFileHandle('new-project.skc',{create:true})},key);await p.locator('#new-project').click();await p.keyboard.press('Control+s');await saved();assert.equal(await p.evaluate(()=>projectFileController.records.get(activeProjectId).name),'new-project.skc');
 const calls=await p.evaluate(()=>window.__pickerCalls.save);await p.keyboard.press('Control+s');await saved();assert.equal(await p.evaluate(()=>window.__pickerCalls.save),calls);
 await p.locator('#new-project').click();await p.evaluate(()=>{delete window.showSaveFilePicker});const download=p.waitForEvent('download');await p.keyboard.press('Control+s');assert.match((await download).suggestedFilename(),/\.skc$/);assert.equal(await p.evaluate(()=>projectFileController.records.has(activeProjectId)),false);assert.match(await p.locator('#status').textContent(),/不支援直接回存/);
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:out+'/mobile.png'});assert.ok(await p.locator('#save-project-file').isVisible());const mobileDownload=p.waitForEvent('download');await p.locator('#save-project-file').click();assert.match((await mobileDownload).suggestedFilename(),/\.skc$/);assert.deepEqual(errors,[]);
 console.log('Browser SKC saving OK: real private file bytes, ten pages/metadata, focused-input Ctrl+S, auto save across pages, handle restoration, auto toggle, conflict, Save As/cancel, stale recovery safety, one-time picker, download fallback and mobile save button.');
}catch(error){console.error('UI diagnostic',await p.evaluate(()=>({status:document.getElementById('status')?.textContent,file:document.getElementById('file-save-status')?.textContent,records:[...projectFileController.records.values()].map(r=>({name:r.name,error:r.error,message:r.message,blocked:r.blocked})),errors:[]})).catch(()=>null),errors);throw error}
finally{await browser.close()}
