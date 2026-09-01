<p align="center">
  <img src="assets/brand/logo-banner-v3.svg" width="620" alt="Sketchou-PPT">
</p>

<p align="center"><strong>Turn raster references into clean, editable vector graphics — then paste them as native PowerPoint layers.</strong></p>

<p align="center">
  <a href="https://github.com/evan6007/sketchou-ppt/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/evan6007/sketchou-ppt/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-22c55e.svg"></a>
  <img alt="Windows" src="https://img.shields.io/badge/PowerPoint-Windows-7c3aed.svg">
  <img alt="Local first" src="https://img.shields.io/badge/privacy-local--first-172033.svg">
</p>

## Why Sketchou-PPT?

Scientific diagrams, teaching figures, and presentation artwork often begin as screenshots or raster references. Conventional tracing tools can produce vectors, but getting those paths into PowerPoint as separately editable shapes is still awkward. Sketchou-PPT closes that gap with a focused, local workflow.

- **Centerline magnetic tracing** follows the middle of thick raster strokes.
- **Click-to-place anchors** show a quiet live preview instead of flooding the canvas with points.
- **Smooth or sharp per anchor** keeps most of a path rounded while preserving intentional corners.
- **Segment-aware anchor insertion** places a new anchor exactly on the selected segment.
- **Endpoint and T-junction snapping** joins branches to endpoints or the middle of another path.
- **Native PowerPoint export** copies paths, shapes, text, and groups as editable Office objects.
- **Local-first persistence** stores projects in IndexedDB; reference images stay on your machine.

## Quick start

Requirements: Windows 10/11, Python 3.8+, and desktop Microsoft PowerPoint for native PPT export. The editor and SVG export work in a modern browser without PowerPoint.

```powershell
git clone https://github.com/evan6007/sketchou-ppt.git
cd sketchou-ppt
powershell -ExecutionPolicy Bypass -File .\scripts\launch.ps1
```

The launcher installs `pywin32` when needed, starts a loopback-only server at `127.0.0.1:8766`, and opens the editor. No cloud account is required.

### Install the desktop app icon

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-shortcut.ps1
```

This creates a **Sketchou-PPT** icon on the current Windows desktop. Double-clicking it starts the local bridge silently and opens the editor.

## Core workflow

1. Click **Import tracing reference** and choose a PNG, JPEG, WebP, GIF, or SVG.
2. Enable the tracing pen, click the first anchor, move along the reference, then click to place the next anchor.
3. Select an anchor to switch it between smooth and sharp.
4. Hold `Ctrl` while dragging an endpoint to snap it to another endpoint or path midpoint.
5. `Shift`-select two joined paths, right-click, and merge them as a chain or persistent T-junction.
6. Use `Ctrl+Shift+C` or **Copy to PPT** for native PowerPoint layers; use **Export SVG** for a standards-based vector file.

Keyboard shortcuts and design notes are documented in [docs/guide.md](docs/guide.md). The PowerPoint bridge architecture is explained in [docs/architecture.md](docs/architecture.md).

## Privacy and safety

Sketchou-PPT binds only to `127.0.0.1`; it does not upload projects or reference images. The PowerPoint bridge serializes COM work on one permanent worker thread and cancels failed exports instead of leaving a partial error layout.

## Project status

`v0.1.0` is the first public preview. The core tracing, snapping, project persistence, SVG export, and Windows PowerPoint path are usable. See the [roadmap](ROADMAP.md) and [changelog](CHANGELOG.md) for current boundaries.

## Contributing

Bug reports, reproducible sample files, documentation fixes, and focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening an issue.

## License

Sketchou-PPT is released under the [MIT License](LICENSE). KaTeX is distributed under its own MIT license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
