from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps


FRAMES_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/media/showcase-frames")
OUTPUT_DIR = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/media")
SIZE = (720, 405)
CONTENT = (696, 351)


def font(size, bold=False):
    name = "msjhbd.ttc" if bold else "msjh.ttc"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def open_frame(name):
    return Image.open(FRAMES_DIR / name).convert("RGB")


def crop(image, bounds):
    width, height = image.size
    left, top, right, bottom = bounds
    return image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))


def cover(image, box=CONTENT):
    return ImageOps.fit(image, box, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def ease(value):
    return value * value * (3 - 2 * value)


def interpolate_bounds(start, end, amount):
    return tuple(a + (b - a) * amount for a, b in zip(start, end))


def moving_view(start, end, amount):
    progress = ease(amount)
    bounds = interpolate_bounds(start[1], end[1], progress)
    first = cover(crop(start[0], bounds))
    second = cover(crop(end[0], bounds))
    return Image.blend(first, second, progress)


def card(title, badge, content, accent):
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
    return frame.convert("RGB")


def save_motion_gif(name, title, accent, keyframes, frames_per_move=10, duration=60):
    frames = []
    for index, start in enumerate(keyframes):
        end = keyframes[(index + 1) % len(keyframes)]
        for step in range(frames_per_move):
            amount = step / frames_per_move
            badge = start[2] if amount < 0.55 else end[2]
            frames.append(card(title, badge, moving_view(start, end, amount), accent))
    palette_strip = Image.new("RGB", (180, 101 * len(frames[::3])))
    for index, frame in enumerate(frames[::3]):
        palette_strip.paste(frame.resize((180, 101), Image.Resampling.BILINEAR), (0, index * 101))
    palette = palette_strip.quantize(colors=96, method=Image.Quantize.MEDIANCUT)
    encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    encoded[0].save(
        OUTPUT_DIR / name,
        save_all=True,
        append_images=encoded[1:],
        duration=[duration] * len(frames),
        loop=0,
        optimize=True,
        disposal=1,
    )


base = open_frame("01-editor.png")
grid = open_frame("02-grid.png")
anchors = open_frame("03-anchors.png")
shapes = open_frame("04-shapes.png")
export = open_frame("05-export.png")
pages = open_frame("06-pages.png")
layers = open_frame("07-layers.png")
auto = open_frame("08-auto-trace.png")
auto_adjusted = open_frame("09-auto-trace-adjusted.png")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
save_motion_gif(
    "feature-auto-trace.gif",
    "自動描圖",
    "#2dd4bf",
    [
        (auto, (0.20, 0.00, 0.80, 0.67), "自動判斷"),
        (auto, (0.25, 0.30, 0.75, 0.98), "323 條曲線・740 錨點"),
        (auto_adjusted, (0.20, 0.00, 0.80, 0.67), "拖曳滑桿即時更新"),
    ],
)
save_motion_gif(
    "feature-anchor-editing.gif",
    "錨點與格線",
    "#60a5fa",
    [
        (base, (0.10, 0.02, 0.90, 1.00), "完成圖"),
        (grid, (0.13, 0.04, 0.87, 0.97), "格線與棋盤同步"),
        (anchors, (0.18, 0.08, 0.82, 0.94), "Ctrl+A 顯示錨點"),
    ],
)
save_motion_gif(
    "feature-pages-layers.gif",
    "圖頁與圖層",
    "#f59e0b",
    [
        (pages, (0.00, 0.28, 0.44, 1.00), "圖頁總覽"),
        (pages, (0.00, 0.38, 0.32, 0.98), "右鍵複製・貼上・排序"),
        (layers, (0.76, 0.36, 1.00, 1.00), "群組・顯示・鎖定"),
    ],
)
save_motion_gif(
    "feature-shapes-export.gif",
    "形狀與匯出",
    "#a78bfa",
    [
        (shapes, (0.22, 0.00, 0.78, 0.58), "形狀工具"),
        (shapes, (0.34, 0.00, 0.66, 0.43), "矩形・圓形・多邊形"),
        (export, (0.55, 0.00, 1.00, 0.52), "PPT・專案・SVG"),
    ],
)

for path in sorted(OUTPUT_DIR.glob("feature-*.gif")):
    print(path.resolve())
