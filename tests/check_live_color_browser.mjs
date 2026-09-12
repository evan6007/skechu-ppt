/* Real browser event/DOM regression checks on isolated, synthetic projects. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 for (const width of [1440,390]) {
  const context = await browser.newContext({serviceWorkers:'block',viewport:{width,height:900}});
  const page = await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=new URL(process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/');url.searchParams.set('mode','web');url.searchParams.set('storage','live-color-qa-'+width+'-'+Date.now());
  await page.goto(url.href);await page.waitForFunction(()=>workspaceReady);
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
  const result=await page.evaluate(async()=>{
   const check=(value,message)=>{if(!value)throw Error(message)};
   const base={id:'shape',name:'Color test',x:120,y:100,w:190,h:130,r:0,fill:'#ddeeff',stroke:'#224466',strokeWidth:3,opacity:1};
   const arrow={...base,type:'arrow',points:[{x:120,y:100},{x:230,y:150},{x:260,y:240}],color:'#224466',width:4,head:14,startHead:true,endHead:true,closed:false};
   const make=type=>type==='arrow'?deepCopy(arrow):type==='text'?{...base,type,text:'即時顏色 Color',size:28,color:'#224466'}:type==='polygon'?{...base,type,points:deepCopy(arrow.points),label:'Color',labelColor:'#224466',fontSize:20}:{...base,type};
   const reset=type=>{closeGradientEditor();items=[make(type),{...make('box'),id:'other',x:380,fill:'#556677'}];setOnlySelected('shape');history=[];future=[];render();fitView();if(mobileEditorUi.media.matches&&workspace.dataset.mobileSheet!=='properties')toggleMobileSheet('properties')};
   const send=(input,value,event='input')=>{input.value=value;input.dispatchEvent(new Event(event,{bubbles:true}))};
   const cases=[['arrow','line-color','color'],['arrow','arrow-fill','fill'],['box','box-fill','fill'],['ellipse','box-fill','fill'],['box','box-stroke','stroke'],['polygon','polygon-fill','fill'],['polygon','polygon-stroke','stroke'],['polygon','polygon-text-color','labelColor'],['text','text-color','color']];
   for(const [type,id,key] of cases){
    reset(type);if(id==='arrow-fill'){items[0].closed=true;items[0].fillOpacity=1;render()}
    const input=document.getElementById(id),before=state(),untouched=scene.querySelector('[data-id="other"]'),selectionNode=selection.firstChild;
    input.focus();check(history.length===0,id+' focus alone creates no Undo');
    send(input,'#ff3366');check(items[0][key]==='#ff3366',id+' preview before change');
    for(const color of ['#bb8844','#2255ee','#33cc77'])send(input,color);
    check(history.length===1,id+' one undo for continuous preview');
    check(scene.innerHTML.includes('#33cc77'),id+' visible scene updated');
    check(scene.querySelector('[data-id="other"]')===untouched,id+' preserves unrelated nodes');
    check(selection.firstChild===selectionNode,id+' does not rebuild anchor overlay');
    if(id==='line-color')check([...scene.querySelectorAll('[data-id="shape"] marker [fill]')].every(n=>n.getAttribute('fill')==='#33cc77'),'arrowheads follow line color');
    check(document.activeElement===input&&input.value==='#33cc77',id+' retains picker focus/value '+JSON.stringify({active:document.activeElement?.id,value:input.value,sheet:workspace.dataset.mobileSheet,inert:!!input.closest('[inert]'),visible:getComputedStyle(input).visibility}));
    send(input,'#33cc77','change');input.blur();check(history.length===1,id+' change/blur do not duplicate undo');
    document.getElementById('undo').click();check(state()===before,id+' undo restores complete original');
    document.getElementById('redo').click();check(items[0][key]==='#33cc77',id+' redo');
   }
   reset('arrow');let input=document.getElementById('line-color');input.focus();send(input,'#ff3366','change');check(items[0].color==='#ff3366'&&history.length===1,'change-only browser fallback');input.blur();
   // Late events must not recolor a new selection, locked object, page or an Undo clone.
   reset('arrow');input.focus();send(input,'#ff3366');setOnlySelected('other');render();send(input,'#22cc77');send(input,'#22cc77','change');input.blur();check(items[1].color===undefined&&items[1].fill==='#556677','late event does not edit new selection');
   reset('arrow');input.focus();items[0].locked=true;send(input,'#ff3366');check(items[0].color==='#224466'&&history.length===0,'locked item rejects picker');input.blur();
   reset('arrow');input.focus();send(input,'#ff3366');document.getElementById('undo').click();setOnlySelected('shape');send(input,'#22cc77');check(items[0].color==='#224466','late input after undo rejected');input.blur();
   reset('arrow');input.focus();const pageId=activePageId;activePageId='another-page';send(input,'#ff3366');activePageId=pageId;check(items[0].color==='#224466','late page input rejected');input.blur();
   // Converting a gradient to solid is one undo, including fill order metadata.
   reset('box');items[0].fillGradient=GradientFill.initial('#3388cc');render();const original=state();input=document.getElementById('box-fill');input.focus();send(input,'#ee4455');send(input,'#aa22cc');check(!items[0].fillGradient,'solid clears old gradient');send(input,'#aa22cc','change');input.blur();document.getElementById('undo').click();check(state()===original,'undo restores gradient and order');
   reset('box');openGradientEditor();history=[];const gradientOriginal=state(),other=scene.querySelector('[data-id="other"]');input=document.getElementById('gradient-color');input.focus();send(input,'#ff5566');send(input,'#66aaee');check(items[0].fillGradient.stops[0].color==='#66aaee','gradient live model');check(scene.querySelector('stop[stop-color="#66aaee"]'),'gradient live SVG');check(scene.querySelector('[data-id="other"]')===other,'gradient keeps other nodes');check(history.length===1,'gradient one undo');send(input,'#66aaee','change');input.blur();document.getElementById('undo').click();check(state()===gradientOriginal,'gradient undo');closeGradientEditor();
   // Reordering, topology changes and repeated geometry edits preserve paint order.
   reset('box');const stable=scene.querySelector('[data-id="other"]');items[0].x+=45;render();check(scene.querySelector('[data-id="other"]')===stable,'drag keeps unaffected scene node');
   renderWorkspacePages();const thumb=document.querySelector('[data-render-island] [data-id="other"]'),pageButton=document.querySelector('#workspace-pages button');items[0].fill='#cc6699';renderStylePreview(items[0]);renderWorkspacePages();check(document.querySelector('[data-render-island] [data-id="other"]')===thumb,'thumbnail keeps unaffected SVG');check(document.querySelector('#workspace-pages button')===pageButton,'thumbnail button retained');
   const layer=document.querySelector('#layers .layer-entry');render();check(document.querySelector('#layers .layer-entry')===layer,'unchanged layer list retained');
   items.reverse();render();check(scene.lastElementChild.dataset.id==='shape','reordered foreground');items[0].hidden=true;render();check(!scene.querySelector('[data-id="other"]'),'hide removes rendered object');items[0].hidden=false;render();
   // External temporary scene contents must not poison the incremental cache.
   scene.innerHTML='<path data-region-preview="true" d="M0 0L20 20"/>';render();check(!scene.querySelector('[data-region-preview]')&&scene.querySelector('[data-id="shape"]'),'external scene invalidation');
   return {width:innerWidth,cases:cases.length,svgId:svg.id};
  });
  // Compare actual raster output of retained SVG vs the reference full renderer.
  await page.evaluate(()=>{closeGradientEditor();clearSelectionState(false);render();document.activeElement?.blur()});
  const target=page.locator('#'+result.svgId),before=await target.screenshot({animations:'disabled'});
  await page.evaluate(()=>{scene.innerHTML=sceneMarkup(items)});
  const reference=await target.screenshot({animations:'disabled'});
  assert.deepEqual(before,reference,'Incremental and full SVG pixels match at '+width);
  await page.evaluate(()=>render());
  assert.deepEqual(await target.screenshot({animations:'disabled'}),reference,'Cache recovers after full replacement');
  fs.mkdirSync('.codex-tmp/live-color',{recursive:true});await page.screenshot({path:'.codex-tmp/live-color/preview-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log('Live colors, Undo/Redo, gradients, stale events, stable layers/thumbnails and SVG pixel parity passed:',width);
  await context.close();
 }
} finally {await browser.close()}
