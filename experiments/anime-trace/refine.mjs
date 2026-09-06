// Developer-only CLI. The input is a model's grayscale sketch, not a color photo.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const [input, outputPrefix, reference] = process.argv.slice(2);
if (!input || !outputPrefix || ![4,5].includes(process.argv.length)) {
  console.error('Usage: node experiments/anime-trace/refine.mjs predicted-sketch.png output-prefix [original-image.png]');
  process.exit(2);
}
const outputs = ['.json', '.svg'].map(ext => path.resolve(outputPrefix+ext));
for (const file of outputs) if (fs.existsSync(file)) throw new Error('Refusing to overwrite: '+file);
function decode(file) {
const decoded = spawnSync(process.env.SKECHU_PYTHON || 'python', ['-c',
  'from PIL import Image;import sys,json;im=Image.open(sys.argv[1]);w,h=im.size;assert 3<=w and 3<=h and w*h<=5000000,"Image size limit";sys.stdout.buffer.write((json.dumps([w,h])+"\\n").encode());sys.stdout.buffer.write(im.convert("RGBA").tobytes())',
  path.resolve(file)], {maxBuffer: 21e6});
if (decoded.error) throw decoded.error;
if (decoded.status !== 0) throw new Error(decoded.stderr.toString());
const end = decoded.stdout.indexOf(10), [width, height] = JSON.parse(decoded.stdout.subarray(0, end).toString());
const data = new Uint8Array(decoded.stdout.subarray(end+1));
return {data,width,height};
}
const {data,width,height}=decode(input), source=reference ? decode(reference) : null;
if(source && (source.width!==width || source.height!==height)) throw new Error('Original image and sketch must have identical dimensions and alignment.');
const scope = vm.createContext({});
for (const file of ['../../app/auto-trace.js', '../../app/trace-boundary.js', './refine.js']) vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), scope);
const {engine, refine} = vm.runInContext('({engine:AutoTrace,refine:AnimeLineRefine})', scope);
const result = refine.run({data, width, height, referenceData:source?.data}, engine);
function curvePath(item) {
  let d = `M${item.points[0].x} ${item.points[0].y}`;
  for (let i = 0; i < item.points.length-(item.closed ? 0 : 1); i++) {
    const j = (i+1)%item.points.length, p = item.points[i], q = item.points[j];
    const a = item.pointHandleAngles[i], b = item.pointHandleAngles[j];
    d += `C${p.x+Math.cos(a.out*Math.PI/180)*a.outLength} ${p.y+Math.sin(a.out*Math.PI/180)*a.outLength} ${q.x+Math.cos(b.in*Math.PI/180)*b.inLength} ${q.y+Math.sin(b.in*Math.PI/180)*b.inLength} ${q.x} ${q.y}`;
  }
  return d+(item.closed ? 'Z' : '');
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/>${result.items.map(item => `<path d="${curvePath(item)}" fill="none" stroke="#242b34" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
for (const file of outputs) fs.mkdirSync(path.dirname(file), {recursive: true});
fs.writeFileSync(outputs[0], JSON.stringify({width, height, ...result}), {flag: 'wx'});
fs.writeFileSync(outputs[1], svg, {flag: 'wx'});
console.log(JSON.stringify({files: outputs, stats: result.stats}, null, 2));
