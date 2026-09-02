# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

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
