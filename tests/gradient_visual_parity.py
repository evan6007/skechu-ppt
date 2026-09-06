"""Local-only real Office/SVG parity evidence. Never writes the clipboard."""
import importlib.util
import json
import pathlib
import sys
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'.codex-tmp/gradient-parity';OUT.mkdir(parents=True,exist_ok=True)
if '--compare' in sys.argv:
    errors=[]
    for record in json.loads((OUT/'fixtures.json').read_text()):
        name=record['name'];native=Image.open(OUT/(name+'-native.png')).convert('RGB');web=Image.open(OUT/(name+'-web.png')).convert('RGB')
        samples=[max(abs(a-b) for a,b in zip(native.getpixel((x,y)),web.getpixel((x,y)))) for x in range(20,780,40) for y in range(20,300,20)]
        error=sum(samples)/len(samples);print(name,'mean/max RGB error',round(error,2),max(samples));errors.append(error)
    assert max(errors)<4, 'SVG and Office gradient angles/colors differ'
    raise SystemExit()
import pythoncom
import win32com.client
spec=importlib.util.spec_from_file_location('parity_bridge',ROOT/'app/bridge.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
pythoncom.CoInitialize();app=win32com.client.Dispatch('PowerPoint.Application');pres=app.Presentations.Add(0)
try:
    pres.PageSetup.SlideWidth=800;pres.PageSetup.SlideHeight=320;slide=pres.Slides.Add(1,12)
    shape=slide.Shapes.AddShape(1,0,0,800,320);shape.Line.Visible=0
    fixtures=[]
    for angle in [0,35,45,90,120,270]:
        for alpha in [1,.55]:
            gradient={'type':'linear','angle':angle,'stops':[{'position':0,'color':'#ff0000','opacity':1},
                {'position':.4,'color':'#00ff00','opacity':alpha},{'position':1,'color':'#0000ff','opacity':1}]}
            bridge.apply_shape_fill(shape,{'fillGradient':gradient},'#ffffff',1)
            name=f'angle-{angle}-alpha-{alpha}';slide.Export(str(OUT/(name+'-native.png')),'PNG',800,320)
            fixtures.append({'name':name,'gradient':gradient})
    (OUT/'fixtures.json').write_text(json.dumps(fixtures))
finally:pres.Saved=True;pres.Close();pythoncom.CoUninitialize()
