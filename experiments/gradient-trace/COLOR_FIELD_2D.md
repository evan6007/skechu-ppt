# Single-domain 2D color field: representation experiment

This research mode requires `?experiments=1` and appears at
**自動填色 → 研究：二維色場 · 僅預覽**. The normal menu instead offers usable
[multi-direction native gradient regions](../../docs/native-fill.md), after the
user explicitly rejected picture-fill conversion. This experiment is preview-only: it does not add items, change project
history, automatically identify contours, or export to PowerPoint. It is not
part of the automation API. It remains opt-in and preview-only in the v91 web
release; publication does not make it a native PowerPoint mesh-fill feature.

Choose **框選局部** and drag over the source, or enter a rectangle in source
pixels. The result zooms to that rectangle. **查看全圖** returns to the full
image without changing the selected region; **重設範圍** fits the full image.
**對照原圖** toggles the result without recomputation. A quality selector and
explicit progress/error messages are included. Apply remains disabled because
the export/editability contract is unresolved.

The Blob/HTTP Worker handles at most 90,000 source samples, 12,000 color-control
sites, and a 640-pixel-long-edge rendered preview. Larger regions are labelled
as downsampled. Selecting a small region preserves more source detail.
Switching modes, changing a region or closing the dialog terminates stale work.
Transparent sources show an explicit unsupported-source message.

## Representation

`app/color-field.js` fits one continuous RGB function over a caller-supplied domain.
The experiment's `color-field.mjs` re-exports this same core for Node tests.
Tensor-product cubic B-spline basis functions allow the red, green and blue
channels to vary independently in both spatial directions. Regularized least
squares is solved by matrix-free, diagonally preconditioned conjugate gradients.
Successive scales now fit the complete source and retain only the best single
grid, instead of storing all earlier residual grids. Legacy hierarchical fields
can still be read and compared with `singleGrid:false`. The raw spline field is C2 continuous across knots.
Final display clamping to the RGB gamut need not preserve that differentiability.

The model stores coefficients, not the original bitmap. It can be evaluated at
different resolutions and its coefficients can be changed. This does **not**
recover details absent from the source, and it does not establish good semantic
segmentation. Hard boundaries should eventually be represented by independent
contours and line art, rather than forcing a smooth field to approximate them.

Hierarchical B-spline approximation is established prior art. This experiment is
not a claim of a new research algorithm or a faithful implementation of the
following paper: [Lee, Wolberg and Shin, 1997](https://cg.postech.ac.kr/papers/scatteredData.pdf).

## PowerPoint contract: native editability is required

The current bridge accepts only linear `fillGradient` values. In the documented
DrawingML format, `gradFill` provides linear and path shading, not arbitrary
multi-directional mesh control colors. [Microsoft GradientFill reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing.gradientfill?view=openxml-3.0.1).

PowerPoint's `FillFormat.UserPicture` can fill one shape with a rendered image.
This is a potential way to retain one freeform with an editable outline, but the
internal colors would be a picture fill, **not native editable gradient stops**.
[Microsoft UserPicture reference](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.fillformat.userpicture).
No native PowerPoint export, editing or visual-parity claim is made here.
The user rejected that tradeoff. There is no picture-fill conversion in the
application. Usable native output comes from the separate multi-region ramp
fitter, not this research-only bicubic field.

## Tests and reproduction

```text
node tests/check_color_field_experiment.mjs
node tests/check_color_field_browser.mjs
node experiments/gradient-trace/evaluate-color-field.mjs INPUT BASELINE.svg PRIVATE_OUTPUT "[[x,y,w,h],...]"
```

The synthetic test checks a crossed RGB field with an off-center glint,
held-out locations, knot continuity, coefficient edits, deterministic data
preservation, cancellation and input/work budgets. It uses 195 coefficient
sites and measures 0.21 RGB RMSE at held-out points.

The browser test uses real Blob and HTTP workers, checks the visible entry,
numeric regions, mouse and mobile touch drags, original comparison, stale work
cancellation, transparent-source errors, the disabled Apply guard and returning
to ordinary editable gradients. It verifies that the original project data are
unchanged. The rasterizer caches separable basis values rather than allocating
new per-pixel control arrays; the core test checks parity against direct field
evaluation at new sample locations.

The image evaluator uses **explicitly supplied rectangular domains**. These
are not automatically detected eyes or faces. Each rectangle is fit separately
from the original source. The baseline is the same rectangle cropped from the
whole-image v84 SVG. This isolates representation quality; it is not an
end-to-end automatic-vectorization benchmark.

Private 640 x 360 illustration evaluation, 2026-09-07:

| Domain | v84 RGB RMSE | 2D field RGB RMSE | Color control sites | Fit time |
| --- | ---: | ---: | ---: | ---: |
| 107 x 111 lens crop | 5.15 | 2.45 | 11,876 | 405 ms |
| 160 x 101 mouth/chin crop | 4.73 | 4.48 | 12,030 | 675 ms |

Runtime excludes rasterization and is machine-specific. These training-region
errors are not generalization or perceptual scores. The first prototype uses
too many control sites and softens thin contours; visual inspection confirmed
both limitations. It is a representation proof, **not a compact production
algorithm**. Color-control sites are not vector boundary anchors or SVG/PPT
objects, but they still consume memory and computation.

Input artwork, field coefficients derived from it and comparison PNGs stay in
the ignored `.codex-tmp/` directory. Do not publish these private test assets.
