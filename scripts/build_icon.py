"""Build Sketchou-PPT app and GitHub assets from the approved AI mark."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).parents[1]
BRAND = ROOT / "assets" / "brand"
MARK = BRAND / "sketchou-mark.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
ICON_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def icon_tile(size: int = 1024) -> Image.Image:
    source = Image.open(MARK).convert("RGBA")
    if source.size == (size, size):
        return source.copy()
    return source.resize((size, size), Image.Resampling.LANCZOS)


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
    draw.text((text_x, 185 * scale), "SKETCHOU", font=eyebrow, fill=(0, 0, 0))
    title_position = (text_x, 220 * scale)
    draw.text(title_position, "Sketchou", font=title, fill=(0, 0, 0))
    title_box = draw.textbbox(title_position, "Sketchou", font=title)
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
    draw.text((text_x, 350 * scale), "Trace precisely. Edit natively.", font=subtitle, fill=(0, 0, 0))
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
    icon_png = BRAND / "sketchou-ppt-icon.png"
    icon_ico = BRAND / "sketchou-ppt-mark.ico"
    brand_ico = BRAND / "sketchou-ppt-brand.ico"
    legacy_ico = BRAND / "sketchou-ppt.ico"
    icon.save(icon_png, optimize=True)
    icon.save(icon_ico, format="ICO", sizes=ICON_SIZES)
    icon.save(brand_ico, format="ICO", sizes=ICON_SIZES)
    icon.save(legacy_ico, format="ICO", sizes=ICON_SIZES)

    preview_path = BRAND / "social-preview.png"
    preview_v2_path = BRAND / "social-preview-v2.png"
    preview_v3_path = BRAND / "social-preview-v3.png"
    preview_v4_path = BRAND / "social-preview-v4.png"
    preview_v5_path = BRAND / "social-preview-v5.png"
    preview = social_preview()
    preview.save(preview_path, optimize=True)
    preview.save(preview_v2_path, optimize=True)
    preview.save(preview_v3_path, optimize=True)
    preview.save(preview_v4_path, optimize=True)
    preview.save(preview_v5_path, optimize=True)

    for path in (icon_png, icon_ico, brand_ico, legacy_ico, preview_path, preview_v2_path, preview_v3_path, preview_v4_path, preview_v5_path):
        print(path)


if __name__ == "__main__":
    main()
