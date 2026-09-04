"""Copy the rainbow brain as native shapes, paste it into PowerPoint, and capture the edit view."""

from pathlib import Path
import ctypes
import json
import math
import sys
import time

from PIL import Image
import pythoncom
import win32com.client
import win32gui
import win32ui


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))
import bridge  # noqa: E402

PROJECT = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\evan6\Downloads\未命名專案 2.skc")
OUTPUT = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/media/showcase-frames").resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
PALETTE = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#00c7be", "#0a84ff", "#af52de"]


def s_curve_targets(count):
    """Return equal-distance points on a full-slide S from top-left to bottom-right."""
    dense = []
    for step in range(1201):
        t = step / 1200
        dense.append((480 - 402 * math.cos(3 * math.pi * t), 54 + 432 * t))
    cumulative = [0.0]
    for previous, current in zip(dense, dense[1:]):
        cumulative.append(cumulative[-1] + math.dist(previous, current))

    points = []
    cursor = 1
    for index in range(count):
        wanted = cumulative[-1] * index / max(1, count - 1)
        while cursor < len(cumulative) - 1 and cumulative[cursor] < wanted:
            cursor += 1
        before = cumulative[cursor - 1]
        after = cumulative[cursor]
        mix = 0 if after == before else (wanted - before) / (after - before)
        x = dense[cursor - 1][0] + (dense[cursor][0] - dense[cursor - 1][0]) * mix
        y = dense[cursor - 1][1] + (dense[cursor][1] - dense[cursor - 1][1]) * mix
        points.append((x, y))
    return points


def capture(hwnd, name):
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    width, height = right - left, bottom - top
    window_dc = win32gui.GetWindowDC(hwnd)
    source_dc = win32ui.CreateDCFromHandle(window_dc)
    memory_dc = source_dc.CreateCompatibleDC()
    bitmap = win32ui.CreateBitmap()
    bitmap.CreateCompatibleBitmap(source_dc, width, height)
    memory_dc.SelectObject(bitmap)
    if not ctypes.windll.user32.PrintWindow(hwnd, memory_dc.GetSafeHdc(), 2):
        raise RuntimeError("PowerPoint window capture failed")
    info = bitmap.GetInfo()
    image = Image.frombuffer("RGB", (info["bmWidth"], info["bmHeight"]), bitmap.GetBitmapBits(True), "raw", "BGRX", 0, 1)
    image.save(OUTPUT / name)
    win32gui.DeleteObject(bitmap.GetHandle())
    memory_dc.DeleteDC()
    source_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, window_dc)


def rainbow_items():
    raw = json.loads(PROJECT.read_text(encoding="utf-8"))
    pages = raw["project"]["pages"]
    page = pages[1] if len(pages) > 1 else pages[0]
    items = [item for item in page["items"] if not item.get("referenceOnly") and not item.get("hidden")]
    fills = [item for item in items if item.get("regionFill") and item.get("points")]
    centers = [(
        sum(point["x"] for point in item["points"]) / len(item["points"]),
        sum(point["y"] for point in item["points"]) / len(item["points"]),
    ) for item in fills]
    scene_center = (
        (min(center[0] for center in centers) + max(center[0] for center in centers)) / 2,
        (min(center[1] for center in centers) + max(center[1] for center in centers)) / 2,
    )
    color_order = sorted(
        range(len(fills)),
        key=lambda index: math.atan2(
            centers[index][0] - scene_center[0], -(centers[index][1] - scene_center[1])
        ) % math.tau,
    )
    color_rank = {item_index: rank for rank, item_index in enumerate(color_order)}
    for index, item in enumerate(fills):
        item["fill"] = PALETTE[color_rank[index] % len(PALETTE)]
        item["fillOpacity"] = 1
        item["paintLayer"] = "fill"
    # Match paintSceneItems(): PowerPoint must create every fill first, then
    # place the original line art above it. Raw project order stores fills last.
    foreground = [item for item in items if not item.get("regionFill")]
    for item in foreground:
        item["paintLayer"] = "line"
    return fills + foreground


