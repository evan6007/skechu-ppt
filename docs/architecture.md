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

`ppt-preparation.js` coalesces changes after a 650 ms idle interval, serializing only after the pause. At most one preparation runs, with one latest pending version; an explicit copy drops obsolete pending work. Connected web clients use the same `/prepare` path through their consent-gated companion window. Older helpers without the preparation capability still support on-demand copy. Preparation never calls the clipboard-writing endpoint and does not replace the copy progress UI.

The bridge keeps a bounded LRU of six app-owned hidden presentation caches keyed by a per-tab/page/selection identity. Partial copies do not overwrite the full-scene cache. UI-only names, locks and folder metadata are excluded from geometry fingerprints. A stable internal coordinate origin allows outer-boundary movement to update just the changed objects; structural or unsupported changes safely fall back to a background rebuild. Only app-owned cache presentations are evicted; user presentations are never closed. These caches are ephemeral, not file backups.

## Trust boundary

The server binds to `127.0.0.1` and serves only the checked-out `app/` directory. Project images and JSON stay in the browser or local downloads. There is no telemetry, remote API, account, or background upload.
