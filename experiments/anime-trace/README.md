# Anime structural tracing — experimental

This is a local, developer-only refinement experiment, **not a shipped editor
mode**. It processes a predicted grayscale sketch into Skechu's native editable
cubic paths. It does not download a model, train a network, upload images, or
change an open project. The existing editor's tracing modes are unchanged.
A separate editor fix prioritizes the smallest geometric fill region over
the background DOM hit, so an already-painted parent no longer steals clicks
inside a single-owner inner loop.

## Optional shading fills and thin-ink cleanup

```sh
node experiments/anime-trace/refine.mjs predicted-sketch.png output-prefix original.png --structure --colors
node tests/check_anime_structure_colors.mjs
```

`--colors` now preserves source shading as independent closed fills with
**zero stroke width**. The earlier one-color-per-structural-face experiment
lost shadows that the sketch network did not enclose. It remains available as
`AnimeStructureColors.run` for comparisons, but is no longer this CLI's default.
The command consumes an aligned, already-predicted sketch; it does not run,
download or retrain a model. JSON separates `items` (linework) and `colorItems`.

- Bundled VTracer segments the original colors. `preserveShading` retains these
  fill boundaries without importing their outline network. Eye and nose shadows
  remain independently editable even when absent from the neural sketch graph.
- `ink-fill-simplify.js` merges only narrow, elongated dark regions already
  covered by existing visible ink. Defaults require a width estimate at most
  3 source pixels and at least 94% boundary support within 3.5 source pixels.
  Broad shadows, compact earrings, highlights and rings are protected.
- A removed ribbon is united with the adjacent fill sharing its longest edge.
  Exact shared cubics cancel; surviving coordinates and all neural strokes stay
  unchanged. Unaffected source fill objects are retained directly. Area changes,
  open unions or increased fragmentation reject the candidate result.
- The local portrait retains 127 of 128 source color regions and all 228 graph
  paths (204 visible, 24 zero-stroke closures). Only one region passes this
  conservative cleanup. This does **not** resolve the remaining source/ink
  misalignment or clutter around the ear. No public editor mode has changed.

Synthetic checks cover shadow retention, zero-width fill outlines, ribbon union
without holes/overlap, unchanged ink, compact earrings and light highlights.
An isolated editor check recolored both eye shadows, the nose shadow and a dark
earring, checked region bounds and exact undo, and selected all 355 objects.
Those checks establish editability for this sample, not anime tracing accuracy.
A separate scratch PowerPoint export produced 355 native freeforms and verified
that all 127 color fills have `Line.Visible = 0`. Its rendered output was checked;
the test neither copied to the clipboard nor modified the user's presentation.

Do not score success by fewer anchors or fewer colors alone. Check source
alignment, the earring/ear-fold distinction, independent recoloring, and native
editability before promoting this path to the editor. Source images, model
weights and private comparison artifacts are not included in the repository.

## Opt-in experiment: visible ink versus fill-only boundaries

`structure-layers.js` adds a conservative **source-profile heuristic after the
neural sketch has been vectorized**. This is not a retrained model or semantic
understanding of anatomy. It does not turn VTracer color outlines into ink.

```sh
node experiments/anime-trace/refine.mjs predicted-sketch.png output-prefix original.png --structure
node tests/check_anime_structure.mjs
```

The original and predicted sketch must have identical size, orientation and
crop. The optional flag requires the original image. Omitting it retains the
previous refinement pipeline. The new module is not imported by the editor,
worker or service worker; **nothing is enabled on the public website**.

- Source intensity profiles across each cubic distinguish a narrow ink/highlight
  ridge from a mostly monotone midtone color transition. Dark edges, genuine
  earring loops, rim-adjacent silhouettes and uncertain spans remain visible.
- Chain-level hysteresis avoids leaving a tiny isolated arc just because one
  sample crossed a threshold. It does not overwrite strong ink evidence.
- Candidate color transitions have `structureRole: "closure"` and `width: 0`,
  **not** `hidden: true`: they remain part of the editable fill graph. Crop-rim
  joins are also fill-only. Visible spans have `structureRole: "ink"`.
- All existing cubics, controls and junction coordinates are retained. Splits
  happen only at existing anchors. No artificial diagonal bridges or new
  geometric smoothing are introduced by this stage.
- JSON includes each span's evidence/reason and the number of uncertain spans.
  `AnimeStructureLayers.run(..., {hideColorSteps: false})` keeps source-derived
  boundaries visible again; crop-rim geometry remains non-ink.

### Local validation and limitations (2026-09-06)

The private cel-shaded portrait and the upstream Anime2Sketch `madoka` / `saber`
samples were evaluated with the same artifact-reduced checkpoint. These are
three exploratory cases, **not** a representative quality benchmark. Reference
images, predictions, checkpoints and derived projects remain in ignored local
QA storage and are not published with this repository.

