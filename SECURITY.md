# Security policy

## Supported versions

The latest tagged release receives security fixes.

## Reporting a vulnerability

Please use GitHub's **Report a vulnerability** private advisory flow for this repository. Do not open a public issue for a vulnerability involving arbitrary file access, unsafe PowerPoint automation, or unintended network exposure.

The bridge is intended to bind only to `127.0.0.1`. Running it on a public interface is unsupported.

The optional GitHub Star service has a separate [authorization trust boundary](docs/github-star-auth.md). Report OAuth/session or unintended Star-operation issues privately too. GitHub client secrets and the session encryption key belong only in backend secret storage, never in the GitHub Pages directory.
