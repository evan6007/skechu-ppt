# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.8 / Web v95] - 2026-09-12

### Fixed

- Explicitly selected reference images can be copied. A single picture uses the browser PNG clipboard without an Office probe. Mixed selections preserve independent pictures and editable vectors in native PPTX and the updated Windows bridge; hidden images remain excluded.
- Bound local copy/preparation waits to three minutes, release the busy UI after failure, and expose a current-selection retry. Terminal stream results no longer wait for socket EOF. Browser permission/network denial no longer launches a second hidden transport.
- Never replay an uncertain PowerPoint clipboard write through a native-cache rebuild. Invalid/missing image files fail visibly instead of being silently dropped. Embedded PNG input is bounded and validated without allowing remote URLs or arbitrary local paths.

### Changed

- Add consistent Windows executable version/publisher metadata, release checksum and actual Authenticode status. Releases remain unsigned while free OSS signing application materials are prepared; no approval or removal of SmartScreen warnings is claimed. See [Code signing policy](docs/code-signing-policy.md).

## [Web v94] - 2026-09-12

### Added

- Browser-only native PPTX selection export: editable cubic Freeforms, independent hole contours, multistop linear gradients and native text, with a bounded offline worker. This exports a file, not universal system-clipboard paste or an Office add-in. Windows PowerPoint editability was checked on isolated scratch decks; Mac, Linux/web and mobile Office receivers remain unverified. Unsupported formulas/images fail without a partial or bitmap export.
- Automatic Windows, Mac, Linux/Ubuntu, ChromeOS, iPhone/iPad and Android routing, including a desktop-mode iPad heuristic. The export menu shows detection and allows an explicit remembered correction. Non-Windows and unknown devices use the portable route without probing/preparing Windows Office, including on localhost. Detection/settings alone never copy or download.

## [0.1.7] - 2026-09-12

### Added

- In-page Windows connector installation guide after an unavailable/old native-copy connection: a direct all-in-one installer download, included-runtime and desktop-PowerPoint requirements, short steps, and an explicit retry using the current selection. Already connected users still copy with Ctrl+C alone; downloads, installation and clipboard writes are never retried automatically.
- Non-Windows clients receive honest SVG/PNG alternatives without probing the Windows connector. Connection guidance covers an already-installed service and denied local-network permission without claiming to detect installed programs.

### Changed

- The installer completion action starts the bundled connector in the background and leaves the web drawing in its original tab. Updated installer assets include browser HD, detail-first native gradients and original SKC saving from the complete web release.

## [Unreleased]

### Added

- Image-edge closure in the auto-trace preview, enabled by default and switchable without rerunning the worker. Short clipped endpoints join an exact, zero-stroke image rim; resulting fills retain normal editable anchors, native export geometry and undo.
- Developer-only anime-sketch refinement with source-supported gap/corner/T repair, thin border artifact suppression and light-stroke ribbon cleanup. The local CLI now supports image-edge closure. Neural inference is not shipped in the browser; private samples and weights are excluded.

- Closed illustration tracing with a pinned, locally executed VTracer WebAssembly engine. Shared cutout boundaries replace skeleton gap-joining for color artwork; optional source-color fills preserve holes as native editable Freeforms. Original line/logo/photo engines remain available. No user images are uploaded.
- Edge-preserving illustration cleanup and less aggressive color merging retain small dark insets and narrow highlights. Curve fitting keeps small arcs without globally adding noisy regions; zero cleanup remains available, and the original reference pixels are never modified.
- Illustration mode and `autoFill` for the opt-in tracing API, plus closed-region, hole, worker, native-coordinate and real-browser recolor/undo checks.
- Freehand "cut after drawing" toggle: on creates independent path pieces; off inserts exact editable anchors into the same connected paths. Existing fills, closed outlines, T-junctions and attachments are retained when adding points, with no duplicate nodes at existing anchors.
- Point cut from an anchor's right-click menu or a 500 ms touch hold. The compact menu operates on that exact anchor; dragging, a second finger, page changes and cancellation abandon the hold without cutting.
- Scissors with point, straight-line and freehand modes. Exact cubic subdivision creates independent editable endpoints, preserves existing color areas, remaps surviving attachments and shares one-step undo. Locked objects and reference images are excluded; two-finger navigation cancels an unfinished cut.
- Search metadata naming Skechu and Skechu-PPT, stable canonical URLs, application structured data, a static feature guide and a two-page sitemap. Search Console verification and indexing requests remain separate owner actions, not automatic ranking guarantees.
- Opt-in, current-page command API with 12 named commands and a separately installed official-SDK MCP connector. Includes paginated inspection, batch styles/movement, editable shapes, confirmed deletion, undo/redo, SVG output and staged/cancellable background tracing. Strict schemas, revision guards and one-step history protect interactive work.
- Automation guide, repository map and optional MCP protocol/security checks. The ordinary static web editor does not require the connector or an AI account.

