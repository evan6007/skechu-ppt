(() => {
  const params = new URLSearchParams(location.search);
  const message = { type: 'skechu-github-auth', state: params.get('state'), code: params.get('code'), error: params.has('error') ? 'access_denied' : '' };
  // Remove the one-use code before any user navigation or history entry can leak it.
  history.replaceState(null, '', location.pathname);
  if (!message.state) {
    document.getElementById('github-callback-status').textContent = '沒有待完成的授權，請回原本的 Skechu-PPT 頁面按 Star。';
    return;
  }
  if (window.opener) window.opener.postMessage(message, location.origin);
  // GitHub/login COOP can sever window.opener. Same-origin channel plus exact
  // unpredictable state matching lets the original tab finish without it.
  let channel;
  try { channel = new BroadcastChannel('skechu-github-auth'); channel.postMessage(message); } catch {}
  document.getElementById('github-callback-status').textContent = message.error ? '已取消授權，可以關閉此頁。' : '已送回授權結果，請回原本的 Skechu-PPT 頁面。';
  setTimeout(() => { channel?.close(); window.close(); }, 250);
})();