- The cel-shaded case retains all **33** geometric faces, with **204** visible
  objects and **24** zero-stroke boundary objects. Source cubic/control
  multisets are unchanged, and there are still **14** topology review warnings.
- Isolated browser QA clicked nine local regions (both earrings, lip, teeth,
  face, nose shadow, brow shadow, clipped hair and coat), checked bounds and
  exact undo. Eleven consecutive, manually chosen fills preserved prior colors.
  All 238 resulting objects could be selected; the native export payload retained
  eleven separate painted objects and zero-stroke closure geometry. This check
  is **not** a new desktop PowerPoint paste test or automatic-coloring claim.
- Across all three samples, splitting visibility preserved every original cubic
  and all original fill-face areas (33 / 103 / 291 faces). Topology conservation
  alone says nothing about whether those faces match the artist's intent.
- The source-guided stage reduces some unwanted shadow outlines in the cel-shaded
  example, but eye-tail fragments, mouth-corner connectors and some hair/ear
  junctions remain. It cannot recover detail the sketch network never predicted.
  Strong painterly lighting still produces many false texture/light contours in
  the `saber` case; this is **not suitable as a universal production default**.

The next quality gate is reliable structural stroke extraction across styles,
especially eyes and mouth corners, not merely fewer anchors or more closed faces.
Any production integration needs a separate user review of these local results.

## Why a separate pipeline?

An anime drawing's structural strokes are not equivalent to the boundaries of
every quantized color, highlight, or shadow. Color-region vectorization remains
useful for fills, but must not be presented as reconstructed artist linework.

