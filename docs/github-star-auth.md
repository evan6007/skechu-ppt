# Optional GitHub Star authorization

Drawing remains local-first and does not require login. The brand opens the repository. The Star action stays between the brand and Select tool.

## Status and activation

The code supports a real per-user Star toggle. **An empty `app/github-star-config.json` service URL deliberately keeps the existing GitHub link.** A working deployment needs both a GitHub App and the separately deployed service. Do not describe the feature as live until a real authorization, GET, PUT and DELETE have been checked.

Production configuration uses [Skechu-PPT Star](https://github.com/apps/skechu-ppt-star) and the dedicated `skechu-github-star.evan6007.workers.dev` service. On 2026-09-05, live authorization, reading the current state, removing a star and adding it back passed through the hosted editor. Independent GitHub API checks confirmed both changes; the test account's original starred state was restored. The following steps document re-deployment or self-hosting; no secret values are stored here.

1. Register a **GitHub App**, not an OAuth App, under the project owner. Use a name such as `Skechu-PPT Star`, homepage `https://evan6007.github.io/skechu-ppt/`, and callback `https://evan6007.github.io/skechu-ppt/github-callback.html`.
2. Enable **Account permissions → Starring → Read and write** and **Repository permissions → Metadata → Read-only**. Leave repository contents, email, organization permissions and webhooks off. Keep user-token expiration enabled; device flow is not needed. Make the app public. The repository owner must install it using **Only select repositories → evan6007/skechu-ppt**, not all repositories: Starring alone allowed login and reads but returned 403 on writes in live testing. Visitors authorize their account's Starring permission; they do not need to install the app into their own repositories.
3. Deploy `services/github-star/worker.mjs` to a dedicated Cloudflare Worker using its `wrangler.jsonc`. Do not change an existing unrelated Worker.
4. Set Worker secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` (32 cryptographically random bytes, base64url encoded). Never put secrets in `vars`, this repository, the static editor, GitHub issue text, or chat. Use Cloudflare secrets or `wrangler secret put` via private input.
5. Verify `/health` returns `configured: true`. Set `app/github-star-config.json` to `{ "serviceUrl": "https://YOUR-WORKER.workers.dev" }` and publish Pages. Only the HTTPS service origin is configurable; repository and GitHub upstream endpoints are fixed in the service.
6. In the real hosted editor, click Star, authorize on GitHub, and confirm the actual state is rendered. Authorization by itself never adds or removes a star. Subsequent clicks immediately toggle the displayed state with a small animation, then synchronize after 450 ms without another click. Check both directions and return a test account to its initial state.

## Immediate feedback and background synchronization

- The button keeps the last confirmed GitHub state separate from the user's pending choice. Yellow/outline feedback is immediate; a small corner dot and the tooltip indicate pending synchronization. Reduced-motion preferences disable the bounce.
- Repeated clicks restart a 450 ms quiet period. Only the final choice is sent; returning to the confirmed state before sending requires no write. There is no extra blocking GET before each click.
- Writes are serialized. Clicking during an in-flight write remains responsive, and its response cannot overwrite a newer choice. A necessary follow-up waits for the latest quiet period. Focus refreshes also cannot overwrite newer clicks or writes.
- Failure discards pending choices and reads GitHub once to reconcile. If that read fails too, the state becomes unknown with an explanation instead of showing a false success. Neither failures nor login automatically retry a write; another deliberate click is required.

## Security and data boundary

- Authorization code flow uses a random PKCE verifier and S256 challenge. The service issues authenticated, encrypted, ten-minute state; the originating tab also checks an exact state match before exchanging the code. Replaying a used GitHub code must fail upstream.
- Only `https://evan6007.github.io` can call the deployed service from a browser. State and sessions are bound to that origin. No wildcard CORS, arbitrary callback, arbitrary repository, or generic GitHub proxy is provided. Other projects on the same GitHub Pages origin share the browser security boundary: keep all owner-hosted scripts trusted.
- A short-lived AES-GCM-sealed session is stored in the editor's **sessionStorage**, not localStorage. It is a bearer credential and must be protected from XSS, even though the GitHub token cannot be read without the server key. This avoids third-party-cookie dependence on mobile browsers.
- Raw GitHub tokens and refresh tokens never enter frontend responses. No refresh token is retained; sessions expire within eight hours or earlier if GitHub revokes the token. Closing the tab drops the session. Users can revoke the app under GitHub Settings → Applications → Authorized GitHub Apps.
- Request bodies are size-limited. Errors contain no raw upstream bodies, tokens or authorization codes. Do not enable request-body or authorization-header logging. Callback HTML removes its query immediately and disables referrers. Service worker does not cache callback URLs or activation config.
- Network failures never silently re-send a Star write. The client re-reads state, and only another deliberate click may write again. An expired or revoked authorization returns to sign-in instead of showing a fictitious success.
- This optional service receives GitHub identity and Star requests only, never artwork, projects, PPT data or Windows-bridge credentials. The Windows/native path remains an ordinary repository link.

## Verification

Run `node --test tests/github_star_service.test.mjs tests/github_star_client.test.mjs` and `node tests/check_app.mjs`. Client tests use a controllable clock and delayed responses to cover rapid clicks, quiet periods, serialized writes, stale reads, rollback and reduced motion. Unit tests use a fake GitHub upstream; they do not log in, add stars, or validate a real deployed GitHub App. Live OAuth acceptance must be checked separately.

Cloudflare Workers requires upstream requests to use `redirect: 'manual'` rather than the browser/Node `redirect: 'error'` option. The service rejects unexpected response statuses without following a redirect or forwarding credentials. A regression test covers both the token exchange and authenticated GitHub API requests.

References: [GitHub App user authorization](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app), [Starring REST API](https://docs.github.com/en/rest/activity/starring), [App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
