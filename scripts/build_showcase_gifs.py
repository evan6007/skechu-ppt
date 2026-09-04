"""Build four fixed-camera feature GIFs from real application states."""

from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps


FRAMES_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/media/showcase-frames")
OUTPUT_DIR = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/media")
SIZE = (720, 405)
CONTENT = (696, 351)
FRAME_DURATION_MS = 45


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
        x, y = cursor[0] + 12, cursor[1] + 42
        if pulse:
            draw.ellipse((x - 17, y - 17, x + 17, y + 17), outline="#38bdf8", width=4)
        pointer = [(x, y), (x + 3, y + 26), (x + 10, y + 19), (x + 16, y + 34),
                   (x + 23, y + 30), (x + 16, y + 16), (x + 27, y + 14)]
        draw.polygon(pointer, fill="#ffffff", outline="#111827")
        draw.line(pointer + [pointer[0]], fill="#111827", width=2, joint="curve")
    return frame.convert("RGB")


def blend(first, second, amount):
    return Image.blend(first, second, amount)


def tween(first, second, count):
    return [blend(first, second, (step + 1) / count) for step in range(count)]


def save_gif(name, frames):
    palette_sheet = Image.new("RGB", (180, 101 * len(frames[::4])))
    for index, frame in enumerate(frames[::4]):
        palette_sheet.paste(frame.resize((180, 101), Image.Resampling.BILINEAR), (0, index * 101))
    palette = palette_sheet.quantize(colors=112, method=Image.Quantize.MEDIANCUT)
    encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    encoded[0].save(
        OUTPUT_DIR / name,
        save_all=True,
        append_images=encoded[1:],
        duration=[FRAME_DURATION_MS] * len(encoded),
        loop=0,
        optimize=True,
        disposal=1,
    )


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Auto trace: the camera never moves; the dialog and its computed result do.
auto_bounds = (0.05, 0.02, 0.95, 0.83)
auto_source = fixed_view(open_frame("auto-00-source.png"), auto_bounds)
auto_opening = fixed_view(open_frame("auto-01-opening.png"), auto_bounds)
auto_result = fixed_view(open_frame("auto-02-result.png"), auto_bounds)
auto_updating = fixed_view(open_frame("auto-03-updating.png"), auto_bounds)
auto_detailed = fixed_view(open_frame("auto-04-detailed.png"), auto_bounds)
auto_frames = []
auto_frames += [card("自動描圖", "原始圖片", auto_source, "#2dd4bf", (158, 8), i == 3) for i in range(6)]
auto_frames += [card("自動描圖", "分析邊界", frame, "#2dd4bf") for frame in tween(auto_source, auto_opening, 8)]
auto_frames += [card("自動描圖", "分析邊界", auto_opening, "#2dd4bf") for _ in range(3)]
auto_frames += [card("自動描圖", "740 個真實錨點", frame, "#2dd4bf") for frame in tween(auto_opening, auto_result, 8)]
auto_frames += [card("自動描圖", "740 個真實錨點", auto_result, "#2dd4bf") for _ in range(8)]
auto_frames += [card("自動描圖", "拖滑桿即時重算", frame, "#2dd4bf", (443, 72)) for frame in tween(auto_result, auto_updating, 6)]
auto_frames += [card("自動描圖", "828 個真實錨點", frame, "#2dd4bf") for frame in tween(auto_updating, auto_detailed, 8)]
auto_frames += [card("自動描圖", "828 個真實錨點", auto_detailed, "#2dd4bf") for _ in range(8)]
auto_frames += [card("自動描圖", "重新播放", frame, "#2dd4bf") for frame in tween(auto_detailed, auto_source, 8)]
save_gif("feature-auto-trace.gif", auto_frames)

# 2. Anchor editing: every source image is a real render of the changing curve.
anchor_bounds = (0.12, 0.13, 0.88, 0.80)
anchor_sources = [fixed_view(open_frame(f"anchor-{step:02d}.png"), anchor_bounds) for step in range(21)]
anchor_frames = []
for step, content in enumerate(anchor_sources):
    y = int(238 - 120 * step / 20)
    anchor_frames.append(card("錨點編輯", "拖曳第 3 個錨點", content, "#60a5fa", (348, y), step in (0, 14)))
