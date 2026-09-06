// Synthetic browser regression; no model, private portrait, or existing project.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:8767/')+'?storage=nested-fill-qa-'+Date.now());
  await page.waitForFunction(()=>workspaceReady);
  await page.evaluate(()=>{
    resetEditorState();activePage().canvasWidth=500;activePage().canvasHeight=400;
    items=[{id:'outer',type:'box',name:'Parent region',x:40,y:40,w:400,h:300,stroke:'#182c49',strokeWidth:2,fill:'#ffffff',opacity:0},
      {id:'inner',type:'arrow',name:'Inner loop',points:[{x:190,y:100},{x:260,y:190},{x:180,y:220}],closed:true,curved:false,
        width:2,color:'#182c49',fill:'#ffffff',fillOpacity:0,startHead:false,endHead:false},
      {id:'eye',type:'ellipse',name:'Other inner loop',x:320,y:100,w:60,h:40,stroke:'#182c49',strokeWidth:2,fill:'#ffffff',opacity:0}];
    setCanvasAppearance('#ffffff',1);setOnlySelected(null);render();fitView();
  });
  await page.locator('#paint-bucket').click();
  for(const probe of [{id:'outer',x:80,y:80,color:'#f8ce8e'},{id:'inner',x:210,y:175,color:'#b86d35'},{id:'eye',x:350,y:120,color:'#25384e'}]){
    const previous=await page.evaluate(()=>items.filter(renderedFillIsVisible).map(it=>({id:it.id,fill:it.fill})));
    await page.evaluate(color=>{activePaletteColor=color;syncPaintColor()},probe.color);
    assert.equal(await page.evaluate(()=>paintTool),'bucket','Continuous filling keeps the bucket active');
    const p=await page.evaluate(p=>{const m=svg.getScreenCTM();return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}},probe);
    await page.mouse.click(p.x,p.y);
    assert.equal(await page.evaluate(id=>byId(id).fill,probe.id),probe.color,'The local region receives the color');
    assert.ok(await page.evaluate(before=>before.every(old=>byId(old.id).fill===old.fill),previous),'The painted parent cannot steal a nested hit');
  }
  await page.keyboard.press('Escape');await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(()=>byId('eye').opacity),0);
  assert.equal(await page.evaluate(()=>byId('inner').fill),'#b86d35');
  assert.equal(await page.evaluate(()=>byId('outer').fill),'#f8ce8e');
  assert.deepEqual(errors,[]);
  console.log('Nested fill browser OK: parent first, inner curve, inner ellipse, unchanged previous colors, exact local Undo.');
}finally{await browser.close();}
