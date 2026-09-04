from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps


FRAMES_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/media/showcase-frames")
OUTPUT_DIR = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/media")
SIZE = (800, 450)
CONTENT = (776, 396)


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


def split_view(left_image, right_image):
    left = cover(crop(left_image, (0.0, 0.34, 0.36, 1.0)), (382, CONTENT[1]))
    right = cover(crop(right_image, (0.80, 0.42, 1.0, 1.0)), (382, CONTENT[1]))
    result = Image.new("RGB", CONTENT, "#111419")
    result.paste(left, (0, 0))
    result.paste(right, (394, 0))
    return result


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
    return frame.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)


def save_gif(name, title, accent, views, badges, duration=450):
    frames = [card(title, badge, view, accent) for view, badge in zip(views, badges)]
    frames[0].save(
        OUTPUT_DIR / name,
        save_all=True,
        append_images=frames[1:],
        duration=[duration] * len(frames),
        loop=0,
        optimize=True,
        disposal=2,
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
save_gif(
    "feature-auto-trace.gif",
    "自動描圖",
    "#2dd4bf",
    [
        cover(crop(auto, (0.22, 0.01, 0.78, 0.61))),
        cover(crop(auto, (0.22, 0.34, 0.78, 0.98))),
        cover(crop(auto_adjusted, (0.22, 0.01, 0.78, 0.61))),
    ],
    ["自動判斷", "323 條曲線・740 錨點", "即時調參"],
)
save_gif(
    "feature-anchor-editing.gif",
    "錨點與格線",
    "#60a5fa",
    [cover(crop(base, (0.12, 0.06, 0.86, 0.98))), cover(crop(grid, (0.12, 0.06, 0.86, 0.98))), cover(crop(anchors, (0.12, 0.06, 0.86, 0.98)))],
    ["完成圖", "格線對齊", "Ctrl+A 顯示錨點"],
)
save_gif(
    "feature-pages-layers.gif",
    "圖頁與圖層",
    "#f59e0b",
    [cover(crop(pages, (0.0, 0.34, 0.36, 1.0))), cover(crop(layers, (0.80, 0.42, 1.0, 1.0))), split_view(pages, layers)],
    ["右鍵圖頁功能", "群組・顯示・鎖定", "兩側直接管理"],
)
save_gif(
    "feature-shapes-export.gif",
    "形狀與匯出",
    "#a78bfa",
    [cover(crop(shapes, (0.24, 0.0, 0.80, 0.52))), cover(crop(export, (0.48, 0.0, 1.0, 0.50)))],
    ["矩形・圓形・多邊形", "PPT・專案・SVG"],
    duration=520,
)

for path in sorted(OUTPUT_DIR.glob("feature-*.gif")):
    print(path.resolve())
