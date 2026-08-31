"""Generate Sketchou-PPT PNG and multi-resolution Windows ICO assets."""

from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).parents[1]
BRAND = ROOT / "assets" / "brand"
SIZE = 1024


def cubic(p0, p1, p2, p3, steps=180):
    points = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        points.append((
            u**3 * p0[0] + 3 * u*u*t * p1[0] + 3 * u*t*t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u*u*t * p1[1] + 3 * u*t*t * p2[1] + t**3 * p3[1],
        ))
    return points


def build_icon():
    BRAND.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((92, 116, 932, 956), radius=226, fill=(25, 14, 55, 150))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(34)))

    tile = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pixels = tile.load()
    for y in range(88, 928):
        for x in range(88, 928):
            if x < 88 or y < 88:
                continue
            mix = ((x - 88) + (y - 88)) / 1680
            r = int(104 + 21 * mix)
            g = int(54 + 20 * mix)
            b = int(218 + 29 * mix)
            pixels[x, y] = (r, g, b, 255)
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((88, 88, 928, 928), radius=226, fill=255)
    tile.putalpha(mask)
    image.alpha_composite(tile)

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    route = cubic((238, 642), (310, 270), (602, 254), (682, 454), 95)
    route += cubic((682, 454), (760, 648), (616, 782), (390, 706), 85)[1:]
    gd.line(route, fill=(255, 255, 255, 115), width=116)
    for x, y in route[::3]:
        gd.ellipse((x-58, y-58, x+58, y+58), fill=(255, 255, 255, 115))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))

    draw = ImageDraw.Draw(image)
    draw.line(route, fill=(255, 255, 255, 255), width=72)
    for x, y in route[::2]:
        draw.ellipse((x-36, y-36, x+36, y+36), fill=(255, 255, 255, 255))

    for x, y, fill in ((238, 642, "#4ade80"), (682, 454, "#fbbf24"), (390, 706, "#4ade80")):
        draw.ellipse((x-42, y-42, x+42, y+42), fill=fill, outline="#ffffff", width=18)

    png_path = BRAND / "sketchou-ppt-icon.png"
    ico_path = BRAND / "sketchou-ppt.ico"
    image.save(png_path, optimize=True)
    image.save(ico_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(png_path)
    print(ico_path)


if __name__ == "__main__":
    build_icon()
