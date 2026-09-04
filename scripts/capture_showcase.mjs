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

const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
  '--force-device-scale-factor=1', '--window-size=1920,1080', `--remote-debugging-port=${port}`,
  '--remote-allow-origins=*', `--user-data-dir=${profile}`,
  'http://127.0.0.1:8766/?capture=showcase-v2',
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
async function setDemoScene(itemsSource, selectedId = null, selectedPointIndex = null) {
  await evaluate(`(() => {
    clearTimeout(pptPrepareTimer); pptPrepareTimer = null; queueNativePrepare = () => {};
    const page = activePage(); page.canvasWidth = 1200; page.canvasHeight = 675;
    items = ${itemsSource}; selected = ${JSON.stringify(selectedId)};
    selectedIds = new Set(${selectedId ? `[${JSON.stringify(selectedId)}]` : '[]'});
    selectedPoint = ${selectedPointIndex == null ? 'null' : selectedPointIndex};
    selectedPoints = new Set(${selectedPointIndex == null ? '[]' : `[${selectedPointIndex}]`});
    selectedSegment = null; editPoints = ${selectedPointIndex == null ? 'false' : 'true'};
    gridOn = false; resetPaintTools(); applyCanvasSize(); render(); fitView();
  })()`);
  await delay(250);
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
  await evaluate(`queueNativePrepare = () => {}; clearTimeout(pptPrepareTimer); pptPrepareTimer = null`);

  const { root } = await command('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await command('DOM.querySelector', { nodeId: root.nodeId, selector: '#load-json' });
  await command('DOM.setFileInputFiles', { nodeId, files: [path.resolve(projectFile)] });
  await evaluate(`document.getElementById('load-json').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelectorAll('#workspace-pages [data-page-id]').length >= 2`);
  await evaluate(`document.querySelectorAll('#workspace-pages [data-page-id]')[1].click()`);
  await waitFor(`document.querySelectorAll('#workspace-pages [data-page-id]')[1].classList.contains('active')`);
  await evaluate(`document.getElementById('fit-view').click();clearSelectionState();document.querySelector('.export-menu').open=false;
    items.forEach(item=>{if(!item.referenceOnly)item.hidden=true});
    const reference=items.find(item=>item.referenceOnly);if(reference)Object.assign(reference,{x:300,y:95,w:900,h:600,opacity:1});
    render();fitView()`);
  await delay(500);

  // Auto trace: source, click, busy preview, computed preview, and a visibly different setting.
  await capture('auto-00-source.png');
  await evaluate(`document.getElementById('auto-trace').click()`);
  await waitFor(`document.getElementById('auto-trace-dialog').open`);
  await capture('auto-01-opening.png');
  await waitFor(`document.getElementById('auto-trace-svg').getAttribute('aria-busy')==='false'&&!document.getElementById('auto-trace-apply').disabled`, 45000);
  await capture('auto-02-result.png');
  await evaluate(`const input=document.getElementById('auto-trace-simplify');input.value='35';input.dispatchEvent(new Event('input',{bubbles:true}))`);
  await delay(900);
  await capture('auto-03-updating.png');
  await waitFor(`document.getElementById('auto-trace-svg').getAttribute('aria-busy')==='false'&&!document.getElementById('auto-trace-apply').disabled`, 45000);
  await capture('auto-04-detailed.png');
  await evaluate(`cancelAutoTrace()`);

  // Anchor editing: the viewport stays fixed while one real anchor and its curve move.
  const anchorScene = `[
    {id:'guide',type:'arrow',name:'修改前',points:[{x:170,y:455},{x:360,y:235},{x:600,y:410},{x:820,y:225},{x:1030,y:445}],color:'#64748b',width:5,curved:true,closed:false,startHead:false,endHead:false,style:'dash',fillOpacity:0,locked:true},
    {id:'edit-curve',type:'arrow',name:'可編輯曲線',points:[{x:170,y:455},{x:360,y:235},{x:600,y:410},{x:820,y:225},{x:1030,y:445}],color:'#8b5cf6',width:10,curved:true,closed:false,startHead:false,endHead:false,style:'solid',fillOpacity:0,pointSmoothness:{2:100}}
  ]`;
  await setDemoScene(anchorScene, 'edit-curve', 2);
  for (let step = 0; step <= 20; step += 1) {
    const y = Math.round(410 - 215 * (step / 20));
    await evaluate(`byId('edit-curve').points[2].y=${y};selected='edit-curve';selectedIds=new Set(['edit-curve']);selectedPoint=2;selectedPoints=new Set([2]);editPoints=true;render();document.getElementById('status').textContent='拖曳錨點，曲線立即跟著改變'`);
    await capture(`anchor-${String(step).padStart(2, '0')}.png`);
  }

  // Smart fill: a real face computed from an outer boundary plus a divider.
  const fillScene = `[
    {id:'outer',type:'box',name:'外框',x:245,y:155,w:720,h:390,r:0,radius:52,fill:'#f8fafc',stroke:'#334155',strokeWidth:9,opacity:1},
    {id:'divider',type:'arrow',name:'分隔線',points:[{x:605,y:155},{x:605,y:545}],color:'#334155',width:9,curved:false,closed:false,startHead:false,endHead:false,style:'solid',fillOpacity:0}
  ]`;
  await setDemoScene(fillScene);
  await evaluate(`activePaletteColor='#22c55e';renderPalette();document.getElementById('status').textContent='把色票拖進線條圍住的區域'`);
  await capture('fill-00-before.png');
  await evaluate(`pendingRegionFace=RegionFill.find(fillNetworkFaces(),{x:420,y:350});setFillHover('network-region-preview');document.getElementById('status').textContent='放開即可填滿這個封閉區域'`);
  await capture('fill-01-hover.png');
  await evaluate(`const target={id:'network-region-preview',name:'接線圍出的區域',regionFace:pendingRegionFace};const filled=materializeFillTarget(target);applyColorToItem(filled,'#22c55e',true);selected=filled.id;selectedIds=new Set([filled.id]);selectedPoint=null;selectedPoints.clear();setFillHover(null);render();document.getElementById('status').textContent='填色完成：色塊可獨立編輯，原線條保留'`);
  await capture('fill-02-after.png');

  // Browser half of the PowerPoint story: selection, foreground copy progress, success.
  const pptScene = `[
    {id:'ppt-box',type:'box',name:'標題卡',x:215,y:175,w:330,h:190,r:-4,radius:28,fill:'#ede9fe',stroke:'#7c3aed',strokeWidth:6,opacity:1},
    {id:'ppt-circle',type:'ellipse',name:'圓形',x:675,y:165,w:210,h:210,r:0,fill:'#ccfbf1',stroke:'#0f766e',strokeWidth:6,opacity:1},
    {id:'ppt-arrow',type:'arrow',name:'箭頭',points:[{x:330,y:485},{x:590,y:390},{x:870,y:485}],color:'#f97316',width:10,curved:true,closed:false,startHead:false,endHead:true,head:18,headShape:'triangle',style:'solid',fillOpacity:0}
  ]`;
  await setDemoScene(pptScene);
  await evaluate(`selectedIds=new Set(items.map(it=>it.id));selected='ppt-arrow';selectedPoint=null;selectedPoints.clear();render();document.getElementById('status').textContent='3 個物件已選取，準備複製到 PowerPoint'`);
  await capture('ppt-00-selected.png');
  await evaluate(`setClipboardBusy(true);const bar=document.getElementById('ppt-progress');bar.hidden=false;bar.value=38;clipboardFeedback('正在複製到 PowerPoint','建立可編輯物件 1/3（38%）')`);
  await capture('ppt-01-copying.png');
  await evaluate(`document.getElementById('ppt-progress').value=76;clipboardFeedback('正在複製到 PowerPoint','建立可編輯物件 3/3（76%）')`);
  await capture('ppt-02-copying.png');
  await evaluate(`setClipboardBusy(false);document.getElementById('ppt-progress').hidden=true;clipboardFeedback('複製成功：可編輯 PPT 物件','貼到 PowerPoint 後，可分別選取與移動。','success')`);
  await capture('ppt-03-success.png');

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