We evaluated [Anime2Sketch](https://github.com/Mukosame/Anime2Sketch), including
its [artifact-reduced variant](https://github.com/Mukosame/Anime2Sketch/pull/32).
That upstream change reduces decoder checkerboard artifacts; it does not solve
semantic line selection or guarantee closed, editable regions. The current work
adds our own **post-processing and topology checks**, not new trained weights.

## Current refinement

1. With an aligned original, optionally suppress an isolated 1–2 pixel dark
   stripe along more than 90% of an image edge. Broad dark subjects touching
   the edge are protected. Results record the evidence; intentional borders can
   be retained with `suppressBorderStripes: false`. No image resize or crop is
   performed.
2. Smooth prediction noise with a small separable kernel. Preserve confidently
   white pixels so smoothing cannot paint over real openings.
3. Remove only small, enclosed, low-confidence pores inside strokes. Preserve
   white holes, larger regions, and image-border openings.
4. Recognize a narrow double-edge ribbon only when the original has a consistent
   light/dark ridge at its center and nearly equal colors on its two sides.
   Recover one centerline, rather than a chain of closed beads. Real openings
   and color-step boundaries are protected. This heuristic is optional via
   `collapseRibbons: false` and each changed ribbon is recorded.
5. Match skeleton endpoints in local spatial buckets. A short bridge requires
   mutually unambiguous partners, matching tangent directions, and faint line
   evidence in the original prediction. Reject white gaps, wrong directions,
   existing crossings, and crossings with previously accepted repairs.
6. With an optional aligned original image, an unsupported sketch gap can use a
   strong, consistently oriented color transition. Search only a narrow local
   corridor between existing, mutually unambiguous endpoints, follow the nearby
   color edge, and reject crossings. A blank sketch never generates strokes from
   source colors alone. Color-assisted bridges are marked `source: "color"` in
   repair provenance and can be disabled with `maxColorGap: 0`.
   Very short (at most 8 px) source-supported corners can reconnect even when
   their end tangents are not collinear; sketch evidence alone cannot relax this
   direction requirement.
7. Attach a supported dangling end to the interior of a different branch to
   recover a missing T. Reject ambiguous targets, parallel lines, and crossings;
   this pass can be disabled with `maxJunctionGap: 0`.
8. Fit ordinary editable cubic curves using the existing AutoTrace engine.
   Shared junction coordinates remain exact. Repairs are returned explicitly in
   `refinement.repairs`, not silently represented as original model strokes.
9. By default, connect terminal anchors within 6 px of the image edge to its
   exact rectangular boundary. The added rim has zero stroke, editable anchors,
   and explicit `traceBoundary` metadata; it is crop geometry, not artist ink.
   Disable it with `closeBorder: false`. The shared implementation is also
   available in the public editor's **沿底圖邊緣封閉** preview checkbox.

Color-supported endpoint gaps now allow up to 48 px by default (64 px maximum).
Moderately turning endpoints may use a cubic bridge only if aligned original
colors support the entire narrow corridor. Flat colors, ambiguous partners,
crossings and unsupported internal gaps are still rejected. This does not
increase the 8 px sketch-only gap allowance or relax sketch-only corner rules.

Distances and tolerances are in input prediction pixels. Defaults are calibrated
for roughly 1,000-pixel sketches; they are not a resolution-independent quality
claim. Maximum input is 5 million pixels. Dense colored images are rejected.

## Run locally

Requirements: Node 22+, Python with Pillow. First extract a sketch with the
upstream model; this command does **not** run the neural network:

```powershell
node experiments/anime-trace/refine.mjs predicted-sketch.png .codex-tmp/refined
node experiments/anime-trace/refine.mjs predicted-sketch.png .codex-tmp/color-assisted original.png
node tests/check_anime_refine.mjs
```

Set `SKECHU_PYTHON` if the Pillow-enabled Python uses a different executable.
The optional original must have exactly the same dimensions, orientation, and
crop as the predicted sketch. The CLI checks dimensions; the caller is
responsible for matching the actual image content and alignment.
The CLI writes JSON (native path geometry and repair provenance) and SVG;
it refuses to overwrite existing outputs. The JSON is a tracing result, not a
`.skc` project. A local QA project can be constructed through the editor's normal
project serializer.

## Verification and limits

Synthetic regressions cover faint supported gaps, unsupported white gaps,
parallel/corner separation, small white holes, earring-like loops, exact T
junctions, independently fillable adjacent regions, transparent pixels, image
borders, deterministic output, and input immutability. Round-two regressions
add light/dark ridge versus real-hole protection, source-backed cusp closure,
supported/unsupported dangling T links, and all four orientations of T links
and thin edge stripe detection.

A private 1080 × 1061 portrait was also checked in the real browser editor.
The following are historical round-one results, retained as the comparison:
Using the same model prediction, threshold, and curve-fitting settings, the
refinement changed 290 paths / 869 anchors / 37 review markers to
213 paths / 698 anchors / 17 review markers. It removed 17 low-confidence pores
and accepted 1 supported bridge. Browser clicks filled the tested left/right
earring subregions and lower lip separately; Undo restored the exact paths and
Select All selected every output object. These are **single-image observations**,
not general accuracy metrics or a claim that every region is now closed.

Adding the aligned color reference accepted 2 additional neck-boundary repairs
(about 13 and 16 pixels long), yielding 211 paths / 701 anchors. The same three
browser fill probes, exact Undo, and Select All checks passed. Synthetic tests
also verify that a color boundary can restore two independent fill regions even
where the sketch prediction is completely white, while flat/transparent color
references and a completely blank sketch cannot invent boundaries.

Round two (same prediction and source) removes the 1 px source-image edge stripe,
collapses 5 source-supported light-stroke ribbons, and accepts 10 total bridges:
3 normal endpoint pairs, 4 T attachments, and 3 short corners. Five bridges use
color evidence. The result has 209 paths / 695 anchors / 14 review markers.
The main face and nose region, which were not fillable in round one, now have
closed faces. Eight real browser fill probes (earring subregions, lower lip,
face, nose shade, teeth, and earring main regions), exact Undo, and Select All
passed. Reducing paths or review markers is not itself an accuracy measure;
correct region separation is checked independently.

A subsequent combined-fill test exposed an editor hit-target bug not caught by
isolated fills: an existing face fill intercepted clicks inside the unfilled
nose/eyebrow loops. This was fixed in `fillTargetAt`, with synthetic unit and
real-browser regressions (`node tests/check_nested_fill_browser.mjs`, requires
Playwright and a local test server). Nine consecutive private demonstration
fills now verify that each earlier region's color is preserved. The exported
test project assigns a shared trace batch to retain linked-anchor behavior.

Round three adds 10 short image-edge joins and one zero-stroke native rim, plus
one color-supported 44 px shoulder gap. The final default result contains
222 paths / 736 anchors / 14 review markers. A subpixel crossing in a tiny
curled branch also exposed a region-fill precision bug: high precision for
short cubics now prevents that missed intersection from joining the coat to
the background. Existing region and native-coordinate regressions pass.

Ten real browser fill probes now include clipped hair and clothing, in addition
to the eight previous probes. Hair, coat and background have distinct faces;
the coat reaches the source's bottom/side edges, and the hair reaches its top
edge. Exact Undo and selection of all 222 objects passed. Eleven consecutive
manual fills preserve previous colors. The private colored image is a **manual
bucket-fill demonstration**, not an automatic-coloring result. Round-one and
round-two statistics above are historical comparisons, not current counts.

Unresolved: some hair highlights and shadow boundaries are still extracted as
strokes; some genuine details are missing or disconnected. Broad semantic
improvement requires a representative evaluation set and potentially model
fine-tuning. No retraining, mobile inference benchmark, or public neural-mode
deployment has been completed. Neither the private portrait nor its outputs or
model checkpoints belong in the public repository.

For model comparisons, preserve aspect ratio and crop any inference padding
back to the exact source bounds. Native-resolution reflective padding was
tested locally; changing inference resolution also changes learned stroke
behavior and must be evaluated, not assumed to be an improvement.
An all-sides context-padding variant failed the right-earring fill containment
test and did not eliminate the image-edge artifact; it was **not adopted**.
