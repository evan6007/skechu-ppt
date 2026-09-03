<p align="center">
  <img src="assets/brand/logo-banner-skechu-v4.svg" width="620" alt="Skechu-PPT">
</p>

<p align="center"><strong>Trace an image into clean, editable vectors—without learning a complicated design tool.</strong></p>

<p align="center">
  <a href="https://evan6007.github.io/skechu-ppt/"><img src="assets/brand/open-web-cta.svg" width="620" alt="Open Web — launch Skechu-PPT free in your browser. No installation or sign-in."></a>
</p>

<p align="center"><strong>Click Open Web and start drawing.</strong><br>免安裝、免登入，打開網頁就能開始描圖。</p>

<p align="center">Works on Windows, macOS, Linux, Chromebook, iPhone, iPad, and Android.<br>Need native editable PowerPoint layers? <a href="https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe">Get the Windows installer →</a></p>

<p align="center">
  <a href="https://github.com/evan6007/skechu-ppt/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/evan6007/skechu-ppt/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-22c55e.svg"></a>
  <img alt="Local first" src="https://img.shields.io/badge/privacy-local--first-172033.svg">
</p>

## Start here

| Your device | What to click | Best for |
| --- | --- | --- |
| Most users — on computer, phone, or tablet | **[Open Web — recommended](https://evan6007.github.io/skechu-ppt/)** | Instant access to tracing, editing, `.skc` projects, and SVG export |
| Windows 10/11 with desktop PowerPoint | **[Download the Windows installer](https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe)** | Everything above, plus native editable PowerPoint layers |

Want it to feel like a normal app? The web edition can be added to your desktop, Dock, application launcher, or phone home screen. See the **[click-by-click installation guide](docs/install.md)**—no command line is required.

## Make your first trace

1. Open Skechu-PPT and choose **Import image to start tracing**.
2. Choose **自動描圖 (Auto trace)** to generate editable curves from a line-art reference or a solid Logo, or use the tracing pen to follow visible boundaries by placing anchors yourself.
3. Download the result as an editable **SVG**, or save the whole workspace as a portable **`.skc` project**.

On the Windows edition, select your vectors and choose **Copy to PPT** to paste them into PowerPoint as separately editable native shapes.

Right-click a **page thumbnail** for page copy/paste, duplication, rename, blank-page insertion, reordering and deletion. Page copies preserve the canvas size and remain independently editable. To add an ordinary image layer, choose **Copy image** on a web image, return to the canvas and press **Ctrl+V** (not Copy image address). The pasted image keeps its proportions, is unlocked, and supports Undo; text fields retain normal paste. Multi-selected curves display their anchors instead of individual bounding rectangles: drag a stroke to move the group, or click an anchor to edit that path.

**Auto trace without guessing parameters:** leave **自動判斷** selected. Thin drawings use centerlines with shared T-junctions; solid black/white Logos use closed outlines around dark regions and their cutouts. You can override this with **細線稿** or **Logo 輪廓**. The result is editable pen curves, not automatically recolored artwork. All four controls are live sliders: **深淺辨識** (dark only → include lighter detail), **曲線柔順** (closer fit → smoother), **錨點精簡** (more → fewer control points), and **細節清理** (keep tiny details → remove small fragments). Start with the recommended defaults; move the first slider right for missing detail or left for unwanted shading. **恢復推薦設定** resets everything. Preview is isolated until **套用線圖**, and applying creates one undoable layer group without changing the reference image.

The toolbar also has **全選並複製** (select all and copy). Both editions keep the PPT button visible, with a persistent success/error message. **The web editor can copy directly to native editable PowerPoint shapes on Windows**: install/start Skechu-PPT **v0.1.2 or later**, click **複製到 PPT** (or Ctrl+C), and approve the local connection window with **允許連接**. Keep that small window open, wait for **複製成功**, then press Ctrl+V in desktop PowerPoint. You keep drawing on the website—no `.skc` transfer is needed. See the [connection guide](docs/install.md#copy-from-open-web-directly-to-powerpoint).

Without the local Windows companion, download SVG, or explicitly choose **複製圖片到 PPT** for a PNG (not editable anchors). Failed native copying never silently substitutes a picture. Web Ctrl+C also keeps the internal Skechu copy.

**Faster repeated copying (v0.1.3+)**: after connection, edits are prepared in the background when you pause for about 0.65 seconds. Look for **快取就緒** beside the PPT button. Only changed geometry is updated where possible; selecting/locking/collapsing layers does not rebuild it. Full-scene and partial-selection caches are separate. Preparation does not overwrite your clipboard. A first copy, a new/evicted selection, structural changes, or restarting PowerPoint can still require initial preparation.

## Why it feels different

- **Magnetic boundary tracing** follows visible brightness and color transitions, so it works for filled shapes, patterns, shadows, and ordinary line art.
- **Automatic line-art tracing** generates editable curves with connected T-junctions. The live preview shows actual anchors; dense curves can be simplified afterward without moving their shared endpoints.
- **Click-to-place anchors** show the orange magnetic candidate even before the first click; the live curve uses a three-to-four-point neighborhood and remains drawable across small broken edges.
- **Curve amount and tangent controls per anchor** let one path mix soft curves, linked tangents, independently distant split handles, inward valleys without loops, outward bulges, and deliberate sharp corners.
- **Precise joining** snaps endpoints to endpoints or to the middle of another path for branches and T-junctions.
- **Segment-aware editing** inserts a new anchor exactly on the segment you selected.
- **Continuous paint bucket** (`B`) fills closed vector regions, including T-junction regions, with repeated clicks. Drag-and-drop swatches still work. The most recently painted fill sits above older fills, while all vector outlines stay on top. This order is shared by the editor, SVG and PowerPoint, including cached native copies.
- **Hand tool** (`H`): choose **拖移** beside the selection tool and drag with the left mouse button to pan the canvas without moving objects or anchors. Use `V` / Escape to return to selection, or **適合** to recenter.
- **Predictable selection**: left-drag an object to move it; right-drag to marquee-select objects or anchors, with Shift to add. A right-click without dragging keeps the context menu. Left-click blank canvas or checkerboard space to deselect. Shift-click toggles selection, and marquee selection excludes locked references. Clicks and small pointer movements do not consume Undo or discard Redo; Escape cancels an active drag or clears selection.
- **Layer folders**: automatic tracing creates one collapsed, expandable folder per batch (including existing projects). Shift-select layers and choose **建立群組** to organize your own folders, or **移出群組** to remove members. Drag the left grip to reorder a layer or folder; drop a layer in a folder header's center to add it. The right-hand eye shows/hides one layer or the entire folder, independently of its lock. Hidden items remain saved but cannot be selected on the canvas and are excluded from exports. Curves remain separately editable; grouping, visibility, locks and order survive `.skc` save/reload and support Undo. References stay below artwork and fills stay below outlines.
- **Always-visible layers panel**: the right sidebar reserves its upper two thirds for tools and its lower third for layers, with independent scrolling in each section.
- **Reference color picker** (`I`) samples the original image color with a magnifier beside the cursor. Sampling from the bucket returns you to continuous filling.
- **Mouse-resizable reference image**: unlock the reference in the inspector to drag it directly and resize from any of its four corners. Corners keep proportions by default; hold Shift for free sizing. Locked references show only their outline. **調整底圖大小** remains a shortcut for adjusting only the reference without unlocking it. Neither workflow moves traced vectors; Undo is supported and references remain excluded from exports.
- **Portable projects** use the short `.skc` extension and can move between devices.
- **Editable output** exports standard SVG everywhere and native PowerPoint layers on Windows.

## Which edition should I use?

| Feature | Web edition | Windows edition |
| --- | :---: | :---: |
| Manual and automatic tracing, anchor editing | ✓ | ✓ |
| Local autosave | ✓ | ✓ |
| Download and load `.skc` projects | ✓ | ✓ |
| Export editable SVG | ✓ | ✓ |
| Install as an app | ✓ | ✓ |
| Copy native editable layers to PowerPoint | ✓ with Windows companion | ✓ |

The native PowerPoint bridge uses Windows COM automation, so **Copy to PPT is Windows-only**, including when drawing in the web editor. It requires desktop PowerPoint and the running local companion. macOS, Linux, and mobile users still get the complete browser editor and SVG workflow.

## Your work stays yours

Skechu-PPT is local-first. The editor stores its autosave in the browser on your device; it does not upload reference images or projects to a Skechu server. Use **Download project** whenever you want a portable backup or need to continue on another device.

## Project status

Skechu-PPT is an open-source public preview. Detailed keyboard controls are in the [user guide](docs/guide.md); implementation details are in the [architecture notes](docs/architecture.md); current work is tracked in the [roadmap](ROADMAP.md) and [changelog](CHANGELOG.md).

<details>
<summary><strong>Developers and contributors</strong></summary>

The hosted editor is a static, dependency-vendored web app. The optional Windows bridge is Python plus `pywin32`. Source-based setup, tests, and architecture notes are intentionally kept out of the beginner quick start.

Bug reports, small documentation improvements, and focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) first.

</details>

## License

Skechu-PPT is released under the [MIT License](LICENSE). KaTeX is distributed under its own MIT license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
