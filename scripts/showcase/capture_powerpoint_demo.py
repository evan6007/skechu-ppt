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


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "app"))
import bridge  # noqa: E402

PROJECT = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\evan6\Downloads\未命名專案 2.skc")
OUTPUT = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/media/showcase-frames").resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
PALETTE = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#00c7be", "#0a84ff", "#af52de"]


def scribble_targets(count):
    """Return loose diagonal brush strokes inspired by the supplied sketch."""
    strokes = [
        ((42, 72), (35, 145), (170, 60), (252, 24), 3),
        ((228, 172), (310, 136), (410, 76), (505, 30), 4),
        ((520, 158), (610, 116), (722, 68), (838, 28), 4),
        ((914, 86), (858, 132), (790, 202), (734, 258), 4),
        ((52, 288), (136, 260), (250, 210), (354, 150), 4),
        ((205, 432), (350, 366), (510, 260), (658, 140), 4),
        ((540, 394), (660, 338), (792, 252), (902, 168), 4),
        ((48, 508), (166, 468), (300, 410), (424, 324), 4),
        ((348, 512), (500, 468), (650, 386), (762, 300), 3),
        ((648, 514), (760, 486), (870, 432), (942, 390), 3),
    ]
    if len(strokes) != 10:
        raise RuntimeError("PowerPoint showcase must contain ten distinct strokes")
    points = []
    for p0, p1, p2, p3, amount in strokes:
        for index in range(amount):
            t = index / max(1, amount - 1)
            one_minus = 1 - t
            x = (one_minus ** 3 * p0[0] + 3 * one_minus ** 2 * t * p1[0]
                 + 3 * one_minus * t ** 2 * p2[0] + t ** 3 * p3[0])
            y = (one_minus ** 3 * p0[1] + 3 * one_minus ** 2 * t * p1[1]
                 + 3 * one_minus * t ** 2 * p2[1] + t ** 3 * p3[1])
            dx = (3 * one_minus ** 2 * (p1[0] - p0[0])
                  + 6 * one_minus * t * (p2[0] - p1[0])
                  + 3 * t ** 2 * (p3[0] - p2[0]))
            dy = (3 * one_minus ** 2 * (p1[1] - p0[1])
                  + 6 * one_minus * t * (p2[1] - p1[1])
                  + 3 * t ** 2 * (p3[1] - p2[1]))
            points.append((x, y, math.degrees(math.atan2(dy, dx))))
    if len(points) != count:
        raise RuntimeError(f"Scribble layout has {len(points)} slots for {count} fills")
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

    # Pull the independent colored regions into loose diagonal brush strokes.
    # Keep the original line art as a small focal point while the larger pieces
    # fill the slide with controlled variation in size, offset, and rotation.
    fill_names = [ungrouped.Item(index).Name for index in range(1, fill_count + 1)]
    line_names = [ungrouped.Item(index).Name for index in range(fill_count + 1, ungrouped.Count + 1)]
    line_group = slide.Shapes.Range(tuple(line_names)).Group()
    line_group.LockAspectRatio = -1
    line_start = (line_group.Left, line_group.Top, line_group.Width, line_group.Height)
    line_scale = min(280 / line_group.Width, 195 / line_group.Height)
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
    scribble_positions = scribble_targets(fill_count)
    for index, shape in enumerate(fill_shapes):
        rank = rank_by_index[index]
        target_max_dimension = 98 + ((rank * 17) % 31)
        display_scale = target_max_dimension / max(shape.Width, shape.Height)
        target_width, target_height = shape.Width * display_scale, shape.Height * display_scale
        target_center = scribble_positions[rank]
        jitter_x = math.sin((rank + 1) * 2.17) * 15
        jitter_y = math.cos((rank + 1) * 1.73) * 13
        target_left = target_center[0] + jitter_x - target_width / 2
        target_top = target_center[1] + jitter_y - target_height / 2
        target_left = max(10, min(950 - target_width, target_left))
        target_top = max(10, min(530 - target_height, target_top))
        tangent_rotation = target_center[2] + math.sin((rank + 1) * 1.91) * 28
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
    # Finish with the PowerPoint equivalent of Ctrl+A. Ungroup the centered
    # line art again so the final selection exposes every editable object,
    # rather than presenting the illustration as one opaque group.
    line_group.Ungroup()
    all_names = [slide.Shapes.Item(index).Name for index in range(1, slide.Shapes.Count + 1)]
    slide.Shapes.Range(tuple(all_names)).Select()
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
