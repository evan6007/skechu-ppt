// Fetch-API service. Deploy separately from the public, static editor.
const REPOSITORY = 'evan6007/skechu-ppt';
const API = 'https://api.github.com';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const seconds = () => Math.floor(Date.now() / 1000);
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const unbase64 = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

async function key(env) {
  const bytes = unbase64(env.SESSION_SECRET);
  if (bytes.length !== 32) fail(503, '授權服務尚未設定完成');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(payload, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('skechu-star-v1') }, await key(env), encoder.encode(JSON.stringify(payload)));
  return `${base64url(iv)}.${base64url(data)}`;
}

async function unseal(value, kind, origin, env) {
  try {
    if (typeof value !== 'string' || value.length > 6000) throw new Error();
    const parts = value.split('.');
    if (parts.length !== 2) throw new Error();
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(parts[0]), additionalData: encoder.encode('skechu-star-v1') }, await key(env), unbase64(parts[1]));
    const payload = JSON.parse(decoder.decode(data));
    if (payload.kind !== kind || payload.origin !== origin || !Number.isFinite(payload.exp) || payload.exp <= seconds()) throw new Error();
    return payload;
  } catch {
    fail(401, '授權已過期，請重新連接 GitHub');
  }
}

async function body(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') fail(415, '需要 JSON 請求');
  const reader = request.body?.getReader();
  if (!reader) fail(400, '缺少請求內容');
  let text = '', size = 0;
  const utf8 = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); fail(413, '請求過大'); }
      text += utf8.decode(value, { stream: true });
    }
    text += utf8.decode();
    const result = JSON.parse(text);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
    return result;
  } catch (error) {
    if (error.status) throw error;
    fail(400, '請求格式錯誤');
  }
}

async function github(path, token, fetcher, method = 'GET') {
  const response = await fetcher(`${API}${path}`, {
    method,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'Skechu-PPT-Star', ...(method === 'PUT' ? { 'Content-Length': '0' } : {}) },
    // Workers only supports manual/follow. Manual plus strict status checks
    // refuses redirects without forwarding the token to another destination.
    redirect: 'manual', signal: AbortSignal.timeout(15000)
  });
  if (response.status === 401) fail(401, 'GitHub 授權已失效，請重新連接');
  if (response.status === 403 || response.status === 429) fail(403, 'GitHub 暫時拒絕操作，請檢查 Star 權限或稍後再試');
  return response;
}

// Dependency injection is only for tests; production can never select upstream URLs.
export function createService(fetcher = (...args) => globalThis.fetch(...args)) {
  return { async fetch(request, env) {
    let phase = 'request';
    const origin = request.headers.get('origin');
    const allowed = env.APP_ORIGIN || 'https://evan6007.github.io';
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
    if (origin === allowed) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health' && request.method === 'GET') return reply({ configured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET), repository: REPOSITORY });
      if (origin !== allowed) fail(403, '不允許的網站來源');
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' } });
      }
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) fail(503, '授權服務尚未設定完成');
      const callback = env.CALLBACK_URL || 'https://evan6007.github.io/skechu-ppt/github-callback.html';
      if (new URL(callback).origin !== allowed || new URL(callback).protocol !== 'https:') fail(503, '授權服務回傳網址設定錯誤');
      if (url.pathname === '/auth/start' && request.method === 'POST') {
        const { challenge } = await body(request);
        if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) fail(400, 'PKCE 格式錯誤');
        const state = await seal({ kind: 'oauth', origin, challenge, callback, exp: seconds() + 600 }, env);
        const target = new URL('https://github.com/login/oauth/authorize');
        target.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, state, code_challenge: challenge, code_challenge_method: 'S256' });
        return reply({ url: target.href, state });
      }
      if (url.pathname === '/auth/exchange' && request.method === 'POST') {
        phase = 'auth-validation';
        const { state, verifier, code } = await body(request);
        const login = await unseal(state, 'oauth', origin, env);
        if (login.callback !== callback || typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(verifier) || typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(code)) fail(400, '授權回傳資料錯誤');
        const challenge = base64url(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)));
        if (challenge !== login.challenge) fail(401, '授權驗證不符，請重新連接');
        phase = 'token-exchange';
        const response = await fetcher('https://github.com/login/oauth/access_token', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, redirect_uri: callback, code, code_verifier: verifier }),
          redirect: 'manual', signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) fail(502, 'GitHub 授權服務暫時無法使用');
        phase = 'token-response';
        const grant = await response.json();
        // Reject broad OAuth tokens; this service is for a least-privilege GitHub App.
        if (grant.error || typeof grant.access_token !== 'string' || !grant.access_token.startsWith('ghu_') || grant.token_type?.toLowerCase() !== 'bearer') fail(401, 'GitHub 未完成授權，請重新連接');
        const lifetime = Math.min(Number(grant.expires_in) || 28800, 28800);
        if (!Number.isFinite(lifetime) || lifetime < 60) fail(401, 'GitHub 授權已過期');
        phase = 'identity-request';
        const identity = await github('/user', grant.access_token, fetcher);
        if (!identity.ok) fail(502, '無法確認 GitHub 使用者');
        phase = 'identity-response';
        const user = await identity.json();
        if (typeof user.login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(user.login)) fail(502, 'GitHub 使用者資料錯誤');
        const exp = seconds() + lifetime - 30;
        const session = await seal({ kind: 'session', origin, token: grant.access_token, login: user.login, exp }, env);
        // No GitHub token or refresh token is returned to the editor.
        return reply({ session, login: user.login, expiresAt: exp * 1000 });
      }
      if (url.pathname === '/star' && ['GET', 'POST'].includes(request.method)) {
        phase = 'star-request';
        const session = await unseal(request.headers.get('authorization')?.replace(/^Bearer /, ''), 'session', origin, env);
        const path = `/user/starred/${REPOSITORY}`;
        if (request.method === 'POST') {
          const input = await body(request);
          if (Object.keys(input).length !== 1 || typeof input.starred !== 'boolean') fail(400, 'Star 狀態格式錯誤');
          const changed = await github(path, session.token, fetcher, input.starred ? 'PUT' : 'DELETE');
          if (changed.status !== 204) fail(502, 'GitHub 未確認 Star 操作，請稍後重新整理狀態');
          return reply({ starred: input.starred, login: session.login });
        }
        const result = await github(path, session.token, fetcher);
        if (![204, 404].includes(result.status)) fail(502, '無法讀取 GitHub Star 狀態');
        return reply({ starred: result.status === 204, login: session.login });
      }
      fail(404, '找不到此功能');
    } catch (error) {
      // Never include upstream response bodies, credentials, codes or tokens in errors/logs.
      return reply({ error: error.status ? error.message : `授權服務暫時無法使用（${phase}），請稍後再試`, ...(!error.status ? { code: `${phase}:${['TypeError','TimeoutError','AbortError','SyntaxError'].includes(error.name) ? error.name : 'Unavailable'}` } : {}) }, error.status || 502);
    }
  } };
}

export default createService();
