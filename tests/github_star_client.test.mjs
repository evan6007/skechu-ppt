import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../app/github-star.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function setup({ configured = true, stored = false, expired = false, mutateError = false, reducedMotion = false } = {}) {
  const events = {}, attributes = {}, windowEvents = {}, requests = [], storage = new Map(), notices = [];
  let now = Date.now(), timerId = 0, animations = 0, activeWrites = 0, maxActiveWrites = 0;
  const timers = new Map(), readGates = [], writeGates = [], readErrors = [], writeErrors = [];
  class Clock extends Date { static now() { return now; } }
  const saved = { session: 'sealed-session', login: 'tester', expiresAt: now + (expired ? -1000 : 60000) };
  if (stored) storage.set('skechu-github-star-session-v1', JSON.stringify(saved));
  let isStarred = false, popup = null, state = '';
  const button = {
    addEventListener: (k, fn) => { events[k] = fn; }, setAttribute: (k, v) => { attributes[k] = v; }, removeAttribute: k => { delete attributes[k]; },
    querySelector: () => ({ animate() { animations++; return { cancel() {} }; } })
  };
  const context = vm.createContext({
    URL, URLSearchParams, TextEncoder, Uint8Array, crypto, btoa, Date: Clock, AbortSignal,
    setTimeout: (fn, ms = 0) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; }, clearTimeout: id => timers.delete(id),
    location: { origin: 'https://evan6007.github.io' },
    document: { getElementById: () => button, createElement: () => ({ setAttribute() {}, set textContent(v) { notices.push(v); } }), body: { append() {} } },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    window: { addEventListener: (k, v) => { windowEvents[k] = v; }, matchMedia: () => ({ matches: reducedMotion }), open: () => (popup = { document: { body: {} }, location: { replace() {} }, close() {}, focus() {} }) },
    fetch: async (url, options = {}) => {
      requests.push({ url, ...options });
      if (url === './github-star-config.json') return Response.json({ serviceUrl: configured ? 'https://star.example' : '' });
      if (url.endsWith('/auth/start')) {
        state = `state-${JSON.parse(options.body).challenge}`;
        return Response.json({ url: `https://github.com/login/oauth/authorize?state=${state}`, state });
      }
      if (url.endsWith('/auth/exchange')) return Response.json(saved);
      if (options.method === 'POST') {
        const gate = writeGates.shift(), error = writeErrors.shift();
        activeWrites++; maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        try {
          if (gate) await gate.promise;
          if (error) return Response.json({ error: 'GitHub rejected the write' }, { status: error });
          isStarred = JSON.parse(options.body).starred;
          if (mutateError) throw new Error('Connection interrupted');
          return Response.json({ starred: isStarred, login: 'tester' });
        } finally { activeWrites--; }
      }
      const captured = isStarred, gate = readGates.shift(), error = readErrors.shift();
      if (gate) await gate.promise;
      if (error) throw new Error('Read unavailable');
      return Response.json({ starred: captured, login: 'tester' });
    }
  });
  vm.runInContext(code, context);
  const click = async () => { let prevented = false; await events.click({ preventDefault() { prevented = true; } }); return prevented; };
  const advance = async ms => {
    const end = now + ms;
    for (let count = 0; count < 1000; count++) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { now = end; await settle(); return; }
      now = next[1].at; timers.delete(next[0]); next[1].fn(); await settle();
    }
    throw new Error('Timer loop');
  };
  const hold = queue => { const gate = deferred(); queue.push(gate); return gate; };
  return {
    requests, attributes, storage, notices, click, advance, events: windowEvents, popup: () => popup, state: () => state,
    writes: () => requests.filter(r => r.url.endsWith('/star') && r.method === 'POST').map(r => JSON.parse(r.body).starred),
    holdRead: () => hold(readGates), holdWrite: () => hold(writeGates), rejectWrite: status => writeErrors.push(status), failRead: () => readErrors.push(true),
    serverStarred: () => isStarred, animations: () => animations, maxActiveWrites: () => maxActiveWrites
  };
}

test('unconfigured editor keeps the actual repository link, no fake starred state', async () => {
  const f = setup({ configured: false }); await settle();
  assert.equal(await f.click(), false);
  assert.equal(f.attributes['aria-pressed'], undefined);
  assert.equal(f.requests.length, 1);
});

test('click responds instantly, then syncs after 450ms without an extra preflight read', async () => {
  const f = setup({ stored: true }); await settle();
  assert.equal(f.attributes['aria-pressed'], 'false');
  await f.click();
  assert.equal(f.attributes['aria-pressed'], 'true');
  assert.equal(f.attributes['data-syncing'], 'true');
  assert.equal(f.animations(), 1);
  assert.deepEqual(f.writes(), []);
  await f.advance(449);
  assert.deepEqual(f.writes(), []);
  await f.advance(1);
  assert.deepEqual(f.writes(), [true]);
  assert.equal(f.attributes['data-syncing'], 'false');
  assert.equal(f.requests.filter(r => r.url.endsWith('/star') && r.method === 'GET').length, 1);
  await f.click();
  assert.equal(f.attributes['aria-pressed'], 'false');
  await f.advance(450);
  assert.deepEqual(f.writes(), [true, false]);
});

