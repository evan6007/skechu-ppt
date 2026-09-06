"""Native integration is opt-in; isolated hidden scratch deck, no clipboard writes."""
import copy
import importlib.util
import os
import pathlib
import unittest
import zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gradient_bridge", ROOT / "app/bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
GRADIENT = {"type": "linear", "angle": 35, "stops": [
    {"color": "#ff0000", "position": 0, "opacity": 1},
    {"color": "#00ff00", "position": .4, "opacity": .8},
    {"color": "#0000ff", "position": 1, "opacity": .5}]}


class GradientValidationTests(unittest.TestCase):
    def test_schema_and_hash(self):
        original = copy.deepcopy(GRADIENT)
        self.assertEqual(bridge.validate_fill_gradient(GRADIENT), GRADIENT)
        self.assertEqual(GRADIENT, original)
        for changed in [{"type": "radial"}, {"angle": True}, {"angle": float('nan')},
                        {"stops": []}, {"stops": GRADIENT['stops'] * 4}]:
            with self.assertRaises(ValueError):
                bridge.validate_fill_gradient({**GRADIENT, **changed})
        for changed in [{"color": "red"}, {"position": 2}, {"position": False}, {"opacity": -1}]:
            g = copy.deepcopy(GRADIENT)
            g['stops'][0].update(changed)
            with self.assertRaises(ValueError):
                bridge.validate_web_ppt_payload({"items": [{"type": "box", "fillGradient": g}]})
        a = dict(type="box", id="a", x=0, y=0, w=200, h=100, fill="#ffffff")
        b = {**a, "fillGradient": GRADIENT}
        self.assertEqual(bridge.item_geometry_hash(a), bridge.item_geometry_hash(b))
        self.assertNotEqual(bridge.item_hash(a), bridge.item_hash(b))


@unittest.skipUnless(os.environ.get('SKECHU_TEST_POWERPOINT') == '1', 'requires local PowerPoint')
class NativeGradientTests(unittest.TestCase):
    def tearDown(self):
        for state in [bridge.STATE, *bridge.CACHE_STATES.values()]:
            pres = state.get('presentation')
            if pres is not None:
                pres.Saved = True
                pres.Close()
        bridge.CACHE_STATES.clear()
        bridge.STATE.update(presentation=None, cache_key=None, cached_group=None,
                            item_hashes={}, item_geometry_hashes={}, item_shapes={}, origin=None)

    def test_native_stops_style_updates_and_export(self):
        shape = dict(id='box', type='box', x=0, y=0, w=300, h=120, r=0, radius=0,
                     fill='#ffffff', stroke='#000000', strokeWidth=0, opacity=.8,
                     fillGradient=copy.deepcopy(GRADIENT))
        items = [shape, {**copy.deepcopy(shape), 'id': 'ellipse', 'type': 'ellipse', 'y': 150},
                 {**copy.deepcopy(shape), 'id': 'poly', 'type': 'polygon', 'points': [
                     {'x':350,'y':0}, {'x':650,'y':0}, {'x':600,'y':120}, {'x':380,'y':120}]}]
        items.append({**copy.deepcopy(items[-1]), 'id':'arrow', 'type':'arrow',
                      'points':[{'x':p['x'],'y':p['y']+150} for p in items[-1]['points']],
                      'closed':True, 'curved':True, 'pointKinds':{'0':'sharp','1':'sharp','2':'sharp','3':'sharp'},
                      'fillOpacity':.8, 'width':0, 'endHead':False})
        items[1]['fillGradient']['angle'] = 120
        bridge.copy_native({'items':items}, copy_clipboard=False)
        pres = bridge.STATE['presentation']; slide = pres.Slides(1)
        def native(item):
            return slide.Shapes.Item(bridge.STATE['item_shapes'][item['id']][0])
        for it in items:
            s=native(it)
            self.assertNotEqual(s.Type,13, 'Gradient must not be a picture')
            self.assertEqual(s.Fill.Type,3)
            self.assertEqual(s.Fill.GradientStops.Count,3)
            self.assertAlmostEqual(s.Fill.GradientAngle,it['fillGradient']['angle'],delta=.01)
            actual=sorted([(s.Fill.GradientStops.Item(i).Position,
                            s.Fill.GradientStops.Item(i).Color.RGB,
                            s.Fill.GradientStops.Item(i).Transparency)
                           for i in range(1,4)])
            for got, stop in zip(actual,it['fillGradient']['stops']):
                self.assertAlmostEqual(got[0],stop['position'],delta=.0001)
                self.assertEqual(got[1],bridge.rgb(stop['color']))
                self.assertAlmostEqual(got[2],1-.8*stop['opacity'],delta=.0001)
        output=ROOT/'.codex-tmp/gradient-native-qa';output.mkdir(parents=True,exist_ok=True)
        pres.SaveAs(str(output/'gradients.pptx'),24)
        slide.Export(str(output/'gradients.png'),'PNG',1300,540)
        with zipfile.ZipFile(output/'gradients.pptx') as z:
            xml=ET.fromstring(z.read('ppt/slides/slide1.xml'))
        ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
        self.assertEqual(len(xml.findall('.//a:gradFill',ns)),4)
        self.assertEqual(len(xml.findall('.//a:gs',ns)),12)
        geometry=[(native(it).Left,native(it).Top,native(it).Width,native(it).Height) for it in items]
        # Maximum stop count + per-stop alpha survive the incremental style path.
        shape['fillGradient']['stops']=[dict(position=i/9,color='#123abc',opacity=i/9) for i in range(10)]
        bridge.copy_native({'items':items},copy_clipboard=False)
        self.assertEqual(native(shape).Fill.GradientStops.Count,10)
        self.assertEqual(geometry,[(native(it).Left,native(it).Top,native(it).Width,native(it).Height) for it in items])
        del shape['fillGradient']
        shape['fill']='#aabbcc'
        bridge.copy_native({'items':items},copy_clipboard=False)
        self.assertEqual(native(shape).Fill.Type,1)
        self.assertEqual(native(shape).Fill.ForeColor.RGB,bridge.rgb('#aabbcc'))

    def test_compound_cutouts_keep_native_gradient(self):
        from test_powerpoint_geometry import NativePowerPointGeometryTests
        item=NativePowerPointGeometryTests.compound_fixture()
        item['fillGradient']=copy.deepcopy(GRADIENT)
        bridge.copy_native({'items':[item]},copy_clipboard=False)
        pres=bridge.STATE['presentation'];slide=pres.Slides(1)
        shape=slide.Shapes.Item(bridge.STATE['item_shapes'][item['id']][0])
        self.assertEqual(shape.Fill.GradientStops.Count,3)
        self.assertEqual(shape.Type,5)
        output=ROOT/'.codex-tmp/gradient-native-qa';output.mkdir(parents=True,exist_ok=True)
        pres.SaveAs(str(output/'cutout.pptx'),24)
        shape.Export(str(output/'cutout.png'),2)
        with zipfile.ZipFile(output/'cutout.pptx') as z:
            xml=ET.fromstring(z.read('ppt/slides/slide1.xml'))
        ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
        self.assertEqual(len(xml.findall('.//a:moveTo',ns)),3)
        self.assertEqual(len(xml.findall('.//a:gs',ns)),3)


if __name__ == '__main__':
    unittest.main()
