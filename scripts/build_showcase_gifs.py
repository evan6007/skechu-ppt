"""Build four brain-based feature GIFs with a normal Windows cursor."""

from pathlib import Path
import json
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


FRAMES_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/media/showcase-frames")
OUTPUT_DIR = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/media")
SIZE = (720, 405)
CONTENT = (696, 351)
FRAME_DURATION_MS = 40
METADATA = json.loads((FRAMES_DIR / "showcase-metadata.json").read_text(encoding="utf-8"))


def font(size, bold=False):
    name = "msjhbd.ttc" if bold else "msjh.ttc"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def open_frame(name):
    return Image.open(FRAMES_DIR / name).convert("RGB")


def fixed_view(image, bounds=(0, 0, 1, 1)):
    width, height = image.size
    left, top, right, bottom = bounds
    cropped = image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))
    return ImageOps.fit(cropped, CONTENT, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def trace_view(image, point=None):
    edge = METADATA["trace"]["edgeScreen"]
    crop_width = min(1080, image.width)
    crop_height = round(crop_width * CONTENT[1] / CONTENT[0])
    left = max(0, min(image.width - crop_width, edge["x"] - crop_width / 2))
    top = max(0, min(image.height - crop_height, edge["y"] - crop_height * .55))
    bounds = (round(left), round(top), round(left + crop_width), round(top + crop_height))
    view = image.crop(bounds).resize(CONTENT, Image.Resampling.LANCZOS)
    if not point:
        return view, None
    mapped = ((point["x"] - bounds[0]) / crop_width * CONTENT[0],
              (point["y"] - bounds[1]) / crop_height * CONTENT[1])
    return view, mapped


def windows_cursor():
    source = Image.open(r"C:\Windows\Cursors\aero_arrow.cur").convert("RGB")
    red, green, blue = source.split()
    luminance = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    alpha = luminance.point(lambda value: 255 if value > 12 else 0)
    source = source.resize((30, 30), Image.Resampling.LANCZOS)
    alpha = alpha.resize((30, 30), Image.Resampling.LANCZOS)
    outline_alpha = alpha.filter(ImageFilter.MaxFilter(5))
    outlined = Image.new("RGBA", (30, 30), (10, 15, 24, 0))
    outlined.putalpha(outline_alpha)
    white = Image.new("RGBA", (30, 30), (255, 255, 255, 0))
    white.putalpha(alpha)
    outlined.alpha_composite(white)
    return outlined


CURSOR = windows_cursor()


def card(title, badge, content, accent, cursor=None, pulse=False):
    frame = Image.new("RGBA", SIZE, "#0d0f12")
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((0, 0, SIZE[0] - 1, SIZE[1] - 1), 18, fill="#171a1f", outline="#3a4049", width=2)
    draw.rounded_rectangle((12, 11, 20, 19), 4, fill=accent)
    draw.text((29, 6), title, font=font(19, True), fill="#f3f4f6")
    badge_font = font(14, True)
    badge_box = draw.textbbox((0, 0), badge, font=badge_font)
    badge_width = badge_box[2] - badge_box[0] + 24
    draw.rounded_rectangle((SIZE[0] - badge_width - 12, 7, SIZE[0] - 12, 32), 12, fill="#282d35")
    draw.text((SIZE[0] - badge_width, 8), badge, font=badge_font, fill="#cbd5e1")
    mask = Image.new("L", CONTENT, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, CONTENT[0], CONTENT[1]), 12, fill=255)
    frame.paste(content, (12, 42), mask)
    if cursor:
        x, y = int(cursor[0] + 12), int(cursor[1] + 42)
        if pulse:
            draw.ellipse((x - 16, y - 16, x + 16, y + 16), outline="#fb923c", width=3)
        frame.alpha_composite(CURSOR, (x, y))
    return frame.convert("RGB")


def tween(first, second, count):
    return [Image.blend(first, second, (step + 1) / count) for step in range(count)]


def save_gif(name, frames):
    palette_sheet = Image.new("RGB", (180, 101 * len(frames[::4])))
    for index, frame in enumerate(frames[::4]):
        palette_sheet.paste(frame.resize((180, 101), Image.Resampling.BILINEAR), (0, index * 101))
    palette = palette_sheet.quantize(colors=112, method=Image.Quantize.MEDIANCUT)
    encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    encoded[0].save(
        OUTPUT_DIR / name, save_all=True, append_images=encoded[1:],
        duration=[FRAME_DURATION_MS] * len(encoded), loop=0, optimize=True, disposal=1,
    )


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Zoomed magnetic tracing on the brain: the orange marker is rendered by the app.
trace_frames = []
for step in range(25):
    source = open_frame(f"trace-{step:02d}.png")
    content, cursor = trace_view(source, METADATA["trace"]["frames"][step]["cursor"])
    snapped = METADATA["trace"]["frames"][step]["snap"] is not None
    trace_frames.append(card("磁吸描圖", "橘點瞬間吸住" if snapped else "游標靠近腦溝", content, "#fb923c", cursor, snapped and step == 19))
trace_frames += [trace_frames[-1]] * 8
trace_frames += list(reversed(trace_frames[8:20]))
save_gif("feature-magnetic-trace.gif", trace_frames)