### Changed

- Scissors now return directly to selected editable anchors after a successful cut, without a Done button. Hold Ctrl during a straight cut to constrain it horizontally or vertically; pressing or releasing Ctrl also updates a stationary preview.
- README feature recordings now occupy separate, top-aligned rows from their captions. All four retain their original 720 × 405 dimensions and colors.
- Published feature GIFs moved to `docs/media/features/`; showcase tooling moved to `scripts/showcase/`. Existing local projects, MP4 exports and generated files were not removed.

### Fixed

- Tiny curved branch crossings are intersected at finer precision, preventing a subpixel missed crossing from merging large foreground/background fill regions. Nested single-owner loops now win over an enclosing painted DOM target.

- Connected-region filling at tangent T-junctions: tiny auto-traced links with equal initial tangents now use their geometric order, keeping neighboring regions separate. Single-path enclosed subregions also use the local face instead of recoloring the whole object.
- Embedded browsers without Blob URL support can load the packaged automatic-tracing worker over HTTP instead of running the heavy operation on the UI thread.

### Previously added

- Optional GitHub App authorization for the hosted Star button: show the authenticated user's actual state, add or remove a star in place, and keep drawing available without login. The dedicated service has fixed repository access, PKCE/state validation and encrypted short-lived sessions; client secrets and raw GitHub tokens never enter the static editor.
- Instant yellow Star feedback with a reduced-motion-aware animation. Repeated clicks coalesce after 450 ms; background writes are serialized, preserve the latest choice and reconcile failures without automatic retries.
- A full-size brain reference on the first-run canvas, replacing the generic demo shapes. Newly imported tracing references start unlocked; saved projects and existing lock choices are preserved.

## [0.1.5] - 2026-09-05

### Fixed

- Ctrl+C completes editable PowerPoint copying without a second button. If a running bridge still has older HTTP routes but serves the updated helper assets, the editor negotiates a hidden same-page connection before sending the copy once. It preserves exact origin/source/channel validation and clipboard-copy priority.
- Failed native copying no longer presents bitmap/download buttons as though they were required steps. Source-checkout users can use the updated compatibility helper without restarting an already-running bridge.

## [0.1.4] - 2026-09-05

### Added

- Same-page editable PowerPoint copying from GitHub Pages. The first Copy click connects directly to the installed Windows service; progress and completion stay in the editor, with no companion popup or redundant application approval. Browser local-network permission remains browser-controlled. Updated installer required.
- Origin- and Host-restricted web bridge endpoints, remote payload validation before Office work, and streamed progress with no automatic retry after an uncertain clipboard write.
- Page-thumbnail context menu with copy/paste, independent duplication, rename, blank-page insertion, ordering and confirmed deletion. Page copies retain canvas dimensions and remap item, attachment, fill-source and junction identities.
- Pasting a copied web image into the canvas creates a normal, unlocked image layer with proportional sizing and Undo. Text inputs retain native paste, decoding is isolated from page changes, and images are read from clipboard files without remote URL fetching.
- Automatic selection between line-art centerlines and solid Logo contours, with manual overrides. Contours retain outer boundaries, inner cutouts, sharp corners and long straight sides as editable cubic paths, including artwork touching the image border or using transparent backgrounds. Solid artwork is no longer rejected by the line-art ink-density guard.
- Three responsive graphite, mist and linen interface themes; draggable side-panel splits; editable canvas dimensions; and an icon-based shape popover for rectangles, circles and polygons.
- Direct drop import for PNG, JPG, SVG and Skechu project JSON files. Artwork can remain visible and interactive outside the canvas instead of being clipped at its edge.

### Changed

