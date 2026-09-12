<p align="center">
  <img src="assets/brand/logo-banner-skechu-v4.svg" width="620" alt="Skechu-PPT">
</p>

<p align="center"><strong>Trace images. Refine every curve. Keep editing in PowerPoint.</strong><br>Skechu (Skechu-PPT) is a free, open-source image tracing and vector editor.</p>

<p align="center">
  <a href="https://evan6007.github.io/skechu-ppt/"><img src="assets/brand/open-web-cta.svg" width="620" alt="Open Web — launch Skechu-PPT free in your browser. No installation or sign-in."></a>
</p>

<p align="center">免安裝、免登入。匯入圖片，描線、填色，再把每個物件繼續改。<br><a href="https://evan6007.github.io/skechu-ppt/about.html">Skechu 功能與使用說明</a></p>

<p align="center">Works on Windows, macOS, Linux, Chromebook, iPhone, iPad, and Android.<br>Need direct native PowerPoint copy/paste? <a href="https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe">Get the Windows installer →</a></p>

<p align="center">
  <a href="https://github.com/evan6007/skechu-ppt/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/evan6007/skechu-ppt/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-22c55e.svg"></a>
  <img alt="Local first" src="https://img.shields.io/badge/privacy-local--first-172033.svg">
</p>

<p align="center">
  <img src="docs/media/editor-anchor-showcase.png" width="1200" alt="Skechu-PPT editing a detailed illustration with hundreds of visible vector anchor points">
</p>

<p align="center"><sub>A real Skechu-PPT project: hundreds of editable anchors, pages, layers, fills, and the original reference image in one workspace.</sub></p>

## See it at a glance

<table width="100%">
  <tr>
    <td width="50%" valign="top"><img src="docs/media/features/feature-magnetic-trace.gif" width="100%" alt="The cursor moves above a line while the orange tracing point stays snapped to its edge"></td>
    <td width="50%" valign="top"><img src="docs/media/features/feature-auto-trace.gif" width="100%" alt="A reference image becomes unfilled line art with editable anchors"></td>
  </tr>
  <tr>
    <td valign="top"><strong>Magnetic tracing</strong><br>Move near an image boundary. The orange point follows the edge.</td>
    <td valign="top"><strong>Auto trace</strong><br>Turn a reference into line art. Every anchor stays editable.</td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/media/features/feature-rainbow-fill.gif" width="100%" alt="Line-art regions receive color, including areas enclosed by T-junctions"></td>
    <td width="50%" valign="top"><img src="docs/media/features/feature-powerpoint.gif" width="100%" alt="Traced artwork is pasted into PowerPoint and its editable parts are spread across a slide"></td>
  </tr>
  <tr>
    <td valign="top"><strong>Connected-region fill</strong><br>Fill areas enclosed by your line art—even at T-junctions.</td>
    <td valign="top"><strong>Native PowerPoint objects</strong><br>Edit lines, fills, and regions independently in desktop PowerPoint.</td>
  </tr>
</table>

## More than tracing

