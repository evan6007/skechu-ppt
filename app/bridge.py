import argparse
import hashlib
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import pythoncom
import win32com.client


LOCK = threading.Lock()
PPT_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="sketchou-ppt")
STATE = {"app": None, "presentation": None, "cache_key": None, "cached_group": None,
         "cached_count": 0, "item_hashes": {}, "item_shapes": {}, "origin": None}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def rgb(hex_color):
    value = (hex_color or "#000000").lstrip("#")
    r, g, b = (int(value[i:i + 2], 16) for i in (0, 2, 4))
    return r + (g << 8) + (b << 16)


SUBSCRIPT = str.maketrans({
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
    "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ",
    "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
    "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ",
    "v": "ᵥ", "x": "ₓ",
})


def latex_to_unicode(value):
    """Convert the editor's compact LaTeX subset into editable PPT text."""
    text = str(value or "")
    # Remove font-style wrappers before parsing subscripts such as
    # V_{\mathrm{mem},t}; nested braces otherwise confuse a simple parser.
    wrapper = re.compile(r"\\(?:mathrm|mathit)\{([^{}]*)\}")
    while wrapper.search(text):
        text = wrapper.sub(r"\1", text)
    replacements = {
        r"\sigma": "σ", r"\alpha": "α", r"\beta": "β",
        r"\cdot": "·", r"\times": "×", r"\leftarrow": "←",
        r"\rightarrow": "→", r"\leq": "≤", r"\geq": "≥",
        r"\neq": "≠", r"\infty": "∞", r"\left": "", r"\right": "",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"\\tilde\{([^{}]+)\}", lambda m: m.group(1) + "\u0303", text)
    text = re.sub(r"_\{([^{}]+)\}", lambda m: m.group(1).translate(SUBSCRIPT), text)
    text = re.sub(r"_([A-Za-z0-9+\-=()])", lambda m: m.group(1).translate(SUBSCRIPT), text)
    text = text.replace("{", "").replace("}", "")
    return text


def bounds(item):
    if item["type"] in ("image", "text", "box", "ellipse"):
        return item.get("x", 0), item.get("y", 0), item.get("w", 80), item.get("h", item.get("size", 20) * 1.3)
    pts = item.get("points", [])
    xs = [p["x"] for p in pts]
    ys = [p["y"] for p in pts]
    return min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)


def point_is_sharp(point_kinds, index):
    if isinstance(point_kinds, dict):
        return point_kinds.get(str(index), point_kinds.get(index)) == "sharp"
    if isinstance(point_kinds, list) and 0 <= index < len(point_kinds):
        return point_kinds[index] == "sharp"
    return False


def build_arrow_freeform(slide, points, min_x, min_y, scale, closed, curved=True, explicit_bezier=False,
                         point_kinds=None):
    q = list(points)
    if closed and len(q) > 2 and abs(q[0]["x"] - q[-1]["x"]) < .01 and abs(q[0]["y"] - q[-1]["y"]) < .01:
        q = q[:-1]
    builder = slide.Shapes.BuildFreeform(0, (q[0]["x"] - min_x) * scale, (q[0]["y"] - min_y) * scale)
    if explicit_bezier and not closed and len(q) >= 4 and (len(q) - 1) % 3 == 0:
        for i in range(1, len(q), 3):
            c1, c2, end = q[i:i + 3]
            builder.AddNodes(1, 0,
                             (c1["x"] - min_x) * scale, (c1["y"] - min_y) * scale,
                             (c2["x"] - min_x) * scale, (c2["y"] - min_y) * scale,
                             (end["x"] - min_x) * scale, (end["y"] - min_y) * scale)
        return builder.ConvertToShape()
    if not curved:
        for p in q[1:]:
            builder.AddNodes(0, 0, (p["x"] - min_x) * scale, (p["y"] - min_y) * scale)
        if closed:
            builder.AddNodes(0, 0, (q[0]["x"] - min_x) * scale, (q[0]["y"] - min_y) * scale)
        return builder.ConvertToShape()
    segment_count = len(q) if closed else len(q) - 1
    for i in range(segment_count):
        p0 = q[(i - 1) % len(q)] if closed else q[max(0, i - 1)]
        p1 = q[i]
        p2 = q[(i + 1) % len(q)]
        p3 = q[(i + 2) % len(q)] if closed else q[min(len(q) - 1, i + 2)]
        next_index = (i + 1) % len(q)
        c1x = p1["x"] if point_is_sharp(point_kinds, i) else p1["x"] + (p2["x"] - p0["x"]) / 6
        c1y = p1["y"] if point_is_sharp(point_kinds, i) else p1["y"] + (p2["y"] - p0["y"]) / 6
        c2x = p2["x"] if point_is_sharp(point_kinds, next_index) else p2["x"] - (p3["x"] - p1["x"]) / 6
        c2y = p2["y"] if point_is_sharp(point_kinds, next_index) else p2["y"] - (p3["y"] - p1["y"]) / 6
        builder.AddNodes(1, 0,
                         (c1x - min_x) * scale, (c1y - min_y) * scale,
                         (c2x - min_x) * scale, (c2y - min_y) * scale,
                         (p2["x"] - min_x) * scale, (p2["y"] - min_y) * scale)
    return builder.ConvertToShape()


