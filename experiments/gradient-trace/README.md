# Gradient-field filling: development history

The separate [single-domain 2D color-field experiment](COLOR_FIELD_2D.md)
investigates multi-directional shading and the PowerPoint editability tradeoff.
The v91 web release exposes it only with `?experiments=1`, under
**研究：二維色場 · 僅預覽**, with explicit user-selected regions, original
comparison and no Apply/PPT export. The normal menu offers usable
[detail-first native gradients](../../docs/native-fill.md). The v84
editable-region results below are historical measurements.

The shading engine now infers **gradient regions directly**, rather than tracing
flat-color layers and pruning overlaps afterward. The former stack compactor is
not in production code. The v91 web release includes its detail-first successor;
this document records the earlier algorithm and its limitations.

## Pipeline

- `app/gradient-regions.js` fits local affine RGB fields and connected pixel
  responsibilities. Regular spatial seeds are supplemented by source residuals,
  so a small contrasting island need not coincide with a grid seed.
- Source reconstruction error and boundary length determine pixel ownership.
  Antialiased intermediate colors can be explained as partial coverage of two
  neighbouring fields, rather than a third material. Darker strokes / brighter
  reflections outside that color segment do not qualify for this coverage test.
- Adjacent regions are tested against a joint multistop model **before any vector
  objects exist**. Both regions have their own error checks; a large background
  cannot simply average a small region out of a pooled mean.
- `app/source-gradient.js` fits solid colors or 2/4/6/8-stop linear gradients.
  An RGB plane proposes the direction; regularized least squares fits the stops.
  A modest complexity penalty avoids unnecessary stops. Compatible weak-boundary
  samples couple neighbouring fits; this is not a global continuity guarantee.
- Each boundary chain is fitted once and reused in reverse by its neighbour.
  Closed outer loops and real holes produce editable zero-outline fill objects.
  Every source pixel has exactly one label; there is no hidden underpaint stack.
- Opaque, unchanged partitions use additive antialias coverage in an isolated
  SVG group to avoid white gutters. This adds no geometry. Moving/editing an
  object's geometry or transparency returns that object to ordinary compositing.
  Browser coverage compositing is not an Office feature or an extra PPT layer.
- Work runs in a cancellable Worker with pixel, field, candidate, boundary,
  object and anchor budgets. Gradient mode no longer downloads VTracer WASM;
  the separate flat-region / illustration modes still use it.

The same engine is used by preview, apply, HTTP/Blob workers and the opt-in
`trace_image` automation API. The original reference and existing line art are
not rewritten. Existing projects do not get automatically regenerated.

## Controls and limits

- More **插畫細節** lowers the permitted field error. **細節清理** controls
  source denoising and boundary regularization, not a post-hoc object count cap.
- **曲線柔順** and **錨點精簡** affect shared curve fitting, not color quantization.
- These are piecewise **linear** multistop fields, not a full 2D gradient mesh or
  a semantic anime model. Radial glints, transparent lenses and textured clouds
  still require multiple regions and sometimes manual correction.
- Object count is **not guaranteed to decrease**. Higher fidelity can retain
  more genuine boundaries. No claim of perfect reconstruction or a publishable
  novel research algorithm is made.
- Independent object/gradient data are included in SVG, project files and the
  native export payload. Native PowerPoint rendering was **not visually tested**
  for this build; browser antialias compositing is not exported to native shapes.
- Transparent sources require the flat-region mode. Explicit gradient mode reports
  this requirement instead of silently changing the reference's transparency.

## Local measurements, 2026-09-07

Same source files, image dimensions, renderer and ordinary default parameters.
Private artwork and derived outputs remain in the ignored `.codex-tmp/` folder.

| Image | v83 objects | Gradient-field objects | v83 RGB RMSE | Field RGB RMSE |
| --- | ---: | ---: | ---: | ---: |
| 640 × 360 color illustration | 738 | 694 | 5.55 | 4.73 |
| 1024 × 1006 color illustration | 1011 | 1285 | 7.70 | 5.63 |

The fixed eye-reporting crop of the first image measured 6.11 → 5.77 RMSE.
The crop is used **only for reporting**, never passed to the algorithm. These are
pixel reconstruction checks, not proof of semantic correctness or general
perceptual superiority. In particular, the second image still has too many
objects for the desired editing experience. The runs took approximately 13 and
20 seconds on this local desktop; mobile/other-host speed is not guaranteed.

Dense-group selection is a separate editor fix: selecting 1200 synthetic
24-anchor regions creates 3 selection overlay nodes rather than one DOM target
per anchor. A local browser run measured roughly 8 ms to select and 11 ms to
delete; copy, exact Undo/Redo, and single-object anchor editing were checked.
No source objects are removed or simplified by this selection optimization.
The 1285-object illustration itself was also tested: about 51 ms to select,
38 ms to delete, and 326 ms to restore the exact project with Undo on this host.
At the second source's full 1080 × 1061 resolution, the real UI generated 1480
fill objects. This remains an open object-count limitation, not a claimed fix.

## Reproduce

Node 22, Playwright and Chrome are used for browser tests. Start the loopback
server with explicit JS MIME types:

```powershell
node tests/serve_app.mjs
```

In another terminal:

```powershell
$env:SKECHU_TEST_URL = 'http://127.0.0.1:18782/'
node tests/check_source_gradients.mjs
node tests/check_source_gradient_browser.mjs
node tests/check_dense_groups_browser.mjs
node tests/check_split_trace_fill_browser.mjs
node experiments/gradient-trace/evaluate.mjs PATH_TO_IMAGE .codex-tmp/field-evaluation
```

The evaluator writes editable `.skc`, SVG, renderer-based comparisons, screenshots,
a native payload, and metrics. It does not write the system clipboard or paste
into PowerPoint. The optional third argument `x,y,width,height` specifies a
reporting crop; the optional fourth JSON argument supplies trace parameters.
Neither reference images nor their derivatives belong in the public repository.
