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

## Trust boundary

The server binds to `127.0.0.1` and serves only the checked-out `app/` directory. Project images and JSON stay in the browser or local downloads. There is no telemetry, remote API, account, or background upload.