def build_rounded_polygon(slide, points, min_x, min_y, scale, radius):
    corners = []
    for i, p in enumerate(points):
        prev = points[(i - 1) % len(points)]
        nxt = points[(i + 1) % len(points)]
        lp = max(.001, ((prev["x"] - p["x"]) ** 2 + (prev["y"] - p["y"]) ** 2) ** .5)
        ln = max(.001, ((nxt["x"] - p["x"]) ** 2 + (nxt["y"] - p["y"]) ** 2) ** .5)
        d = min(radius, lp / 2, ln / 2)
        a = {"x": p["x"] + (prev["x"] - p["x"]) * d / lp, "y": p["y"] + (prev["y"] - p["y"]) * d / lp}
        b = {"x": p["x"] + (nxt["x"] - p["x"]) * d / ln, "y": p["y"] + (nxt["y"] - p["y"]) * d / ln}
        corners.append((p, a, b))
    first = corners[0][1]
    builder = slide.Shapes.BuildFreeform(0, (first["x"] - min_x) * scale, (first["y"] - min_y) * scale)
    for i, (p, a, b) in enumerate(corners):
        c1 = {"x": a["x"] + (p["x"] - a["x"]) * 2 / 3, "y": a["y"] + (p["y"] - a["y"]) * 2 / 3}
        c2 = {"x": b["x"] + (p["x"] - b["x"]) * 2 / 3, "y": b["y"] + (p["y"] - b["y"]) * 2 / 3}
        builder.AddNodes(1, 0,
                         (c1["x"] - min_x) * scale, (c1["y"] - min_y) * scale,
                         (c2["x"] - min_x) * scale, (c2["y"] - min_y) * scale,
                         (b["x"] - min_x) * scale, (b["y"] - min_y) * scale)
        next_a = corners[(i + 1) % len(corners)][1]
        builder.AddNodes(0, 0, (next_a["x"] - min_x) * scale, (next_a["y"] - min_y) * scale)
    return builder.ConvertToShape()


def format_text_shape(shape, text, x, y, w, h, size, color, center=True, rotation=0,
                      font_name="Arial", align=None, valign="top", bold=False, italic=False,
                      margins=None, word_wrap=True):
    target_w, target_h = max(8, w), max(8, h)
    # AddTextbox starts in shape-to-fit-text mode. Disable it before assigning
    # any text, otherwise PowerPoint permanently grows the box on the first
    # assignment and the grouped paste no longer matches the browser layout.
    shape.TextFrame.AutoSize = 0
    shape.TextFrame.WordWrap = -1 if word_wrap else 0
    shape.TextFrame2.AutoSize = 0
    shape.TextFrame2.WordWrap = -1 if word_wrap else 0
    margins = margins or (0, 0, 0, 0)
    shape.TextFrame.MarginLeft, shape.TextFrame.MarginRight, shape.TextFrame.MarginTop, shape.TextFrame.MarginBottom = margins
    shape.TextFrame.TextRange.Text = text
    shape.TextFrame.TextRange.Font.Name = font_name
    shape.TextFrame.TextRange.Font.Size = size
    shape.TextFrame.TextRange.Font.Color.RGB = rgb(color)
    shape.TextFrame.TextRange.Font.Bold = -1 if bold else 0
    shape.TextFrame.TextRange.Font.Italic = -1 if italic else 0
    # Pin the Latin and East-Asian font slots. Setting every Office script slot
    # separately is noticeably expensive across dozens of COM text boxes.
    font2 = shape.TextFrame2.TextRange.Font
    for attr in ("Name", "NameFarEast"):
        try:
            setattr(font2, attr, font_name)
        except Exception:
            pass
    alignment = align or ("center" if center else "left")
    shape.TextFrame.TextRange.ParagraphFormat.Alignment = {"left": 1, "center": 2, "right": 3}.get(alignment, 1)
    shape.TextFrame.VerticalAnchor = {"top": 1, "middle": 3, "bottom": 4}.get(valign, 1)
    try:
        shape.TextFrame2.TextRange.ParagraphFormat.Alignment = {"left": 1, "center": 2, "right": 3}.get(alignment, 1)
        shape.TextFrame2.VerticalAnchor = {"top": 1, "middle": 3, "bottom": 4}.get(valign, 1)
    except Exception:
        pass
    shape.Rotation = rotation
    # Reassert the editor geometry after all Office text formatting. Some
    # builds briefly reflow the box while font script slots are being pinned.
    shape.Left, shape.Top, shape.Width, shape.Height = x, y, target_w, target_h
    return shape


