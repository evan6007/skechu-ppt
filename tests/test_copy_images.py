import base64
import importlib.util
import pathlib
import struct
import unittest
import zlib
from unittest.mock import Mock, patch


class CopyImageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('image_bridge', pathlib.Path(__file__).parents[1] / 'app/bridge.py')
        cls.bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.bridge)

    def png(self, w=1, h=1):
        def chunk(kind, data):
            return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\xff\x00\x00\xff'))+chunk(b'IEND',b'')
        return 'data:image/png;base64,'+base64.b64encode(raw).decode()

    def test_embedded_png_and_unsafe_sources(self):
        self.assertTrue(self.bridge.inline_png(self.png()).startswith(b'\x89PNG'))
        for src in ['C:/secret.png','https://example.com/a.png','data:image/svg+xml;base64,AAAA',self.png()[:-8],self.png(8193),self.png(5000,5000)]:
            with self.assertRaises(ValueError):
                self.bridge.inline_png(src)
        item={'id':'pic','type':'image','src':self.png(),'x':0,'y':0,'w':1,'h':1}
        self.bridge.validate_web_ppt_payload({'items':[item]})

    def test_uncertain_cached_copy_is_not_replayed(self):
        bridge=self.bridge
        import hashlib,json
        payload={'items':[{'id':'a','type':'box','x':0,'y':0,'w':20,'h':20}]}
        key=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
        app=Mock(Version='16.0');group=Mock();group.Copy.side_effect=RuntimeError('clipboard occupied')
        state={**bridge.STATE,'app':app,'cache_key':key,'cached_group':group,'origin':None}
        with patch.object(bridge,'STATE',state):
            with self.assertRaisesRegex(RuntimeError,'clipboard occupied'):
                bridge.copy_native(payload)
        group.Copy.assert_called_once();app.Presentations.Add.assert_not_called()
        self.assertIsNone(state['cached_group'],'Explicit next retry must be able to rebuild a stale COM group')
        self.assertIsNone(state['cache_key'])


if __name__=='__main__':unittest.main()
