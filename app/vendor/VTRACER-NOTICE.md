# VTracer

- Source: https://github.com/visioncortex/vtracer
- Package: `@visioncortex/vtracer@1.0.0-alpha.4` (pinned WebAssembly build).
- License chosen: MIT; see `VTRACER-LICENSE.txt`.
- `vtracer.wasm` is the unmodified `pkg/vtracer_wasm_bg.wasm` from that npm package.
- SHA-256: `63716b70497b7468ef97545b50f5f34b8bbb7acde2d7b00deb4eb40781446d45`.
- `vtracer.js` adapts the package's wasm-bindgen glue: no Node filesystem imports;
  the editor loads local bytes on demand and initializes WebAssembly in a worker.
- The adapter in `../illustration-trace.js` converts the engine's SVG paths to
  editable Skechu anchors. No image data is sent to VTracer or any remote service.

The alpha engine is isolated to the new illustration mode. Existing line-art,
logo-contour and photo modes retain their original engines.
