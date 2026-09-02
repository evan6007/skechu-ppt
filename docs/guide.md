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

## Joining paths

- Hold `Ctrl` while dragging an endpoint to snap it to another path's endpoint or midpoint.
- `Shift`-click two paths, right-click, and choose merge.
- Endpoint-to-endpoint joins become one continuous path.
- Endpoint-to-midpoint joins become a persistent T-junction: moving the trunk updates the attached branch root.

## Filling closed regions

Drag a swatch from the left palette into a closed path, rectangle, ellipse, or polygon. The target outline lights up before the drop, and the fill remains editable in the inspector and in native PowerPoint output. A traced path whose endpoints are already close together is closed automatically when it contains at least three distinct boundary points.

Clicking a swatch applies it to the current selection instead. Use **Add swatch** beside the custom color picker to keep frequently used colors in the palette; the palette is stored locally in the browser.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+C`, `Ctrl+V` | Copy and paste selected editor objects |
| `Ctrl+Shift+C` | Copy selected objects as native PowerPoint layers |
| `Ctrl+A` | Select all canvas objects |
| `Shift+click` | Add or remove an object from the selection |
| `Ctrl+drag endpoint` | Snap to another endpoint or path midpoint |
| `Delete` / `Backspace` | Delete selected anchors; delete the object only when no anchor is selected |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Enter` | Finish the active trace |
| `Esc` | Cancel the active trace |

## Project files

The editor autosaves locally in IndexedDB. Use **Download project** for a portable `.skc` project file and **Load project** to restore it. Imported reference images are embedded in that project data but excluded from SVG and PowerPoint output. Legacy `.sktc`, `.sketchou`, `.sketchou.json`, and `.json` project files remain supported.
