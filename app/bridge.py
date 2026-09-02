import argparse
import hashlib
import json
import math
import os
import re
import sys
import threading
import time
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import pythoncom
import win32com.client


LOCK = threading.Lock()
PPT_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="skechu-ppt")
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


def indexed_point_value(values, index, default=None):
    if isinstance(values, dict):
        return values.get(str(index), values.get(index, default))
    if isinstance(values, list) and 0 <= index < len(values):
        return values[index]
    return default


def point_smoothness_value(point_kinds, point_smoothness, index, default_strength=100):
    if point_is_sharp(point_kinds, index):
        return 0.0
    try:
        value = float(indexed_point_value(point_smoothness, index, default_strength))
    except (TypeError, ValueError):
        value = float(default_strength)
    return max(0.0, min(150.0, value))


def limited_control(origin, dx, dy, strength, max_length, sign=1):
    vx, vy = dx * strength / 600 * sign, dy * strength / 600 * sign
    length = (vx * vx + vy * vy) ** .5
    if length > max_length and length:
        ratio = max_length / length
        vx, vy = vx * ratio, vy * ratio
    return {"x": origin["x"] + vx, "y": origin["y"] + vy}


def point_tangent_delta(points, index, closed=False, point_angles=None):
    count = len(points)
    point = points[index]
    previous = points[(index - 1) % count] if closed else points[max(0, index - 1)]
    following = points[(index + 1) % count] if closed else points[min(count - 1, index + 1)]
    dx, dy = following["x"] - previous["x"], following["y"] - previous["y"]
    if not dx and not dy:
        fallback = following if following is not point else previous
        dx, dy = fallback["x"] - point["x"], fallback["y"] - point["y"]
    raw_angle = indexed_point_value(point_angles, index, None)
    try:
        angle = float(raw_angle)
    except (TypeError, ValueError):
        return dx, dy
    length = (dx * dx + dy * dy) ** .5
    radians = math.radians(angle)
    return math.cos(radians) * length, math.sin(radians) * length


def split_handle_delta(points, index, side, closed=False, point_handle_angles=None):
    handles = indexed_point_value(point_handle_angles, index, None)
    if not isinstance(handles, dict):
        return None
    try:
        angle = float(handles[side])
    except (KeyError, TypeError, ValueError):
        return None
    explicit_length = False
    try:
        length = max(0.0, min(600.0, float(handles[f"{side}Length"])))
        explicit_length = True
    except (KeyError, TypeError, ValueError):
        automatic = point_tangent_delta(points, index, closed, None)
        length = (automatic[0] ** 2 + automatic[1] ** 2) ** .5
    radians = math.radians(angle)
    return math.cos(radians) * length, math.sin(radians) * length, explicit_length


