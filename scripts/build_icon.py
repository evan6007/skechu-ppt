"""Build Skechu-PPT app icons from the approved deterministic vector mark.

The GitHub social preview is authored separately in the editable PowerPoint at
assets/brand/Skechu-PPT-social-preview-editable.pptx so this script never
overwrites the designer-approved layout.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).parents[1]
BRAND = ROOT / "assets" / "brand"
MARK = BRAND / "skechu-mark.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
ICON_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def cubic(p0, p1, p2, p3, steps=80):
    points = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        points.append((
            u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
        ))
    return points


def render_mark(size: int = 1024) -> Image.Image:
    """Render the approved mark from deterministic, symmetric Bezier geometry."""
    scale = 4
    canvas = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    s = size * scale / 1024
    xy = lambda point: (round(point[0] * s), round(point[1] * s))

    draw.rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius=round(104 * s), fill="black")
    left_upper = cubic((390, 228), (405, 315), (405, 395), (360, 470))
    left_lower = cubic((360, 470), (410, 590), (470, 760), (512, 890))
    right_lower = [(1024 - x, y) for x, y in reversed(left_lower)]
    right_upper = [(1024 - x, y) for x, y in reversed(left_upper)]
    body = [xy(point) for point in left_upper + left_lower + right_lower + right_upper]
    draw.polygon(body, fill="white")
    draw.rounded_rectangle((*xy((348, 160)), *xy((676, 229))), radius=round(10 * s), fill="white")
    draw.line((*xy((512, 486)), *xy((512, 890))), fill="black", width=round(14 * s))
    cx, cy = xy((512, 611))
    radius = round(30 * s)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill="black")
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def icon_tile(size: int = 1024) -> Image.Image:
    return render_mark(size)


def social_preview() -> Image.Image:
    scale = 2
    width, height = 1280 * scale, 640 * scale
    image = Image.new("RGB", (width, height), (0, 0, 0))
    draw = ImageDraw.Draw(image)

    # A permanent white brand field keeps the lockup legible in both GitHub
    # light and dark themes while the black surround retains the app identity.
    draw.rounded_rectangle(
        (40 * scale, 70 * scale, 1240 * scale, 570 * scale),
        radius=38 * scale,
        fill=(255, 255, 255),
    )

    tile_size = 320 * scale
    tile = icon_tile(tile_size)
    image.paste(tile, (84 * scale, 160 * scale), tile)

    title = ImageFont.truetype(str(FONT_BOLD), 88 * scale)
    label = ImageFont.truetype(str(FONT_BOLD), 34 * scale)
    subtitle = ImageFont.truetype(str(FONT_REGULAR), 31 * scale)
    eyebrow = ImageFont.truetype(str(FONT_BOLD), 18 * scale)

    text_x = 470 * scale
    draw.text((text_x, 185 * scale), "SKECHU", font=eyebrow, fill=(0, 0, 0))
    title_position = (text_x, 220 * scale)
    draw.text(title_position, "Skechu", font=title, fill=(0, 0, 0))
    title_box = draw.textbbox(title_position, "Skechu", font=title)
    u_box = draw.textbbox(title_position, "u", font=title)
    title_width = title_box[2] - title_box[0]
    ppt_x = text_x + title_width + 14 * scale
    # Match the pill to the lowercase u's x-height, not the capital S.
    pill_top = u_box[1]
    pill_bottom = u_box[3]
    pill = (ppt_x, pill_top, ppt_x + 112 * scale, pill_bottom)
    draw.rounded_rectangle(
        pill,
        radius=14 * scale,
        fill=(0, 0, 0),
    )
    label_box = draw.textbbox((0, 0), "PPT", font=label)
    label_width = label_box[2] - label_box[0]
    label_height = label_box[3] - label_box[1]
    label_x = pill[0] + (pill[2] - pill[0] - label_width) / 2 - label_box[0]
    label_y = pill[1] + (pill[3] - pill[1] - label_height) / 2 - label_box[1]
    draw.text((label_x, label_y), "PPT", font=label, fill=(255, 255, 255))
    draw.text((text_x, 350 * scale), "Powered by Hsiao, Chao-Hsiang", font=subtitle, fill=(0, 0, 0))
    draw.text(
        (text_x, 430 * scale),
        "MAGNETIC TRACE   /   EDITABLE VECTOR   /   POWERPOINT",
        font=eyebrow,
        fill=(0, 0, 0),
    )

    return image.resize((1280, 640), Image.Resampling.LANCZOS)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    icon = icon_tile()
    icon.save(MARK, optimize=True)
    icon_png = BRAND / "skechu-ppt-icon.png"
    icon_ico = BRAND / "skechu-ppt-mark.ico"
    brand_ico = BRAND / "skechu-ppt-brand.ico"
    legacy_ico = BRAND / "skechu-ppt.ico"
    icon.save(icon_png, optimize=True)
    icon.save(icon_ico, format="ICO", sizes=ICON_SIZES)
    icon.save(brand_ico, format="ICO", sizes=ICON_SIZES)
    icon.save(legacy_ico, format="ICO", sizes=ICON_SIZES)

    for path in (icon_png, icon_ico, brand_ico, legacy_ico):
        print(path)


if __name__ == "__main__":
    main()
