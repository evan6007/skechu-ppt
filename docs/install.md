# Install Skechu-PPT without a command line

You do not need Git, Python, or a terminal to use the web edition.

## Windows

### Fastest: use the web app

1. Open [Skechu-PPT Online](https://evan6007.github.io/skechu-ppt/).
2. In Chrome or Edge, choose **Install Skechu-PPT** from the address bar or browser menu.
3. Launch it later from the desktop or Start menu like a normal app.

### Native PowerPoint export: install the Windows edition

1. Download [Skechu-PPT-Windows-Setup.exe](https://github.com/evan6007/skechu-ppt/releases/latest/download/Skechu-PPT-Windows-Setup.exe).
2. Double-click the installer and keep the default options.
3. Open **Skechu-PPT** from the desktop or Start menu.

The Windows edition is required only for **Copy to PPT**, which creates separately editable native PowerPoint layers. The early preview installer is not yet code-signed, so Windows SmartScreen may show **Windows protected your PC**. If you downloaded it from this repository, choose **More info → Run anyway**.

### If you downloaded the source folder

Double-click **啟動Skechu-PPT.cmd** in the repository folder. It starts the local service and opens the editor at `http://127.0.0.1:8766/` (requires Python on the source-code edition). Do not use `app/index.html` as the native PowerPoint launcher: a `file://` tab cannot connect to Office automatically. Direct-file auto tracing is supported, but native copying still needs the local service.

If you already drew in a direct-file tab, download the `.skc` project **before** switching, then load it in the local-service tab. Each origin has separate browser storage; opening the other tab does not transfer your drawing automatically.

## macOS

1. Open [Skechu-PPT Online](https://evan6007.github.io/skechu-ppt/).
2. In Safari, choose **File → Add to Dock**. In Chrome or Edge, use **Install Skechu-PPT**.
3. Open it later from the Dock or Applications.

The editor, `.skc` project files, and SVG export work. Native **Copy to PPT** is Windows-only.

## Linux and Chromebook

1. Open [Skechu-PPT Online](https://evan6007.github.io/skechu-ppt/).
2. In Chrome or Edge, choose **Install Skechu-PPT** from the address bar or browser menu.
3. Open it later from the application launcher.

The editor, `.skc` project files, and SVG export work. Native **Copy to PPT** is Windows-only.

## iPhone and iPad

1. Open [Skechu-PPT Online](https://evan6007.github.io/skechu-ppt/) in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.

## Android

1. Open [Skechu-PPT Online](https://evan6007.github.io/skechu-ppt/) in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.

Phone editing works, but a tablet or desktop gives you more room for detailed anchor work.

## Your projects

- Skechu-PPT automatically saves the current workspace in that browser on that device.
- Use **Download project** to create a portable `.skc` file.
- Use **Load project** to continue on another browser or device.
- Reference images and projects remain local unless you choose to share the exported files.
