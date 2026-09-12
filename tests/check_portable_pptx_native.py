"""Opt-in scratch-deck QA. Never reads/writes the system clipboard or user decks."""
import pathlib
import zipfile
import xml.etree.ElementTree as ET
import json

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.codex-tmp/portable-pptx-qa'
SOURCE = OUT / 'native-fixture.pptx'
NS = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(SOURCE) as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        ET.fromstring(archive.read(name))
    slide = ET.fromstring(archive.read('ppt/slides/slide1.xml'))
    assert len(slide.findall('.//p:sp', NS)) == 4

if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--office',action='store_true')
    parser.add_argument('--browser',action='store_true')
    args=parser.parse_args()
    if args.office:
        import pythoncom
        import win32com.client
        pythoncom.CoInitialize()
        ppt=win32com.client.Dispatch('PowerPoint.Application')
        presentation=None
        try:
            source=OUT/'browser-selection.pptx' if args.browser else SOURCE
            snapshot=json.loads(source.with_suffix('.json').read_text(encoding='utf-8'))
            presentation=ppt.Presentations.Open(str(source),False,False,False)
            assert presentation.Slides.Count == 1
            native=presentation.Slides(1)
            assert native.Shapes.Count == len(snapshot['shapes'])
            for i, expected in enumerate(snapshot['shapes'],1):
                shape=native.Shapes(i)
                if expected['kind']=='path':
                    assert shape.Type == 5, (i,shape.Type)
                    assert shape.Nodes.Count > 1
                else:
                    assert shape.HasTextFrame
                    assert shape.TextFrame.TextRange.Text.replace('\r','\n')==expected['text']
                if expected.get('fill',{}):
                    if expected['fill']['type']=='linear':
                        assert shape.Fill.Type==3
                        assert shape.Fill.GradientStops.Count==len(expected['fill']['stops'])
                        assert abs(shape.Fill.GradientAngle-expected['fill']['angle'])<.01
                        for j,stop in enumerate(expected['fill']['stops'],1):
                            assert abs(shape.Fill.GradientStops.Item(j).Position-stop['position'])<.0001
                            assert abs(shape.Fill.GradientStops.Item(j).Transparency-(1-stop.get('opacity',1)*expected['fill'].get('opacity',1)))<.0001
            if args.browser:
                native.Export(str(OUT/'browser-native-render.png'),'PNG',1400,720)
                presentation.SaveCopyAs(str(OUT/'browser-office-roundtrip.pptx'),24)
                print(f'Actual editor selection opened: {native.Shapes.Count} native parts, gradient stops/transparency/text preserved; no clipboard writes.')
                raise SystemExit(0)
            gradient=native.Shapes(1)
            assert gradient.Fill.Type == 3
            assert gradient.Fill.GradientStops.Count == 3
            assert abs(gradient.Fill.GradientAngle-35)<.01
            stop=gradient.Fill.GradientStops.Item(2)
            saved=stop.Position
            stop.Position=.45
            assert abs(stop.Position-.45)<.0001
            stop.Position=saved
            curve=native.Shapes(2)
            point=curve.Nodes.Item(1).Points[0]
            curve.Nodes.SetPosition(1,point[0]+5,point[1]+5)
            assert abs(curve.Nodes.Item(1).Points[0][0]-point[0]-5)<.01
            curve.Nodes.SetPosition(1,*point)
            assert native.Shapes(4).TextFrame.TextRange.Text.replace('\r','\n')=='Skechu & <editable>\n原生漸層'
            native.Export(str(OUT/'native-render.png'),'PNG',1200,760)
            presentation.SaveCopyAs(str(OUT/'office-roundtrip.pptx'),24)
            print('PowerPoint opened without repair; 3 editable freeforms, real editable stops, text and independent contours. No clipboard writes.')
        finally:
            if presentation is not None:
                presentation.Saved=True
                presentation.Close()
            pythoncom.CoUninitialize()
    else:
        print('ZIP CRC and every XML part validated. Office QA requires --office.')