pythoncom.CoInitialize()
app = win32com.client.DispatchEx("PowerPoint.Application")
target = None
scratch = None
try:
    app.Visible = True
    app.WindowState = 3
    target = app.Presentations.Add()
    target.PageSetup.SlideWidth = 960
    target.PageSetup.SlideHeight = 540
    slide = target.Slides.Add(1, 12)
    target.Windows(1).Activate()
    app.ActiveWindow.View.GotoSlide(1)
    app.ActiveWindow.View.Zoom = 82
    app.Activate()
    time.sleep(0.8)

    windows = []
    win32gui.EnumWindows(
        lambda handle, found: found.append(handle)
        if win32gui.IsWindowVisible(handle) and win32gui.GetClassName(handle) == "PPTFrameClass"
        else None,
        windows,
    )
    if len(windows) != 1:
        raise RuntimeError(f"Expected one PowerPoint window before paste, found {len(windows)}")
    hwnd = windows[0]
    capture(hwnd, "ppt-native-00-empty.png")

    native_items = rainbow_items()
    fill_count = sum(bool(item.get("regionFill")) for item in native_items)
    bridge.STATE["app"] = app
    bridge.copy_native({"items": native_items, "scale": 0.75}, copy_clipboard=True)
    scratch = bridge.STATE.get("presentation")
    target.Windows(1).Activate()
    app.ActiveWindow.View.GotoSlide(1)
    pasted = slide.Shapes.Paste()
    brain = pasted.Item(1)
    brain.LockAspectRatio = -1
    if brain.Height > 430:
        brain.Height = 430
    if brain.Width > 800:
        brain.Width = 800
    brain.Left = (960 - brain.Width) / 2
    brain.Top = (540 - brain.Height) / 2
    brain_center = (brain.Left + brain.Width / 2, brain.Top + brain.Height / 2)
    brain.Select()
    app.Activate()
    time.sleep(1.0)
    capture(hwnd, "ppt-native-01-pasted.png")

    # Ctrl+A-style selection after ungrouping exposes every native object.
    ungrouped = brain.Ungroup()
    ungrouped.Select()
    time.sleep(0.5)
    capture(hwnd, "ppt-native-02-all-selected.png")

    # Pull the independent colored regions into a deliberately composed
    # exploded-view ring. Keep the original line art as a smaller focal point
    # in the middle instead of leaving a full-size drawing behind the pieces.
    fill_names = [ungrouped.Item(index).Name for index in range(1, fill_count + 1)]
    line_names = [ungrouped.Item(index).Name for index in range(fill_count + 1, ungrouped.Count + 1)]
    line_group = slide.Shapes.Range(tuple(line_names)).Group()
    line_group.LockAspectRatio = -1
    line_start = (line_group.Left, line_group.Top, line_group.Width, line_group.Height)
    line_scale = min(320 / line_group.Width, 225 / line_group.Height)
    line_target = (
        (960 - line_group.Width * line_scale) / 2,
        (540 - line_group.Height * line_scale) / 2,
        line_group.Width * line_scale,
        line_group.Height * line_scale,
    )

    fill_shapes = [slide.Shapes.Item(name) for name in fill_names]
    starts = [(shape.Left, shape.Top, shape.Rotation, shape.Width, shape.Height) for shape in fill_shapes]
    clockwise = sorted(
        range(fill_count),
        key=lambda index: math.atan2(
            starts[index][0] + fill_shapes[index].Width / 2 - brain_center[0],
            -(starts[index][1] + fill_shapes[index].Height / 2 - brain_center[1]),
        ) % math.tau,
    )
    rank_by_index = {shape_index: rank for rank, shape_index in enumerate(clockwise)}
    targets = []
    s_positions = s_curve_targets(fill_count)
    for index, shape in enumerate(fill_shapes):
        rank = rank_by_index[index]
        target_max_dimension = 62
        display_scale = target_max_dimension / max(shape.Width, shape.Height)
        target_width, target_height = shape.Width * display_scale, shape.Height * display_scale
        target_center = s_positions[rank]
        target_left = target_center[0] - target_width / 2
        target_top = target_center[1] - target_height / 2
        target_left = max(10, min(950 - target_width, target_left))
        target_top = max(10, min(530 - target_height, target_top))
        before = s_positions[max(0, rank - 1)]
        after = s_positions[min(fill_count - 1, rank + 1)]
        tangent_rotation = math.degrees(math.atan2(after[1] - before[1], after[0] - before[0]))
        targets.append((target_left, target_top,
                        tangent_rotation,
                        target_width, target_height))
    app.ActiveWindow.Selection.Unselect()
    for step in range(49):
        amount = step / 48
        line_eased = 1 - (1 - amount) ** 3
        line_group.Width = line_start[2] + (line_target[2] - line_start[2]) * line_eased
        line_group.Height = line_start[3] + (line_target[3] - line_start[3]) * line_eased
        line_group.Left = line_start[0] + (line_target[0] - line_start[0]) * line_eased
        line_group.Top = line_start[1] + (line_target[1] - line_start[1]) * line_eased
        for index, (shape, start, move_target) in enumerate(zip(fill_shapes, starts, targets)):
            rank = rank_by_index[index]
            begins = rank / max(1, fill_count - 1) * .62
            local = max(0, min(1, (amount - begins) / .38))
            eased = 1 - (1 - local) ** 3
            shape.LockAspectRatio = 0
            shape.Width = start[3] + (move_target[3] - start[3]) * eased
            shape.Height = start[4] + (move_target[4] - start[4]) * eased
            shape.Left = start[0] + (move_target[0] - start[0]) * eased
            shape.Top = start[1] + (move_target[1] - start[1]) * eased
            shape.Rotation = start[2] + (move_target[2] - start[2]) * eased
        capture(hwnd, f"ppt-native-explode-{step:02d}.png")
    showcase_fill = max(fill_shapes, key=lambda shape: shape.Width * shape.Height)
    showcase_fill.Select()
    app.Activate()
    time.sleep(0.5)
    capture(hwnd, "ppt-native-explode-selected.png")
finally:
    if scratch is not None:
        try:
            scratch.Saved = True
            scratch.Close()
        except Exception:
            pass
    if target is not None:
        target.Saved = True
        target.Close()
    app.Quit()
    bridge.STATE.update(app=None, presentation=None, cached_group=None, cache_key=None)
    pythoncom.CoUninitialize()

print(OUTPUT)
