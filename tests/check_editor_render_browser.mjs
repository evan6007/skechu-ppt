import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.SKECHU_TEST_URL||'http://127.0.0.1:18782/')+'?mode=web&storage=renderer-test-'+Date.now());await page.waitForFunction(()=>workspaceReady);
 const result=await page.evaluate(()=>{
  const check=(value,message)=>{if(!value)throw Error(message)};
  const svgNs='http://www.w3.org/2000/svg',host=document.createElementNS(svgNs,'svg'),reference=document.createElementNS(svgNs,'svg');
  const tree=node=>node.nodeType===1?[node.namespaceURI,node.nodeName,[...node.attributes].map(a=>[a.namespaceURI,a.name,a.value]).sort((a,b)=>a[1].localeCompare(b[1])),[...node.childNodes].map(tree)]:[node.nodeType,node.nodeValue];
  let seed=912;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let pass=0;pass<150;pass++){
   const entries=Array.from({length:12},(_,i)=>({renderKey:'k'+i,markup:random()<.08?'':random()<.4?`<defs><linearGradient id="g${i}"><stop stop-color="#ff0044" offset="${random()}"/></linearGradient></defs><rect x="${pass}" fill="url(#g${i})"/>`:`<g data-id="${i}" opacity="${random()}"><path d="M0 0L${pass} ${i}"/><text>${pass}</text>${random()<.5?'<circle r="4"/>':''}</g>`})).filter(()=>random()>.2);
   for(let i=entries.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[entries[i],entries[j]]=[entries[j],entries[i]]}
   EditorRender.render(host,entries);reference.innerHTML=entries.map(e=>e.markup).join('');check(JSON.stringify(tree(host))===JSON.stringify(tree(reference)),'full DOM parity pass '+pass);
  }
  EditorRender.render(host,[]);check(host.childNodes.length===0,'bulk delete');
  const html=document.createElement('div'),entry=name=>[{renderKey:'page',markup:`<button><span>${name}</span><svg><g data-render-island="page-scene"></g></svg></button>`}];
  EditorRender.render(html,entry('one'));const island=html.querySelector('g');EditorRender.render(island,[{renderKey:'rect',markup:'<rect width="10"/>'}]);const rect=island.firstChild;EditorRender.render(html,entry('renamed'));check(html.querySelector('span').textContent==='renamed'&&html.querySelector('g')===island&&island.firstChild===rect,'page metadata keeps preview island');
  // Real shared-edge coverage blocks must split/rejoin correctly when a stop
  // becomes transparent, or when a neighbouring fill is hidden or removed.
  items=[0,1,2].map(i=>({id:'partition-'+i,type:'arrow',name:'part '+i,closed:true,width:0,fill:'#4488cc',fillOpacity:1,color:'#000000',points:[{x:80+i*90,y:70},{x:170+i*90,y:70},{x:170+i*90,y:220},{x:80+i*90,y:220}]}));
  items.forEach(it=>{GradientRegions.stamp(it,'renderer-coverage');it.fillPartition.count=3;it.fillPartition.frame=[{x:80,y:70},{x:350,y:70},{x:350,y:220},{x:80,y:220}]});
  clearSelectionState(false);render();check(scene.querySelector('[data-coverage-normalized]'),'complete coverage');
  items[1].fillGradient=GradientFill.initial('#cc3388');renderStylePreview(items[1]);check(scene.querySelector('[data-coverage-normalized]')&&scene.querySelector('linearGradient'),'opaque gradient retains coverage');
  items[1].fillGradient.stops[1].opacity=.4;renderStylePreview(items[1]);check(!scene.querySelector('[data-coverage-normalized]'),'transparent stop splits coverage');
  items[1].fillGradient.stops[1].opacity=1;renderStylePreview(items[1]);check(scene.querySelector('[data-coverage-normalized]'),'opaque stop rejoins coverage');
  items[0].hidden=true;render();check(!scene.querySelector('[data-coverage-normalized]'),'hidden member invalidates coverage');items[0].hidden=false;render();check(scene.querySelector('[data-coverage-normalized]'),'restored member rejoins');
  return {svgId:svg.id,passes:150};
 });
 const target=page.locator('#'+result.svgId),before=await target.screenshot({animations:'disabled'});await page.evaluate(()=>scene.innerHTML=sceneMarkup(items));assert.deepEqual(await target.screenshot({animations:'disabled'}),before,'Shared-coverage pixel parity');
 assert.deepEqual(errors,[]);console.log('Incremental SVG: 150 deterministic reorder/multi-root/topology parity cases, page islands, transparent shared gradients and full-render pixel parity passed.');
}finally{await browser.close()}
