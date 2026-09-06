import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try {
fs.mkdirSync('.codex-tmp',{recursive:true});
await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:8767/')+'?storage=cut-browser-qa-'+Date.now());
await page.waitForFunction(()=>workspaceReady);
const screen=async(x,y)=>page.evaluate(({x,y})=>{const m=svg.getScreenCTM();return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};},{x,y});
const move=async(x,y)=>{const p=await screen(x,y);await page.mouse.move(p.x,p.y);};
async function seed(){await page.evaluate(()=>{
 resetEditorState();items=Array.from({length:6},(_,i)=>({id:'qa-'+i,name:'Test '+i,type:'arrow',points:[{x:300,y:200+i*80},{x:1100,y:200+i*80}],curved:false,closed:false,color:'#123f8c',width:5,endHead:false}));render();fitView();
});}
await seed();
await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="line"]').click();
await move(650,120);await page.mouse.down();await move(760,700);
assert.equal(await page.locator('#cut-preview circle').count(),6,'Every intersection is previewed');
assert.equal(await page.evaluate(()=>items.length),6,'Preview does not mutate');
await page.screenshot({path:'.codex-tmp/cut-desktop-preview.png'});
await page.mouse.up();
assert.equal(await page.evaluate(()=>items.length),12);assert.equal(await page.evaluate(()=>history.length),1);
assert.equal(await page.locator('#cut-preview circle').count(),0);
assert.equal(await page.evaluate(()=>paintTool),null,'Cut immediately returns to editable selection');
assert.equal(await page.locator('#cut-options').isHidden(),true);
assert.equal(await page.locator('#cut-done').count(),0,'No extra Done action');
assert.equal(await page.locator('#selection [data-anchor-owner]').count(),24,'Both sides of every cut expose their anchors immediately');
await page.screenshot({path:'.codex-tmp/cut-immediate-anchors.png'});
await page.keyboard.press('Control+z');
assert.equal(await page.evaluate(()=>items.length),6);
// Cancelling a gesture never edits, and a click on an ordinary line creates two endpoints.
await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="line"]').click();
await move(650,120);await page.mouse.down();await move(760,700);await page.keyboard.press('Escape');await page.mouse.up();
assert.equal(await page.evaluate(()=>items.length),6);
await page.locator('[data-cut-mode="point"]').click();await move(650,200);await page.mouse.click((await screen(650,200)).x,(await screen(650,200)).y);
assert.equal(await page.evaluate(()=>items.length),7);
assert.equal(await page.evaluate(()=>paintTool),null);
assert.ok(await page.locator('#selection [data-anchor-owner]').count()>0);
// Ctrl switches the preview in place and the committed geometry uses the same axis.
await seed();await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="line"]').click();
await move(650,120);await page.mouse.down();await move(760,700);
await page.keyboard.down('Control');
assert.equal(await page.evaluate(()=>cutGesture.points[0].x===cutGesture.points[1].x),true,'Ctrl locks a steep cut vertically without moving the mouse');
await page.keyboard.up('Control');
assert.equal(await page.evaluate(()=>cutGesture.points[0].x===cutGesture.points[1].x),false,'Releasing Ctrl immediately restores the diagonal preview');
await page.keyboard.down('Control');await page.mouse.up();await page.keyboard.up('Control');
assert.equal(await page.evaluate(()=>items.length),12);
assert.equal(await page.evaluate(()=>items.every(it=>Math.abs((it.id.startsWith('qa-')?it.points.at(-1):it.points[0]).x-650)<.001)),true,'Every new endpoint is on the committed vertical knife');
await seed();
await page.evaluate(()=>{items=items.map((it,i)=>({...it,points:[{x:300+i*120,y:200},{x:300+i*120,y:700}]}));render();});
await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="line"]').click();
await move(250,430);await page.mouse.down();await page.keyboard.down('Control');await move(1000,520);
assert.equal(await page.evaluate(()=>cutGesture.points[0].y===cutGesture.points[1].y),true,'A shallow Ctrl cut is horizontal');
await page.mouse.up();await page.keyboard.up('Control');
assert.equal(await page.evaluate(()=>items.length),12);
assert.equal(await page.evaluate(()=>items.every(it=>Math.abs((it.id.startsWith('qa-')?it.points.at(-1):it.points[0]).y-430)<.001)),true,'Preview and committed horizontal cut agree');
async function seedAnchor(){await page.evaluate(()=>{
 resetEditorState();items=[{id:'qa-anchor',type:'arrow',name:'Anchor context test',points:[{x:300,y:200},{x:700,y:400},{x:1100,y:600}],curved:false,closed:false,color:'#123f8c',width:5,endHead:false}];
 selected='qa-anchor';selectedIds=new Set([selected]);selectedPoint=1;selectedPoints=new Set([1]);editPoints=true;render();fitView();
});}
await seedAnchor();
let anchorScreen=await screen(700,400);
await page.mouse.click(anchorScreen.x,anchorScreen.y,{button:'right'});
assert.equal(await page.locator('#cut-anchor').isVisible(),true,'Right-click directly on an anchor exposes Point cut');
assert.equal(await page.locator('#cut-anchor').isEnabled(),true);
assert.equal(await page.evaluate(()=>history.length),0,'Opening an anchor menu never changes geometry');
await page.locator('#cut-anchor').click();
assert.equal(await page.evaluate(()=>items.length),2);assert.equal(await page.evaluate(()=>history.length),1);
assert.equal(await page.locator('#selection [data-anchor-owner]').count(),4,'Context cut immediately exposes both new endpoints');
await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>items.length),1);
// Actual starter-brain curves, not a sketch of the bug.
const brain=await page.evaluate(async()=>{
 const image=new Image();image.src='starter-brain.png';await image.decode();
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const context=canvas.getContext('2d');context.drawImage(image,0,0);
 return AutoTrace.run(context.getImageData(0,0,canvas.width,canvas.height)).items.map((it,i)=>({...it,id:'qa-brain-'+i}));
});
await page.evaluate(data=>{
 resetEditorState();items=data.map(it=>({...it,color:'#123f8c',width:3,endHead:false}));render();fitView();
 const a=fillTargetAt({x:870,y:560},null),b=fillTargetAt({x:800,y:700},null);
 if(!a.regionFace||!b.regionFace||a.regionFace.key===b.regionFace.key)throw Error('Brain fill region leaked');
 activePaletteColor='#ff8a00';const fill=materializeFillTarget(a);fill.fill='#ff8a00';render();
},brain);
await page.screenshot({path:'.codex-tmp/cut-brain-fill.png'});
// Phone toolbar and compact mode chooser remain inside the viewport.
await page.setViewportSize({width:390,height:844});await seed();
const cdp=await page.context().newCDPSession(page);
const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,id)=>({x:p.x,y:p.y,id,radiusX:5,radiusY:5,force:1}))});
await seedAnchor();anchorScreen=await screen(700,400);
const beforeHold=await page.evaluate(()=>state());
await touch('touchStart',[anchorScreen]);
await page.locator('#context-menu[data-anchor-cut]').waitFor({state:'visible'});
await touch('touchEnd',[]);
assert.equal(await page.evaluate(()=>state()),beforeHold,'A long press does not move the anchor');
assert.equal(await page.evaluate(()=>history.length),0);
const contextBounds=await page.locator('#context-menu').boundingBox();assert.ok(contextBounds.x>=0&&contextBounds.x+contextBounds.width<=390&&contextBounds.height<90,'Touch point-cut menu is compact and stays in the viewport');
await page.screenshot({path:'.codex-tmp/cut-mobile-anchor-menu.png'});
await page.locator('#cut-anchor').click();assert.equal(await page.evaluate(()=>items.length),2);
await seedAnchor();anchorScreen=await screen(700,400);
await touch('touchStart',[anchorScreen]);await touch('touchMove',[{x:anchorScreen.x+20,y:anchorScreen.y+15}]);
await page.waitForTimeout(650);assert.equal(await page.locator('#context-menu').isHidden(),true,'Dragging cancels the hold timer');await touch('touchEnd',[]);
await seedAnchor();anchorScreen=await screen(700,400);
const second={x:anchorScreen.x+65,y:anchorScreen.y+50};
await touch('touchStart',[anchorScreen]);await touch('touchStart',[anchorScreen,second]);
await page.waitForTimeout(650);assert.equal(await page.locator('#context-menu').isHidden(),true,'Second finger cancels long-press actions');await touch('touchEnd',[]);
assert.equal(await page.evaluate(()=>history.length),0);
await seed();
await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="free"]').click();
const bounds=await page.locator('#cut-options').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.height<110);
assert.equal(await page.locator('#cut-separate').isChecked(),true);
await page.screenshot({path:'.codex-tmp/cut-mobile.png'});
await move(350,120);await page.mouse.down();await move(700,300);await move(500,500);await move(850,720);await page.mouse.up();
assert.equal(await page.evaluate(()=>items.length),12,'Freehand cuts every intersected phone-sized line');
assert.equal(await page.evaluate(()=>paintTool),null);assert.equal(await page.locator('#cut-options').isHidden(),true);
assert.equal(await page.locator('#selection [data-anchor-owner]').count(),24,'Phone cuts also show anchors without a Done tap');
// Actually pull one overlapping cut endpoint away: its former neighbor stays put.
const splitBefore=await page.evaluate(()=>JSON.parse(state())),tip=splitBefore.find(it=>it.id==='qa-3').points.at(-1),tipScreen=await screen(tip.x,tip.y);
await page.mouse.move(tipScreen.x,tipScreen.y);await page.mouse.down();await page.mouse.move(tipScreen.x+22,tipScreen.y+12,{steps:5});await page.mouse.up();
const splitAfter=await page.evaluate(()=>JSON.parse(state()));
const changed=splitAfter.filter(it=>JSON.stringify(it.points)!==JSON.stringify(splitBefore.find(old=>old.id===it.id).points));
assert.equal(changed.length,1,'Free cut creates genuinely independent pieces, not merely points on the same path');
assert.ok(splitAfter.some(it=>it.id!==changed[0].id&&it.points.some(p=>Math.hypot(p.x-tip.x,p.y-tip.y)<.001)),'The opposite cut endpoint does not follow the dragged one');
await page.screenshot({path:'.codex-tmp/free-cut-separated.png'});
// The same freehand stroke with separation switched off adds points to each original path.
await seed();await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="free"]').click();
await page.locator('#cut-separate').uncheck();assert.equal(await page.locator('#cut-free-label').innerText(),'自由點');
const connectedBefore=await page.evaluate(()=>JSON.parse(state()));
await move(350,120);await page.mouse.down();await move(700,300);await move(500,500);await move(850,720);
assert.equal(await page.locator('#cut-preview circle').count(),6);assert.equal(await page.evaluate(()=>items.length),6,'Point preview has not edited the document');
await page.mouse.up();
assert.equal(await page.evaluate(()=>items.length),6,'Free points retain every original object');
assert.equal(await page.evaluate(()=>items.every(it=>it.points.length===3&&!it.closed)),true);
assert.deepEqual(await page.evaluate(()=>items.map(it=>it.id)),connectedBefore.map(it=>it.id));
assert.equal(await page.evaluate(()=>history.length),1);assert.equal(await page.locator('#selection [data-anchor-owner]').count(),18);
await page.screenshot({path:'.codex-tmp/free-points-connected.png'});
await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>items.every(it=>it.points.length===2)),true);
await page.locator('#cut-tool').click();assert.equal(await page.locator('#cut-separate').isChecked(),false,'Remember the toggle while switching in and out of the tool');
await page.locator('#cut-separate').check();assert.equal(await page.locator('#cut-free-label').innerText(),'自由切');await page.keyboard.press('Escape');
// Genuine multi-touch events cancel the first-finger knife and navigate instead.
await seed();await page.locator('#cut-tool').click();await page.locator('[data-cut-mode="line"]').click();
const a=await screen(550,250),b=await screen(950,450);
await touch('touchStart',[a]);await touch('touchStart',[a,b]);
await touch('touchMove',[{x:a.x-15,y:a.y-10},{x:b.x+15,y:b.y+10}]);
await touch('touchEnd',[]);
assert.equal(await page.evaluate(()=>items.length),6);assert.equal(await page.evaluate(()=>history.length),0);assert.equal(await page.evaluate(()=>cutGesture),null);
assert.equal(errors.length,0,errors.join('\n'));
console.log('Browser QA passed: freehand cut/points toggle, independent endpoint drag, connected anchor insertion, immediate anchors, Ctrl axes, right-click/long-press, cancellation, undo, brain fill and compact phone controls.');
} finally { await browser.close(); }