anchor_frames += [card("錨點編輯", "曲線立即更新", anchor_sources[-1], "#60a5fa", (348, 118)) for _ in range(7)]
for step, content in enumerate(reversed(anchor_sources)):
    y = int(118 + 120 * step / 20)
    anchor_frames.append(card("錨點編輯", "放回原位", content, "#60a5fa", (348, y)))
anchor_frames += [card("錨點編輯", "修改前後可直接比較", anchor_sources[0], "#60a5fa", (348, 238)) for _ in range(5)]
save_gif("feature-anchor-editing.gif", anchor_frames)

# 3. Smart fill: cursor movement explains the gesture; hover and fill are actual app states.
fill_bounds = (0.005, 0.12, 0.735, 0.77)
fill_before = fixed_view(open_frame("fill-00-before.png"), fill_bounds)
fill_hover = fixed_view(open_frame("fill-01-hover.png"), fill_bounds)
fill_after = fixed_view(open_frame("fill-02-after.png"), fill_bounds)
fill_frames = [card("智慧區域填色", "選一個色票", fill_before, "#22c55e", (25, 92), i == 3) for i in range(6)]
for step in range(18):
    amount = (step + 1) / 18
    cursor = (25 + (420 - 25) * amount, 92 + (190 - 92) * amount)
    fill_frames.append(card("智慧區域填色", "拖進封閉區域", fill_before, "#22c55e", cursor))
fill_frames += [card("智慧區域填色", "辨識到左半區", fill_hover, "#22c55e", (420, 190), i == 1) for i in range(5)]
fill_frames += [card("智慧區域填色", "只填選中的區域", frame, "#22c55e", (420, 190)) for frame in tween(fill_hover, fill_after, 6)]
fill_frames += [card("智慧區域填色", "原線條完整保留", fill_after, "#22c55e") for _ in range(10)]
fill_frames += [card("智慧區域填色", "重新播放", frame, "#22c55e") for frame in tween(fill_after, fill_before, 6)]
save_gif("feature-smart-fill.gif", fill_frames)

# 4. PowerPoint: show the app copy, then the real PowerPoint selection moving.
ppt_browser_bounds = (0.12, 0.12, 0.88, 0.80)
ppt_selected = fixed_view(open_frame("ppt-00-selected.png"), ppt_browser_bounds)
ppt_copying1 = fixed_view(open_frame("ppt-01-copying.png"), ppt_browser_bounds)
ppt_copying2 = fixed_view(open_frame("ppt-02-copying.png"), ppt_browser_bounds)
ppt_success = fixed_view(open_frame("ppt-03-success.png"), ppt_browser_bounds)
ppt_native = [fixed_view(open_frame(f"ppt-native-{step:02d}.png")) for step in range(21)]
ppt_frames = [card("原生 PowerPoint", "選取 3 個物件", ppt_selected, "#f97316", (655, 8), i == 2) for i in range(5)]
ppt_frames += [card("原生 PowerPoint", "正在複製", frame, "#f97316") for frame in tween(ppt_selected, ppt_copying1, 5)]
ppt_frames += [card("原生 PowerPoint", "3 個可編輯物件", frame, "#f97316") for frame in tween(ppt_copying1, ppt_copying2, 5)]
ppt_frames += [card("原生 PowerPoint", "複製成功", frame, "#f97316") for frame in tween(ppt_copying2, ppt_success, 5)]
ppt_frames += [card("原生 PowerPoint", "貼到 PowerPoint", ppt_success, "#f97316") for _ in range(5)]
ppt_frames += [card("原生 PowerPoint", "選取單一物件", frame, "#f97316") for frame in tween(ppt_success, ppt_native[0], 7)]
ppt_frames += [card("原生 PowerPoint", "單獨拖曳位置", frame, "#f97316") for frame in ppt_native]
ppt_frames += [card("原生 PowerPoint", "仍是可編輯形狀", ppt_native[-1], "#f97316") for _ in range(7)]
save_gif("feature-powerpoint.gif", ppt_frames)

for path in sorted(OUTPUT_DIR.glob("feature-*.gif")):
    print(path.resolve())