- Multi-selected curves show editable anchor points instead of per-path bounding rectangles. Shared T-junction markers are deduplicated; clicking or dragging an anchor focuses its own path, while dragging the stroke still moves the selected group.
- Replaced abstract automatic-trace number fields with four live, labeled sliders: dark/light detection, curve softness, anchor simplification and detail cleanup. Added recommended-settings reset, detected-mode feedback, and plain-language directional hints. Existing line-art/T-junction tracing and isolated preview/apply/undo behavior remain intact.
- Reworked the desktop and mobile toolbars around compact neutral controls, moved secondary page actions to a non-blocking side popover, restored grid visibility under a clean translucent canvas, and replaced ambiguous menu glyphs with magnetic-trace and export/share icons.
- Page thumbnails and layer rows now reorder by dragging their body, with stable insertion thresholds, animated displacement and a translucent drag preview.
- Replaced the text-heavy repository introduction with a real complex editor screenshot, an at-a-glance feature grid and a short three-step start path.

## [0.1.3] - 2026-09-03

### Changed

- Connected web sessions now prepare native PowerPoint shapes in the background after a 650 ms editing pause. Repeated/no-op renders do not rebuild; intermediate changes are coalesced and explicit copying takes priority over queued preparation. Preparation never writes the system clipboard.
- Keep up to six native caches isolated by editor tab, page and full/partial selection so copying one object or using another tab does not replace the whole-scene cache. UI-only layer metadata no longer invalidates native shapes. Moving the outermost point keeps a stable internal origin and updates only the changed native curve.
- Copy feedback now distinguishes cached copying, incremental updates and initial creation, with measured bridge time. Temporary preparation errors back off without permanently disabling on-demand copying. New connection sessions force a fresh helper document, avoiding stale popup handshakes.

## [0.1.2] - 2026-09-03

### Added

- Web-to-native PowerPoint copying through a user-approved localhost companion window. Repeated copies stay in Open Web, preserve native curve nodes and fill order, and report real clipboard results. Exact site/window/channel checks, payload validation, disconnect controls and timeout handling protect the connection. The updated Windows installer includes the companion.
- Eye controls for individual layers and folders, independent of locks. Hidden artwork remains saved, supports Undo, cannot be hit on the canvas, and is excluded from filling and exports.
- Independently scrolling right-sidebar sections: tools occupy the upper two thirds; layers stay visible in the lower third.

### Changed

