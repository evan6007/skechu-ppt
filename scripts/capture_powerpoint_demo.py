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
PALETTE = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6"]


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
    xs = [point["x"] for item in fills for point in item["points"]]
    minimum, maximum = min(xs), max(xs)
    for item in fills:
        center_x = sum(point["x"] for point in item["points"]) / len(item["points"])
        center_y = sum(point["y"] for point in item["points"]) / len(item["points"])
        stripe = max(0, min(6, int((center_x - minimum) / (maximum - minimum or 1) * 7)))
        item["fill"] = PALETTE[(stripe + int(center_y / 150)) % len(PALETTE)]
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

    # Pull the independent colored regions away from the line-art center.
    fill_shapes = [ungrouped.Item(index) for index in range(1, fill_count + 1)]
    starts = [(shape.Left, shape.Top, shape.Rotation) for shape in fill_shapes]
    clockwise = sorted(
        range(fill_count),
        key=lambda index: math.atan2(
            starts[index][0] + fill_shapes[index].Width / 2 - brain_center[0],
            -(starts[index][1] + fill_shapes[index].Height / 2 - brain_center[1]),
        ) % math.tau,
    )
    rank_by_index = {shape_index: rank for rank, shape_index in enumerate(clockwise)}
    targets = []
    for index, shape in enumerate(fill_shapes):
        rank = rank_by_index[index]
        angle = -math.pi / 2 + rank / fill_count * math.tau
        radius_x = max(60, 448 - shape.Width / 2)
        radius_y = max(42, 248 - shape.Height / 2)
        target_left = brain_center[0] + math.cos(angle) * radius_x - shape.Width / 2
        target_top = brain_center[1] + math.sin(angle) * radius_y - shape.Height / 2
        targets.append((
            max(8, min(952 - shape.Width, target_left)),
            max(8, min(532 - shape.Height, target_top)),
            starts[index][2] + ((rank % 7) - 3) * 2.4,
        ))
    app.ActiveWindow.Selection.Unselect()
    for step in range(49):
        amount = step / 48
        for index, (shape, start, move_target) in enumerate(zip(fill_shapes, starts, targets)):
            rank = rank_by_index[index]
            begins = rank / max(1, fill_count - 1) * .62
            local = max(0, min(1, (amount - begins) / .38))
            eased = 1 - (1 - local) ** 3
            shape.Left = start[0] + (move_target[0] - start[0]) * eased
            shape.Top = start[1] + (move_target[1] - start[1]) * eased
            shape.Rotation = start[2] + (move_target[2] - start[2]) * eased
        capture(hwnd, f"ppt-native-explode-{step:02d}.png")
    largest_fill = max(fill_shapes, key=lambda shape: shape.Width * shape.Height)
    largest_fill.Select()
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