# 2. The same brain goes from source image to auto trace, then Ctrl+A reveals all anchors.
auto_bounds = (0.04, 0.02, 0.96, 0.84)
auto_source = fixed_view(open_frame("auto-00-source.png"), auto_bounds)
auto_opening = fixed_view(open_frame("auto-01-opening.png"), auto_bounds)
auto_preview = fixed_view(open_frame("auto-02-preview.png"), auto_bounds)
auto_applied = fixed_view(open_frame("auto-03-applied.png"), auto_bounds)
auto_anchors = fixed_view(open_frame("auto-04-all-anchors.png"), auto_bounds)
anchor_count = METADATA["autoTraceAnchors"]
auto_frames = [card("自動描圖", "腦袋原圖", auto_source, "#38bdf8", (162, 8), i == 2) for i in range(5)]
auto_frames += [card("自動描圖", "開啟自動描圖", frame, "#38bdf8") for frame in tween(auto_source, auto_opening, 7)]
auto_frames += [card("自動描圖", "預覽描圖線", frame, "#38bdf8") for frame in tween(auto_opening, auto_preview, 7)]
auto_frames += [card("自動描圖", "套用線條", frame, "#38bdf8", (522, 327)) for frame in tween(auto_preview, auto_applied, 7)]
auto_frames += [card("自動描圖", "Ctrl+A 全選", frame, "#38bdf8") for frame in tween(auto_applied, auto_anchors, 7)]
auto_frames += [card("自動描圖", f"{anchor_count} 個錨點", auto_anchors, "#38bdf8") for _ in range(10)]
auto_frames += [card("自動描圖", "重新播放", frame, "#38bdf8") for frame in tween(auto_anchors, auto_source, 6)]
save_gif("feature-auto-trace.gif", auto_frames)

# 3. Precomputed regions fill the same brain with seven colors in under one second.
fill_bounds = (0.084, 0.10, 0.917, 0.912)
fill_sources = [fixed_view(open_frame(f"fill-{step:02d}.png"), fill_bounds) for step in range(21)]
fill_frames = [card("線稿區域填色", "線稿形成封閉區域", fill_sources[0], "#22c55e") for _ in range(5)]
for step, content in enumerate(fill_sources[1:], 1):
    fill_frames.append(card("線稿區域填色", "辨識並填入封閉範圍", content, "#22c55e"))
fill_frames += [card("線稿區域填色", "T 字接線也能填色", fill_sources[-1], "#22c55e") for _ in range(12)]
fill_frames += [card("線稿區域填色", "原始線稿完整保留", frame, "#22c55e") for frame in tween(fill_sources[-1], fill_sources[0], 6)]
save_gif("feature-rainbow-fill.gif", fill_frames)

# 4. Select the rainbow brain, copy, switch to the real PowerPoint window, and paste.
ppt_browser_bounds = (0.0, 0.0, 1.0, 0.96)
ppt_selected = fixed_view(open_frame("ppt-00-selected.png"), ppt_browser_bounds)
ppt_copying = fixed_view(open_frame("ppt-01-copying.png"), ppt_browser_bounds)
ppt_success = fixed_view(open_frame("ppt-02-success.png"), ppt_browser_bounds)
ppt_empty = fixed_view(open_frame("ppt-native-00-empty.png"))
ppt_pasted = fixed_view(open_frame("ppt-native-01-pasted.png"))
ppt_all_selected = fixed_view(open_frame("ppt-native-02-all-selected.png"))
ppt_explode = [fixed_view(open_frame(f"ppt-native-explode-{step:02d}.png")) for step in range(49)]
ppt_explode_selected = fixed_view(open_frame("ppt-native-explode-selected.png"))
ppt_cursor_path = [
    (430 + (655 - 430) * step / 11, 220 + (18 - 220) * step / 11)
    for step in range(12)
]
ppt_frames = [
    card("貼到 PowerPoint", "Ctrl+A 全選腦袋", ppt_selected, "#f97316", point, step == 11)
    for step, point in enumerate(ppt_cursor_path)
]
ppt_frames += [card("貼到 PowerPoint", "複製可編輯物件", frame, "#f97316") for frame in tween(ppt_selected, ppt_copying, 6)]
ppt_frames += [card("貼到 PowerPoint", "複製完成", frame, "#f97316") for frame in tween(ppt_copying, ppt_success, 6)]
ppt_frames += [card("貼到 PowerPoint", "切換到 PowerPoint", ppt_empty, "#f97316") for _ in range(6)]
ppt_frames += [card("貼到 PowerPoint", "Ctrl+V 貼上", ppt_pasted, "#f97316", (330, 190), i == 2) for i in range(6)]
ppt_frames += [card("貼到 PowerPoint", "整顆腦袋已貼上", ppt_pasted, "#f97316") for _ in range(10)]
ppt_frames += [card("貼到 PowerPoint", "Ctrl+A 全選可編輯物件", ppt_all_selected, "#f97316") for _ in range(8)]
ppt_frames += [card("貼到 PowerPoint", "色塊沿斜向筆勢依序散開", frame, "#f97316") for frame in ppt_explode]
ppt_frames += [card("貼到 PowerPoint", "Ctrl+A：每個物件都能編輯", ppt_explode_selected, "#f97316") for _ in range(10)]
save_gif("feature-powerpoint.gif", ppt_frames)

for path in sorted(OUTPUT_DIR.glob("feature-*.gif")):
    print(path.resolve())
