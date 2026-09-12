"""Opt-in scratch-only Office QA. Never invokes Copy or touches user slides."""
import importlib.util,json,pathlib,zipfile,xml.etree.ElementTree as ET
import pythoncom,win32com.client
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'.codex-tmp/copy-recovery-qa'
with zipfile.ZipFile(OUT/'mixed.pptx') as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        if name.endswith(('.xml','.rels')): ET.fromstring(archive.read(name))
    assert len([name for name in archive.namelist() if name.startswith('ppt/media/')])==1
pythoncom.CoInitialize()
app=win32com.client.Dispatch('PowerPoint.Application');pres=None
try:
    pres=app.Presentations.Open(str(OUT/'mixed.pptx'),False,False,False)
    shapes=pres.Slides(1).Shapes
    assert any(shapes(i).Type==13 for i in range(1,shapes.Count+1))
    gradient=next(shapes(i) for i in range(1,shapes.Count+1) if shapes(i).Type==5 and shapes(i).Fill.Type==3)
    assert gradient.Fill.GradientStops.Count==3
    gradient.Fill.GradientStops(2).Color.RGB=255
    gradient.Nodes.SetPosition(1,gradient.Left+1,gradient.Top+1)
    pres.SaveAs(str(OUT/'mixed-edited.pptx'))
finally:
    if pres:pres.Saved=True;pres.Close()
spec=importlib.util.spec_from_file_location('image_native_bridge',ROOT/'app/bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
try:
    payload=json.loads((OUT/'native-input.json').read_text(encoding='utf-8'));payload.pop('cacheId',None)
    result=bridge.copy_native(payload,copy_clipboard=False)
    assert result['count']>=2 and result['prepared']
    shapes=bridge.STATE['presentation'].Slides(1).Shapes(1).GroupItems
    assert any(shapes(i).Type==13 for i in range(1,shapes.Count+1))
    bridge.STATE['presentation'].SaveAs(str(OUT/'bridge-mixed.pptx'))
finally:
    pres=bridge.STATE.get('presentation')
    if pres:pres.Saved=True;pres.Close()
print('Office: independent native picture plus editable three-stop gradient and anchors; bridge preparation passed, no clipboard writes.')
