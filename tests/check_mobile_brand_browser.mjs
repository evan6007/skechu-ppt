import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/',out='.codex-tmp/mobile-brand-browser';fs.mkdirSync(out,{recursive:true});
const errors=[],context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(String(error)));
const inspect=()=>page.evaluate(()=>{
 const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},brand=document.querySelector('.topbar .brand'),mark=brand.querySelector('img'),name=brand.querySelector('.brand-name'),select=document.getElementById('select-tool'),save=document.getElementById('save-project-file');
 const hit=el=>{const r=rect(el);return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
 return{brand:rect(brand),mark:rect(mark),nameVisible:getComputedStyle(name).display!=='none',select:rect(select),hitBrand:hit(brand),hitSelect:hit(select),hitSave:hit(save),bodyOverflow:document.documentElement.scrollWidth>innerWidth,brandName:brand.getAttribute('aria-label')};
});
try{
 await page.goto(base+'?v=90-mobile-brand&storage=mobile-brand-test-'+Date.now());await page.waitForFunction(()=>workspaceReady);await page.evaluate(()=>{document.querySelector('.topbar').scrollLeft=0});
 for(const [width,height] of [[320,740],[390,844],[430,932],[768,1024],[844,390],[900,800]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.querySelector('.topbar').scrollLeft=0);
  const state=await inspect();assert.equal(state.nameVisible,false,`No overflowing title at ${width}px`);assert.equal(state.brand.width,44);assert.equal(state.brand.height,44);assert.equal(state.mark.width,30);assert.equal(state.mark.height,30);
  assert.ok(state.mark.x>=state.brand.x&&state.mark.right<=state.brand.right);assert.ok(state.brand.right<=state.select.x,`Logo cannot overlap Select at ${width}px`);assert.ok(state.hitBrand&&state.hitSelect&&state.hitSave);assert.ok(!state.bodyOverflow);assert.match(state.brandName,/Skechu-PPT/);
  await page.locator('#select-tool').tap();assert.ok(await page.locator('#select-tool').evaluate(el=>el.classList.contains('active')));
 }
 await page.setViewportSize({width:390,height:844});
 for(const theme of ['graphite','mist','linen']){await page.evaluate(t=>applySkechuTheme(t),theme);await page.screenshot({path:out+'/'+theme+'.png'});assert.ok((await inspect()).hitSelect)}
 const desktop=await browser.newPage({viewport:{width:1500,height:950}});desktop.on('pageerror',error=>errors.push(String(error)));await desktop.goto(base+'?v=90-mobile-brand&storage=desktop-brand-test-'+Date.now());await desktop.waitForFunction(()=>workspaceReady);
 for(const width of [901,1200,1500]){await desktop.setViewportSize({width,height:950});const d=await desktop.evaluate(()=>{const b=document.querySelector('.brand'),name=document.querySelector('.brand-name');return{display:getComputedStyle(name).display,text:name.textContent,brandRight:b.getBoundingClientRect().right,starLeft:document.querySelector('.topbar .repo-actions').getBoundingClientRect().left}});assert.notEqual(d.display,'none');assert.equal(d.text,'Skechu-PPT');assert.ok(d.brandRight<=d.starLeft)}
 await desktop.screenshot({path:out+'/desktop.png'});assert.deepEqual(errors,[]);console.log('Mobile brand OK: 320/390/430/768/844/900px, three themes, centered 30px logo in 44px target, no text overflow or blocked Select/Save, working touch selection, unchanged desktop brand at 901/1200/1500px.');
}finally{await browser.close()}
