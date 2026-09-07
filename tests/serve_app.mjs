// Loopback-only test server; consistent JS/Wasm MIME types on Windows.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../app/',import.meta.url)),port=Number(process.env.SKECHU_TEST_PORT||18782);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(file!==root&&!file.startsWith(root.endsWith(path.sep)?root:root+path.sep)){res.writeHead(403);return res.end()}
 const stat=await fs.promises.stat(file);if(!stat.isFile()){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log('Skechu test app: http://127.0.0.1:'+port+'/'));