def add_text(slide, text, x, y, w, h, size, color, center=True, rotation=0,
             font_name="Arial", align=None, valign="top", bold=False, italic=False,
             margins=None, word_wrap=True):
    shape = slide.Shapes.AddTextbox(1, x, y, max(8, w), max(8, h))
    return format_text_shape(shape, text, x, y, w, h, size, color, center, rotation,
                             font_name, align, valign, bold, italic, margins, word_wrap)


def item_hash(item):
    return hashlib.sha256(json.dumps(item, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=False).encode("utf-8")).hexdigest()


def freeform_node_points(item):
    kind = item.get("type")
    points = list(item.get("points") or [])
    if not points:
        return []
    if kind == "polygon":
        radius = float(item.get("cornerRadius", 0))
        if radius <= 0:
            return points + [points[0]]
        corners = []
        for i, p in enumerate(points):
            prev, nxt = points[(i - 1) % len(points)], points[(i + 1) % len(points)]
            lp = max(.001, ((prev["x"] - p["x"]) ** 2 + (prev["y"] - p["y"]) ** 2) ** .5)
            ln = max(.001, ((nxt["x"] - p["x"]) ** 2 + (nxt["y"] - p["y"]) ** 2) ** .5)
            d = min(radius, lp / 2, ln / 2)
            a = {"x": p["x"] + (prev["x"] - p["x"]) * d / lp,
                 "y": p["y"] + (prev["y"] - p["y"]) * d / lp}
            b = {"x": p["x"] + (nxt["x"] - p["x"]) * d / ln,
                 "y": p["y"] + (nxt["y"] - p["y"]) * d / ln}
            corners.append((p, a, b))
        nodes = [corners[0][1]]
        for i, (p, a, b) in enumerate(corners):
            nodes.extend([
                {"x": a["x"] + (p["x"] - a["x"]) * 2 / 3,
                 "y": a["y"] + (p["y"] - a["y"]) * 2 / 3},
                {"x": b["x"] + (p["x"] - b["x"]) * 2 / 3,
                 "y": b["y"] + (p["y"] - b["y"]) * 2 / 3},
                b, corners[(i + 1) % len(corners)][1]
            ])
        return nodes
    closed = bool(item.get("closed"))
    q = points[:-1] if closed and len(points) > 2 and abs(points[0]["x"] - points[-1]["x"]) < .01 and abs(points[0]["y"] - points[-1]["y"]) < .01 else points
    if item.get("explicitBezier") and not closed and len(q) >= 4 and (len(q) - 1) % 3 == 0:
        return q
    if not bool(item.get("curved", True)):
        return q + ([q[0]] if closed else [])
    nodes = [q[0]]
    segment_count = len(q) if closed else len(q) - 1
    for i in range(segment_count):
        p0 = q[(i - 1) % len(q)] if closed else q[max(0, i - 1)]
        p1, p2 = q[i], q[(i + 1) % len(q)]
        p3 = q[(i + 2) % len(q)] if closed else q[min(len(q) - 1, i + 2)]
        next_index = (i + 1) % len(q)
        nodes.extend([
            {"x": p1["x"] if point_is_sharp(item.get("pointKinds"), i) else p1["x"] + (p2["x"] - p0["x"]) / 6,
             "y": p1["y"] if point_is_sharp(item.get("pointKinds"), i) else p1["y"] + (p2["y"] - p0["y"]) / 6},
            {"x": p2["x"] if point_is_sharp(item.get("pointKinds"), next_index) else p2["x"] - (p3["x"] - p1["x"]) / 6,
             "y": p2["y"] if point_is_sharp(item.get("pointKinds"), next_index) else p2["y"] - (p3["y"] - p1["y"]) / 6},
            p2
        ])
    return nodes


