# Detail-first native gradients

Open **自動填色 → 精細原生漸層 · 細節優先**. **智慧推薦** now chooses this mode for continuous shading. **漸層光影 · 較快** remains available explicitly. Existing artwork is never regenerated or overwritten automatically: rerun the fill preview and apply deliberately. Included in the v91 web release, together with standalone image HD and SKC original-file saving.

## Fidelity before object count

The v87 tradeoff below did not preserve enough small reflections, narrow contours or subtle shading. The detail-first mode now:

- Uses lighter edge-aware denoising and less boundary-length pressure when inferring regions. Fits and validation always use the unchanged original pixels, not an AI-generated replacement.
- Keeps denser source samples and checks **every pixel of both regions before accepting a merge**. A sparse fit cannot silently absorb a small high-error feature. The accepted ramp is retained rather than replaced by an unchecked refit.
- Searches more final gradient directions, then places up to eight editable native color stops at actual changes in the projected source colors. The stops are no longer limited to an equally spaced grid.
- Fits shared cubic boundaries at a stricter, subpixel error budget. It does not force the fewest anchors or independently simplify neighboring outlines.
- Discards stale merge-queue candidates and favors balanced merges when source errors are similar. These are scheduling changes, not relaxed quality gates. Worker cancellation and explicit size/complexity budgets remain in place; there is no silent fallback to pictures or a coarser mode.

The source remains a partition, not a stack of color patches. It can contain **more** editable objects and anchors than v87. It still approximates the source, including JPEG/compression artifacts; it does not understand anatomy or reconstruct unknown original ink strokes perfectly.

## Browser edge coverage

Complete, unedited opaque partitions use coverage-weighted SVG compositing to prevent bright/dark antialias seams. The composite keeps alpha headroom, normalizes coverage, and clips to the original paper quad (including translated/rotated references). This changes browser/SVG rendering only: the saved vector colors, opacity, geometry and native PowerPoint gradient stops are unchanged. It does **not** add raster images or duplicate filled shapes to the project.

Normalization is disabled for incomplete exports or groups with hidden, deleted, moved, opacity-edited or geometry-edited members. Deleting a region therefore really leaves a hole. The browser coverage operation is not a new native PowerPoint gradient type; native Office still uses its own antialias renderer.

## Checks

`tests/check_source_gradients.mjs` additionally covers a narrow off-center reflection, source-positioned native stops, deterministic fitting, quality-first recommendation, and incomplete-partition safeguards. `tests/check_fill_coverage_browser.mjs` raster-checks opaque seams, color accuracy, partial/hidden regions and rotated clipping. Desktop/mobile Apply, editable gradient payloads, undo/redo and persistence remain covered by `tests/check_native_fill_browser.mjs`.

## Measured comparison

Private 640×360 comparison against v87, using the unchanged source and the real editor renderer:

| Reporting area | v87 RGB RMSE | v88 RGB RMSE |
| --- | ---: | ---: |
| Full image | 5.03 | 2.62 |
| Eyes | 5.62 | 2.91 |
| Jaw/chin | 4.85 | 2.71 |
| Hair | 5.64 | 2.59 |

These are image-specific errors on the 0–255 RGB scale, not subjective scores or proof of perfect reconstruction. Reporting crops never enter the algorithm. This run produced 1,714 regions, 24,038 anchors and 1,072 gradients, in 73 seconds while other tests were running. The synthetic coverage test had no interior alpha gaps and a maximum uniform-color error of 3 RGB levels. An isolated real-output group test (the preceding 1,716-region candidate) selected in 17 ms, deleted in 47 ms and restored exactly with Undo; this is not a speed guarantee for every device. Private artwork/results remain in ignored `.codex-tmp/`.

### Original v87 notes (superseded above)

Open **自動填色 → 多向原生漸層 · 可編輯**. The result is a group of closed, editable vector regions with native linear gradient stops. Press **套用色塊** to add it to the canvas; the original reference and line art remain unchanged. Recolor, change the gradient angle/stops, edit anchors, delete a group, or undo normally. Native PowerPoint transfer uses the existing Windows companion.

## Why the former 2D entry could not apply

The former **二維填色（實驗預覽）** entry deliberately disabled Apply: it fitted a continuous bicubic color field that the native PowerPoint bridge cannot represent as one editable gradient. The user explicitly rejected a bitmap/picture-fill fallback. No such fallback is implemented.

PowerPoint's documented gradient schema provides linear and path shading, not arbitrary multi-direction mesh control colors. [Microsoft GradientFill documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.gradientfill?view=openxml-3.0.1). The new usable mode approximates complex lighting with multiple regions, each retaining its own native gradient. It is **not** a single-shape editable 2D mesh.

The representation-only experiment remains available for developers with `?experiments=1`, under **研究：二維色場 · 僅預覽**. It does not appear in the normal menu and still cannot be applied as native PPT shading.

## Fewer objects and anchors

- Native multi-direction fitting compares the principal color direction with perpendicular and diagonal candidates where the original ramp has significant residual error. Alternate fits use at most eight stops. Adjoining domains may share a better-fitting ramp before any vector objects are created.
- Shared boundary chains are fitted once and reversed for the neighboring region. The simplification setting now allows a larger, bounded subpixel/source-pixel tolerance for smooth boundaries, while keeping paper edges, junctions, small islands and thin closed features stricter. Independently simplifying adjacent objects would create gaps; this implementation does not do that.
- The model does not discard the iris or merge arbitrary disconnected parts to reach a target object count. There is no promise that every image has fewer regions, or that native editable ramps reproduce all reflection details perfectly.

Private 640×360 anime comparison on this computer: the previous gradient result had **694 objects / 9,728 anchors**. The final multi-direction run had **655 objects / 8,409 anchors**, with full-image RGB RMSE changing from **4.73 to 5.03** on the 0–255 scale, and about **34 seconds** of fitting (an earlier run took 25 seconds). This is an image-specific editability/fidelity tradeoff, not a general perceptual or speed benchmark. Private artwork and generated files stay in ignored `.codex-tmp/`.

The research-only bicubic fitter also now keeps one directly fitted grid instead of accumulating coarse residual grids. In the same private full-image preview, coefficients fell from 13,808 sites to 9,956; an eye crop fell from 11,876 to 5,775, with training RGB RMSE changing from 2.44 to 2.74. These are internal color coefficients, not canvas objects or boundary anchors. They are not counted as native-gradient gains.

## Verification

`tests/check_source_gradients.mjs` checks small highlights, dark islands, closed and exactly shared boundaries, deterministic fitting, unchanged source pixels, native stop limits, and a symmetric reflection for which multi-angle search improves over the principal-plane direction. `tests/check_native_fill_browser.mjs` checks actual desktop/mobile Apply, SVG without embedded pictures, native gradient payloads, recoloring, undo/redo and project reload. Existing `tests/test_gradient_fill.py` exercises native Office gradient stops and compound cutouts in an isolated scratch deck without changing the clipboard.

The v87/v88 measurements above describe local development evaluations, not benchmarks of every browser or device. The v91 web release includes the detail-first implementation.
