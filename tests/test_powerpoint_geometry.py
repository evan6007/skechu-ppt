"""Opt-in integration test: SKECHU_TEST_POWERPOINT=1 python -m unittest discover -s tests.

Uses a separate hidden scratch presentation; never copies to the clipboard or
closes an existing user presentation. Preview files stay under .codex-tmp.
"""
import copy
import importlib.util
import json
import os
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get("SKECHU_TEST_POWERPOINT") == "1", "requires local PowerPoint")
class NativePowerPointGeometryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("qa_bridge", ROOT / "app" / "bridge.py")
        cls.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.bridge)
        cls.fixture = json.loads((ROOT / "tests" / "curve_fixture.json").read_text(encoding="utf-8"))

    def tearDown(self):
        pres = self.bridge.STATE.get("presentation")
        if pres is not None:
            pres.Saved = True
            pres.Close()
        self.bridge.STATE.update(presentation=None, cache_key=None, cached_group=None,
                                 item_hashes={}, item_shapes={}, origin=None)

    def assert_native_matches(self, item):
        state = self.bridge.STATE
        group = state["cached_group"]
        shape = group.GroupItems.Item(state["item_shapes"][item["id"]][0])
        nodes = self.bridge.freeform_node_points(item)
        self.bridge.verify_freeform_nodes(shape, nodes, 0, 0, .75)
        return shape

    def test_split_cusp_first_build_cached_update_and_render(self):
        item = copy.deepcopy(self.fixture)
        # A second object exercises the real grouped prewarm/update path.
        origin = {"id":"origin", "type":"box", "x":0,"y":0,"w":1,"h":1,
                  "fill":"#ffffff", "strokeWidth":0}
        payload = {"items":[origin,item]}
        result = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assertEqual(result["count"], 2)
        self.assert_native_matches(item)
        output = ROOT / ".codex-tmp" / "native-curve-qa"
        output.mkdir(parents=True, exist_ok=True)
        pres = self.bridge.STATE["presentation"]
        pres.Slides(1).Export(str(output / "split-before.png"), "PNG", 1200, 675)
        pres.SaveAs(str(output / "split-before.pptx"))
        item["pointHandleAngles"]["5"].update({"in":-70,"out":-110,"inLength":95,"outLength":80})
        result = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assert_native_matches(item)
        print("native update:", result)
        self.bridge.STATE["presentation"].Slides(1).Export(str(output / "split-after.png"), "PNG", 1200, 675)
        cached = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assertTrue(cached["cached"])

    def test_circle_uses_projected_start_and_remains_closed(self):
        import math
        points = [{"x":280+(150+(4 if i % 2 else -3))*math.cos(math.tau*i/24),
                   "y":250+(150+(4 if i % 2 else -3))*math.sin(math.tau*i/24)} for i in range(24)]
        points.append(dict(points[0]))
        item = {**self.fixture, "points":points, "pointHandleAngles":{}, "pointAngles":{}}
        origin = {"id":"origin", "type":"box", "x":0,"y":0,"w":1,"h":1}
        self.bridge.copy_native({"items":[origin,item]}, copy_clipboard=False)
        self.assert_native_matches(item)

    def test_short_fairing_handles_are_not_expanded_to_four_units(self):
        item=copy.deepcopy(self.fixture)
        item["pointHandleAngles"]["1"].update(inLength=.35,outLength=.7)
        item["pointHandleAngles"]["6"].update(inLength=0,outLength=0)
        origin={"id":"origin","type":"box","x":0,"y":0,"w":1,"h":1}
        self.bridge.copy_native({"items":[origin,item]},copy_clipboard=False)
        self.assert_native_matches(item)

    def test_fill_only_curve_has_no_office_hairline(self):
        item = copy.deepcopy(self.fixture)
        item.update(width=0, fillOpacity=1, regionFill={"key":"test", "sources":["outer","branch"]})
        origin={"id":"origin","type":"box","x":0,"y":0,"w":1,"h":1}
        payload={"items":[origin,item]}
        self.bridge.copy_native(payload,copy_clipboard=False)
        self.assertEqual(self.assert_native_matches(item).Line.Visible,0)
        item["fill"]="#22c55e"
        self.bridge.copy_native(payload,copy_clipboard=False)
        shape=self.assert_native_matches(item)
        self.assertEqual(shape.Line.Visible,0)
        self.assertEqual(shape.Fill.Transparency,0)
