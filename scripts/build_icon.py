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

    tile_size = 320 * scale
    tile = icon_tile(tile_size)
    image.paste(tile, (84 * scale, 160 * scale), tile)

    title = ImageFont.truetype(str(FONT_BOLD), 88 * scale)
    label = ImageFont.truetype(str(FONT_BOLD), 28 * scale)
    subtitle = ImageFont.truetype(str(FONT_REGULAR), 31 * scale)
    eyebrow = ImageFont.truetype(str(FONT_BOLD), 18 * scale)

    text_x = 470 * scale
    draw.text((text_x, 185 * scale), "SKETCHOU", font=eyebrow, fill=(255, 255, 255))
    title_position = (text_x, 220 * scale)
    draw.text(title_position, "Sketchou", font=title, fill=(255, 255, 255))
    title_box = draw.textbbox(title_position, "Sketchou", font=title)
    title_width = title_box[2] - title_box[0]
    ppt_x = text_x + title_width + 26 * scale
    pill_height = 60 * scale
    title_center_y = (title_box[1] + title_box[3]) / 2
    pill_top = title_center_y - pill_height / 2
    pill = (ppt_x, pill_top, ppt_x + 120 * scale, pill_top + pill_height)
    draw.rounded_rectangle(
        pill,
        radius=14 * scale,
        fill=(255, 255, 255),
    )
    label_box = draw.textbbox((0, 0), "PPT", font=label)
    label_width = label_box[2] - label_box[0]
    label_height = label_box[3] - label_box[1]
    label_x = pill[0] + (pill[2] - pill[0] - label_width) / 2 - label_box[0]
    label_y = pill[1] + (pill[3] - pill[1] - label_height) / 2 - label_box[1]
    draw.text((label_x, label_y), "PPT", font=label, fill=(0, 0, 0))
    draw.text((text_x, 350 * scale), "Trace precisely. Edit natively.", font=subtitle, fill=(255, 255, 255))
    draw.text(
        (text_x, 430 * scale),
        "MAGNETIC TRACE   /   EDITABLE VECTOR   /   POWERPOINT",
        font=eyebrow,
        fill=(255, 255, 255),
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
    social_preview().save(preview_path, optimize=True)

    for path in (icon_png, icon_ico, brand_ico, legacy_ico, preview_path):
        print(path)


if __name__ == "__main__":
    main()
