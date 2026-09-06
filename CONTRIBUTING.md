# Contributing

Thanks for helping improve Skechu-PPT.

1. Search existing issues before opening a new one.
2. Include Windows version, browser version, PowerPoint version, and a minimal project file when reporting export bugs.
3. Fork the repository and create a focused branch.
4. Run `python -m compileall app tests` and `node tests/check_app.mjs` before opening a pull request.
5. Keep pull requests small enough to review and explain the user-visible behavior.

For curve, fill or scissors changes, also run `node tests/check_regions.mjs`, `node tests/check_cut_tools.mjs` and `node tests/check_touch_gestures.mjs`.

For tracing changes, run `node tests/check_auto_trace.mjs` and `node tests/check_illustration_trace.mjs`. The illustration checks cover local WASM/worker parity, small noisy oval details, transparent edges, closed regions, holes and native PowerPoint curve coordinates. Keep `app/vendor/VTRACER-NOTICE.md`, the upstream license and the pinned WASM hash together when updating that dependency.

The optional browser regression requires Playwright and Chrome. Serve `app/` with `python -m http.server 8767 --bind 127.0.0.1 --directory app`, then run `node tests/check_cut_browser.mjs` in another terminal. It uses isolated test storage and checks real mouse/touch gestures, the starter-brain fill regression and compact mobile controls. Screenshots go to the ignored `.codex-tmp/` directory; existing projects are not opened.

With the same server, `node tests/check_illustration_browser.mjs` exercises a generated test image through the real preview, automatic colors, apply, bucket, manual outline fill and undo controls. No private reference image is needed or committed.

For image-edge closure, run `node tests/check_trace_boundary.mjs` and `node tests/check_trace_boundary_browser.mjs`. The browser check exercises the default checkbox, opt-out, exact source-boundary fill, background/outside containment and undo on a generated image. `node tests/check_nested_fill_browser.mjs` checks continuous nested painting. Experimental anime post-processing has separate synthetic checks in `tests/check_anime_refine.mjs`.

Do not submit copyrighted reference images, private research figures, credentials, or generated PowerPoint files containing confidential material. By contributing, you agree that your contribution is licensed under the repository's MIT License.
