import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const out='.codex-tmp/gradient-parity';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:800,height:320}});
 await page.addScriptTag({path:'app/gradient-fill.js'});
 for(const fixture of JSON.parse(fs.readFileSync(out+'/fixtures.json'))){
  await page.evaluate(({gradient})=>{const g=GradientFill.svg(gradient,'parity');document.body.style.margin='0';document.body.innerHTML=`<svg width="800" height="320">${g.defs}<rect width="800" height="320" fill="${g.fill}"/></svg>`},fixture);
  await page.screenshot({path:out+'/'+fixture.name+'-web.png'});
 }
}finally{await browser.close()}
