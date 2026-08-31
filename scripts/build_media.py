"""Build the original Sketchou-PPT launch video and README GIF.

The script uses only repository screenshots and procedurally drawn artwork.
"""

from pathlib import Path
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).parents[1]
MEDIA = ROOT / "docs" / "media"
WIDTH, HEIGHT, FPS, DURATION = 1920, 1080, 30, 17
PURPLE, GREEN, INK, MUTED = "#8b5cf6", "#4ade80", "#f8fafc", "#cbd5e1"


def font(size, bold=False):
    name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def background(t):
    yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
    pulse = 0.5 + 0.5 * math.sin(t * 0.55)
    r = 18 + 21 * xx / WIDTH + 10 * pulse
    g = 16 + 26 * yy / HEIGHT + 8 * (1 - pulse)
    b = 39 + 41 * (1 - xx / WIDTH) + 24 * yy / HEIGHT
    arr = np.dstack([r, g, b]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def ease(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def fit_image(image, box, zoom=1.0, pan=(0.5, 0.5)):
    x, y, w, h = box
    scale = max(w / image.width, h / image.height) * zoom
    resized = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
    left = int((resized.width - w) * pan[0])
    top = int((resized.height - h) * pan[1])
    return resized.crop((left, top, left + w, top + h))


def window_card(canvas, screenshot, box, zoom=1.0, pan=(0.5, 0.5)):
    x, y, w, h = box
    shadow = Image.new("RGBA", canvas.size)
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x + 10, y + 18, x + w + 10, y + h + 18), 28, fill=(0, 0, 0, 95))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
    card = Image.new("RGBA", (w, h), "#f8fafc")
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, w - 1, h - 1), 25, fill="#ffffff", outline="#ffffff", width=2)
    cd.rectangle((0, 58, w, h), fill="#eef2f7")
    for i, color in enumerate(("#fb7185", "#facc15", "#4ade80")):
        cd.ellipse((24 + 32 * i, 19, 42 + 32 * i, 37), fill=color)
    view = fit_image(screenshot, (0, 0, w - 20, h - 78), zoom, pan)
    card.alpha_composite(view.convert("RGBA"), (10, 68))
    canvas.alpha_composite(card, (x, y))


def caption(draw, eyebrow, title, body=None, y=780):
    draw.text((120, y), eyebrow.upper(), font=font(25, True), fill=GREEN)
    draw.text((120, y + 45), title, font=font(62, True), fill=INK)
    if body:
        draw.text((124, y + 124), body, font=font(28), fill=MUTED)


def vector_intro(canvas, t):
    d = ImageDraw.Draw(canvas)
    reveal = ease(t / 2.3)
    pts = []
    for i in range(240):
        u = i / 239
        x = 190 + u * 1510
        y = 590 + 185 * math.sin(u * math.pi * 3.1) * (0.73 + 0.27 * math.cos(u * math.pi))
        pts.append((x, y))
    shown = pts[: max(2, int(len(pts) * reveal))]
    glow = Image.new("RGBA", canvas.size)
    gd = ImageDraw.Draw(glow)
    gd.line(shown, fill=(139, 92, 246, 120), width=44, joint="curve")
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(24)))
    d.line(shown, fill=PURPLE, width=18, joint="curve")
    for u in (0, 0.33, 0.66, 1):
        if u <= reveal + 0.01:
            x, y = pts[int(u * 239)]
            radius = 11 + 6 * (0.5 + 0.5 * math.sin(t * 6 + u * 8))
            d.ellipse((x - radius, y - radius, x + radius, y + radius), fill="#ffffff", outline=GREEN, width=6)
    alpha = ease((t - 0.35) / 0.8)
    title_layer = Image.new("RGBA", canvas.size)
    td = ImageDraw.Draw(title_layer)
    td.text((145, 115), "Sketchou-PPT", font=font(102, True), fill=(248, 250, 252, int(255 * alpha)))
    td.text((152, 232), "TRACE IT.  SHAPE IT.  PRESENT IT.", font=font(32, True), fill=(203, 213, 225, int(255 * alpha)))
    canvas.alpha_composite(title_layer)


def make_frame(time_s, images):
    base = background(time_s).convert("RGBA")
    draw = ImageDraw.Draw(base)
    if time_s < 3.2:
        vector_intro(base, time_s)
    elif time_s < 7.3:
        p = ease((time_s - 3.2) / 4.1)
        window_card(base, images[0], (740, 105, 1050, 750), 1.0 + 0.08 * p, (0.48, 0.36))
        caption(draw, "Real application", "Magnetic centerline tracing", "Follow the stroke — not its noisy edges.", 790)
    elif time_s < 11.4:
        p = ease((time_s - 7.3) / 4.1)
        window_card(base, images[1], (650, 95, 1140, 790), 1.02 + 0.16 * p, (0.70, 0.45))
        caption(draw, "Anchor control", "Smooth here. Sharp there.", "Every turn stays intentional and editable.", 795)
    elif time_s < 14.4:
        p = ease((time_s - 11.4) / 3.0)
        window_card(base, images[2], (690, 92, 1100, 790), 1.02 + 0.10 * p, (0.48, 0.38))
        caption(draw, "Native output", "From path to PowerPoint", "Editable layers. SVG export. Local-first projects.", 795)
    else:
        p = ease((time_s - 14.4) / 1.3)
        vector_intro(base, 2.3)
        overlay = Image.new("RGBA", base.size, (15, 13, 30, int(190 * p)))
        base.alpha_composite(overlay)
        draw = ImageDraw.Draw(base)
        draw.text((152, 278), "OPEN SOURCE", font=font(31, True), fill=GREEN)
        draw.text((145, 335), "Sketchou-PPT", font=font(104, True), fill=INK)
        draw.rounded_rectangle((150, 500, 1110, 590), 28, fill=(255, 255, 255, 26), outline=(255, 255, 255, 60), width=2)
        draw.text((190, 523), "github.com/evan6007/sketchou-ppt", font=font(39, True), fill="#ddd6fe")
        draw.text((154, 655), "Trace it. Shape it. Present it.", font=font(37), fill=MUTED)
    return base.convert("RGB")


def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    image_paths = [MEDIA / "app-overview.png", MEDIA / "anchor-edit.png", MEDIA / "sharp-and-copy.png"]
    images = [Image.open(path).convert("RGB") for path in image_paths]
    video_path = MEDIA / "sketchou-ppt-intro.mp4"
    writer = cv2.VideoWriter(str(video_path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError("OpenCV could not open the MP4 writer")
    gif_frames = []
    try:
        for index in range(FPS * DURATION):
            frame = make_frame(index / FPS, images)
            writer.write(cv2.cvtColor(np.asarray(frame), cv2.COLOR_RGB2BGR))
            if index % 5 == 0 and 3.2 <= index / FPS <= 14.4:
                gif_frames.append(frame.resize((960, 540), Image.Resampling.LANCZOS).quantize(colors=128))
    finally:
        writer.release()
    gif_frames[0].save(MEDIA / "demo.gif", save_all=True, append_images=gif_frames[1:], duration=167, loop=0, optimize=True, disposal=2)
    print(f"Wrote {video_path} ({video_path.stat().st_size:,} bytes)")
    print(f"Wrote {MEDIA / 'demo.gif'} ({(MEDIA / 'demo.gif').stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
