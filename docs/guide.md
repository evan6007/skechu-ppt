# User guide

## Tracing

Choose **Tracing pen**, click once to place the first anchor, move the pointer to preview the route, and click again to commit the next anchor. The committed line and the lighter preview segment are calculated as one continuous spline, so a circular boundary does not acquire a raised corner at their join. Press `Enter` or double-click to finish; press `Esc` to cancel the current path.

When boundary tracing is enabled, Skechu-PPT detects visible brightness and color transitions in the imported reference. The orange indicator is the candidate boundary point, and both the preview and committed segment follow that same edge. When the sampled boundary is circular, all samples jointly estimate one best-fit center and radius, then the noisy points are projected onto a true SVG arc instead of being joined as many spline pieces. Long half-to-full-circle traces tolerate ordinary hand-placement error; non-circular boundaries keep the flexible curve behavior. This works for filled shapes, patterns, shadows, and ordinary line art without assuming that every source feature is a stroke with a meaningful center.

Routing is limited to a local corridor between consecutive anchors. If a candidate would detour onto a different nearby boundary, its indicator turns red and the segment is not committed; place the next anchor closer to the intended edge and continue.

While a trace is active, hold `Ctrl` to reveal the manually placed anchors for that stroke. The first anchor is green: click it to route the last segment back to the start and close the path. A recognized circular trace keeps its fitted center and radius during this closure, adds only the exact start point, and deliberately skips a new magnetic search for the closing segment. It uses two exact half-circle SVG arcs rather than changing back to a generic closed spline. Clicking another visible anchor connects to that point and finishes the trace. At least three manually placed anchors are required before closing to the start.

The active drawing tool always receives the next canvas click, even when the pointer is over a filled or closed object. This lets a new trace begin inside an existing circle instead of selecting the circle. Choose **Select** in the top toolbar to leave tracing and return to normal object selection; choosing it while a trace is in progress finishes that trace safely.

## Editing anchors

Click a path, then click an anchor. In the inspector, choose **Smooth curve** or **Sharp corner** for that anchor. The visible anchor is intentionally small; a larger transparent hit target keeps it easy to select.

Each smooth anchor has a **Curve amount** from 0% to 150% and a **Tangent angle** from −180° to 180°. Curve amount controls how far the handles extend; tangent angle controls which direction the path bends, including inward and outward variants of the same three points. Drag the teal tangent handle directly on the canvas or use the inspector slider, then choose **Restore automatic angle** to return to the three-to-four-point prediction. Traced paths default to 100% curve amount. Magnetic boundary samples are relaxed and simplified before being committed, and a visually broken edge warns but does not block the next anchor.

For a pointed inward valley, enable **Split incoming/outgoing handles** on that anchor. The teal incoming handle controls the preceding segment and the purple outgoing handle controls the following segment. Each handle can be dragged as far as needed; its dashed guide remains connected to the anchor, and the inspector shows its exact distance. Put both handles on the inside of the valley to bend both segments inward without forcing one side to reverse into a loop. Disable the option to return to the original linked tangent behavior.

Click the segment between two anchors to select that segment. The add-anchor command then inserts the new point on that segment. Without a segment selection, the command uses the path-wide fallback.

With one or more anchors selected, `Backspace` or `Delete` removes only those anchors and keeps the path. Without an anchor selection, the same keys delete the selected object. Open paths retain at least two anchors, and closed shapes retain at least three.

## Local smoothing

Select a curved path, then drag a box around at least two anchors (or Shift-click them). In **Local smoothing / 局部順線**, adjust **Softness / 柔順度** from 0 to 300, enter a number, or use the ± buttons (5 per click). From 0–100, the selected handles are coordinated together. From 100–300, the aligned handles extend further for stronger roundness, with limits based on the adjacent segment lengths. A higher value is not necessarily a closer fit to the reference. Anchors do not move; the segments entering and leaving the selected area can also change.

Zero and **Restore this smoothing / 還原這次順線** restore the exact starting shape for this adjustment. Moving from 30 to 80 and back to 30 gives the same result. Changing the selection or manually editing the path starts a new adjustment baseline; Ctrl+Z can undo the operation. Saved projects and PowerPoint receive ordinary editable control handles, not a temporary visual effect. The slider starts at zero relative to the saved shape after reopening.

Open endpoints, explicit sharp/zero-amplitude points, and pronounced inward cusps are protected automatically; the panel shows the protected count. Already-recognized circles stay circular. This first version adjusts handles only: misplaced anchors may still need manual repositioning, and 100 is not always the best match to the reference image.

Selected anchors are bright red with a white outline, including Shift-selected and sharp anchors. Anchor circles are 14 screen pixels across, tangent handles are 16, and their invisible click targets are 36; these sizes remain constant when zooming. Overlapping click targets choose the nearest visible center. Magnetic orange markers also keep a constant screen size. Dashed tangent guides remain connected to the actual anchor. Very short or overlapping tangent handles are displayed farther away for easier selection; this display gap alone does not change the curve.

The linked tangent handle can be pulled farther to change both its angle and curve reach. Split handles keep independent directions and lengths for inward cusps. These controls are preserved as editable native Bézier nodes in PowerPoint, including after a cached update. After updating Skechu, restart the local bridge and copy the shape again; an already-pasted PowerPoint shape does not update automatically.

