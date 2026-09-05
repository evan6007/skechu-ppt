import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../app/github-star.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function setup({ configured = true, stored = false, expired = false, mutateError = false } = {}) {
  const events = {}, attributes = {}, windowEvents = {}, requests = [], storage = new Map(), notices = [];
  const saved = { session: 'sealed-session', login: 'tester', expiresAt: Date.now() + (expired ? -1000 : 60000) };
  if (stored) storage.set('skechu-github-star-session-v1', JSON.stringify(saved));
  let isStarred = false, popup = null, state = '';
  const button = { addEventListener: (k, fn) => { events[k] = fn; }, setAttribute: (k, v) => { attributes[k] = v; }, removeAttribute: k => { delete attributes[k]; } };
  const context = vm.createContext({
    URL, URLSearchParams, TextEncoder, Uint8Array, crypto, btoa, Date, AbortSignal,
    setTimeout: fn => ({ fn }), clearTimeout: () => {},
    location: { origin: 'https://evan6007.github.io' },
    document: { getElementById: () => button, createElement: () => ({ setAttribute() {}, set textContent(v) { notices.push(v); } }), body: { append() {} } },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { addEventListener: (k, v) => { windowEvents[k] = v; }, open: () => (popup = { document: { body: {} }, location: { replace() {} }, close() {}, focus() {} }) },
    fetch: async (url, options = {}) => {
      requests.push({ url, ...options });
      if (url === './github-star-config.json') return Response.json({ serviceUrl: configured ? 'https://star.example' : '' });
      if (url.endsWith('/auth/start')) {
        state = `state-${JSON.parse(options.body).challenge}`;
        return Response.json({ url: `https://github.com/login/oauth/authorize?state=${state}`, state });
      }
      if (url.endsWith('/auth/exchange')) return Response.json(saved);
      if (options.method === 'POST') {
        isStarred = JSON.parse(options.body).starred;
        if (mutateError) throw new Error('Connection interrupted');
      }
      return Response.json({ starred: isStarred, login: 'tester' });
    }
  });
  vm.runInContext(code, context);
  const click = async () => { let prevented = false; await events.click({ preventDefault() { prevented = true; } }); return prevented; };
  return { requests, attributes, storage, notices, click, events: windowEvents, popup: () => popup, state: () => state };
}

test('unconfigured editor keeps the actual repository link, no fake starred state', async () => {
  const f = setup({ configured: false }); await settle();
  assert.equal(await f.click(), false);
  assert.equal(f.attributes['aria-pressed'], undefined);
  assert.equal(f.requests.length, 1);
});

test('stored session reads real state; one click stars and another unstars', async () => {
  const f = setup({ stored: true }); await settle();
  assert.equal(f.attributes['aria-pressed'], 'false');
  await f.click();
  assert.equal(f.attributes['aria-pressed'], 'true');
  await f.click();
  assert.equal(f.attributes['aria-pressed'], 'false');
  assert.equal(f.requests.filter(r => r.url.endsWith('/star') && r.method === 'POST').length, 2);
});

test('login requires correct origin, source and state and never auto-stars', async () => {
  const f = setup(); await settle();
  assert.equal(await f.click(), true);
  const result = { type: 'skechu-github-auth', state: f.state(), code: 'github-code' };
  f.events.message({ origin: 'https://evil.example', data: result, source: f.popup() });
  f.events.message({ origin: 'https://evan6007.github.io', data: { ...result, state: 'wrong' }, source: f.popup() });
  f.events.message({ origin: 'https://evan6007.github.io', data: result, source: {} });
  await settle();
  assert.equal(f.requests.filter(r => r.url.endsWith('/auth/exchange')).length, 0);
  f.events.message({ origin: 'https://evan6007.github.io', data: result, source: f.popup() });
  f.events.message({ origin: 'https://evan6007.github.io', data: result, source: f.popup() });
  await settle();
  assert.equal(f.requests.filter(r => r.url.endsWith('/auth/exchange')).length, 1);
  assert.equal(f.requests.filter(r => r.url.endsWith('/star') && r.method === 'POST').length, 0);
  assert.equal(f.attributes['aria-pressed'], 'false');
  assert.equal(f.attributes['aria-busy'], 'false');
});

test('denied authorization does not mutate stars or persist credentials', async () => {
  const f = setup(); await settle(); await f.click();
  f.events.message({ origin: 'https://evan6007.github.io', data: { type: 'skechu-github-auth', state: f.state(), error: 'access_denied' }, source: f.popup() });
  await settle();
  assert.equal(f.storage.size, 0);
  assert.equal(f.attributes['aria-busy'], 'false');
  assert.equal(f.requests.filter(r => r.url.endsWith('/star')).length, 0);
});

test('expired sessions require login; uncertain writes read back without retry', async () => {
  const expired = setup({ stored: true, expired: true }); await settle(); await expired.click();
  assert.equal(expired.requests.filter(r => r.url.endsWith('/star')).length, 0);
  const f = setup({ stored: true, mutateError: true }); await settle(); await f.click();
  assert.equal(f.requests.filter(r => r.url.endsWith('/star') && r.method === 'POST').length, 1);
  assert.equal(f.attributes['aria-pressed'], 'true', 'reconciles a successful write with a lost response');
});
