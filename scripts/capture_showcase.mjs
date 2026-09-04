import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const [projectFile, outputDir = 'docs/media/showcase-frames'] = process.argv.slice(2);
if (!projectFile) {
  console.error('Usage: node scripts/capture_showcase.mjs <project.skc> [output-dir]');
  process.exit(2);
}

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(path.join(os.tmpdir(), 'skechu-showcase-'));
await mkdir(outputDir, { recursive: true });
const metadata = {};

const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
  '--force-device-scale-factor=1', '--window-size=1920,1080', `--remote-debugging-port=${port}`,
  '--remote-allow-origins=*', `--user-data-dir=${profile}`,
  'http://127.0.0.1:8766/?capture=brain-showcase-v1',
], { stdio: 'ignore' });
const browserExited = new Promise(resolve => browser.once('exit', resolve));

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForTarget() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const page = targets.find(target => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools target did not start');
}

let socket;
let serial = 0;
const pending = new Map();
function command(method, params = {}) {
  const id = ++serial;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Browser evaluation failed');
  return response.result?.value;
}
async function waitFor(expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}
async function capture(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(outputDir, name), Buffer.from(result.data, 'base64'));
}

try {
  const debuggerUrl = await waitForTarget();
  socket = new WebSocket(debuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve; socket.onerror = reject;
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const waiter = pending.get(message.id); pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
    };
  });
  await command('Page.enable'); await command('Runtime.enable'); await command('DOM.enable');
  await waitFor('document.readyState === "complete"');
  await evaluate(`pptAutoPrepareDisabled=true;clearTimeout(pptPrepareTimer);pptPrepareTimer=null`);

  const { root } = await command('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await command('DOM.querySelector', { nodeId: root.nodeId, selector: '#load-json' });
  await command('DOM.setFileInputFiles', { nodeId, files: [path.resolve(projectFile)] });
  await evaluate(`document.getElementById('load-json').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelectorAll('#workspace-pages [data-page-id]').length >= 2`);
  await evaluate(`document.querySelectorAll('#workspace-pages [data-page-id]')[1].click()`);
  await waitFor(`document.querySelectorAll('#workspace-pages [data-page-id]')[1].classList.contains('active')`);
  await evaluate(`window.__brainItems=deepCopy(items);window.__brainCanvas=canvasSize();pptAutoPrepareDisabled=true;clearTimeout(pptPrepareTimer);pptPrepareTimer=null;
    const reference=deepCopy(items.find(item=>item.referenceOnly));
    Object.assign(reference,{x:275,y:65,w:950,h:675,opacity:1,hidden:false});
    const page=activePage();page.canvasWidth=1500;page.canvasHeight=850;items=[reference];
    clearSelectionState();applyCanvasSize();render();fitView();setTracePen(true);prepareReferenceEdges()`);
  await waitFor(`(() => {const r=items.find(x=>x.referenceOnly),c=r&&referenceEdgeCache.get(r.id);return !!c?.edges&&!c.loading})()`, 30000);

  // 1. Magnetic trace: zoomed close-up, normal cursor approaches, orange point snaps to a real edge.
  const traceSetup = await evaluate(`(() => {
    const ref=items.find(item=>item.referenceOnly),cache=referenceEdgeCache.get(ref.id);
    const centralGuideY=x=>cache.h*(.34+1.15*((x/cache.w)-.50)**2);
    const track=[];
    for(let slot=0;slot<21;slot++){
      const wantedX=cache.w*(.30+slot*.018);let candidate=null;
      for(let x=Math.max(1,Math.round(wantedX)-5);x<=Math.min(cache.w-2,Math.round(wantedX)+5);x++){
        const wantedY=centralGuideY(x);
        for(let y=Math.max(1,Math.floor(wantedY-cache.h*.065));y<=Math.min(cache.h-2,Math.ceil(wantedY+cache.h*.065));y++){
          const i=y*cache.w+x;if(!cache.edges[i])continue;
          const score=Math.abs(x-wantedX)*4+Math.abs(y-wantedY)*7-(cache.strengths[i]||0)*.02;
          if(!candidate||score<candidate.score)candidate={x,y,score};
        }
      }
      if(!candidate)throw new Error('No central showcase edge found');
      const point=candidate;
      track.push({x:ref.x+(point.x+.5)/cache.w*ref.w,y:ref.y+(point.y+.5)/cache.h*ref.h});
    }
    const edge=track[10];
    const matrix=svg.getScreenCTM(),screen=p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f});
    return{edge,track,edgeScreen:screen(edge),viewport:{width:innerWidth,height:innerHeight}};
  })()`);
  metadata.trace = {...traceSetup, frames: []};
  for (let step = 0; step < 15; step += 1) {
    const point = await evaluate(`(() => {
      const edge=${JSON.stringify(traceSetup.edge)},distance=78-(66*${step}/14),raw={x:edge.x-distance*.22,y:edge.y-distance};
      magneticEdgeSnap(raw);traceRouteValid=true;renderSelection();
      document.getElementById('status').textContent=traceSnapTarget?'橘色點已吸住圖像邊界':'游標靠近邊界即可磁吸';
      const matrix=svg.getScreenCTM(),screen=p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f});
      return{cursor:screen(raw),snap:traceSnapTarget?screen(traceSnapTarget):null};
    })()`);
    metadata.trace.frames.push(point);
    await capture(`trace-${String(step).padStart(2, '0')}.png`);
  }
  const sweep = (from, to, frames) => Array.from({length:frames}, (_, index) =>
    Math.round(from + (to - from) * index / (frames - 1)));
  const motionOrder = [
    ...sweep(10, 0, 17),
    ...sweep(0, 20, 33).slice(1),
    ...sweep(20, 0, 33).slice(1),
    ...sweep(0, 10, 17).slice(1),
  ];
  for (const trackIndex of motionOrder) {
    const frameIndex = metadata.trace.frames.length;
    const point = await evaluate(`(() => {
      const edge=${JSON.stringify(traceSetup.track)}[${trackIndex}],raw={x:edge.x,y:edge.y-10};
      magneticEdgeSnap(raw);traceRouteValid=true;renderSelection();
      document.getElementById('status').textContent='橘色點吸住中央曲線慢速滑動';
      const matrix=svg.getScreenCTM(),screen=p=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f});
      const cursorPoint=traceSnapTarget?{x:traceSnapTarget.x+2,y:traceSnapTarget.y-18}:raw;
      return{cursor:screen(cursorPoint),snap:traceSnapTarget?screen(traceSnapTarget):null};
    })()`);
    metadata.trace.frames.push(point);
    await capture(`trace-${String(frameIndex).padStart(2, '0')}.png`);
  }

  // 2. Auto trace: same brain image, real preview, apply, then Ctrl+A shows every anchor.
  await evaluate(`traceSnapTarget=null;setTracePen(false);items=[deepCopy(items.find(item=>item.referenceOnly))];clearSelectionState();render();fitView()`);
  await delay(250);
  await capture('auto-00-source.png');
  await evaluate(`document.getElementById('auto-trace').click()`);
  await waitFor(`document.getElementById('auto-trace-dialog').open`);
  await capture('auto-01-opening.png');
  await waitFor(`document.getElementById('auto-trace-svg').getAttribute('aria-busy')==='false'&&!document.getElementById('auto-trace-apply').disabled`, 45000);
  await capture('auto-02-preview.png');
  await evaluate(`document.getElementById('auto-trace-apply').click()`);
  await waitFor(`!document.getElementById('auto-trace-dialog').open`);
  await delay(250);
  await capture('auto-03-applied.png');
  const anchorCount = await evaluate(`document.getElementById('select-all').click();items.filter(item=>item.points&&!item.referenceOnly).reduce((sum,item)=>sum+item.points.length,0)`);
  metadata.autoTraceAnchors = anchorCount;
  await delay(250);
  await capture('auto-04-all-anchors.png');

  // 3. Rainbow speed fill: reveal precomputed brain regions in a fast sweep.
  const fillInfo = await evaluate(`(() => {
    items=deepCopy(window.__brainItems);const palette=['#ff3b30','#ff9500','#ffd60a','#34c759','#00c7be','#0a84ff','#af52de'];
    const page=activePage();page.canvasWidth=window.__brainCanvas.width;page.canvasHeight=window.__brainCanvas.height;
    items.filter(item=>item.referenceOnly).forEach(item=>item.hidden=true);
    const fills=items.filter(item=>item.regionFill&&item.points?.length);
    const centers=new Map(fills.map(item=>[item.id,{x:item.points.reduce((s,p)=>s+p.x,0)/item.points.length,y:item.points.reduce((s,p)=>s+p.y,0)/item.points.length}]));
    const all=[...centers.values()],center={x:(Math.min(...all.map(p=>p.x))+Math.max(...all.map(p=>p.x)))/2,y:(Math.min(...all.map(p=>p.y))+Math.max(...all.map(p=>p.y)))/2};
    const ordered=[...fills].sort((a,b)=>{const pa=centers.get(a.id),pb=centers.get(b.id);
      const aa=(Math.atan2(pa.x-center.x,-(pa.y-center.y))+Math.PI*2)%(Math.PI*2),ab=(Math.atan2(pb.x-center.x,-(pb.y-center.y))+Math.PI*2)%(Math.PI*2);return aa-ab;});
    ordered.forEach((item,rank)=>{item.fill=palette[rank%palette.length];item.fillOpacity=1;item.hidden=true;});
    window.__rainbowFillIds=ordered.map(item=>item.id);
    clearSelectionState();applyCanvasSize();render();fitView();return{count:fills.length,colors:palette};
  })()`);
  metadata.rainbow = fillInfo;
  await capture('fill-00.png');
  for (let step = 1; step <= 20; step += 1) {
    await evaluate(`(() => {const ids=window.__rainbowFillIds,limit=Math.ceil(ids.length*${step}/20),visible=new Set(ids.slice(0,limit));
      items.filter(item=>item.regionFill).forEach(item=>item.hidden=!visible.has(item.id));render();
      document.getElementById('status').textContent='七彩區域填色 '+Math.round(${step}/20*100)+'%';})()`);
    await capture(`fill-${String(step).padStart(2, '0')}.png`);
  }

  // 4. Start from the untouched rainbow brain, visibly select everything,
  // then copy it before the companion script continues in PowerPoint.
  await evaluate(`clearSelectionState();render()`);
  await capture('ppt-00-unselected.png');
  await evaluate(`document.getElementById('select-all').click();document.getElementById('status').textContent='Ctrl+A 全選所有物件'`);
  await capture('ppt-01-selected.png');
  await evaluate(`setClipboardBusy(true);const bar=document.getElementById('ppt-progress');bar.hidden=false;bar.value=48;clipboardFeedback('正在複製到 PowerPoint','建立可編輯向量物件（48%）')`);
  await capture('ppt-02-copying.png');
  await evaluate(`document.getElementById('ppt-progress').value=100;setClipboardBusy(false);document.getElementById('ppt-progress').hidden=true;clipboardFeedback('複製成功：可編輯 PPT 物件','切到 PowerPoint，按 Ctrl+V 貼上完整作品。','success')`);
  await capture('ppt-03-success.png');

  await writeFile(path.join(outputDir, 'showcase-metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(path.resolve(outputDir));
} finally {
  try { if (socket?.readyState === WebSocket.OPEN) await command('Browser.close'); } catch {}
  await Promise.race([browserExited, delay(2000)]);
  if (browser.exitCode === null) browser.kill();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { await rm(profile, { recursive: true, force: true }); break; }
    catch (error) { if (attempt === 4) console.warn(`Temporary profile remains at ${profile}: ${error.message}`); else await delay(300); }
  }
}
