# User guide

## Tracing

Choose **Tracing pen**, click once to place the first anchor, move the pointer to preview the route, and click again to commit the next anchor. Press `Enter` or double-click to finish; press `Esc` to cancel the current path.

When magnetic tracing is enabled, Skechu-PPT estimates the centerline of the imported reference stroke. The orange indicator is the candidate point; the committed path uses the same routed centerline.

## Editing anchors

Click a path, then click an anchor. In the inspector, choose **Smooth curve** or **Sharp corner** for that anchor. The visible anchor is intentionally small; a larger transparent hit target keeps it easy to select.

Click the segment between two anchors to select that segment. The add-anchor command then inserts the new point on that segment. Without a segment selection, the command uses the path-wide fallback.

## Joining paths

- Hold `Ctrl` while dragging an endpoint to snap it to another path's endpoint or midpoint.
- `Shift`-click two paths, right-click, and choose merge.
- Endpoint-to-endpoint joins become one continuous path.
- Endpoint-to-midpoint joins become a persistent T-junction: moving the trunk updates the attached branch root.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+C`, `Ctrl+V` | Copy and paste selected editor objects |
| `Ctrl+Shift+C` | Copy selected objects as native PowerPoint layers |
| `Ctrl+A` | Select all canvas objects |
| `Shift+click` | Add or remove an object from the selection |
| `Ctrl+drag endpoint` | Snap to another endpoint or path midpoint |
| `Delete` / `Backspace` | Delete selection |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Enter` | Finish the active trace |
| `Esc` | Cancel the active trace |

## Project files

The editor autosaves locally in IndexedDB. Use **Download project** for a portable `.skc` project file and **Load project** to restore it. Imported reference images are embedded in that project data but excluded from SVG and PowerPoint output. Legacy `.sktc`, `.sketchou`, `.sketchou.json`, and `.json` project files remain supported.