## Automatic line-art tracing

Import a reference with **底圖**, then press **自動描圖** in the top mode group. This mode extracts dark strokes from a pale background into single editable curves; it is intended for line-art illustrations, not photographs or solid silhouettes. The existing manual boundary magnet remains available.

- **辨識門檻**: raise to include lighter ink, lower to reject shading and filled areas.
- **貼線誤差**: defaults to 2.5 original-image pixels for broad curved strokes; lower for tighter fitting or raise (up to 6) for longer arcs.
- **跨步幅度**: defaults to 90; use more of the fitting tolerance to reduce anchors. The fitter refines each cubic before splitting it into smaller steps, while preserving shared T-junction anchors.
- **忽略碎線**: discard isolated short fragments without deleting connecting branches.

Opening automatic tracing immediately predicts and draws blue pen curves, using the same stroke style as the manual tracing pen. Changing settings automatically updates the lines after a short input pause; there is no regenerate button. The preview can hide the reference or show red review markers. Previous lines fade during updates and Apply stays disabled until the latest result is ready. **套用線圖** adds the editable curves in one undo step and never replaces existing artwork. **取消** stops pending computation and leaves the canvas untouched. Computation stays in a local background worker, and large references are processed at up to 2048 pixels on their longest side.

**實際錨點（青色）** shows every anchor that will be applied, not raster samples. Click a preview curve to highlight it and see that curve's anchor count. **Red rings are review warnings, not anchors.** Preview and applied anchor counts are identical.

For an existing dense curve, select that one object and use **精簡這條線的錨點** in the inspector. The default fitting tolerance is 1.5 canvas units. Simplification samples the actual Bézier curve (not its anchor polygon), refits longer spans, and keeps endpoints, shared junctions, review positions, and cusps. It does not force complex curves to three anchors. Changes affect only the selected curve and are undoable; existing artwork is never automatically migrated.

T junctions share an anchor position while retaining separate branch curves. Moving any member moves the shared point. The orange ring identifies a shared junction. Ordinary anchors can be deleted as usual; for a junction, select **解除這個分岔接點** first so branch disconnection is explicit. Deleting an entire branch leaves the other paths intact.

Nearby but disconnected endpoints are not automatically bridged. Use **下一個待確認** in the inspector to visit red markers after applying, then edit the connection or select **這個接點已確認**. Review marks and shared junctions survive project save/reload. Curves remain editable in SVG and native PowerPoint output.

## Joining paths manually

- Hold `Ctrl` while dragging an endpoint to snap it to another path's endpoint or midpoint.
- `Shift`-click two paths, right-click, and choose merge.
- Endpoint-to-endpoint joins become one continuous path.
- Endpoint-to-midpoint joins become a persistent T-junction: moving the trunk updates the attached branch root.

## Filling closed regions

Drag a swatch from the left palette into a closed path, rectangle, ellipse, or polygon. The target outline lights up before the drop, and the fill remains editable in the inspector and in native PowerPoint output. A traced path whose endpoints are already close together is closed automatically when it contains at least three distinct boundary points.

Clicking a swatch applies it to the current selection instead. Use **Add swatch** beside the custom color picker to keep frequently used colors in the palette; the palette is stored locally in the browser.

T junctions and intersecting editable paths can also enclose fillable regions. Drag a swatch into the desired region; the preview highlights only that region, not the entire enclosing object. Small endpoint gaps within the visible stroke width are tolerated, but a dangling T or an open gap does not create a region. Reference-image lines are not fill boundaries: trace those lines first.

A multi-path fill creates a separate **區域填色** vector layer with the original curve controls, leaving source paths unchanged. You can recolor, undo, save, and copy that color shape to PowerPoint as an editable freeform. It is an independent shape, not a live paint link: later source-path edits do not reshape an existing color layer automatically.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+C` | On the Windows local edition, copy selected objects as native editable PowerPoint layers; also keep an internal Skechu copy |
| `Ctrl+V` | Paste in PowerPoint after the copy finishes, or paste internally when Skechu is focused |
| `Ctrl+Shift+C` | Alternate shortcut for native PowerPoint copying |
| `Ctrl+A` | Select all canvas objects |
| `Shift+click` | Add or remove an object from the selection |
| `Ctrl+drag endpoint` | Snap to another endpoint or path midpoint |
| `Delete` / `Backspace` | Delete selected anchors; delete the object only when no anchor is selected |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Enter` | Finish the active trace |
| `Esc` | Cancel the active trace |

## Copying to PowerPoint

When an input or editable text field is focused, Ctrl+C keeps its normal text-copy behavior. For native object copying, select the object on the canvas or in the layer list, press Ctrl+C, wait for the successful-copy message, then switch to PowerPoint and press Ctrl+V. The hosted web edition only supports the internal Skechu copy; native PowerPoint clipboard formats require the Windows local bridge.

## Project files

The editor autosaves locally in IndexedDB. Use **Download project** for a portable `.skc` project file and **Load project** to restore it. Imported reference images are embedded in that project data but excluded from SVG and PowerPoint output. Legacy `.sktc`, `.sketchou`, `.sketchou.json`, and `.json` project files remain supported.