- **Browser-local image HD:** a standalone **圖片高清** action beside **新增底圖** offers 2× / 4× anime super-resolution, a draggable double-arrow comparison divider, original/split/full-result views, PNG download, and a new reference page without replacing the original. Start from the fixed bottom-right action; oversized outputs are flagged before processing. The approximately 4 MB model/runtime loads only on explicit use; images stay on-device. GPU support is required for AI mode, with a clearly labelled non-AI alternative. [Usage, limits and model licenses](docs/browser-hd.md).
- **Automatic colors, with a choice:** open **自動填色** and choose **智慧推薦** (image-based recommendation), **平塗色區** (flat regions for line art / logos), or **漸層光影** (source-fitted shading for color illustrations). The new shading engine starts with gradient fields: it partitions source pixels, fits multistop colors, and shares each boundary between neighbouring closed regions. It does not construct a stack of flat-color overlays or prune that stack afterward. This is still an approximation, not semantic redraw or guaranteed restoration of blurred eyes. [How it works and local evaluation](experiments/gradient-trace/README.md).
- **Separate line art and fills:** trace shared boundaries once, then create colors in their own group. Applying automatic colors does not replace, duplicate, or recolor your line art.
- **Editable gradient fills:** select a closed region and click **漸層**. Add 2–10 color stops, drag their positions, adjust transparency and angle, or return to a solid fill. Gradients stay editable in `.skc`, SVG, and native PowerPoint objects (requires Windows companion **v0.1.6+**). This is a manual linear-gradient tool, not automatic lighting reconstruction.
- **Detail-first native gradients:** **自動填色 → 精細原生漸層 · 細節優先** can be applied to the canvas and transferred through the native PowerPoint workflow. **智慧推薦** chooses it for continuous shading; the faster shading mode remains available. Colors stay editable in multiple vector regions, not a flattened picture or single-shape 2D mesh. Higher fidelity may require more objects; large selections use a compact outline to keep editing responsive. The preview-only research mode is hidden from the normal menu. [Usage, measured tradeoffs and limits](docs/native-fill.md).
- **Curves you can refine:** edit anchors, tangents, shared junctions, and local smoothing.
- **Scissors for editable paths:** split lines with point, straight or freehand cuts. Toggle **畫完直接切斷** off to add anchors without breaking paths. Hold Ctrl for horizontal/vertical cuts, or right-click / long-press an anchor for point cutting. Anchors are immediately editable, with one-step undo.
- **A workspace that stays organized:** pages, layers, groups, locks, and adjustable canvas size and color.
- **Touch controls:** two-finger pan and zoom, compact panels, separate copy/paste, and a visible delete button.
- **Portable work:** save `.skc` projects, export SVG or native editable PPTX in your browser, or copy native objects directly to PowerPoint with the Windows companion. The export menu detects your system and lets you correct the chosen route.
- **Programmatic editing:** an opt-in command API and local MCP connector for supported AI clients. Batch edits share the editor's undo history.

**One flow:** add a reference → trace → refine → export. Use the illustration above as an example, not a restriction on what you can draw.

**New: fill right up to the image edge.** Auto trace's **沿底圖邊緣封閉** option is on by default. It connects clipped strokes to an editable image-edge boundary, so cropped regions can be filled without adding a visible black frame. Turn it off to keep open edges. Interior missing lines may still need repair.

For developers: our [experimental anime-sketch refinement](experiments/anime-trace/) uses aligned source colors to repair supported gaps. This is a separate local experiment, **not an Anime2Sketch mode in the public web editor**; no model weights or private reference images are bundled.

## Let your tools work with you

Read objects, select them, change colors in a batch, move independent shapes, or start a background tracing job from code or a connected AI client.

Open **專案與匯出 → 程式／AI 工具** to enable access to the current page. Access is off by default, ends when you switch pages or reload, and deletion asks for confirmation. Tracing results stay separate until applied.

The **browser command API** works in the web editor. The **optional MCP connector** runs locally and opens its own editor workspace; it does not silently attach to a GitHub Pages tab. No AI subscription is needed for normal drawing.

[Command API & MCP setup →](docs/automation.md)

## Start in 30 seconds

