import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
for(const marker of ['class="brand" href="https://github.com/evan6007/skechu-ppt"','class="repo-actions"','id="github-star"','開啟 GitHub 專案並按 Star','<span>Star</span>'])if(!html.includes(marker))throw new Error(`Missing GitHub action: ${marker}`);
if(!(html.indexOf('id="github-star"')>html.indexOf('class="brand"')&&html.indexOf('id="github-star"')<html.indexOf('id="select-tool"')))throw new Error('Desktop Star action must sit between the Skechu-PPT brand and Select tool');
if(html.includes('幫我按 Star'))throw new Error('Star action must use the concise label Star');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) throw new Error('No inline application script found.');

for (const [, attributes, source] of scripts) {
  if (!source.trim()) continue;
  if (/type="application\/ld\+json"/i.test(attributes)) JSON.parse(source);
  else new Function(source);
}
const smoothing=fs.readFileSync(new URL('../app/local-smoothing.js',import.meta.url),'utf8');
const starStyles=fs.readFileSync(new URL('../app/github-star.css',import.meta.url),'utf8');
if(!starStyles.includes('#github-star[aria-pressed="true"] svg{fill:#e3b341;stroke:#e3b341}'))throw new Error('A confirmed GitHub Star must have a yellow fill and outline');
if(!starStyles.includes('#github-star[aria-pressed="false"] svg{fill:none;stroke:currentColor}'))throw new Error('An unstarred button must remain an unfilled neutral outline, including hover');
for (const file of ['github-star.js','github-star.css']) {
  const asset=fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
  if(file.endsWith('.js'))new Function(asset);
  if(!html.includes(file))throw new Error('Missing Star integration '+file);
  if(!fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes('./'+file))throw new Error('Missing Star offline asset '+file);
  if(!fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/'+file+';.'))throw new Error('Missing packaged Star asset '+file);
}
for(const file of ['auto-trace.js','auto-trace-ui.js','auto-trace-worker.js','auto-trace.css','paint-layers.js','paint-tools.js','paint-tools.css','pan-tool.js','selection-controls.js','workspace-actions.js','layer-controls.js','layer-controls.css','panel-layout.js','theme-controls.js','theme-controls.css','clipboard-controls.js','web-ppt-client.js','web-ppt-helper.js','web-ppt.html','ppt-preparation.js','clipboard-controls.css']){
  const asset=fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
  if(file.endsWith('.js'))new Function(asset);
  if(!fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes('./'+file))throw new Error('Missing offline asset '+file);
  if(!fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/'+file+';.'))throw new Error('Missing packaged asset '+file);
}
const regions=fs.readFileSync(new URL('../app/region-fill.js',import.meta.url),'utf8');
new Function(regions);
for(const marker of ['region-fill.js','fillBoundaryPath','fillNetworkFaces','materializeFillTarget','data-region-preview'])assertMarker(marker);
function assertMarker(marker){if(!html.includes(marker))throw new Error(`Missing network fill integration: ${marker}`)}
if(!fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes('./region-fill.js'))throw new Error('Missing offline region-fill asset');
if(!fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/region-fill.js;.'))throw new Error('Missing packaged region-fill asset');
new Function(smoothing);
for(const marker of ['local-smoothing.js','局部順線','local-smooth-range','local-smooth-number','applyLocalSmoothing','syncLocalSmoothing']) {
  if(!html.includes(marker))throw new Error(`Missing local smoothing integration: ${marker}`);
}
if(!fs.readFileSync(new URL('../app/service-worker.js',import.meta.url),'utf8').includes('./local-smoothing.js'))throw new Error('Missing offline smoothing asset');
if(!fs.readFileSync(new URL('../.github/workflows/windows-release.yml',import.meta.url),'utf8').includes('app/local-smoothing.js;.'))throw new Error('Missing packaged smoothing asset');

const forbidden = [
  /SemaSNN/i,
  /hippocamp/i,
  /Figure\s+[2b]/i,
  /(?:fetch|src|href)\s*[=(]\s*['"]https?:\/\/(?!127\.0\.0\.1|localhost|github\.com\/evan6007\/skechu-ppt(?:[\/"']))/i,
];
// A canonical identity link does not fetch or upload anything. Keep the strict
// remote-resource boundary for every other tag and every executable script.
const privacySource = html.replace('<link rel="canonical" href="https://evan6007.github.io/skechu-ppt/">', '');
for (const pattern of forbidden) {
  if (pattern.test(privacySource)) throw new Error(`Forbidden private or remote reference: ${pattern}`);
}

for (const required of ['Skechu-PPT', 'magnetic-trace', 'merge-selected', 'copy-ppt', 'palette-grid', 'application/x-skechu-color', 'fillTargetAt']) {
  if (!html.includes(required)) throw new Error(`Missing core feature marker: ${required}`);
}

for (const extension of ['.skc', '.sktc', '.sketchou.json']) {
  if (!html.includes(extension)) throw new Error(`Missing project compatibility marker: ${extension}`);
}

for (const tracingFix of ['edgeLocked:true', 'curved:true,centerlineLocked:true,edgeLocked:true,centerlineSmoothingVersion:2,smoothnessDefault:100', 'arrowUsesCurves', 'traceJoinOverlay', 'finishTraceAtAnchor', 'anchorIndices:[0]', 'trace-join-label']) {
  if (!html.includes(tracingFix)) throw new Error(`Missing boundary tracing fix marker: ${tracingFix}`);
}

for (const smoothingFix of ['point-smoothness', 'pointSmoothnessValue', 'limitedControl', 'curveSegmentControls', 'smoothnessDefault']) {
  if (!html.includes(smoothingFix)) throw new Error(`Missing per-anchor smoothing marker: ${smoothingFix}`);
}

for (const tangentControl of ['point-angle', 'pointAngles', 'pointTangentAngle', 'pointTangentDelta', 'tangent-angle-handle', '恢復自動角度', '這一點的曲線幅度']) {
  if (!html.includes(tangentControl)) throw new Error(`Missing per-anchor tangent marker: ${tangentControl}`);
}

for (const splitHandle of ['point-handles-split', 'pointHandleAngles', 'splitHandleAngles', 'splitHandleDelta', 'inLength', 'outLength', 'point-in-length', 'point-out-length', 'anchorHandleLengths', 'tangent-handle-hit', 'r="18"', '可自由拉到遠處', 'tangent-in', 'tangent-out', '內凹尖谷、不繞圈']) {
  if (!html.includes(splitHandle)) throw new Error(`Missing split Bézier handle marker: ${splitHandle}`);
}

for (const routeSmoothing of ['relaxCenterlinePoints', 'smoothTraceRoute', 'ensureCenterlineSmoothing', 'tracePreviewRawPoints', '前後 3～4 點']) {
  if (!html.includes(routeSmoothing)) throw new Error(`Missing boundary de-noising marker: ${routeSmoothing}`);
}

for (const circularArc of ['circleFromThreePoints', 'solve3x3', 'leastSquaresCircle', 'wideArc', 'circularArcModel', 'circularClosedArcModel', 'circularArcPathRange', 'circularFullCirclePath', 'fullCircle', 'data-perfect-arc', ' A${model.r} ${model.r}']) {
  if (!html.includes(circularArc)) throw new Error(`Missing true circular arc marker: ${circularArc}`);
}

for (const circularClosure of ["fittedCircle=closing?circularArcModel(it.points):null", "delete it.tracePreviewRawPoints", "封閉時未重新尋路"]) {
  if (!html.includes(circularClosure)) throw new Error(`Missing direct circular closure marker: ${circularClosure}`);
}

for (const boundarySnap of ['edgeRouteMask', 'referenceBoundaryRoute', 'routeFollowsBoundary', 'cache.edges[index]', '磁吸已開啟']) {
  if (!html.includes(boundarySnap)) throw new Error(`Missing boundary snap marker: ${boundarySnap}`);
}

for (const routeGuard of ['insideCorridor', 'routeLength>distance*1.55', 'trace-snap.blocked']) {
  if (!html.includes(routeGuard)) throw new Error(`Missing magnetic route guard marker: ${routeGuard}`);
}

for (const permissiveTrace of ["if(tracePenOn&&!traceDraft&&!drag)", '橘色點就是第一個預測錨點', '但仍可繼續描', 'it.points.slice(0,-1).concat(route)', 'smoothPathRange', '共用同一條切線']) {
  if (!html.includes(permissiveTrace)) throw new Error(`Missing permissive curved preview marker: ${permissiveTrace}`);
}

for (const drawingMode of ['select-tool', 'activateSelectTool', 'tool-icon', '可直接在既有物件上開始新線', 'if(tracePenOn&&e.button===0)', '.stage.tracing #scene [data-id]']) {
  if (!html.includes(drawingMode)) throw new Error(`Missing drawing-mode priority marker: ${drawingMode}`);
}

for (const anchorDelete of ['function deleteSelectedAnchors()', '不能再刪錨點', '路徑保留', "if(!deleteSelectedAnchors())document.getElementById('delete').click()"]){
  if (!html.includes(anchorDelete)) throw new Error(`Missing anchor deletion marker: ${anchorDelete}`);
}

console.log(`Skechu-PPT app syntax OK (${html.length} characters).`);
