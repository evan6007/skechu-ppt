import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../services/github-star/worker.mjs';

const origin = 'https://evan6007.github.io';
const env = { APP_ORIGIN: origin, GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-secret', SESSION_SECRET: Buffer.alloc(32, 7).toString('base64url') };
const verifier = Buffer.alloc(32, 8).toString('base64url');
const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
function fixture() {
  const calls = [], used = new Set();
  let starred = false, revoked = false, rejectWrites = false;
  const service = createService(async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://github.com/login/oauth/access_token') {
      const input = JSON.parse(options.body);
      assert.equal(input.code_verifier, verifier);
      assert.equal(input.client_secret, env.GITHUB_CLIENT_SECRET);
      assert.equal(input.redirect_uri, `${origin}/skechu-ppt/github-callback.html`);
      if (used.has(input.code)) return Response.json({ error: 'bad_verification_code' });
      used.add(input.code);
      return Response.json({ access_token: 'ghu_test_private', refresh_token: 'ghr_never_return', token_type: 'bearer', expires_in: 28800 });
    }
    assert.equal(options.headers.Authorization, 'Bearer ghu_test_private');
    if (revoked) return Response.json({}, { status: 401 });
    if (url === 'https://api.github.com/user') return Response.json({ login: 'tester' });
    assert.equal(url, 'https://api.github.com/user/starred/evan6007/skechu-ppt');
    if (options.method !== 'GET') {
      if (rejectWrites) return Response.json({}, { status: 500 });
      starred = options.method === 'PUT';
      if (starred) assert.equal(options.headers['Content-Length'], '0');
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: starred ? 204 : 404 });
  });
  const send = (path, data, session, overrides = {}, bindings = env) => service.fetch(new Request(`https://service.example${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(session ? { Authorization: `Bearer ${session}` } : {}), ...overrides },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  }), bindings);
  const authorize = async () => {
    const started = await (await send('/auth/start', { challenge })).json();
    const authorized = await send('/auth/exchange', { state: started.state, verifier, code: 'code-1' });
    assert.equal(authorized.status, 200);
    return { ...await authorized.json(), state: started.state };
  };
  return { service, calls, send, authorize, revoke: () => { revoked = true; }, reject: () => { rejectWrites = true; } };
}

test('real protocol: PKCE login, read, star, unstar; authorization never stars', async () => {
  const f = fixture();
  const start = await f.send('/auth/start', { challenge });
  assert.equal(start.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(start.headers.get('Cache-Control'), 'no-store');
  const started = await start.json(), target = new URL(started.url);
  assert.equal(target.origin, 'https://github.com');
  assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(target.searchParams.get('scope'), null, 'GitHub App uses narrow permissions, not public_repo');
  const response = await f.send('/auth/exchange', { state: started.state, verifier, code: 'real-code' });
  const serialized = await response.text(), login = JSON.parse(serialized);
  assert.doesNotMatch(serialized, /ghu_|ghr_|test-secret/);
  assert.equal(f.calls.length, 2, 'login only exchanges code and checks identity');
  assert.ok(login.expiresAt > Date.now() && login.expiresAt <= Date.now() + 28800000);
  assert.equal((await (await f.send('/star', undefined, login.session)).json()).starred, false);
  assert.equal((await (await f.send('/star', { starred: true }, login.session)).json()).starred, true);
  assert.equal((await (await f.send('/star', undefined, login.session)).json()).starred, true);
  assert.equal((await (await f.send('/star', { starred: false }, login.session)).json()).starred, false);
});

test('reject foreign and missing origins before any upstream calls', async () => {
  const f = fixture();
  for (const Origin of ['https://evil.example', 'null', 'https://evan6007.github.io.evil.example']) {
    const result = await f.send('/auth/start', { challenge }, null, { Origin });
    assert.equal(result.status, 403);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
  }
  const missing = await f.service.fetch(new Request('https://service.example/star'), env);
  assert.equal(missing.status, 403);
  assert.equal(f.calls.length, 0);
});

test('CORS preflight is exact-origin and does not permit cookies', async () => {
  const f = fixture();
  const response = await f.service.fetch(new Request('https://service.example/star', { method: 'OPTIONS', headers: { Origin: origin } }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type');
});

test('reject tampered state, wrong verifier and used code', async () => {
  const f = fixture();
  const { state } = await (await f.send('/auth/start', { challenge })).json();
  assert.equal((await f.send('/auth/exchange', { state: `X${state.slice(1)}`, verifier, code: 'one' })).status, 401);
  assert.equal((await f.send('/auth/exchange', { state, verifier: 'x'.repeat(43), code: 'one' })).status, 401);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.send('/auth/exchange', { state, verifier, code: 'one' })).status, 200);
  assert.equal((await f.send('/auth/exchange', { state, verifier, code: 'one' })).status, 401);
});

test('sessions cannot be fabricated, used as state or bound to another origin', async () => {
  const f = fixture(), login = await f.authorize();
  assert.equal((await f.send('/star', undefined, login.state)).status, 401);
  assert.equal((await f.send('/star', undefined, 'made-up')).status, 401);
  assert.equal((await f.send('/star', undefined, `X${login.session.slice(1)}`)).status, 401);
  assert.equal((await f.send('/star', undefined, login.session, { Origin: 'https://other.example' }, { ...env, APP_ORIGIN: 'https://other.example', CALLBACK_URL: 'https://other.example/callback.html' })).status, 401);
});

test('expiry and upstream revocation remove the ability to act', async () => {
  const f = fixture(), login = await f.authorize();
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 28800001;
    assert.equal((await f.send('/star', undefined, login.session)).status, 401);
    assert.equal((await f.send('/auth/exchange', { state: login.state, verifier, code: 'later' })).status, 401);
  } finally { Date.now = realNow; }
  f.revoke();
  assert.equal((await f.send('/star', { starred: true }, login.session)).status, 401);
});

test('bounded JSON only; fixed repository and no arbitrary proxy', async () => {
  const f = fixture(), login = await f.authorize();
  assert.equal((await f.send('/star', { starred: 'true' }, login.session)).status, 400);
  assert.equal((await f.send('/star', { starred: true, repository: 'other/repo' }, login.session)).status, 400);
  assert.equal((await f.send('/anything', undefined, login.session)).status, 404);
  assert.equal((await f.send('/auth/start', { challenge }, null, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.send('/auth/start', { challenge: 'x'.repeat(9000) })).status, 413);
  assert.equal((await f.send('/auth/start', { challenge: 'wrong' })).status, 400);
});

test('failed writes never claim success or retry; unconfigured service fails closed', async () => {
  const f = fixture(), login = await f.authorize();
  f.reject();
  const before = f.calls.length;
  assert.equal((await f.send('/star', { starred: true }, login.session)).status, 502);
  assert.equal(f.calls.length, before + 1);
  assert.equal((await f.send('/auth/start', { challenge }, null, {}, {})).status, 503);
});
