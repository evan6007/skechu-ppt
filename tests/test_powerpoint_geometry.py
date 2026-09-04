"""Opt-in integration test: SKECHU_TEST_POWERPOINT=1 python -m unittest discover -s tests.

Uses separate hidden scratch presentations; never closes a user presentation.
The clipboard benchmark additionally requires SKECHU_TEST_CLIPBOARD=1 and copies
test curves to the system clipboard. Other tests do not copy. Previews stay under .codex-tmp.
"""
import copy
import importlib.util
import json
import os
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class NativePreparationPriorityTests(unittest.TestCase):
    def test_fill_color_does_not_invalidate_freeform_geometry(self):
        spec = importlib.util.spec_from_file_location("style_bridge", ROOT / "app" / "bridge.py")
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        item = {"id": "fill", "type": "arrow", "closed": True, "curved": True,
                "points": [{"x": 0, "y": 0}, {"x": 40, "y": 20}, {"x": 80, "y": 0}],
                "fill": "#ef4444", "fillOpacity": 1}
        changed = copy.deepcopy(item)
        changed.update(fill="#2563eb", fillOrder=4)
        self.assertNotEqual(bridge.item_hash(item), bridge.item_hash(changed))
        self.assertEqual(bridge.item_geometry_hash(item), bridge.item_geometry_hash(changed))

    def test_only_closed_paint_faces_are_appendable_to_native_cache(self):
        spec = importlib.util.spec_from_file_location("fill_bridge", ROOT / "app" / "bridge.py")
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        face = {"id": "fill", "type": "arrow", "paintLayer": "fill", "closed": True,
                "points": [{"x": 0, "y": 0}, {"x": 40, "y": 0}, {"x": 20, "y": 30}]}
        self.assertTrue(bridge.appendable_region_fill(face))
        self.assertFalse(bridge.appendable_region_fill({**face, "paintLayer": "line"}))
        self.assertFalse(bridge.appendable_region_fill({**face, "closed": False}))

    def test_cancelled_background_prepare_stops_before_powerpoint_access(self):
        spec = importlib.util.spec_from_file_location("priority_bridge", ROOT / "app" / "bridge.py")
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        cancel = bridge.register_prepare_cancel()
        cancel.set()
        try:
            with self.assertRaisesRegex(bridge.PreparationCancelled, "讓位"):
                bridge.copy_native({"items": [{"id": "box", "type": "box", "x": 0, "y": 0,
                                                "w": 10, "h": 10}]}, copy_clipboard=False,
                                   cancel_event=cancel)
        finally:
            bridge.unregister_prepare_cancel(cancel)
        self.assertFalse(bridge.PREPARE_CANCEL_EVENTS)


