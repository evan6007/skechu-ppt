"""Loopback security/queue tests; run without installing the optional MCP SDK."""
import importlib.util
import json
from pathlib import Path
import threading
import time
import unittest
import urllib.error
import urllib.request

SPEC = importlib.util.spec_from_file_location('editor_mcp', Path(__file__).resolve().parents[1] / 'services/editor-mcp/server.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EditorMcpTests(unittest.TestCase):
    def setUp(self):
        self.broker = MODULE.Broker(timeout=.3)
        self.server = MODULE.BridgeServer(0, self.broker)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def request(self, path, body=None, **headers):
        defaults = {'Origin': self.server.origin, 'Authorization': 'Bearer ' + self.server.token, 'Content-Type': 'application/json'}
        defaults.update(headers)
        request = urllib.request.Request(self.server.origin + path, data=json.dumps(body).encode() if body is not None else None, headers=defaults)
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_exact_origin_host_and_token(self):
        body = {'sessionId': 'a' * 20}
        for headers in [{'Origin': 'https://evil.example'}, {'Origin': 'null'}, {'Origin': ''}, {'Authorization': ''}, {'Host': 'evil.example'}]:
            self.assertEqual(self.request('/automation/connect', body, **headers)[0], 403)
        self.assertEqual(self.request('/automation/connect', body)[0], 200)
        self.assertEqual(self.request('/automation/connect', {'sessionId': 'b' * 20})[0], 409)
        self.assertEqual(self.request('/automation/disconnect', {'sessionId': 'b' * 20})[0], 409)
        self.assertEqual(self.request('/automation/disconnect', body)[0], 200)

    def test_static_files_do_not_expose_server_or_parent(self):
        self.assertEqual(self.request('/')[0], 200)
        self.assertEqual(self.request('/automation/commands.json')[0], 200)
        for path in ['/../README.md', '/%2e%2e/services/editor-mcp/server.py', '/server.py', '/.env', '/automation/../.env']:
            self.assertEqual(self.request(path)[0], 404)

    def test_single_delivery_and_no_hidden_queue(self):
        self.broker.connect('a' * 20)
        responses = []
        thread = threading.Thread(target=lambda: responses.append(self.broker.call('read_document', {})))
        thread.start()
        command = self.broker.poll('a' * 20)
        self.assertTrue(command['id'])
        with self.assertRaises(MODULE.BridgeError):
            self.broker.call('read_document', {})
        self.broker.complete('a' * 20, {'id': command['id'], 'ok': True, 'result': {'count': 1}})
        thread.join()
        self.assertEqual(responses[0]['result']['count'], 1)
        with self.assertRaises(MODULE.BridgeError):
            self.broker.complete('a' * 20, {'id': command['id'], 'ok': True})

    def test_timeout_revokes_instead_of_replaying(self):
        self.broker.connect('a' * 20)
        with self.assertRaisesRegex(MODULE.BridgeError, 'RESULT_UNKNOWN'):
            self.broker.call('move_objects', {})
        self.assertIsNone(self.broker.session)
        self.assertIsNone(self.broker.pending)
        with self.assertRaises(MODULE.BridgeError):
            self.broker.poll('a' * 20)

    def test_no_authorization_means_no_commands(self):
        with self.assertRaises(MODULE.BridgeError):
            self.broker.call('read_document', {})
        self.assertEqual(self.request('/automation/connect', {'sessionId': 42})[0], 400)


if __name__ == '__main__':
    unittest.main()
