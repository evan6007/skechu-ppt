(() => {
  const button = document.getElementById('github-star');
  if (!button) return;
  const storageKey = 'skechu-github-star-session-v1';
  const debounceMs = 450;
  let service = '', session = null, starred = null, busy = false, pending = null, lastRead = 0;
  let desired = null, writing = false, reading = false, revision = 0, lastIntentAt = 0;
  let noticeTimer, syncTimer, feedback;
  const notice = document.createElement('div');
  notice.className = 'github-star-notice'; notice.hidden = true;
  notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  document.body.append(notice);
  const say = text => { notice.textContent = text; notice.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 6000); };
  const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  function saveSession(value) {
    session = value;
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); } catch {}
  }
  function cancelIntent() {
    clearTimeout(syncTimer); syncTimer = null; desired = null; revision++;
  }
  function expireSession() {
    cancelIntent(); saveSession(null); starred = null;
  }
  function render() {
    const shown = desired ?? starred, syncing = desired !== null || writing;
    button.setAttribute('aria-busy', String(busy || syncing));
    button.setAttribute('data-connecting', String(busy));
    button.setAttribute('data-syncing', String(syncing));
    if (shown === null) button.removeAttribute('aria-pressed');
    else button.setAttribute('aria-pressed', String(shown));
    button.title = busy ? '正在連接 GitHub…' : !session ? '連接 GitHub 以使用 Star' : shown === null ? '重新讀取 GitHub Star 狀態' : `${shown ? '取消 Star' : 'Star'} · @${session.login}${syncing ? '（同步中…）' : ''}`;
    button.setAttribute('aria-label', button.title);
  }
  function animateToggle() {
    feedback?.cancel();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    feedback = button.querySelector('svg')?.animate?.([
      { transform: 'scale(.82)' }, { transform: 'scale(1.2)', offset: .45 }, { transform: 'scale(1)' }
    ], { duration: 220, easing: 'ease-out' });
  }
  async function api(path, data, authenticated = false) {
    const requestSession = session;
    const response = await fetch(`${service}${path}`, {
      method: data === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(authenticated ? { Authorization: `Bearer ${session?.session || ''}` } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && authenticated && session === requestSession) expireSession();
      throw new Error(result.error || 'GitHub 暫時無法連線，請稍後再試');
    }
    return result;
  }
  async function refresh() {
    if (!session) return;
    if (session.expiresAt <= Date.now()) { expireSession(); return; }
    const requestSession = session, requestRevision = revision;
    const result = await api('/star', undefined, true);
    // A read started before a click/write must not overwrite that newer intent.
    if (session !== requestSession || revision !== requestRevision) return;
    if (typeof result.starred !== 'boolean') throw new Error('無法確認 GitHub Star 狀態');
    starred = result.starred; lastRead = Date.now();
  }
  function scheduleSync() {
    clearTimeout(syncTimer);
    if (desired === null) { syncTimer = null; return; }
    syncTimer = setTimeout(() => { syncTimer = null; void sync(); }, Math.max(0, lastIntentAt + debounceMs - Date.now()));
  }
  async function sync() {
    if (writing || busy || desired === null) return;
    if (Date.now() < lastIntentAt + debounceMs) { scheduleSync(); return; }
    if (!session || session.expiresAt <= Date.now()) {
      expireSession(); render(); say('GitHub 授權已過期，請重新連接後再按 Star。'); return;
    }
    if (desired === starred) { cancelIntent(); render(); return; }
    const target = desired, requestSession = session;
    let recovering = false;
    writing = true; revision++; render();
    try {
      const result = await api('/star', { starred: target }, true);
      if (session !== requestSession) return;
      if (result.starred !== target) throw new Error('GitHub 未確認這次操作');
      starred = target; lastRead = Date.now();
      // Acknowledge the sent value, but preserve clicks made while it was in flight.
      if (desired === target) {
        cancelIntent();
        say(starred ? '已加 Star，謝謝支持！' : '已取消 Star');
      }
    } catch (error) {
      if (session && session !== requestSession) return;
      cancelIntent(); busy = true; recovering = true; render();
      // An uncertain write may have succeeded. Reconcile once; never retry it.
      if (session) try { await refresh(); } catch { starred = null; }
      say(`${error.message || '無法連接 GitHub'}${starred === null ? '；目前無法確認狀態，請稍後再試。' : '；已重新讀取 GitHub 狀態。'}`);
    } finally {
      writing = false;
      if (recovering) busy = false;
      if (desired !== null) scheduleSync();
      render();
    }
  }
  function finishLogin() {
    if (!pending) return;
    clearTimeout(pending.timer); pending.popup?.close(); pending = null;
  }
  async function receive(message, source) {
    if (!pending || pending.completing || !pending.state || message?.type !== 'skechu-github-auth' || message.state !== pending.state || (source && source !== pending.popup)) return;
    pending.completing = true;
    try {
      if (message.error) throw new Error('已取消 GitHub 授權');
      const result = await api('/auth/exchange', { code: message.code, state: pending.state, verifier: pending.verifier });
      if (typeof result.session !== 'string' || typeof result.login !== 'string' || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw new Error('GitHub 授權回應不完整');
      saveSession(result);
      await refresh();
      // Authorization alone never changes stars, including already-starred repos.
      say(starred ? '已連接 GitHub，這個專案已加 Star。' : '已連接 GitHub，現在可按 Star 加星。');
    } catch (error) { say(error.message); }
    finally { finishLogin(); busy = false; render(); }
  }
  window.addEventListener('message', event => { if (event.origin === location.origin) receive(event.data, event.source); });
  try { const channel = new BroadcastChannel('skechu-github-auth'); channel.onmessage = event => receive(event.data); } catch {}
  async function login() {
    // Open synchronously from the click so mobile popup blockers can allow it.
    const popup = window.open('about:blank', '_blank', 'popup,width=600,height=740');
    if (!popup) throw new Error('請允許 GitHub 授權視窗，再按 Star。');
    pending = { popup, state: '', verifier: base64url(crypto.getRandomValues(new Uint8Array(32))) };
    popup.document.title = '連接 GitHub · Skechu-PPT';
    popup.document.body.textContent = '正在前往 GitHub 授權…';
    const attempt = pending;
    attempt.timer = setTimeout(() => { if (pending === attempt) { finishLogin(); busy = false; render(); say('授權等候已結束，請再按 Star。'); } }, 180000);
    const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(attempt.verifier)));
    const result = await api('/auth/start', { challenge });
    const target = new URL(result.url);
    if (target.origin !== 'https://github.com' || target.pathname !== '/login/oauth/authorize' || typeof result.state !== 'string' || target.searchParams.get('state') !== result.state) throw new Error('GitHub 授權網址不正確');
    if (pending !== attempt) return;
    attempt.state = result.state;
    popup.location.replace(target.href);
  }
  button.addEventListener('click', async event => {
    if (!service) return; // Until configured, keep the truthful repository link.
    event.preventDefault();
    if (busy) {
      if (pending?.popup?.closed) { finishLogin(); busy = false; render(); say('授權視窗已關閉，請再按 Star 重新連接。'); }
      else pending?.popup?.focus();
      return;
    }
    if (session && session.expiresAt > Date.now() && starred !== null) {
      desired = !(desired ?? starred); revision++; lastIntentAt = Date.now();
      clearTimeout(noticeTimer); notice.hidden = true;
      render(); animateToggle(); scheduleSync(); return;
    }
    busy = true; render();
    try {
      if (!session || session.expiresAt <= Date.now()) {
        expireSession(); await login(); return;
      }
      // Unknown state needs a read, not a guessed toggle. Login itself never stars.
      await refresh();
      say('已更新 GitHub 狀態，現在可按 Star。');
    } catch (error) {
      finishLogin();
      say(error.message || '無法連接 GitHub，請稍後再試');
    } finally { if (!pending) { busy = false; render(); } }
  });
  button.addEventListener('keydown', event => { if (service && event.key === ' ') { event.preventDefault(); button.click(); } });
  window.addEventListener('focus', async () => {
    if (!service || !session || busy || reading || writing || desired !== null || Date.now() - lastRead < 10000) return;
    const requestRevision = revision;
    reading = true;
    try { await refresh(); } catch { if (revision === requestRevision) starred = null; }
    finally { reading = false; render(); }
  });
  async function initialize() {
    try {
      const config = await fetch('./github-star-config.json', { cache: 'no-store', credentials: 'omit' }).then(response => response.ok ? response.json() : null);
      if (!config?.serviceUrl) return;
      const url = new URL(config.serviceUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return;
      service = url.origin;
      // Only the public hosted editor gets OAuth; desktop still links to GitHub.
      if (location.origin !== 'https://evan6007.github.io') { service = ''; return; }
      button.setAttribute('role', 'button');
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (saved && typeof saved.session === 'string' && typeof saved.login === 'string' && Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now()) session = saved;
      } catch {}
      busy = !!session; render();
      if (session) await refresh();
    } catch { starred = null; }
    finally { busy = false; if (service) render(); }
  }
  initialize();
})();