test('a burst restarts the quiet period and only sends its final state', async () => {
  const f = setup({ stored: true }); await settle();
  for (let i = 0; i < 11; i++) {
    await f.click();
    assert.equal(f.attributes['aria-pressed'], String(i % 2 === 0));
    await f.advance(100);
  }
  assert.deepEqual(f.writes(), []);
  await f.advance(350);
  assert.deepEqual(f.writes(), [true]);
  assert.equal(f.animations(), 11);
  assert.equal(f.serverStarred(), true);
});

test('toggling back before sending avoids an unnecessary GitHub write', async () => {
  const f = setup({ stored: true }); await settle();
  await f.click(); await f.click(); await f.advance(450);
  assert.deepEqual(f.writes(), []);
  assert.equal(f.attributes['aria-pressed'], 'false');
  assert.equal(f.attributes['aria-busy'], 'false');
});

test('clicks during a write stay responsive and the old response cannot replace the final choice', async () => {
  const f = setup({ stored: true }); await settle();
  const first = f.holdWrite(), second = f.holdWrite();
  await f.click(); await f.advance(450);
  await f.click(); await f.advance(450);
  assert.equal(f.attributes['aria-pressed'], 'false');
  assert.deepEqual(f.writes(), [true], 'writes must be serialized');
  first.resolve(); await settle();
  assert.equal(f.attributes['aria-pressed'], 'false', 'older true response must not flash on screen');
  await f.advance(0);
  assert.deepEqual(f.writes(), [true, false]);
  second.resolve(); await settle();
  assert.equal(f.serverStarred(), false);
  assert.equal(f.attributes['data-syncing'], 'false');
  assert.equal(f.maxActiveWrites(), 1);
});

test('a completed write still waits for the latest click quiet period', async () => {
  const f = setup({ stored: true }); await settle();
  const first = f.holdWrite();
  await f.click(); await f.advance(450); await f.click();
  await f.advance(100); first.resolve(); await settle();
  await f.advance(349);
  assert.deepEqual(f.writes(), [true]);
  await f.advance(1);
  assert.deepEqual(f.writes(), [true, false]);
});

test('clicking back to the in-flight target does not send another write', async () => {
  const f = setup({ stored: true }); await settle();
  const first = f.holdWrite();
  await f.click(); await f.advance(450);
  await f.click(); await f.click(); await f.advance(450);
  first.resolve(); await settle(); await f.advance(1000);
  assert.deepEqual(f.writes(), [true]);
  assert.equal(f.attributes['aria-pressed'], 'true');
});

test('a stale focus read cannot overwrite a newer click or completed write', async () => {
  const f = setup({ stored: true }); await settle(); await f.advance(10000);
  const read = f.holdRead(); f.events.focus(); await settle();
  await f.click(); await f.advance(450);
  read.resolve(); await settle();
  assert.equal(f.attributes['aria-pressed'], 'true');
  assert.equal(f.serverStarred(), true);
});

test('rejected writes roll back using GitHub state and discard queued clicks', async () => {
  const f = setup({ stored: true }); await settle();
  const write = f.holdWrite(); f.rejectWrite(403);
  await f.click(); await f.advance(450); await f.click(); await f.click();
  write.resolve(); await settle(); await f.advance(1000);
  assert.deepEqual(f.writes(), [true]);
  assert.equal(f.attributes['aria-pressed'], 'false');
  assert.equal(f.attributes['data-syncing'], 'false');
  assert.ok(f.notices.some(text => text.includes('已重新讀取')));
});

test('failed reconciliation shows unknown instead of pretending the optimistic state succeeded', async () => {
  const f = setup({ stored: true }); await settle();
  f.rejectWrite(403); f.failRead();
  await f.click(); await f.advance(450); await f.advance(1000);
  assert.equal(f.attributes['aria-pressed'], undefined);
  assert.deepEqual(f.writes(), [true]);
  assert.ok(f.notices.some(text => text.includes('無法確認狀態')));
});

test('revoked authorization clears optimistic state without retrying writes', async () => {
  const f = setup({ stored: true }); await settle(); f.rejectWrite(401);
  await f.click(); await f.advance(450);
  assert.equal(f.attributes['aria-pressed'], undefined);
  assert.equal(f.storage.size, 0);
  assert.deepEqual(f.writes(), [true]);
});

test('reduced motion keeps the instant color response without a bounce', async () => {
  const f = setup({ stored: true, reducedMotion: true }); await settle(); await f.click();
  assert.equal(f.attributes['aria-pressed'], 'true');
  assert.equal(f.animations(), 0);
  await f.advance(450); assert.deepEqual(f.writes(), [true]);
});

test('an old write failure cannot cancel a new login after the session expires', async () => {
  const f = setup({ stored: true }); await settle();
  const write = f.holdWrite(); f.rejectWrite(403);
  await f.click(); await f.advance(450); await f.advance(60000); await f.click();
  assert.ok(f.popup());
  write.resolve(); await settle();
  assert.equal(f.attributes['aria-busy'], 'true', 'the new authorization is still pending');
  assert.equal(f.attributes['aria-pressed'], undefined);
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
  const f = setup({ stored: true, mutateError: true }); await settle(); await f.click(); await f.advance(450); await f.advance(1000);
  assert.equal(f.requests.filter(r => r.url.endsWith('/star') && r.method === 'POST').length, 1);
  assert.equal(f.attributes['aria-pressed'], 'true', 'reconciles a successful write with a lost response');
});
