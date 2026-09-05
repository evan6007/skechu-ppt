# Architecture

Skechu-PPT deliberately has two small parts:

```text
Browser editor (SVG + IndexedDB)
        │ JSON over loopback HTTP
        ▼
Python bridge (ThreadingHTTPServer)
        │ one serialized COM worker
        ▼
Microsoft PowerPoint native shapes
```

The browser editor is a dependency-light single-page application. It performs hit testing, Bézier routing, magnetic reference analysis, project persistence, and SVG export locally.

The Python bridge serves the static editor and handles `/prepare` and `/copy`. HTTP requests remain concurrent, while every PowerPoint COM operation is routed through one permanent `ThreadPoolExecutor(max_workers=1)`. That matters because Office COM objects are apartment-threaded and cached groups are only safe to reuse from their owning worker.

The editor prewarms the complete workspace rather than only the current selection. Small edits can therefore update existing native nodes incrementally; a later full selection can reuse the same cache. A failed native export is reported to the browser and no fallback error slide is written.

`ppt-preparation.js` coalesces changes after an 1800 ms idle interval, serializing only after the pause. At most one preparation runs, with one latest pending version; an explicit copy drops obsolete pending work. The first web Copy click probes `/web-ppt/status`, then calls `/web-ppt/copy` directly from the editor. Subsequent background requests use `/web-ppt/prepare` and `/web-ppt/cancel-prepare`. The first load never probes loopback or prompts for local-network permission. Preparation never writes the clipboard. The legacy popup helper remains available for older web clients, but the current editor never opens it.

The bridge keeps a bounded LRU of six app-owned hidden presentation caches keyed by a per-tab/page/selection identity. Partial copies do not overwrite the full-scene cache. UI-only names, locks and folder metadata are excluded from geometry fingerprints. A stable internal coordinate origin allows outer-boundary movement to update just the changed objects; structural or unsupported changes safely fall back to a background rebuild. Only app-owned cache presentations are evicted; user presentations are never closed. These caches are ephemeral, not file backups.

## Trust boundary

The server binds to `127.0.0.1` and serves only the checked-out `app/` directory. Project images and JSON stay in the browser or local downloads. There is no telemetry, remote API, account, or background upload.

Remote operations require a matching official/local Origin and the server's loopback Host and port. CORS permits only those origins, never `*`; web requests are size-limited JSON, with type, finite-coordinate and image-path checks before any Office work or cache cancellation. Browser Local Network Access permission remains browser-controlled. No POST is retried automatically after a transport failure because Office may already have written the clipboard.
