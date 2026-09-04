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

<p align="center">
  <img src="docs/media/editor-anchor-showcase.png" width="1200" alt="Skechu-PPT editing a detailed illustration with hundreds of visible vector anchor points">
</p>

<p align="center"><sub>A real Skechu-PPT project: hundreds of editable anchors, pages, layers, fills, and the original reference image in one workspace.</sub></p>

## See it at a glance

<table>
  <tr>
    <td width="50%"><img src="docs/media/feature-magnetic-trace.gif" alt="A pointer moves above an image boundary while an orange trace point stays snapped to the edge"><br><strong>Magnetic tracing</strong> — move near an image boundary and the orange point follows the real edge.</td>
    <td width="50%"><img src="docs/media/feature-auto-trace.gif" alt="A complex reference image is auto-traced and Ctrl+A reveals every editable anchor"><br><strong>Auto trace</strong> — trace a complex reference, apply the result, and press Ctrl+A to reveal every anchor.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/media/feature-rainbow-fill.gif" alt="Enclosed regions formed by complex line art are filled while T-junction boundaries remain intact"><br><strong>Connected-region fill</strong> — fill enclosed areas formed by your line art, including regions closed by T-junctions.</td>
    <td width="50%"><img src="docs/media/feature-powerpoint.gif" alt="Complex traced artwork is selected, copied into PowerPoint, spread across the slide, then every editable object is selected"><br><strong>Native PowerPoint objects</strong> — copy any traced artwork into PowerPoint and edit every line, fill, and region independently.</td>
  </tr>
</table>

| ✦ **Auto trace** | 🧲 **Magnetic pen** | ◉ **Anchor editing** | 🪣 **Paint bucket** |
| :---: | :---: | :---: | :---: |
| Image → editable paths | Follow visible boundaries | Refine every curve | Fill closed regions |
| **▧ Pages** | **☷ Layers & groups** | **⌘ Clipboard import** | **P PowerPoint** |
| Reorder whole canvases | Organize complex artwork | Paste or drop images | Native editable shapes |

**One flow:** add a reference → trace automatically or by hand → refine anchors and colors → export SVG or paste editable objects into PowerPoint.

## Start in 30 seconds

| Use it now | You get |
| --- | --- |
| **[Open Web — recommended](https://evan6007.github.io/skechu-ppt/)** | The full editor on computer, phone, or tablet; no install or sign-in |
| **[Windows installer](https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe)** | The editor plus native editable PowerPoint copy/paste |

1. Choose **新增底圖** and add any image.
2. Use **自動描圖** or place anchors with **描圖 / 磁吸**.
3. Export SVG, save a portable `.skc` project, or copy editable objects to PowerPoint.

Want the web edition to feel like a normal app? Follow the **[click-by-click install guide](docs/install.md)**—no command line required.

<details>
<summary><strong>Detailed workflow, tracing controls, and clipboard behavior</strong></summary>

- **Auto trace without guessing parameters:** leave **自動判斷** selected. Thin drawings use centerlines with shared T-junctions; solid black/white logos use closed outlines. The four live sliders control detail threshold, curve smoothness, anchor reduction, and tiny-fragment cleanup. The preview stays separate until you choose **套用線圖**.
- **Direct image import:** drag PNG, JPG, SVG, or a supported project file onto the page. You can also copy an image on the web and press Ctrl+V to create a new image layer while keeping its proportions.
- **Selection and anchors:** Ctrl+A selects immediately and shows editable anchors. Drag blank canvas space to marquee-select; drag an object to move it. Locked references are excluded.
- **Pages and layers:** drag the body of a page thumbnail or layer row to reorder it. Right-click pages for copy, paste, duplicate, rename, insertion, reordering, and deletion. Groups, visibility, locks, order, canvas size, and references survive `.skc` save/reload.
- **PowerPoint:** on Windows, install/start Skechu-PPT v0.1.2 or later, approve the local connection, copy in the editor, then press Ctrl+V in desktop PowerPoint. The bridge prepares changed geometry in the background and reuses cached objects when possible. See the [connection guide](docs/install.md#copy-from-open-web-directly-to-powerpoint).
- **Privacy:** reference images and autosaves remain on your device. Use **下載專案** when you want a portable backup.

</details>

<p align="center"><strong>If Skechu-PPT saves you from redrawing one figure, consider giving the project a ⭐.</strong></p>

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