def update_freeform_shape(shape, item, min_x, min_y, scale):
    nodes = freeform_node_points(item)
    if shape.Nodes.Count != len(nodes):
        raise ValueError("freeform node count changed")
    for index, point in enumerate(nodes, 1):
        shape.Nodes.SetPosition(index, (point["x"] - min_x) * scale,
                                (point["y"] - min_y) * scale)
    kind = item.get("type")
    if kind == "arrow":
        closed = bool(item.get("closed"))
        shape.Line.ForeColor.RGB = rgb(item.get("color", "#596a73"))
        shape.Line.Weight = float(item.get("width", 3)) * scale
        shape.Line.DashStyle = 4 if item.get("style") == "dash" else 1
        arrow_style = {"triangle": 2, "stealth": 4, "diamond": 5, "circle": 6}.get(item.get("headShape"), 2)
        if not closed:
            shape.Line.BeginArrowheadStyle = arrow_style if item.get("startHead") else 1
            shape.Line.EndArrowheadStyle = arrow_style if item.get("endHead", True) else 1
        shape.Fill.Visible = -1 if closed else 0
        if closed:
            shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#dbeafe"))
            shape.Fill.Transparency = 1 - float(item.get("fillOpacity", .25))
        return
    shape.Fill.Visible = -1
    shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#d2e2f0"))
    shape.Fill.Transparency = 1 - float(item.get("opacity", 1))
    stroke = str(item.get("stroke", "#28343e"))
    stroke_width = float(item.get("strokeWidth", 3))
    shape.Line.Visible = -1 if stroke_width > 0 and stroke.lower() not in ("none", "transparent", "") else 0
    if shape.Line.Visible:
        shape.Line.ForeColor.RGB = rgb(stroke)
        shape.Line.Weight = stroke_width * scale


def update_cached_shape(shape, item, min_x, min_y, scale):
    kind = item.get("type")
    if kind in ("arrow", "polygon"):
        update_freeform_shape(shape, item, min_x, min_y, scale)
        return
    x, y, w, h = bounds(item)
    left, top, width, height = (x - min_x) * scale, (y - min_y) * scale, w * scale, h * scale
    if kind == "text":
        is_latex = bool(item.get("latex"))
        size = float(item.get("size", 20)) * scale * (float(item.get("latexScale", 1)) if is_latex else 1)
        boxed = bool(item.get("box"))
        top = (y - min_y) * scale if boxed else (y - min_y - item.get("size", 20)) * scale
        margins = tuple(float(item.get(key, 0)) * scale for key in ("marginLeft", "marginRight", "marginTop", "marginBottom"))
        text = latex_to_unicode(item.get("text", "")) if is_latex else item.get("text", "")
        format_text_shape(shape, text, left, top, width, height, size, item.get("color", "#24313a"),
                          False, item.get("r", 0), item.get("fontFamily", "Arial"),
                          item.get("align", "left"), item.get("valign", "top"),
                          bool(item.get("bold")), bool(item.get("italic")), margins, not is_latex)
        return
    shape.Left, shape.Top, shape.Width, shape.Height = left, top, width, height
    shape.AutoShapeType = 9 if kind == "ellipse" else (5 if float(item.get("radius", 0)) > 0 else 1)
    if kind == "box" and float(item.get("radius", 0)) > 0:
        try:
            shape.Adjustments.SetItem(1, min(.5, float(item.get("radius", 0)) / max(1, min(w, h))))
        except Exception:
            pass
    shape.Fill.Visible = -1
    shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#f3f3f3"))
    shape.Fill.Transparency = 1 - float(item.get("opacity", 1))
    stroke_width = float(item.get("strokeWidth", 2))
    shape.Line.Visible = -1 if stroke_width > 0 else 0
    if stroke_width > 0:
        shape.Line.ForeColor.RGB = rgb(item.get("stroke", "#4b4b4b"))
        shape.Line.Weight = stroke_width * scale
    shape.Rotation = float(item.get("r", 0))


