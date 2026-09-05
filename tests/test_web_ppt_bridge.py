"""Exercise real HTTP trust boundaries without changing the Office clipboard."""
import http.client
import importlib.util
import json
import pathlib
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer


class InlineBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("inline_bridge", pathlib.Path(__file__).parents[1] / "app/bridge.py")
        cls.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.bridge)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), cls.bridge.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.bridge.PPT_EXECUTOR.shutdown()

    def setUp(self):
        self.copy = patch.object(self.bridge, "copy_native", side_effect=self.native).start()
        self.cancel = patch.object(self.bridge, "cancel_background_prepares").start()
        self.addCleanup(patch.stopall)

    @staticmethod
    def native(payload, progress, copying, cancel_event):
        progress({"type": "progress", "percent": 50, "stage": "build"})
        return {"count": len(payload["items"]), "prepared": not copying}

    def request(self, method, path, payload=None, origin="https://evan6007.github.io", headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        request_headers = {"Content-Type": "application/json"}
        if origin is not None:
            request_headers["Origin"] = origin
        request_headers.update(headers or {})
        body = json.dumps(payload) if payload is not None else None
        connection.request(method, path, body, request_headers)
        response = connection.getresponse()
        data = response.read().decode("utf-8")
        result = response.status, dict(response.getheaders()), data
        connection.close()
        return result

    def test_probe_and_preflight_never_start_office(self):
        status, headers, body = self.request("GET", "/web-ppt/status")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["protocol"], 1)
        self.assertIn("inline-copy", json.loads(body)["capabilities"])
        self.assertEqual(headers["Access-Control-Allow-Origin"], "https://evan6007.github.io")
        self.assertEqual(headers["Cache-Control"], "no-store")
        status, headers, _ = self.request("OPTIONS", "/web-ppt/copy", headers={
            "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
            "Access-Control-Request-Private-Network": "true"})
        self.assertEqual(status, 204)
        self.assertEqual(headers["Access-Control-Allow-Private-Network"], "true")
        self.copy.assert_not_called()
        self.cancel.assert_not_called()

    def test_reject_untrusted_origin_host_and_simple_post_before_side_effects(self):
        payload = {"items": [{"type": "box"}]}
        for origin in (None, "null", "https://evil.example", "https://evan6007.github.io.evil.example"):
            for method, path in (("GET", "/web-ppt/status"), ("POST", "/web-ppt/copy"), ("POST", "/web-ppt/cancel-prepare")):
                status, headers, _ = self.request(method, path, payload if method == "POST" else None, origin=origin)
                self.assertEqual(status, 403)
                self.assertNotIn("Access-Control-Allow-Origin", headers)
        for path in ("/copy", "/prepare", "/cancel-prepare"):
            self.assertEqual(self.request("POST", path, payload, origin="https://evil.example")[0], 403)
        self.assertEqual(self.request("POST", "/web-ppt/copy", payload, headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(self.request("POST", "/web-ppt/copy", payload, headers={"Content-Type": "text/plain"})[0], 400)
        self.copy.assert_not_called()
        self.cancel.assert_not_called()

    def test_validate_remote_documents_before_cancelling_or_scheduling(self):
        bad = [None, [], {}, {"items": []}, {"cacheId": {}, "items": [{"type": "box"}]},
               {"items": [{"type": "unknown"}]}, {"items": [{"type": "box", "x": float("nan")}]},
               {"items": [{"type": "arrow", "points": [{"x": "1", "y": 2}]}]}]
        for src in ("C:/private.png", "assets/../private.png", "assets/..\\private.png", "https://example.com/a.png"):
            bad.append({"items": [{"type": "image", "src": src}]})
        for payload in bad:
            self.assertEqual(self.request("POST", "/web-ppt/copy", payload)[0], 400)
        self.copy.assert_not_called()
        self.cancel.assert_not_called()
        self.assertFalse(self.bridge.PREPARE_CANCEL_EVENTS)

    def test_copy_prepare_stream_and_legacy_compatibility(self):
        payload = {"cacheId": "tab:page:selection", "items": [{"id": "a", "type": "box", "x": 20}]}
        for path, preparing in (("/web-ppt/copy", False), ("/web-ppt/prepare", True), ("/copy", False)):
            status, headers, body = self.request("POST", path, payload)
            self.assertEqual(status, 200)
            events = [json.loads(line) for line in body.splitlines()]
            self.assertEqual(events[0]["type"], "progress")
            self.assertTrue(events[-1]["ok"])
            self.assertEqual(events[-1]["prepared"], preparing)
            self.assertEqual(self.copy.call_args.args[0], payload)
            self.assertEqual(self.copy.call_args.args[2], not preparing)
            self.assertEqual(headers["Access-Control-Allow-Origin"], "https://evan6007.github.io")
        self.assertFalse(self.bridge.PREPARE_CANCEL_EVENTS)
        self.assertEqual(self.cancel.call_count, 2)
        self.assertEqual(self.request("POST", "/web-ppt/cancel-prepare", {})[0], 200)
        self.assertEqual(self.cancel.call_count, 3)


if __name__ == "__main__":
    unittest.main()
