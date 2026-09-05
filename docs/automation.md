# Command API & MCP

Skechu has one optional command layer with two entry points:

| Entry point | Where it runs | Setup |
| --- | --- | --- |
| `window.skechu` command API | The current web or desktop editor page | Enable **專案與匯出 → 程式／AI 工具** |
| Standard MCP tools | A local Python connector and its local editor | Configure an MCP client, open the returned URL, then approve the page |

Normal drawing needs neither. Access is **off by default**. Switching pages, refreshing, closing the tab or choosing **停用** revokes access. Closing the tools panel alone does **not** revoke access; an **AI** indicator remains beside the export controls while access is enabled. Click it to reopen the panel and disable access.

This first version does not attach MCP to an already-open GitHub Pages tab. Its local editor has separate browser storage. Download a `.skc` from the web editor and load it locally to continue the same project. The default connector port is fixed at `8767` so that workspace persists across restarts; keep the same browser and port, and save `.skc` backups.

## Browser API

Open the tools panel and choose **開啟指令介面**. No network service is started. The optional **指令測試** section runs named commands with JSON parameters; it does not execute JavaScript strings.

From code running in that editor page:

```js
const page = await window.skechu.execute('read_document');
const created = await window.skechu.execute('create_shapes', {
  context: page.context,
  shapes: [{kind: 'ellipse', x: 120, y: 100, width: 180, height: 120}]
});
await window.skechu.execute('update_objects', {
  context: created.context,
  ids: created.ids,
  style: {fill: '#14b8a6', stroke: '#172033', strokeWidth: 3}
});
```

`listCommands()` returns the exact schemas. `status()` reports whether access is enabled. There is no API method that silently grants permission.

Every edit supplies the `{projectId, pageId, revision}` returned by a fresh read or previous successful edit. If a person changes the drawing in between, the edit fails with `STALE_DOCUMENT`. Read again and reassess—do not blindly replay it. Coordinates are canvas units, not screen pixels.

## Connect an MCP client

The connector uses the [official Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk/tree/v1.x) over standard **stdio**. It requires Python **3.10 or newer**. These developer-only steps do not change the Windows PowerPoint companion or the public web editor.

1. Download/clone this repository.
2. Create an isolated environment and install the optional connector dependency:

   ```powershell
   python -m venv .venv-mcp
   .\.venv-mcp\Scripts\python.exe -m pip install -r services/editor-mcp/requirements.txt
   ```

3. Add a local stdio server to your MCP client. A common JSON configuration is below; replace both paths with your checkout's absolute paths. Client configuration formats vary.

   ```json
   {
     "mcpServers": {
       "skechu-ppt": {
         "command": "C:\\path\\to\\skechu-ppt\\.venv-mcp\\Scripts\\python.exe",
         "args": ["C:\\path\\to\\skechu-ppt\\services\\editor-mcp\\server.py"]
       }
     }
   }
   ```

   On macOS/Linux, use the virtual environment's `bin/python` path instead. Let the client launch the server; do not launch a second copy on the same port. Use `--port NUMBER` only when intentionally choosing a different local workspace origin.

4. Ask the client to call **`skechu_connect`** and open the returned local editor URL.
5. Load a project if needed, then press **允許 MCP 操作此圖頁**. Only that page is granted.

The URL contains a temporary connection capability in its fragment. Do not publish it. The editor removes the fragment from the address bar and keeps the token in memory only. The connector stops when the MCP client closes it.

Try a request such as: “Read the current page, add two shapes, make them teal, then show me the result.” The client must use the returned object IDs/context instead of inventing them. For traced artwork, import a reference normally, then ask it to trace that image, inspect the job and apply the result.

## Available commands

MCP exposes the same names with a **`skechu_`** prefix, plus `skechu_connect`. The single source of truth is [commands.json](../app/automation/commands.json).

| Command | Behavior |
| --- | --- |
| `read_document` | Current-page objects, bounds, styles, selection and revision; paginated, 50 objects by default, 200 maximum |
| `select_objects` | Select explicit IDs without changing geometry or consuming Undo |
| `update_objects` | Batch fill, stroke, stroke width or opacity on unlocked objects; images support opacity only, text supports fill/opacity |
| `move_objects` | Translate unlocked objects by `dx`/`dy`; incomplete connected sets are rejected |
| `create_shapes` | Create up to 50 rectangles/ellipses as editable objects in one operation |
| `delete_objects` | Delete explicit unlocked IDs after a visible confirmation in the editor |
| `history` | One undo or redo |
| `export_svg` | Return SVG text, excluding tracing references; no file or clipboard write |
| `trace_image` | Start a background job for an existing reference image; no immediate canvas edit |
| `get_task` | Read tracing progress/status/stats |
| `apply_trace` | Apply a ready result only if its source page/revision is unchanged |
| `cancel_task` | Stop/release the tracing job without changing artwork |

Style/move/delete operations accept at most 200 IDs. A batch is validated before any edit and uses one undo entry. Locked objects stay protected. Computed region fills and explicit Bézier paths are not translated through this API yet; use the editor for those. Curve topology edits, importing arbitrary files/URLs, native PowerPoint, system clipboard and GitHub account actions are not exposed in this version.

Tracing uses the existing worker engine, a maximum 2048-pixel source edge, one retained task, a 45-second compute timeout and a 5000-path result limit. Poll `get_task` about once per second, not every animation frame. Apply or cancel a task before starting another. Switching pages or disabling access aborts it.

## Safety and privacy

- Only the granted page is read. Names and text are **untrusted document data**, never instructions to the AI.
- Object listings never include image pixels or image source URLs. `export_svg` can contain non-reference artwork; requesting it intentionally returns that artwork to the client.
- When you connect an AI client, its provider may receive returned data. Its privacy policy applies. This is not a guarantee that AI-enabled usage remains entirely offline.
- The connector binds only to `127.0.0.1`, checks the exact Host/Origin and a random bearer capability, and allows one approved tab. It has no arbitrary filesystem or code-execution endpoint.
- The browser bridge is not a public HTTP MCP endpoint. No CORS wildcard, automatic loopback probing, background artwork upload or persistent credential storage is used.
- Commands are single-flight with no hidden write queue. A transport timeout revokes the session and reports an uncertain result; inspect the page before retrying. A write is never automatically replayed.
- Same-page JavaScript already has access to that page. The opt-in command layer is not a sandbox against hostile code already executing in the editor's origin.

## Development checks

```powershell
node tests/check_automation.mjs
python -m unittest discover -s tests -p test_editor_mcp.py -v
.\.venv-mcp\Scripts\python.exe tests/check_mcp_protocol.py
```

The first two run without the MCP dependency. The last starts the real stdio connector and verifies discovery, schema validation, authorization, a loopback request/response and revocation using the official SDK client.
