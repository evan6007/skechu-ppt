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
  '--headless=new',
  '--disable-gpu',
  '--disable-background-networking',
  '--disable-component-update',
  '--force-device-scale-factor=1',
  '--window-size=1920,1080',
  `--remote-debugging-port=${port}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  'http://127.0.0.1:8766/?capture=showcase-v1',
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
    socket.onopen = resolve;
    socket.onerror = reject;
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    };
  });
  await command('Page.enable');
  await command('Runtime.enable');
  await command('DOM.enable');
  await waitFor('document.readyState === "complete"');

  const { root } = await command('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await command('DOM.querySelector', { nodeId: root.nodeId, selector: '#load-json' });
  await command('DOM.setFileInputFiles', { nodeId, files: [path.resolve(projectFile)] });
  await evaluate(`document.getElementById('load-json').dispatchEvent(new Event('change',{bubbles:true}))`);
  await waitFor(`document.querySelectorAll('#workspace-pages [data-page-id]').length >= 2`);
  await evaluate(`document.querySelectorAll('#workspace-pages [data-page-id]')[1].click()`);
  await waitFor(`document.querySelectorAll('#workspace-pages [data-page-id]')[1].classList.contains('active')`);
  await evaluate(`document.getElementById('fit-view').click();document.querySelector('.export-menu').open=false`);
  await delay(800);

  await capture('01-editor.png');
  await evaluate(`if(document.getElementById('toggle-grid').getAttribute('aria-pressed')!=='true')document.getElementById('toggle-grid').click()`);
  await delay(450);
  await capture('02-grid.png');
  await evaluate(`document.getElementById('select-all').click()`);
  await delay(700);
  await capture('03-anchors.png');
  await evaluate(`document.getElementById('add-shape').click()`);
  await delay(350);
  await capture('04-shapes.png');

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
