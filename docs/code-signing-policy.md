# Code signing policy

## Current status

Windows releases are currently **unsigned**. SignPath Foundation application
materials are being prepared; no certificate or approval has been granted.
Do not interpret this page, GitHub build checks, or a SHA-256 checksum as a
trusted Windows publisher signature.

We are seeking free open-source signing through [SignPath.io](https://signpath.io/)
and the [SignPath Foundation](https://signpath.org/). If approved, the certificate
will identify SignPath Foundation, not a certificate issued directly to the
project maintainer. Attribution and release status will be updated only after
approval and signature verification.

## Responsibilities and release controls

- Maintainer and reviewer: [evan6007](https://github.com/evan6007).
- Proposed signing approver: evan6007; each signing request requires human approval.
- Signing is restricted to this repository's own release executable and installer.
  Third-party dependencies retain their original licenses and signatures.
- Artifacts must be built from a recorded commit using GitHub Actions. The
  executable, installer and signed outputs must carry consistent product/version
  metadata. Approved signing requires verified provenance and timestamping.
- Before enabling a signing account, the maintainer must enable multi-factor
  authentication for the repository and signing service and approve its access.
  This document does not claim that account setup is already complete.
- Signing credentials must never be embedded in the app, committed, or shared in
  build logs. Fork pull requests must not be allowed to invoke release signing.

## Privacy and installation

Normal editing, reference images, tracing, enhancement and project autosave run
on the user's device. The website is served by GitHub Pages; the host necessarily
receives ordinary web requests. The editor does not upload artwork for tracing
or PowerPoint export.

The optional Windows companion listens on **127.0.0.1**, not a public network
interface. On an explicit copy request, the selected drawing is sent to that
local companion and converted through the user's installed desktop PowerPoint.
Background preparation after connection does not write the clipboard. Failed
clipboard writes are not automatically replayed. Embedded reference PNG files
are temporarily stored locally for PowerPoint import and removed after import.

The optional GitHub star sign-in talks to GitHub and the project's OAuth service
only when the user invokes that feature. An explicitly enabled automation/MCP
connection can return authorized drawing data to the connected client; that
client's privacy policy applies. Third-party resource licenses are listed in
[THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md) and the
[model/runtime notice](../app/vendor/super-resolution/NOTICE.md).

The installer is per-user, does not require administrator rights, includes the
Python runtime and connector, and does **not** include Microsoft PowerPoint.
It does not disable antivirus/firewall, install a root certificate, or add a
Windows-startup task. Its final page offers starting the connector. Uninstall
via Windows **Settings > Apps > Installed apps > Skechu-PPT**.

## If Windows warns

Use only the [official releases](https://github.com/evan6007/skechu-ppt/releases).
Do not disable Defender, SmartScreen or firewall. A checksum helps detect a
changed download but is not a publisher identity. Browser clipboard/local-network
consent is separate from executable signing and remains controlled by the browser.
Until trusted signing is available, the browser-only editor and native PPTX file
export do not require installing the Windows companion.

Even valid code signing does not promise immediate removal of SmartScreen
warnings: Microsoft also evaluates reputation. See
[Microsoft's explanation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
