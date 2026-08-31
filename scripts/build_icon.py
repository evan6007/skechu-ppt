"""Generate the Sketchou-PPT application icon and GitHub social preview."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).parents[1]
BRAND = ROOT / "assets" / "brand"
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")

INK = (8, 13, 28)
VIOLET = (99, 91, 255)
WHITE = (247, 249, 255)
MUTED = (166, 177, 204)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def icon_tile(size: int = 1024) -> Image.Image:
    """Render a quiet enterprise tile with a proprietary S monogram."""
    image = Image.new("RGBA", (size, size), INK + (255,))
    pixels = image.load()

    # Restrained two-axis gradient: navy at the top, proprietary violet at the edge.
    for y in range(size):
        for x in range(size):
            violet_weight = max(0.0, (x + y - size * 0.72) / (size * 1.28))
            top_light = max(0.0, 1.0 - y / (size * 0.82)) * 0.08
            pixels[x, y] = (
                int(INK[0] * (1 - violet_weight) + VIOLET[0] * violet_weight + 13 * top_light),
                int(INK[1] * (1 - violet_weight) + VIOLET[1] * violet_weight + 22 * top_light),
                int(INK[2] * (1 - violet_weight) + VIOLET[2] * violet_weight + 34 * top_light),
                255,
            )

    background = image.copy()

    # A single large S is intentionally used: recognisable at 16 px, serious at 1024 px.
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT_BOLD), int(size * 0.70))
    glyph = "S"
    box = draw.textbbox((0, 0), glyph, font=font)
    glyph_width = box[2] - box[0]
    glyph_height = box[3] - box[1]
    x = (size - glyph_width) / 2 - box[0]
    y = (size - glyph_height) / 2 - box[1] - size * 0.012
    draw.text((x, y), glyph, font=font, fill=WHITE)

    # The precision cut makes the monogram ownable and hints at a vector-path edit.
    cut_y = int(size * 0.495)
    cut_left = int(size * 0.495)
    cut_right = int(size * 0.585)
    cut = [
        (cut_left, cut_y + int(size * 0.006)),
        (cut_right, cut_y - int(size * 0.027)),
        (cut_right, cut_y - int(size * 0.010)),
        (cut_left, cut_y + int(size * 0.023)),
    ]
    cut_mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(cut_mask).polygon(cut, fill=255)
    image.paste(background, (0, 0), cut_mask)

    image.putalpha(rounded_mask((size, size), int(size * 0.225)))
    return image


def social_preview() -> Image.Image:
    scale = 2
    width, height = 1280 * scale, 640 * scale
    image = Image.new("RGB", (width, height), INK)
    pixels = image.load()

    for y in range(height):
        for x in range(width):
            weight = max(0.0, (x / width + y / height - 0.84) / 1.16)
            pixels[x, y] = tuple(
                int(INK[channel] * (1 - weight * 0.48) + VIOLET[channel] * weight * 0.48)
                for channel in range(3)
            )

    draw = ImageDraw.Draw(image)
    tile_size = 280 * scale
    tile = icon_tile(tile_size)
    image.paste(tile, (100 * scale, 180 * scale), tile)

    wordmark = ImageFont.truetype(str(FONT_BOLD), 92 * scale)
    label = ImageFont.truetype(str(FONT_BOLD), 22 * scale)
    subtitle = ImageFont.truetype(str(FONT_REGULAR), 32 * scale)
    eyebrow = ImageFont.truetype(str(FONT_BOLD), 18 * scale)

    text_x = 450 * scale
    draw.text((text_x, 184 * scale), "S K E T C H O U", font=eyebrow, fill=(137, 145, 255))
    draw.text((text_x, 220 * scale), "Sketchou", font=wordmark, fill=WHITE)
    wordmark_width = draw.textbbox((0, 0), "Sketchou", font=wordmark)[2]
    ppt_x = text_x + wordmark_width + 24 * scale
    draw.rounded_rectangle((ppt_x, 246 * scale, ppt_x + 132 * scale, 316 * scale), radius=18 * scale, fill=VIOLET)
    draw.text((ppt_x + 26 * scale, 255 * scale), "PPT", font=label, fill=WHITE)
    draw.text((text_x, 345 * scale), "Vector tracing, built for editable slides.", font=subtitle, fill=MUTED)
    draw.line((text_x, 416 * scale, 1128 * scale, 416 * scale), fill=(48, 57, 82), width=2 * scale)
    draw.text((text_x, 448 * scale), "LOCAL-FIRST   /   OPEN SOURCE   /   POWERPOINT-NATIVE", font=eyebrow, fill=(205, 211, 229))

    return image.resize((1280, 640), Image.Resampling.LANCZOS)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    icon = icon_tile()
    icon_png = BRAND / "sketchou-ppt-icon.png"
    icon_ico = BRAND / "sketchou-ppt-brand.ico"
    legacy_ico = BRAND / "sketchou-ppt.ico"
    icon.save(icon_png, optimize=True)
    icon.save(icon_ico, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    icon.save(legacy_ico, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    preview = social_preview()
    preview_path = BRAND / "social-preview.png"
    preview.save(preview_path, optimize=True)

    for path in (icon_png, icon_ico, legacy_ico, preview_path):
        print(path)


if __name__ == "__main__":
    main()