@unittest.skipUnless(os.environ.get("SKECHU_TEST_POWERPOINT") == "1", "requires local PowerPoint")
class NativePowerPointGeometryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("qa_bridge", ROOT / "app" / "bridge.py")
        cls.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.bridge)
        cls.fixture = json.loads((ROOT / "tests" / "curve_fixture.json").read_text(encoding="utf-8"))

    def tearDown(self):
        for state in [self.bridge.STATE, *self.bridge.CACHE_STATES.values()]:
            pres = state.get("presentation")
            if pres is not None:
                pres.Saved = True
                pres.Close()
        self.bridge.CACHE_STATES.clear()
        self.bridge.STATE.update(presentation=None, cache_key=None, cached_group=None,
                                 item_hashes={}, item_geometry_hashes={}, item_shapes={}, origin=None)

    @unittest.skipUnless(os.environ.get("SKECHU_TEST_CLIPBOARD") == "1", "explicit clipboard benchmark opt-in")
    def test_incremental_caches_and_background_clipboard_isolation(self):
        import win32clipboard
        curves = [{"id": f"curve-{i}", "type": "arrow", "curved": True,
                   "centerlineLocked": True, "explicitBezier": True, "width": 2,
                   "color": "#123f8c", "startHead": False, "endHead": False,
                   "points": [{"x": 100, "y": 20+i*4}, {"x": 140, "y": 5+i*4}, {"x": 190, "y": 20+i*4}]}
                  for i in range(100)]
        payload = {"items": curves, "cacheId": "qa:all"}
        before = win32clipboard.GetClipboardSequenceNumber()
        cold = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assertEqual(win32clipboard.GetClipboardSequenceNumber(), before)
        warm = self.bridge.copy_native(payload, copy_clipboard=True)
        self.assertTrue(warm["cached"])
        before = win32clipboard.GetClipboardSequenceNumber()
        # Moving the leftmost point changes the scene bounds, but only one native curve needs updating.
        curves[0]["points"][0]["x"] -= 10
        updated = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assertTrue(updated["incremental"])
        self.assertEqual(updated["changed"], 1)
        self.assertEqual(win32clipboard.GetClipboardSequenceNumber(), before)
        self.bridge.copy_native({"items": curves[:1], "cacheId": "qa:selection"}, copy_clipboard=False)
        self.bridge.copy_native({"items": curves[1:2], "cacheId": "qa:other-tab"}, copy_clipboard=False)
        again = self.bridge.copy_native(payload, copy_clipboard=True)
        self.assertTrue(again["cached"], "Partial copying and another tab must not evict the full scene")
        with self.bridge.native_cache_context("qa:all"):
            state = self.bridge.STATE
            x, y, scale = state["origin"]
            for curve in curves:
                shape = state["cached_group"].GroupItems.Item(state["item_shapes"][curve["id"]][0])
                self.bridge.verify_freeform_nodes(shape, self.bridge.freeform_node_points(curve), x, y, scale)
            output = ROOT / ".codex-tmp" / "native-cache-qa"
            output.mkdir(parents=True, exist_ok=True)
            state["presentation"].Slides(1).Export(str(output / "curves.png"), "PNG", 1200, 900)
        print("100-curve cache benchmark:", json.dumps({"coldPrepare": cold, "warmCopy": warm,
              "onePointPrepare": updated, "fullCopyAfterOtherSelections": again}))

    def assert_native_matches(self, item):
        state = self.bridge.STATE
        group = state["cached_group"]
        shape = group.GroupItems.Item(state["item_shapes"][item["id"]][0])
        nodes = self.bridge.freeform_node_points(item)
        self.bridge.verify_freeform_nodes(shape, nodes, 0, 0, .75)
        return shape

    def test_new_region_fill_is_appended_without_rebuilding_existing_lines(self):
        lines = [{"id": f"line-{index}", "type": "arrow", "curved": True,
                  "width": 2, "color": "#123f8c", "startHead": False,
                  "endHead": False,
                  "points": [{"x": 0, "y": index * 15},
                             {"x": 50, "y": index * 15 + 8},
                             {"x": 100, "y": index * 15}]}
                 for index in range(4)]
        payload = {"items": lines, "cacheId": "qa:append-fill"}
        cold = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assertFalse(cold.get("incremental", False))
        fill = {"id": "region-fill", "type": "arrow", "paintLayer": "fill",
                "curved": True, "closed": True, "width": 0, "color": "#ef4444",
                "fill": "#ef4444", "fillOpacity": 1,
                "points": [{"x": 10, "y": 8}, {"x": 80, "y": 8},
                           {"x": 80, "y": 36}, {"x": 10, "y": 36}]}
        payload["items"] = [fill, *lines]
        appended = self.bridge.copy_native(payload, copy_clipboard=False)
        self.assertTrue(appended["incremental"])
        self.assertEqual(appended["changed"], 1)
        self.assertEqual(appended["count"], 5)
        with self.bridge.native_cache_context("qa:append-fill"):
            state = self.bridge.STATE
            self.assertEqual(set(state["item_shapes"]), {"region-fill", *[line["id"] for line in lines]})
            self.assertEqual(state["cached_group"].GroupItems.Count, 5)

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
