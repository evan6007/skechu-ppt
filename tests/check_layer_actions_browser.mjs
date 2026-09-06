import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18767/';
const output='.codex-tmp/layer-actions-qa';fs.mkdirSync(output,{recursive:true});
async function setup(page){
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+'?storage=layer-actions-isolated-'+Date.now());await page.waitForFunction(()=>workspaceReady);
 await seed(page);
}
async function seed(page){
 await page.evaluate(()=>{
  resetEditorState();activateSelectTool();activePage().canvasWidth=800;activePage().canvasHeight=500;
  const group={id:'qa-g',name:'測試群組',collapsed:true};
  items=[{id:'qa-ref',name:'測試底圖',type:'image',src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#b7d9f4"/></svg>'),x:0,y:0,w:800,h:500,r:0,opacity:.5,referenceOnly:true,locked:false,preserveFull:true},
   {id:'qa-a',name:'矩形',type:'box',x:120,y:110,w:240,h:210,r:0,fill:'#ff7a30',stroke:'#182c49',strokeWidth:3,opacity:1,layerGroup:{...group}},
   {id:'qa-b',name:'曲線',type:'arrow',points:[{x:100,y:100},{x:250,y:50},{x:400,y:130}],color:'#182c49',width:5,curved:true,closed:false,endHead:false,layerGroup:{...group}},
   {id:'qa-outside',name:'獨立圓形',type:'ellipse',x:500,y:180,w:170,h:150,r:0,fill:'#24ba99',stroke:'#182c49',strokeWidth:2,opacity:1}];
  setOnlySelected('qa-outside');internalClipboard=[];setCanvasAppearance('#ffffff',1);render();fitView();
 });
}
const row=(page,key)=>page.locator('[data-layer-key="'+key+'"]');
const action=(page,key)=>page.locator('#layer-context-menu [data-layer-action="'+key+'"]');
try{
 const page=await browser.newPage({viewport:{width:1500,height:1040}});await setup(page);
 const initial=await page.evaluate(()=>JSON.stringify(items));
 await row(page,'group:qa-g').click({button:'right'});assert.ok(await page.locator('#layer-context-menu').isVisible());
 await page.screenshot({path:output+'/desktop-menu.png'});
 await action(page,'copy').click();assert.equal(await page.evaluate(()=>items.length),4);assert.equal(await page.evaluate(()=>history.length),0);
 assert.deepEqual(await page.evaluate(()=>internalClipboard.map(it=>it.id)),['qa-a','qa-b']);
 await row(page,'group:qa-g').click({button:'right'});await action(page,'paste').click();assert.equal(await page.evaluate(()=>items.length),6);
 assert.ok(await page.evaluate(()=>items[4].layerGroup.id===items[5].layerGroup.id&&items[4].layerGroup.id!=='qa-g'));
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>JSON.stringify(items)),initial);
 await row(page,'group:qa-g').click({button:'right'});await action(page,'delete').click();assert.deepEqual(await page.evaluate(()=>items.map(it=>it.id)),['qa-ref','qa-outside']);
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>JSON.stringify(items)),initial);
 await page.evaluate(()=>{byId('qa-b').locked=true;render()});await row(page,'group:qa-g').click({button:'right'});
 assert.ok(await action(page,'delete').isDisabled());await page.keyboard.press('Escape');assert.ok(await page.locator('#layer-context-menu').isHidden());
 await seed(page);
 // Real pointer drag: move the bottom reference above the folder header.
 const from=await row(page,'item:qa-ref').locator('.layer-name').boundingBox(),to=await row(page,'group:qa-g').boundingBox();
 await page.mouse.move(from.x+40,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+60,to.y+3,{steps:18});await page.mouse.up();
 assert.ok(await page.evaluate(()=>byId('qa-ref').referenceStacked));
 const order=await page.evaluate(()=>[...scene.querySelectorAll(':scope > g[data-id]')].map(el=>el.dataset.id));
 assert.ok(order.indexOf('qa-ref')>order.lastIndexOf('qa-b'),'Reference must draw above group linework');
 assert.ok(order.indexOf('qa-ref')>order.lastIndexOf('qa-a'),'Reference must draw above group fill and outline');
 assert.ok(await page.evaluate(()=>JSON.parse(nativeBody()).items.every(it=>!it.referenceOnly)),'Manual overlay does not leak reference images into native export');
 await page.screenshot({path:output+'/desktop-reference-above.png'});
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>JSON.stringify(items)),initial);
 await row(page,'group:qa-g').locator('.layer-more').focus();await page.keyboard.press('Shift+F10');assert.ok(await page.locator('#layer-context-menu').isVisible());
 await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.layerAction),'lock');await page.keyboard.press('Escape');
 await page.close();

 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mobile=await mobileContext.newPage();await setup(mobile);
 await mobile.locator('#show-inspector').click();
 const groupName=row(mobile,'group:qa-g').locator('.layer-name');await groupName.scrollIntoViewIfNeeded();
 const box=await groupName.boundingBox(),cdp=await mobileContext.newCDPSession(mobile);
 const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
 await touch('touchStart',box.x+45,box.y+box.height/2);await mobile.waitForTimeout(600);
 assert.ok(await mobile.locator('#layer-context-menu').isVisible(),'Real held touch opens layer actions');
 await touch('touchEnd');await mobile.waitForTimeout(80);
 const menuBox=await mobile.locator('#layer-context-menu').boundingBox();assert.ok(menuBox.width<300&&menuBox.height<=844*.48+12&&menuBox.x>=0&&menuBox.y+menuBox.height<=844);
 await mobile.screenshot({path:output+'/mobile-long-press.png'});
 await action(mobile,'copy').tap();assert.equal(await mobile.evaluate(()=>items.length),4,'Mobile copy does not paste');
 await row(mobile,'group:qa-g').locator('.layer-more').tap();await action(mobile,'delete').tap();assert.deepEqual(await mobile.evaluate(()=>items.map(it=>it.id)),['qa-ref','qa-outside']);
 await mobile.locator('#mobile-undo').tap();assert.equal(await mobile.evaluate(()=>items.length),4);
 // Moving a finger to scroll must cancel the long press.
 const nextBox=await groupName.boundingBox();await touch('touchStart',nextBox.x+40,nextBox.y+22);await touch('touchMove',nextBox.x+40,nextBox.y+45);await mobile.waitForTimeout(600);await touch('touchEnd');
 assert.ok(await mobile.locator('#layer-context-menu').isHidden(),'Scrolling cannot accidentally open/delete from a long press');
 assert.equal(await mobile.evaluate(()=>items.length),4);
 await mobileContext.close();assert.deepEqual(errors,[]);
 console.log('Layer browser: right-click, copy/paste, whole-group delete/Undo, locks, visible reference drag, keyboard, mobile hold/menu/delete and scroll cancellation passed.');
}finally{await browser.close();}
