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
assert.ok(browserCapture.includes("auto-00-blank.png")&&browserCapture.includes("auto-01-imported.png")&&browserCapture.includes("auto-05-shrink-")&&browserCapture.includes("auto-06-all-anchors.png")&&gifBuilder.includes('auto_blank')&&gifBuilder.includes('auto_shrink')&&gifBuilder.includes('無填色向量線稿'),'Auto trace demo must start blank, import a reference, reveal unfilled line art after moving the source to the lower-left, then select every editable anchor');
assert.ok(browserCapture.includes("page.canvasColor='#ffffff';page.canvasOpacity=1"),'Browser showcase capture must render the drawing canvas as solid white instead of reusing the editor checkerboard');
assert.ok(gifBuilder.includes('auto_preview_close_bounds = (0.452, 0.574, 0.682, 0.780)')&&gifBuilder.includes('zoom_sequence(auto_preview_source, auto_bounds, auto_preview_close_bounds, 30)')&&gifBuilder.includes('zoom_sequence(auto_preview_source, auto_preview_close_bounds, auto_bounds, 26)')&&gifBuilder.includes('"複雜線條完整描出", auto_preview_close')&&gifBuilder.includes('range(22)'),'Auto trace demo must smoothly center, enlarge and briefly hold the raised cerebellum tracing');
assert.ok(gifBuilder.includes('Image.Transform.EXTENT')&&gifBuilder.includes('step / max(1, count - 1)')&&gifBuilder.includes('t * t * t * (t * (t * 6 - 15) + 10)'),'Zoom camera must use subpixel sampling, shared endpoints and minimum-jerk easing');
assert.ok(gifBuilder.includes('"完整預覽已確認", auto_preview')&&gifBuilder.includes('range(7)'),'Auto trace demo must settle on the full preview before closing back into the source image');
assert.ok(browserCapture.includes("auto-02-opening-${String(step).padStart(2,'0')}.png")&&browserCapture.includes("auto-04-closing-${String(step).padStart(2,'0')}.png")&&browserCapture.includes('autoTraceDialogMotion?.animation.pause()')&&browserCapture.includes('autoTraceDialogMotion.animation.currentTime=')&&gifBuilder.includes('METADATA["autoTraceMotion"]["openingFrames"]')&&gifBuilder.includes('METADATA["autoTraceMotion"]["closingFrames"]')&&!gifBuilder.includes('auto_preview_match_angle'),'Auto trace GIF must use deterministic frames from the real shared-image animation instead of guessed crop bounds or corrective rotation');
assert.ok(gifBuilder.includes('"描圖已套用", auto_applied_clean')&&gifBuilder.includes('range(10)'),'Auto trace demo must pause after applying the trace before shrinking the reference image');
assert.ok(browserCapture.includes("ppt-00-unselected.png")&&browserCapture.includes("ppt-01-selected.png")&&gifBuilder.includes('ppt_unselected'),'PowerPoint demo must start unselected, then show Ctrl+A before copying');
assert.ok(browserCapture.includes('const start={x:ref.x+ref.w*.375')&&browserCapture.includes('const end={x:ref.x+ref.w*.535')&&browserCapture.includes('Math.floor(slot/40)')&&browserCapture.includes('guideTrack.map(point=>{magneticEdgeSnap(point)')&&browserCapture.includes('traceSnapTarget={x:edge.x,y:edge.y}')&&browserCapture.includes('Math.sin(progress*Math.PI*5)')&&browserCapture.includes('motionOrder = Array.from')&&gifBuilder.includes('crop_width = min(420')&&!gifBuilder.includes('anchor=anchor')&&gifBuilder.includes('橘點吸住線條滑動'),'Magnetic tracing demo must center one native orange marker on a branch-free span of one real edge while a visibly separate cursor advances in three natural pushes');
assert.ok(pptCapture.includes('return fills + foreground'),'PowerPoint showcase must keep fills behind the original line art');
assert.ok(pptCapture.includes('rank_by_index')&&pptCapture.includes('for step in range(49)')&&pptCapture.includes('scribble_targets')&&pptCapture.includes('len(strokes) != 10')&&pptCapture.includes('all_names'),'PowerPoint color regions must fill ten diagonal strokes, then finish with every native object selected');
assert.ok(browserCapture.includes('window.__brainCanvas=canvasSize()')&&browserCapture.includes('page.canvasHeight=window.__brainCanvas.height'),'Brain demos must restore the project canvas before showing the full artwork');
assert.ok(!gifBuilder.includes('moving_view'),'Feature demos must not hide the action behind camera pans or zooms');
console.log('Web-first entry OK: primary launch card, four brain-based action GIFs and secondary Windows installer.');
