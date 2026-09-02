import importlib.util
import math
import pathlib
import unittest


BRIDGE = pathlib.Path(__file__).parents[1] / "app" / "bridge.py"


class BridgePureFunctionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("skechu_bridge", BRIDGE)
        cls.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.bridge)

    def test_rgb_uses_office_bgr_integer_layout(self):
        self.assertEqual(self.bridge.rgb("#ff0000"), 255)
        self.assertEqual(self.bridge.rgb("#00ff00"), 65280)
        self.assertEqual(self.bridge.rgb("#0000ff"), 16711680)

    def test_latex_subset_stays_editable_unicode(self):
        result = self.bridge.latex_to_unicode(r"V_{mem,t}=V_{mem,t-1}\cdot\beta+X")
        self.assertIn("V", result)
        self.assertIn("ₜ", result)
        self.assertIn("β", result)
        self.assertNotIn("\\cdot", result)

    def test_per_anchor_smoothness_is_preserved_for_powerpoint_nodes(self):
        item = {
            "type": "arrow",
            "points": [{"x": 0, "y": 0}, {"x": 10, "y": 10}, {"x": 20, "y": 0}],
            "curved": True,
            "centerlineLocked": True,
            "smoothnessDefault": 45,
            "pointSmoothness": {"1": 0},
        }
        straight_corner = self.bridge.freeform_node_points(item)
        self.assertEqual(straight_corner[2], item["points"][1])
        self.assertEqual(straight_corner[4], item["points"][1])

        item["pointSmoothness"]["1"] = 100
        rounded_corner = self.bridge.freeform_node_points(item)
        self.assertNotEqual(rounded_corner[2], item["points"][1])
        self.assertNotEqual(rounded_corner[4], item["points"][1])

    def test_per_anchor_tangent_angle_can_turn_curve_inward(self):
        item = {
            "type": "arrow",
            "points": [{"x": 0, "y": 0}, {"x": 10, "y": 10}, {"x": 20, "y": 0}],
            "curved": True,
            "smoothnessDefault": 100,
            "pointAngles": {"1": 90},
        }
        nodes = self.bridge.freeform_node_points(item)
        incoming, outgoing = nodes[2], nodes[4]
        self.assertAlmostEqual(incoming["x"], 10)
        self.assertAlmostEqual(outgoing["x"], 10)
        self.assertLess(incoming["y"], 10)
        self.assertGreater(outgoing["y"], 10)

    def test_split_handles_make_inward_cusp_without_reversing_one_side(self):
        item = {
            "type": "arrow",
            "points": [{"x": 0, "y": 0}, {"x": 10, "y": 10}, {"x": 20, "y": 0}],
            "curved": True,
            "smoothnessDefault": 100,
            "pointHandleAngles": {"1": {"in": -90, "out": -90}},
        }
        nodes = self.bridge.freeform_node_points(item)
        incoming, outgoing = nodes[2], nodes[4]
        self.assertAlmostEqual(incoming["x"], 10)
        self.assertAlmostEqual(outgoing["x"], 10)
        self.assertLess(incoming["y"], 10)
        self.assertLess(outgoing["y"], 10)

    def test_split_handle_distances_are_exact_powerpoint_control_points(self):
        item = {
            "type": "arrow",
            "points": [{"x": 0, "y": 0}, {"x": 10, "y": 10}, {"x": 20, "y": 0}],
            "curved": True,
            "smoothnessDefault": 100,
            "pointHandleAngles": {
                "1": {"in": -90, "out": -90, "inLength": 25, "outLength": 40}
            },
        }
        nodes = self.bridge.freeform_node_points(item)
        incoming, outgoing = nodes[2], nodes[4]
        self.assertAlmostEqual(incoming["x"], 10)
        self.assertAlmostEqual(incoming["y"], -15)
        self.assertAlmostEqual(outgoing["x"], 10)
        self.assertAlmostEqual(outgoing["y"], -30)

    def test_magnetic_circle_samples_export_as_one_true_arc_model(self):
        points = [
            {"x": 100 + 80 * math.cos(math.pi + math.pi / 16 * i),
             "y": 100 + 80 * math.sin(math.pi + math.pi / 16 * i)}
            for i in range(9)
        ]
        model = self.bridge.circle_arc_model(points)
        self.assertIsNotNone(model)
        self.assertAlmostEqual(model["r"], 80, places=6)
        self.assertLess(model["rms"], 1e-6)

        item = {"type": "arrow", "points": points, "curved": True,
                "centerlineLocked": True, "edgeLocked": True}
        nodes = self.bridge.freeform_node_points(item)
        self.assertEqual(len(nodes), 4)
        self.assertAlmostEqual(nodes[0]["x"], points[0]["x"], places=6)
        self.assertAlmostEqual(nodes[-1]["y"], points[-1]["y"], places=6)

    def test_non_circular_boundary_keeps_free_curve_fallback(self):
        points = [{"x": 0, "y": 0}, {"x": 20, "y": 15}, {"x": 40, "y": -8},
                  {"x": 60, "y": 18}, {"x": 80, "y": 0}]
        self.assertIsNone(self.bridge.circle_arc_model(points))

    def test_rough_nearly_full_trace_is_projected_to_one_best_fit_circle(self):
        points = []
        for index in range(25):
            angle = math.radians(10 + 320 * index / 24)
            noisy_radius = 150 + (9 if index % 2 else -7)
            points.append({"x": 240 + noisy_radius * math.cos(angle),
                           "y": 210 + noisy_radius * math.sin(angle)})
        model = self.bridge.circle_arc_model(points)
        self.assertIsNotNone(model)
        self.assertTrue(model["wideArc"])
        self.assertAlmostEqual(model["cx"], 240, delta=3)
        self.assertAlmostEqual(model["cy"], 210, delta=3)
        nodes = self.bridge.circle_arc_bezier_nodes(points)
        radial_errors = [abs(math.hypot(point["x"] - model["cx"], point["y"] - model["cy"]) - model["r"])
                         for point in nodes[::3]]
        self.assertLess(max(radial_errors), 1e-6)
        item = {"type": "arrow", "points": points, "curved": True,
                "centerlineLocked": True, "edgeLocked": True,
                "pointAngles": {"2": 35}}
        self.assertEqual(len(self.bridge.freeform_node_points(item)), 13)

    def test_closing_rough_circle_keeps_the_same_circle_instead_of_spline_fallback(self):
        points = []
        for index in range(24):
            angle = math.tau * index / 24
            noisy_radius = 145 + (8 if index % 2 else -6)
            points.append({"x": 220 + noisy_radius * math.cos(angle),
                           "y": 190 + noisy_radius * math.sin(angle)})
        points.append(dict(points[0]))
        model = self.bridge.circle_arc_model(points, True)
        self.assertIsNotNone(model)
        self.assertTrue(model["fullCircle"])
        self.assertAlmostEqual(abs(model["span"]), math.tau, places=7)
        item = {"type": "arrow", "points": points, "curved": True, "closed": True,
                "centerlineLocked": True, "edgeLocked": True}
        nodes = self.bridge.freeform_node_points(item)
        self.assertEqual(len(nodes), 13)
        self.assertAlmostEqual(nodes[0]["x"], nodes[-1]["x"], places=6)
        self.assertAlmostEqual(nodes[0]["y"], nodes[-1]["y"], places=6)


if __name__ == "__main__":
    unittest.main()