def copy_native(payload, progress=None, copy_clipboard=True):
    pythoncom.CoInitialize()
    with LOCK:
        started = time.perf_counter()
        last_progress = {"percent": -1, "stage": None}

        def report(percent, stage, current=0, total=0, force=False):
            percent = max(0, min(100, int(percent)))
            should_send = (force or stage != last_progress["stage"] or
                           percent >= last_progress["percent"] + 3 or percent == 100)
            if progress is not None and should_send:
                progress({"type": "progress", "percent": percent, "stage": stage,
                          "current": current, "total": total})
            if should_send:
                last_progress["percent"] = percent
                last_progress["stage"] = stage

        report(1, "連接 PowerPoint", force=True)
        cache_key = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()
        app = STATE.get("app")
        if app is not None:
            try:
                _ = app.Version
            except Exception:
                app = None
                STATE["app"] = None
                STATE["cache_key"] = None
                STATE["cached_group"] = None
        if app is None:
            try:
                app = win32com.client.GetActiveObject("PowerPoint.Application")
            except Exception:
                app = win32com.client.DispatchEx("PowerPoint.Application")
            STATE["app"] = app
        selected = payload.get("items", [])
        all_bounds = [bounds(item) for item in selected]
        min_x = min((b[0] for b in all_bounds), default=0)
        min_y = min((b[1] for b in all_bounds), default=0)
        scale = float(payload.get("scale") or next((item.get("pptScale") for item in selected if item.get("pptScale")), 0.75))
        origin = (round(min_x, 6), round(min_y, 6), round(scale, 6))
        current_hashes = {str(item.get("id")): item_hash(item) for item in selected}
        if cache_key == STATE.get("cache_key") and STATE.get("cached_group") is not None:
            try:
                if copy_clipboard:
                    report(88, "使用既有快取", force=True)
                    STATE["cached_group"].Copy()
                report(100, "完成", STATE.get("cached_count", 0), STATE.get("cached_count", 0), True)
                return {"count": STATE.get("cached_count", 0), "cached": True,
                        "prepared": not copy_clipboard,
                        "seconds": round(time.perf_counter() - started, 2)}
            except Exception:
                STATE["cache_key"] = None
                STATE["cached_group"] = None
        cached_hashes = STATE.get("item_hashes") or {}
        changed_ids = [key for key, value in current_hashes.items() if cached_hashes.get(key) != value]
        can_increment = (STATE.get("cached_group") is not None and STATE.get("origin") == origin and
                         set(current_hashes) == set(cached_hashes) and changed_ids)
        if can_increment:
            changed_items = [item for item in selected if str(item.get("id")) in changed_ids]
            can_increment = all(item.get("type") in ("text", "box", "ellipse", "arrow", "polygon") and
                                len((STATE.get("item_shapes") or {}).get(str(item.get("id")), [])) == 1
                                for item in changed_items)
        if can_increment:
            try:
                group = STATE["cached_group"]
                changed_total = len(changed_items)
                report(8, "更新已修改物件", 0, changed_total, True)
                for changed_index, item in enumerate(changed_items, 1):
                    shape_name = STATE["item_shapes"][str(item.get("id"))][0]
                    update_cached_shape(group.GroupItems.Item(shape_name), item, min_x, min_y, scale)
                    report(8 + int(changed_index / max(1, changed_total) * 82),
                           "更新已修改物件", changed_index, changed_total)
                if copy_clipboard:
                    report(96, "寫入剪貼簿", changed_total, changed_total, True)
                    group.Copy()
                STATE["cache_key"] = cache_key
                STATE["item_hashes"] = current_hashes
                report(100, "完成", changed_total, changed_total, True)
                return {"count": STATE.get("cached_count", 0), "cached": False, "incremental": True,
                        "prepared": not copy_clipboard, "changed": len(changed_items),
                        "seconds": round(time.perf_counter() - started, 2)}
            except Exception:
                # Fall back to a complete rebuild if this PowerPoint build
                # rejects direct edits to a child of the cached native group.
                pass
        report(3, "準備暫存投影片", force=True)
        old = STATE.get("presentation")
        if old is not None:
            try:
                old.Close()
            except Exception:
                pass
        try:
            pres = app.Presentations.Add(False)
        except Exception:
            # PowerPoint may have been closed/reopened since the previous copy.
            # Reacquire a fresh COM server instead of reporting it as a bridge
            # connectivity failure.
            app = win32com.client.DispatchEx("PowerPoint.Application")
            STATE["app"] = app
            pres = app.Presentations.Add(False)
        slide = pres.Slides.Add(1, 12)
        names = []
        item_shapes = {}
        # Matrix/grid cells account for most objects in dense research figures.
        # Duplicate an already formatted native AutoShape with the same style
        # instead of repeating every slow PowerPoint COM formatting call.
        style_templates = {}
        text_templates = {}

        def add_reused_text(text, x, y, w, h, size, color, center=True, rotation=0,
                            font_name="Arial", align=None, valign="top", bold=False,
                            italic=False, margins=None, word_wrap=True):
            margins = tuple(margins or (0, 0, 0, 0))
            alignment = align or ("center" if center else "left")
            style_key = (round(float(size), 4), color, font_name, alignment, valign,
                         bool(bold), bool(italic), tuple(round(float(v), 4) for v in margins),
                         bool(word_wrap))
            template = text_templates.get(style_key)
            if template is None:
                shape = add_text(slide, text, x, y, w, h, size, color, center, rotation,
                                 font_name, align, valign, bold, italic, margins, word_wrap)
                text_templates[style_key] = shape
                return shape
            shape = template.Duplicate().Item(1)
            shape.TextFrame.TextRange.Text = text
            shape.Rotation = rotation
            shape.Left, shape.Top = x, y
            shape.Width, shape.Height = max(8, w), max(8, h)
            return shape
        def remember(shape, item, suffix="main"):
            item_id = str(item.get("id"))
            safe_id = re.sub(r"[^A-Za-z0-9_-]", "_", item_id)
            try:
                shape.Name = "sema_%s_%s" % (safe_id, suffix)
            except Exception:
                pass
            names.append(shape.Name)
            item_shapes.setdefault(item_id, []).append(shape.Name)
        total_items = max(1, len(selected))
        report(5, "建立 PowerPoint 物件", 0, total_items, True)
        for item_index, item in enumerate(selected, 1):
            report(5 + int((item_index - 1) / total_items * 84),
                   "建立 PowerPoint 物件", item_index - 1, total_items)
            kind = item.get("type")
            if kind == "polygon":
                pts = item.get("points", [])
                if len(pts) < 3:
                    continue
                radius = float(item.get("cornerRadius", 0))
                if radius > 0:
                    shape = build_rounded_polygon(slide, pts, min_x, min_y, scale, radius)
                else:
                    builder = slide.Shapes.BuildFreeform(0, (pts[0]["x"] - min_x) * scale, (pts[0]["y"] - min_y) * scale)
                    for p in pts[1:]:
                        builder.AddNodes(0, 0, (p["x"] - min_x) * scale, (p["y"] - min_y) * scale)
                    builder.AddNodes(0, 0, (pts[0]["x"] - min_x) * scale, (pts[0]["y"] - min_y) * scale)
                    shape = builder.ConvertToShape()
                shape.Fill.Visible = -1
                shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#d2e2f0"))
                shape.Fill.Transparency = 1 - float(item.get("opacity", 1))
                stroke = str(item.get("stroke", "#28343e"))
                stroke_width = float(item.get("strokeWidth", 3))
                if stroke_width <= 0 or stroke.lower() in ("none", "transparent", ""):
                    shape.Line.Visible = 0
                else:
                    shape.Line.Visible = -1
                    shape.Line.ForeColor.RGB = rgb(stroke)
                    shape.Line.Weight = stroke_width * scale
                remember(shape, item)
                label = item.get("label")
                if label:
                    x, y, w, h = bounds(item)
                    size = float(item.get("fontSize", 20)) * scale
                    lx = float(item.get("labelX", x + w / 2))
                    ly = float(item.get("labelY", y + h / 2))
                    text_shape = add_reused_text(label, (lx - min_x - w / 2) * scale, (ly - min_y - item.get("fontSize", 20)) * scale, w * scale, size * 1.5, size, item.get("labelColor", "#24313a"))
                    remember(text_shape, item, "label")
            elif kind == "box":
                x, y, w, h = bounds(item)
                radius = float(item.get("radius", 0))
                style_key = ("box", round(radius, 6), round(float(w), 4), round(float(h), 4),
                             item.get("fill", "#f3f3f3"),
                             round(float(item.get("opacity", 1)), 6), item.get("stroke", "#4b4b4b"),
                             round(float(item.get("strokeWidth", 2)), 6), round(float(item.get("r", 0)), 6))
                template = style_templates.get(style_key)
                if template is not None:
                    shape = template.Duplicate().Item(1)
                    shape.Left, shape.Top = (x - min_x) * scale, (y - min_y) * scale
                    if radius > 0:
                        try:
                            shape.Adjustments.SetItem(1, min(.5, radius / max(1, min(w, h))))
                        except Exception:
                            pass
                else:
                    shape = slide.Shapes.AddShape(5 if radius > 0 else 1, (x - min_x) * scale, (y - min_y) * scale, w * scale, h * scale)
                    if radius > 0:
                        try:
                            shape.Adjustments.SetItem(1, min(.5, radius / max(1, min(w, h))))
                        except Exception:
                            pass
                    shape.Fill.Visible = -1
                    shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#f3f3f3"))
                    shape.Fill.Transparency = 1 - float(item.get("opacity", 1))
                    shape.Line.Visible = -1 if float(item.get("strokeWidth", 2)) > 0 else 0
                    shape.Line.ForeColor.RGB = rgb(item.get("stroke", "#4b4b4b"))
                    shape.Line.Weight = float(item.get("strokeWidth", 2)) * scale
                    shape.Rotation = float(item.get("r", 0))
                    style_templates[style_key] = shape
                remember(shape, item)
            elif kind == "ellipse":
                x, y, w, h = bounds(item)
                style_key = ("ellipse", round(float(w), 4), round(float(h), 4),
                             item.get("fill", "#f3f3f3"),
                             round(float(item.get("opacity", 1)), 6), item.get("stroke", "#4b4b4b"),
                             round(float(item.get("strokeWidth", 2)), 6), round(float(item.get("r", 0)), 6))
                template = style_templates.get(style_key)
                if template is not None:
                    shape = template.Duplicate().Item(1)
                    shape.Left, shape.Top = (x - min_x) * scale, (y - min_y) * scale
                else:
                    shape = slide.Shapes.AddShape(9, (x - min_x) * scale, (y - min_y) * scale, w * scale, h * scale)
                    shape.Fill.Visible = -1
                    shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#f3f3f3"))
                    shape.Fill.Transparency = 1 - float(item.get("opacity", 1))
                    shape.Line.Visible = -1 if float(item.get("strokeWidth", 2)) > 0 else 0
                    if shape.Line.Visible:
                        shape.Line.ForeColor.RGB = rgb(item.get("stroke", "#4b4b4b"))
                        shape.Line.Weight = float(item.get("strokeWidth", 2)) * scale
                    shape.Rotation = float(item.get("r", 0))
                    style_templates[style_key] = shape
                remember(shape, item)
            elif kind == "text":
                x, y, w, h = bounds(item)
                is_latex = bool(item.get("latex"))
                size = float(item.get("size", 20)) * scale
                if is_latex:
                    size *= float(item.get("latexScale", 1))
                boxed = bool(item.get("box"))
                top = (y - min_y) * scale if boxed else (y - min_y - item.get("size", 20)) * scale
                margins = tuple(float(item.get(key, 0)) * scale for key in ("marginLeft", "marginRight", "marginTop", "marginBottom"))
                ppt_text = latex_to_unicode(item.get("text", "")) if is_latex else item.get("text", "")
                shape = add_reused_text(ppt_text, (x - min_x) * scale, top, w * scale, h * scale,
                                        size, item.get("color", "#24313a"), False, item.get("r", 0),
                                        item.get("fontFamily", "Arial"), item.get("align", "left"), item.get("valign", "top"),
                                        bool(item.get("bold")), bool(item.get("italic")), margins, not is_latex)
                remember(shape, item)
            elif kind == "arrow":
                pts = item.get("points", [])
                if len(pts) < 2:
                    continue
                closed = bool(item.get("closed"))
                curved = bool(item.get("curved", True))
                try:
                    shape = build_arrow_freeform(slide, pts, min_x, min_y, scale, closed, curved,
                                                 bool(item.get("explicitBezier")), item.get("pointKinds"))
                except Exception:
                    # Some PowerPoint versions reject a cyclic cubic segment
                    # with E_INVALIDARG. Preserve editability and geometry by
                    # retrying the same nodes as a closed native freeform.
                    shape = build_arrow_freeform(slide, pts, min_x, min_y, scale, closed, False, False,
                                                 item.get("pointKinds"))
                stage = "line color"
                try:
                    shape.Line.ForeColor.RGB = rgb(item.get("color", "#596a73"))
                    stage = "line weight"
                    shape.Line.Weight = float(item.get("width", 3)) * scale
                    stage = "line dash"
                    if item.get("style") == "dash":
                        shape.Line.DashStyle = 4
                    arrow_style = {"triangle": 2, "stealth": 4, "diamond": 5, "circle": 6}.get(item.get("headShape"), 2)
                    if not closed:
                        stage = "begin arrowhead"
                        shape.Line.BeginArrowheadStyle = arrow_style if item.get("startHead") else 1
                        stage = "end arrowhead"
                        shape.Line.EndArrowheadStyle = arrow_style if item.get("endHead", True) else 1
                    stage = "fill visibility"
                    shape.Fill.Visible = -1 if closed else 0
                    if closed:
                        stage = "fill color"
                        shape.Fill.ForeColor.RGB = rgb(item.get("fill", "#dbeafe"))
                        stage = "fill transparency"
                        shape.Fill.Transparency = 1 - float(item.get("fillOpacity", .25))
                except Exception as exc:
                    raise RuntimeError("arrow formatting failed at %s: %s" % (stage, exc))
                remember(shape, item)
            elif kind == "image":
                src = item.get("src", "")
                if src.startswith("assets/"):
                    src = os.path.join(BASE_DIR, *src.split("/"))
                if not os.path.isfile(src):
                    continue
                x, y, w, h = bounds(item)
                shape = slide.Shapes.AddPicture(src, False, True, (x - min_x) * scale, (y - min_y) * scale, w * scale, h * scale)
                shape.Rotation = item.get("r", 0)
                remember(shape, item)
        if not names:
            raise ValueError("沒有可複製的 PowerPoint 原生元素")
        report(90, "建立 PowerPoint 物件", len(selected), len(selected), True)
        build_seconds = time.perf_counter() - started
        # Copy one native group so PowerPoint cannot independently reflow the
        # text and geometry. All child shapes remain editable after entering
        # or ungrouping the group, and text boxes stay above filled shapes.
        report(93, "群組處理", len(names), len(names), True)
        if len(names) > 1:
            group = slide.Shapes.Range(names).Group()
            group_seconds = time.perf_counter() - started - build_seconds
        else:
            group = slide.Shapes.Range(names)
            group_seconds = time.perf_counter() - started - build_seconds
        if copy_clipboard:
            report(97, "寫入剪貼簿", len(names), len(names), True)
            group.Copy()
        STATE["presentation"] = pres
        STATE["cache_key"] = cache_key
        STATE["cached_group"] = group
        STATE["cached_count"] = len(names)
        STATE["item_hashes"] = current_hashes
        STATE["item_shapes"] = item_shapes
        STATE["origin"] = origin
        total_seconds = time.perf_counter() - started
        report(100, "完成", len(names), len(names), True)
        return {"count": len(names), "cached": False, "prepared": not copy_clipboard,
                "seconds": round(total_seconds, 2),
                "phases": {"build": round(build_seconds, 2), "group": round(group_seconds, 2),
                           "clipboard": round(total_seconds - build_seconds - group_seconds, 2)}}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8765")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        if self.path not in ("/copy", "/prepare"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
        except Exception as exc:
            body = json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8765")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        connected = {"value": True}

        def emit(event):
            if not connected["value"]:
                return
            try:
                line = (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")
                self.wfile.write(line)
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                connected["value"] = False

        try:
            # Every COM request runs on one persistent worker thread so the
            # PowerPoint application and native group cache remain reusable.
            result = PPT_EXECUTOR.submit(
                copy_native, payload, emit, self.path == "/copy"
            ).result()
            emit({"type": "result", "ok": True, **result})
        except Exception as exc:
            emit({"type": "result", "ok": False, "error": str(exc)})

    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description="Sketchou-PPT local PowerPoint bridge")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    # Static editor/font requests must stay responsive while the serialized
    # PowerPoint COM worker is preparing a large native group.
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    print(f"Sketchou-PPT is ready at http://127.0.0.1:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
