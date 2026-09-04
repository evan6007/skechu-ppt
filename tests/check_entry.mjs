import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const readme=read('README.md'),asset='assets/brand/open-web-cta.svg',svg=read(asset),gifBuilder=read('scripts/build_showcase_gifs.py'),pptCapture=read('scripts/capture_powerpoint_demo.py'),browserCapture=read('scripts/capture_showcase.mjs');
const primary=readme.match(/<a href="([^"]+)"><img src="assets\/brand\/open-web-cta.svg"[^>]+><\/a>/);
assert.ok(primary,'A large linked Open Web card is the primary entry');
assert.equal(primary[1],'https://evan6007.github.io/skechu-ppt/');
assert.ok(readme.indexOf(asset)<readme.indexOf('releases/latest/download/'),'Web precedes the installer');
assert.ok(!readme.includes('badge/Download_for_Windows'),'Installer must not compete with the primary card');
assert.match(readme,/Get the Windows installer/);
assert.match(svg,/<title[^>]*>Open Web/);
assert.match(svg,/No installation/);
assert.ok(!/<script|foreignObject|(?:href|src)=/i.test(svg),'The entry card is a self-contained static SVG');
assert.ok(readme.includes('Copy to PPT is Windows-only'),'Platform limitations remain explicit');
const featureGifs=['feature-magnetic-trace.gif','feature-auto-trace.gif','feature-rainbow-fill.gif','feature-powerpoint.gif'];
for(const name of featureGifs){
  const path=`docs/media/${name}`,data=fs.readFileSync(new URL('../'+path,import.meta.url));
  assert.ok(readme.includes(path),`README must display ${name}`);
  assert.equal(data.subarray(0,3).toString(),'GIF',`${name} must be a real GIF`);
  assert.ok(data.length>50000,`${name} must contain a meaningful UI recording`);
}
assert.ok(!readme.includes('editor-workflow.gif'),'The obsolete combined montage must not replace four focused demos');
assert.ok(gifBuilder.includes('fixed_view')&&gifBuilder.includes('trace_view')&&gifBuilder.includes('aero_arrow.cur')&&gifBuilder.includes('ppt_all_selected')&&gifBuilder.includes('ppt_explode'),'Feature demos must use fixed views, a normal system cursor, real magnetic snapping, full PowerPoint selection and independently editable objects');
assert.ok(pptCapture.includes('return fills + foreground'),'PowerPoint showcase must keep fills behind the original line art');
assert.ok(browserCapture.includes('window.__brainCanvas=canvasSize()')&&browserCapture.includes('page.canvasHeight=window.__brainCanvas.height'),'Brain demos must restore the project canvas before showing the full artwork');
assert.ok(!gifBuilder.includes('moving_view'),'Feature demos must not hide the action behind camera pans or zooms');
console.log('Web-first entry OK: primary launch card, four brain-based action GIFs and secondary Windows installer.');
