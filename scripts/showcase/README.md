# Showcase maintenance

Run these scripts from the repository root. Published GIFs live in `docs/media/features/`; intermediate frames default to the ignored `docs/media/showcase-frames/` directory.

- `capture_showcase.mjs`: browser recording preparation using an isolated capture profile. Requires a running local editor and an explicit `.skc` input.
- `capture_powerpoint_demo.py`: native editable-shape demonstration. Requires Windows, desktop PowerPoint and an explicit project input. **This operates PowerPoint; do not run it as part of ordinary tests.**
- `build_showcase_gifs.py`: builds the four 720 × 405 GIFs from existing captures. Optional first argument: frame directory; second: output directory.

The README deliberately puts videos and descriptions in separate table rows. Preserve the shared aspect ratio and top alignment; do not stretch, crop or recolor recordings to compensate for caption length.