| Use it now | You get |
| --- | --- |
| **[Open Web — recommended](https://evan6007.github.io/skechu-ppt/)** | The full editor on computer, phone, or tablet; no install or sign-in |
| **[Windows installer](https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe)** | The editor plus native editable PowerPoint copy/paste |

1. Choose **新增底圖** and add any image.
2. Use **自動描圖** for linework and **自動填色** for independent color regions—two toolbar actions, two editable layer groups. Or place anchors with **描圖 / 磁吸**.
3. Export SVG, save a portable `.skc` project, or copy editable objects to PowerPoint.

Want the web edition to feel like a normal app? Follow the **[click-by-click install guide](docs/install.md)**—no command line required.

**Native PPTX export on the web:** [cross-platform selection export](docs/portable-powerpoint.md) keeps curves, independent fills and gradient stops editable without Windows conversion. The editor detects your system: Windows keeps direct connector copy; other platforms get the native-file workflow. You can correct detection in the export menu. This exports a file, not universal system-clipboard paste; an Office add-in is not yet available.

<details>
<summary><strong>Detailed workflow, tracing controls, and clipboard behavior</strong></summary>

- **Auto trace without guessing parameters:** leave **自動判斷** selected. Thin drawings use centerlines with shared T-junctions; solid black/white logos use closed outlines. The four live sliders control detail threshold, curve smoothness, anchor reduction, and tiny-fragment cleanup. The preview stays separate until you choose **套用線圖**.
- **Direct image import:** drag PNG, JPG, SVG, or a supported project file onto the page. You can also copy an image on the web and press Ctrl+V to create a new image layer while keeping its proportions.
- **Selection and anchors:** Ctrl+A selects immediately and shows editable anchors. Drag blank canvas space to marquee-select; drag an object to move it. Locked references are excluded.
- **Pages and layers:** drag to reorder on desktop; use the drag handles on touch devices. Right-click a layer or group, long-press its name, or tap **⋯** to copy, paste, rename, or delete the whole group with Undo. Locked members must be unlocked before group deletion. Reference images start below the artwork but can be moved above or below a group. Groups, visibility, locks, order, canvas size, and references survive `.skc` save/reload.
- **PowerPoint:** copy in the editor, then press Ctrl+V in desktop PowerPoint. If the Windows connector is unavailable, the page gives you a direct **下載 Windows 必要連接元件** button: one installer includes the runtime and connector, with no separate Python packages or browser plugins. Keep the connector running and allow the browser's local-network prompt. Desktop Microsoft PowerPoint is required and is not included. See the [connection guide](docs/install.md#copy-from-open-web-directly-to-powerpoint).
- **Save your SKC:** use **開啟 SKC** and allow file writing once. Supported browsers then save edits back to that file automatically; **Ctrl+S** saves immediately and **Ctrl+Shift+S** saves as a new file. The menu also offers **下載專案副本** and an autosave toggle. Browser recovery and original-file save status are shown separately. Files changed externally are not silently overwritten.
- **Privacy:** reference images, file permissions and browser recovery stay on your device. Direct file saving requires a browser with the File System Access pickers (such as desktop Chrome/Edge); other browsers download an SKC instead. Browsers may ask for write permission again after reopening. A recovered browser copy that differs from the last saved version requires confirmation with **Ctrl+S** before overwriting.

</details>

<p align="center"><strong>If Skechu-PPT saves you from redrawing one figure, consider giving the project a ⭐.</strong></p>

## Which edition should I use?

| Feature | Web edition | Windows edition |
| --- | :---: | :---: |
| Manual and automatic tracing, anchor editing | ✓ | ✓ |
| Local autosave | ✓ | ✓ |
| Download and load `.skc` projects | ✓ | ✓ |
| Export editable SVG | ✓ | ✓ |
| Export native editable PPTX selection | ✓ | Use Web; packaged update pending |
| Install as an app | ✓ | ✓ |
| Copy native editable layers to PowerPoint | ✓ with Windows companion | ✓ |

The native PowerPoint bridge uses Windows COM automation, so **Copy to PPT is Windows-only**, including when drawing in the web editor. It requires desktop PowerPoint and the running local companion. macOS, Linux, and mobile users still get the complete browser editor and SVG workflow.

## Your work stays yours

Skechu-PPT is local-first. Normal drawing and autosave stay in your browser; reference images and projects are not uploaded to a Skechu server. Use **Download project** for a portable backup or to continue on another device.

If you explicitly enable automation, requested object data and exports can be returned to your connected AI client. That client's data-handling policy applies. Read-only object listings omit image pixels; the MCP connector has no arbitrary filesystem, system clipboard, PowerPoint, or GitHub account tools.

## Project status

### Code signing policy

The Windows installer is currently unsigned; free open-source signing application
materials are being prepared. Approval has not been granted. See the
[code signing policy, privacy details and installation safety](docs/code-signing-policy.md).
The browser editor and editable PPTX export do not require a Windows installation.

Skechu-PPT is an open-source public preview. Detailed keyboard controls are in the [user guide](docs/guide.md); implementation details are in the [architecture notes](docs/architecture.md); current work is tracked in the [roadmap](ROADMAP.md) and [changelog](CHANGELOG.md).

<details>
<summary><strong>Developers and contributors</strong></summary>

The hosted editor is a static, dependency-vendored web app. The optional Windows bridge is Python plus `pywin32`; the optional MCP connector uses the official Python MCP SDK. Neither is required for ordinary web editing.

Start with the [documentation index](docs/README.md), [automation guide](docs/automation.md), or [repository map](docs/architecture.md#repository-map).

Bug reports, small documentation improvements, and focused pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) first.

</details>

## License

Skechu-PPT is released under the [MIT License](LICENSE). KaTeX is distributed under its own MIT license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