- Made Open Web the primary README entry point with a large, locally hosted browser-launch card; Windows installation is a secondary link for native PowerPoint integration.
- Automatic-trace previews now show actual cyan anchors and per-curve anchor counts; red rings are explicitly labeled as review warnings. Added undoable simplification of existing dense curves, preserving shared junctions and cusps. Balanced fitting splits avoid peeling tiny segments off the ends of simple arcs.
- Automatic tracing now draws visible blue pen curves immediately and updates them automatically when settings change, without a regenerate button. Preview and applied curves use the manual tracing pen's stroke style; stale worker results cannot be applied.
- Automatic pen tracing defaults to broader, smoother cubic steps (2.5 px fitting tolerance, 90 step size). Sample positions are refined along each cubic before adding anchors, avoiding unnecessary short segments while retaining shared branch points.
- Added local, worker-based automatic line-art tracing with adjustable ink threshold, fitting tolerance, simplification, and small-fragment filtering. Preview/apply/cancel preserves the reference and existing artwork; output is editable cubic paths, not a flattened bitmap.
- Automatic T junctions retain shared anchor identities, independent branch controls, and aligned through-tangents. Moving a shared anchor updates its branches; explicit detachment is required before deleting it. Near gaps are flagged rather than bridged, and ambiguous crossings have persistent review markers and a next-review action.
- Fixed Windows JavaScript MIME headers so background tracing and offline workers load reliably. Automatic tracing assets are included in the web cache and Windows package.
- Dragged colors now recognize bounded regions formed by multiple paths and T junctions, with an exact-region hover preview. Filling creates a separate editable vector color shape without merging or replacing source paths; cubic boundaries and zero-width outlines are preserved in PowerPoint.
- Ctrl+C now writes selected objects to the native PowerPoint clipboard on Windows while retaining an internal Skechu copy. Ctrl+V works in either application; text fields keep normal text copying and Ctrl+Shift+C remains an alias for native export.
- Added local smoothing for marquee/Shift-selected anchors: a reversible 0–300 softness control, numeric entry, ±5 buttons, and reset. The original 0–100 range coordinates selected tangents; 100–300 extends the aligned handles for stronger roundness with segment-length limits. Anchor positions, unselected handles, endpoints, sharp corners, and inward cusps are preserved.
- Selected anchors now use bright red with a white border. Visible anchors/handles and their invisible hit targets are larger but stay screen-sized at every zoom; overlapping hit targets select the nearest center and tangent leaders leave more separation.
- Native PowerPoint curves now use explicit corner-mode Bézier controls instead of Office auto-smoothing, with node-coordinate verification after creation and cache updates. Failed curve creation no longer silently substitutes a polygon.
- Anchor, magnetic-snap, split/linked tangent, and join helpers keep a constant screen size at every canvas zoom. Dashed tangent leaders leave a clear clickable gap around the anchor and separate overlapping handles.
- Linked tangent handles now preserve dragged distance as well as angle. Automatic circle fitting respects manual tangent edits, and reversed paths retain handle lengths.
- Magnetic tracing now snaps to brightness and color boundaries instead of assuming every source feature has a useful stroke centerline.
- The canonical project file extension is now `.skc`; legacy `.sktc`, `.sketchou`, `.sketchou.json`, and `.json` files remain importable.
- The default local port is now `8766` to avoid conflicts with earlier private builds.
- Reorganized the editor into clearer tracing, insertion, view, project, export, palette, canvas, and inspector groups.
- Traced boundaries now use continuous, handle-limited Bézier interpolation over a three-to-four-point neighborhood instead of displaying each sampled segment as a small corner.
- Magnetic routes remain constrained to the local anchor corridor, but a broken or ambiguous edge now warns and accepts the next anchor instead of stopping the drawing session.
- `Backspace` and `Delete` remove selected anchors before falling back to whole-object deletion.
- Each anchor now has an independent 0–150% curve amount; traced paths default to a natural 100% amount with longer, still-capped control handles.
- Magnetic trace samples are now de-noised before rendering, removing the tiny zigzags that previously remained even when anchors were set to smooth.
- Renamed per-anchor smoothness strength to curve amount and added a −180° to 180° tangent angle, a draggable on-canvas tangent handle, and automatic-angle reset; the same geometry is preserved in native PowerPoint export.
- Added optional split incoming/outgoing Bézier handles per anchor. This preserves the linked tangent tool while allowing pointed inward valleys whose two sides bend independently without creating a self-intersection loop.
- Split Bézier handles now preserve their independently dragged distance, may be pulled far from the anchor, and remain connected by color-coded dashed guides in both the editor and native PowerPoint geometry.
- Active magnetic tracing now computes the committed stroke and lighter prediction as two ranges of one shared spline, eliminating the raised corner that appeared where a circular arc met its next preview segment.
- Magnetic boundaries whose samples fit one circle are now rendered as a true SVG circular arc and exported to PowerPoint with the same fitted center, radius, and cubic arc conversion; irregular boundaries continue using the free-curve fallback.
- Circular recognition now uses a robust all-sample least-squares fit with outlier trimming and wider tolerance for half-to-full-circle traces, so rough manual samples around logos are projected onto one exact circle instead of falling back to a wavy spline.
- Closing a recognized circular trace back to its first anchor now preserves the fitted circle and emits two exact SVG half-arcs (plus four native PowerPoint Bézier quarters), instead of disabling circle mode and exploding into a generic closed spline.
- Circular closure now bypasses magnetic re-routing for the final click and adds only the exact original anchor, preventing noisy reference-image samples from corrupting an otherwise valid circle at the join.
- Drawing mode now takes priority over existing filled and outlined objects, so a new traced line can begin inside a closed circle without selecting or dragging that circle.
- Reorganized the top ribbon into compact Mode, Add, View, and Edit groups with consistent icons, and added an explicit Select cursor for leaving the tracing tool.

### Added

- Branded Windows app icon and a one-command desktop shortcut installer.
- Draggable, locally saved color palette with highlighted drop targets and automatic filling for closed vector regions.
- Hold-`Ctrl` trace joining with visible manual anchors and click-to-close support.

## [0.1.0] - 2026-08-31

### Added

- Click-to-place vector tracing with centerline magnetic routing.
- Per-anchor smooth and sharp corner styles.
- Segment-specific anchor insertion.
- Internal copy/paste and Shift multi-selection.
- Endpoint snapping, path-midpoint snapping, chain merge, and persistent T-junctions.
- SVG export and native editable PowerPoint export.
- Local IndexedDB autosave and portable project JSON files.
- Public documentation, CI, security policy, and original demo assets.
