"""Capture a real PowerPoint edit view for the README feature demo."""

from pathlib import Path
import sys
import time

from PIL import Image
import pythoncom
import win32com.client
import win32con
import win32gui
import win32ui
import ctypes


OUTPUT = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/media/showcase-frames").resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)


def rgb(red, green, blue):
    return red | (green << 8) | (blue << 16)


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
    bits = bitmap.GetBitmapBits(True)
    image = Image.frombuffer("RGB", (info["bmWidth"], info["bmHeight"]), bits, "raw", "BGRX", 0, 1)
    image.save(OUTPUT / name)
    win32gui.DeleteObject(bitmap.GetHandle())
    memory_dc.DeleteDC()
    source_dc.DeleteDC()
    win32gui.ReleaseDC(hwnd, window_dc)


pythoncom.CoInitialize()
app = win32com.client.DispatchEx("PowerPoint.Application")
presentation = None
try:
    app.Visible = True
    app.WindowState = 3
    presentation = app.Presentations.Add()
    presentation.PageSetup.SlideWidth = 960
    presentation.PageSetup.SlideHeight = 540
    slide = presentation.Slides.Add(1, 12)

    title = slide.Shapes.AddTextbox(1, 72, 40, 816, 48)
    title.TextFrame.TextRange.Text = "每個物件都能在 PowerPoint 單獨編輯"
    title.TextFrame.TextRange.Font.Name = "Microsoft JhengHei"
    title.TextFrame.TextRange.Font.Size = 25
    title.TextFrame.TextRange.Font.Bold = True
    title.TextFrame.TextRange.Font.Color.RGB = rgb(30, 41, 59)

    subtitle = slide.Shapes.AddTextbox(1, 74, 88, 800, 30)
    subtitle.TextFrame.TextRange.Text = "選取其中一個物件，直接拖曳位置"
    subtitle.TextFrame.TextRange.Font.Name = "Microsoft JhengHei"
    subtitle.TextFrame.TextRange.Font.Size = 14
    subtitle.TextFrame.TextRange.Font.Color.RGB = rgb(100, 116, 139)

    card = slide.Shapes.AddShape(5, 115, 190, 250, 145)
    card.Fill.ForeColor.RGB = rgb(237, 233, 254)
    card.Line.ForeColor.RGB = rgb(124, 58, 237)
    card.Line.Weight = 4
    card.Rotation = -4

    circle = slide.Shapes.AddShape(9, 520, 175, 160, 160)
    circle.Fill.ForeColor.RGB = rgb(204, 251, 241)
    circle.Line.ForeColor.RGB = rgb(15, 118, 110)
    circle.Line.Weight = 4

    builder = slide.Shapes.BuildFreeform(0, 210, 420)
    builder.AddNodes(1, 0, 405, 350)
    builder.AddNodes(1, 0, 705, 420)
    arrow = builder.ConvertToShape()
    arrow.Line.ForeColor.RGB = rgb(249, 115, 22)
    arrow.Line.Weight = 7
    arrow.Line.EndArrowheadStyle = 3
    arrow.Fill.Visible = False

    app.ActiveWindow.View.GotoSlide(1)
    app.ActiveWindow.View.Zoom = 86
    circle.Select()
    app.Activate()
    time.sleep(1.2)
    windows = []
    win32gui.EnumWindows(
        lambda handle, found: found.append(handle)
        if win32gui.IsWindowVisible(handle) and win32gui.GetClassName(handle) == "PPTFrameClass"
        else None,
        windows,
    )
    if len(windows) != 1:
        raise RuntimeError(f"Expected one PowerPoint window, found {len(windows)}")
    hwnd = windows[0]
    capture(hwnd, "ppt-native-00.png")

    start = circle.Left
    for step in range(1, 21):
        circle.Left = start + 92 * step / 20
        circle.Select()
        time.sleep(0.035)
        capture(hwnd, f"ppt-native-{step:02d}.png")
finally:
    if presentation is not None:
        presentation.Close()
    app.Quit()
    pythoncom.CoUninitialize()

print(OUTPUT)
