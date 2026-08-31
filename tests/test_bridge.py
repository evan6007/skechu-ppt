import importlib.util
import pathlib
import unittest


BRIDGE = pathlib.Path(__file__).parents[1] / "app" / "bridge.py"


class BridgePureFunctionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("sketchou_bridge", BRIDGE)
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


if __name__ == "__main__":
    unittest.main()