def curve_segment_controls(points, index, closed, point_kinds=None, point_smoothness=None,
                           point_angles=None, point_handle_angles=None, default_strength=100,
                           centerline_locked=False):
    count = len(points)
    p0 = points[(index - 1) % count] if closed else points[max(0, index - 1)]
    p1, p2 = points[index], points[(index + 1) % count]
    p3 = points[(index + 2) % count] if closed else points[min(count - 1, index + 2)]
    next_index = (index + 1) % count
    distance = lambda a, b: ((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2) ** .5
    current_length = distance(p1, p2)
    previous_length = distance(p1, p0) or current_length
    following_length = distance(p2, p3) or current_length
    cap = 36 if centerline_locked else float("inf")
    split_out = split_handle_delta(points, index, "out", closed, point_handle_angles)
    split_in = split_handle_delta(points, next_index, "in", closed, point_handle_angles)
    tangent1 = split_out or point_tangent_delta(points, index, closed, point_angles)
    tangent2 = split_in or point_tangent_delta(points, next_index, closed, point_angles)
    c1 = ({"x": p1["x"] + split_out[0], "y": p1["y"] + split_out[1]}
          if split_out and split_out[2] else
          limited_control(p1, tangent1[0], tangent1[1],
                          point_smoothness_value(point_kinds, point_smoothness, index, default_strength),
                          min(previous_length, current_length) * .48 if not centerline_locked else min(min(previous_length, current_length) * .48, cap)))
    c2 = ({"x": p2["x"] + split_in[0], "y": p2["y"] + split_in[1]}
          if split_in and split_in[2] else
          limited_control(p2, tangent2[0], tangent2[1],
                          point_smoothness_value(point_kinds, point_smoothness, next_index, default_strength),
                          min(current_length, following_length) * .48 if not centerline_locked else min(min(current_length, following_length) * .48, cap), 1 if split_in else -1))
    return c1, c2


def solve_three_by_three(matrix, vector):
    rows = [list(row) + [vector[index]] for index, row in enumerate(matrix)]
    for column in range(3):
        pivot = max(range(column, 3), key=lambda row: abs(rows[row][column]))
        if abs(rows[pivot][column]) < 1e-8:
            return None
        rows[column], rows[pivot] = rows[pivot], rows[column]
        divisor = rows[column][column]
        rows[column] = [value / divisor for value in rows[column]]
        for row in range(3):
            if row == column:
                continue
            factor = rows[row][column]
            rows[row] = [rows[row][item] - factor * rows[column][item] for item in range(4)]
    return [row[3] for row in rows]


def least_squares_circle(points):
    mean_x = sum(point["x"] for point in points) / len(points)
    mean_y = sum(point["y"] for point in points) / len(points)
    uu = uv = vv = u = v = uq = vq = q = 0.0
    for point in points:
        x, y = point["x"] - mean_x, point["y"] - mean_y
        z = x * x + y * y
        uu, uv, vv = uu + x * x, uv + x * y, vv + y * y
        u, v, uq, vq, q = u + x, v + y, uq + x * z, vq + y * z, q + z
    solved = solve_three_by_three([[uu, uv, u], [uv, vv, v], [u, v, len(points)]],
                                  [-uq, -vq, -q])
    if not solved:
        return None
    d, e, f = solved
    center_x, center_y = mean_x - d / 2, mean_y - e / 2
    radius_squared = (d * d + e * e) / 4 - f
    if radius_squared <= 4:
        return None
    radius = math.sqrt(radius_squared)
    return {"cx": center_x, "cy": center_y, "r": radius} if math.isfinite(radius) else None


def circle_arc_model(points, closed=False):
    points = list(points)
    if closed and len(points) > 5 and math.hypot(points[0]["x"] - points[-1]["x"],
                                                 points[0]["y"] - points[-1]["y"]) < 4:
        points = points[:-1]
    if len(points) < 5:
        return None
    first, last = points[0], points[-1]
    chord = math.hypot(last["x"] - first["x"], last["y"] - first["y"])
    extent = max(max(point["x"] for point in points) - min(point["x"] for point in points),
                 max(point["y"] for point in points) - min(point["y"] for point in points))
    if extent < 12:
        return None
    circle = least_squares_circle(points)
    if not circle:
        return None
    initial_errors = [abs(math.hypot(point["x"] - circle["cx"], point["y"] - circle["cy"]) - circle["r"])
                      for point in points]
    if len(points) >= 12:
        cutoff = sorted(initial_errors)[int(len(initial_errors) * .88)]
        trimmed = [point for index, point in enumerate(points) if initial_errors[index] <= cutoff]
        refined = least_squares_circle(trimmed) if len(trimmed) >= 5 else None
        if refined:
            circle = refined
    center_x, center_y, radius = circle["cx"], circle["cy"], circle["r"]
    if radius > max(extent * 30, chord * 60):
        return None
    angles = [math.atan2(first["y"] - center_y, first["x"] - center_x)]
    diffs = []
    previous = angles[0]
    for point in points[1:]:
        raw = math.atan2(point["y"] - center_y, point["x"] - center_x)
        difference = raw - previous
        while difference > math.pi:
            difference -= math.tau
        while difference < -math.pi:
            difference += math.tau
        previous += difference
        angles.append(previous)
        diffs.append(difference)
    span = angles[-1] - angles[0]
    if abs(span) < .08 or abs(span) > math.pi * 1.999:
        return None
    direction = 1 if span > 0 else -1
    travel = sum(abs(value) for value in diffs)
    forward = sum(abs(value) for value in diffs if (1 if value > 0 else -1) == direction)
    if not travel or forward / travel < .68:
        return None
    errors = [abs(math.hypot(point["x"] - center_x, point["y"] - center_y) - radius)
              for point in points]
    rms = math.sqrt(sum(value * value for value in errors) / len(errors))
    wide_arc = abs(span) >= math.pi * 1.15
    rms_limit = max(7, radius * .075) if wide_arc else max(2.5, radius * .02)
    max_limit = max(20, radius * .18) if wide_arc else max(7, radius * .06)
    if rms > rms_limit or max(errors) > max_limit:
        return None
    if closed:
        span = (1 if span > 0 else -1) * math.tau
    return {"cx": center_x, "cy": center_y, "r": radius, "angles": angles, "span": span,
            "rms": rms, "maxError": max(errors), "wideArc": wide_arc, "fullCircle": closed}


def circle_arc_bezier_nodes(points, closed=False):
    model = circle_arc_model(points, closed)
    if not model:
        return None
    start = model["angles"][0]
    end = start + model["span"] if model.get("fullCircle") else model["angles"][-1]
    segment_count = max(1, math.ceil(abs(end - start) / (math.pi / 2) - 1e-9))
    step = (end - start) / segment_count

    def point_at(angle):
        return {"x": model["cx"] + math.cos(angle) * model["r"],
                "y": model["cy"] + math.sin(angle) * model["r"]}

    nodes = [point_at(start)]
    for index in range(segment_count):
        a, b = start + step * index, start + step * (index + 1)
        p1, p2 = point_at(a), point_at(b)
        factor = 4 / 3 * math.tan((b - a) / 4)
        c1 = {"x": p1["x"] - math.sin(a) * model["r"] * factor,
              "y": p1["y"] + math.cos(a) * model["r"] * factor}
        c2 = {"x": p2["x"] + math.sin(b) * model["r"] * factor,
              "y": p2["y"] - math.cos(b) * model["r"] * factor}
        nodes.extend([c1, c2, p2])
    return nodes


def build_arrow_freeform(slide, points, min_x, min_y, scale, closed, curved=True, explicit_bezier=False,
                         point_kinds=None, point_smoothness=None, point_angles=None,
                         point_handle_angles=None, default_strength=100, centerline_locked=False,
                         edge_locked=False):
    item = {"type": "arrow", "points": points, "closed": closed, "curved": curved,
            "explicitBezier": explicit_bezier, "pointKinds": point_kinds,
            "pointSmoothness": point_smoothness, "pointAngles": point_angles,
            "pointHandleAngles": point_handle_angles, "smoothnessDefault": default_strength,
            "centerlineLocked": centerline_locked, "edgeLocked": edge_locked}
    nodes = freeform_node_points(item)
    cubic = curved or centerline_locked or (explicit_bezier and not closed and
                                           len(points) >= 4 and (len(points) - 1) % 3 == 0)
    builder = slide.Shapes.BuildFreeform(1, (nodes[0]["x"] - min_x) * scale,
                                         (nodes[0]["y"] - min_y) * scale)
    if cubic:
        for i in range(1, len(nodes), 3):
            c1, c2, end = nodes[i:i + 3]
            # Corner means explicit Bezier controls, not a visually sharp curve.
            # Auto discards the controls and lets Office reshape the segment.
            builder.AddNodes(1, 1,
                             (c1["x"] - min_x) * scale, (c1["y"] - min_y) * scale,
                             (c2["x"] - min_x) * scale, (c2["y"] - min_y) * scale,
                             (end["x"] - min_x) * scale, (end["y"] - min_y) * scale)
    else:
        for point in nodes[1:]:
            builder.AddNodes(0, 0, (point["x"] - min_x) * scale, (point["y"] - min_y) * scale)
    shape = builder.ConvertToShape()
    verify_freeform_nodes(shape, nodes, min_x, min_y, scale)
    return shape


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
    builder = slide.Shapes.BuildFreeform(1, (first["x"] - min_x) * scale, (first["y"] - min_y) * scale)
    for i, (p, a, b) in enumerate(corners):
        c1 = {"x": a["x"] + (p["x"] - a["x"]) * 2 / 3, "y": a["y"] + (p["y"] - a["y"]) * 2 / 3}
        c2 = {"x": b["x"] + (p["x"] - b["x"]) * 2 / 3, "y": b["y"] + (p["y"] - b["y"]) * 2 / 3}
        builder.AddNodes(1, 1,
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
    if not bool(item.get("curved", True)) and not bool(item.get("centerlineLocked")):
        return q + ([q[0]] if closed else [])
    authored = any(item.get(key) for key in ("pointKinds", "pointSmoothness", "pointAngles", "pointHandleAngles"))
    arc_nodes = circle_arc_bezier_nodes(q, closed) if item.get("edgeLocked") and not authored and not item.get("explicitBezier") else None
    if arc_nodes:
        return arc_nodes
    nodes = [q[0]]
    segment_count = len(q) if closed else len(q) - 1
    for i in range(segment_count):
        p2 = q[(i + 1) % len(q)]
        c1, c2 = curve_segment_controls(q, i, closed, item.get("pointKinds"),
                                        item.get("pointSmoothness"), item.get("pointAngles"),
                                        item.get("pointHandleAngles"), item.get("smoothnessDefault", 100),
                                        bool(item.get("centerlineLocked")))
        nodes.extend([
            c1,
            c2,
            p2
        ])
    return nodes


def verify_freeform_nodes(shape, nodes, min_x, min_y, scale, tolerance=.02):
    """Reject Office geometry drift instead of silently copying a different shape."""
    if shape.Nodes.Count != len(nodes):
        raise ValueError("PowerPoint changed the freeform node count")
    for index, point in enumerate(nodes, 1):
        actual = shape.Nodes.Item(index).Points[0]
        expected = ((point["x"] - min_x) * scale, (point["y"] - min_y) * scale)
        if math.hypot(actual[0] - expected[0], actual[1] - expected[1]) > tolerance:
            raise ValueError(f"PowerPoint changed freeform control point {index}")


def update_freeform_shape(shape, item, min_x, min_y, scale):
    nodes = freeform_node_points(item)
    if shape.Nodes.Count != len(nodes):
        raise ValueError("freeform node count changed")
    for index, point in enumerate(nodes, 1):
        shape.Nodes.SetPosition(index, (point["x"] - min_x) * scale,
                                (point["y"] - min_y) * scale)
    # Moving an anchor may move its adjacent handles. Repair the final positions;
    # if Office still changes them, the caller rebuilds with explicit controls.
    for index in range(len(nodes), 0, -1):
        point = nodes[index - 1]
        shape.Nodes.SetPosition(index, (point["x"] - min_x) * scale,
                                (point["y"] - min_y) * scale)
    verify_freeform_nodes(shape, nodes, min_x, min_y, scale)
    kind = item.get("type")
    if kind == "arrow":
        closed = bool(item.get("closed"))
        shape.Line.ForeColor.RGB = rgb(item.get("color", "#596a73"))
        shape.Line.Weight = float(item.get("width", 3)) * scale
        shape.Line.Visible = -1 if float(item.get("width", 3)) > 0 else 0
        shape.Line.DashStyle = 4 if item.get("style") == "dash" else 1
        arrow_style = {"triangle": 2, "stealth": 4, "diamond": 5, "circle": 6}.get(item.get("headShape"), 2)
        if not closed and math.hypot(nodes[0]["x"]-nodes[-1]["x"], nodes[0]["y"]-nodes[-1]["y"]) > .01:
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
                curved = bool(item.get("curved", True)) or bool(item.get("centerlineLocked"))
                shape = build_arrow_freeform(slide, pts, min_x, min_y, scale, closed, curved,
                                             bool(item.get("explicitBezier")), item.get("pointKinds"),
                                             item.get("pointSmoothness"), item.get("pointAngles"),
                                             item.get("pointHandleAngles"), item.get("smoothnessDefault", 100),
                                             bool(item.get("centerlineLocked")), bool(item.get("edgeLocked")))
                stage = "line color"
                try:
                    shape.Line.ForeColor.RGB = rgb(item.get("color", "#596a73"))
                    stage = "line weight"
                    shape.Line.Weight = float(item.get("width", 3)) * scale
                    shape.Line.Visible = -1 if float(item.get("width", 3)) > 0 else 0
                    stage = "line dash"
                    if item.get("style") == "dash":
                        shape.Line.DashStyle = 4
                    arrow_style = {"triangle": 2, "stealth": 4, "diamond": 5, "circle": 6}.get(item.get("headShape"), 2)
                    if not closed and math.hypot(pts[0]["x"]-pts[-1]["x"], pts[0]["y"]-pts[-1]["y"]) > .01:
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
    # Windows registry MIME overrides may label .js as text/plain. Workers and
    # service workers require a JavaScript MIME type even when classic scripts run.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".css": "text/css", ".svg": "image/svg+xml",
                      ".webmanifest": "application/manifest+json"}

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
    parser = argparse.ArgumentParser(description="Skechu-PPT local PowerPoint bridge")
    parser.add_argument("--port", type=int, default=8766)
    browser = parser.add_mutually_exclusive_group()
    browser.add_argument("--open-browser", dest="open_browser", action="store_true")
    browser.add_argument("--no-open-browser", dest="open_browser", action="store_false")
    parser.set_defaults(open_browser=None)
    args = parser.parse_args()
    studio_url = f"http://127.0.0.1:{args.port}/"
    should_open = getattr(sys, "frozen", False) if args.open_browser is None else args.open_browser
    # Static editor/font requests must stay responsive while the serialized
    # PowerPoint COM worker is preparing a large native group.
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError:
        if should_open:
            webbrowser.open(studio_url)
            return
        raise
    server.daemon_threads = True
    print(f"Skechu-PPT is ready at {studio_url}")
    if should_open:
        threading.Timer(0.35, webbrowser.open, args=(studio_url,)).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
