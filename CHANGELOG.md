# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
