"""Real official-SDK client/server round trip; browser channel is a test peer."""
import asyncio
import json
from pathlib import Path
import sys
import urllib.request
from urllib.parse import urlsplit, parse_qs

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]


async def main():
    params = StdioServerParameters(command=sys.executable, args=[str(ROOT / 'services/editor-mcp/server.py'), '--port', '0'])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            initialized = await session.initialize()
            assert initialized.serverInfo.name == 'skechu-ppt'
            tools = await session.list_tools()
            assert len(tools.tools) == 13
            assert len({tool.name for tool in tools.tools}) == 13
            assert (await session.call_tool('skechu_read_document', {})).isError
            connected = await session.call_tool('skechu_connect', {})
            url = urlsplit(connected.structuredContent['url'])
            token = parse_qs(url.fragment)['automation'][0]
            origin = f'{url.scheme}://{url.netloc}'

            def post(path, body):
                request = urllib.request.Request(origin + '/automation/' + path, data=json.dumps({'sessionId':'test-session-12345678', **body}).encode(), headers={'Origin':origin,'Authorization':'Bearer '+token,'Content-Type':'application/json'})
                with urllib.request.urlopen(request, timeout=15) as response:
                    return json.loads(response.read())

            await asyncio.to_thread(post, 'connect', {})
            call = asyncio.create_task(session.call_tool('skechu_read_document', {}))
            command = await asyncio.to_thread(post, 'poll', {})
            assert command['name'] == 'read_document'
            payload = {'context':{'projectId':'test','pageId':'one','revision':1},'objects':[],'total':0}
            await asyncio.to_thread(post, 'result', {'id':command['id'],'ok':True,'result':payload})
            result = await call
            assert not result.isError and result.structuredContent == payload
            invalid = await session.call_tool('skechu_move_objects', {'ids':['x'],'dx':'bad'})
            assert invalid.isError
            await asyncio.to_thread(post, 'disconnect', {})
            assert (await session.call_tool('skechu_read_document', {})).isError
    print('MCP protocol OK: official SDK initialize/list/call, strict schemas, no access before consent, loopback round trip and revocation.')


if __name__ == '__main__':
    asyncio.run(main())
