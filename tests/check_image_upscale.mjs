import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';import crypto from 'node:crypto';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
vm.runInThisContext(read('app/image-upscale-core.js'));const sr=globalThis.SkechuUpscale;
const rgba=(w,h,color=[32,110,228,255])=>{const a=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)a.set(color,i*4);return a};
assert.deepEqual(sr.validate({width:8,height:5,data:rgba(8,5)}),{width:16,height:10});
for(const input of [{width:0,height:2},{width:2000,height:2000},{width:1080,height:1061,scale:4},{width:2,height:2,scale:3}])assert.throws(()=>sr.validate({...input,data:rgba(2,2)}));
assert.throws(()=>sr.validate({width:2,height:2,data:new Uint8Array(16)}));
assert.throws(()=>sr.validate({width:100000,height:2,data:rgba(2,2)}),'Extreme aspect ratios must not allocate huge interpolation tables');
assert.throws(()=>sr.validate({width:1024,height:1024,scale:4,lowMemory:true,data:rgba(2,2)}));
assert.throws(()=>sr.validate({width:3000,height:100,scale:4,data:rgba(2,2)}));
for(const scale of [2,4])for(const color of [[32,110,228,255],[12,180,50,120],[0,0,0,0]]){
 const data=rgba(9,7,color),copy=data.slice(),result=sr.resize({width:9,height:7,data,scale});
 assert.equal(result.width,9*scale);assert.equal(result.height,7*scale);assert.deepEqual(data,copy);
 for(let i=0;i<result.data.length;i++)assert.ok(Math.abs(result.data[i]-color[i%4])<=1,'Uniform color and alpha are preserved');
}
for(const [w,h,size] of [[145,137,64],[640,360,128],[128,128,128],[129,17,64]]){
 const coverage=new Uint8Array(w*h),input=rgba(w,h),work=sr.tiles(w,h,size),out=new Uint8ClampedArray(w*h*4*4);
 for(const t of work){
  assert.ok(t.left>=0&&t.top>=0&&t.left+t.width<=w&&t.top+t.height<=h);
  if(t.x>0)assert.ok(t.x-t.left>=18);if(t.y>0)assert.ok(t.y-t.top>=18);
  for(let y=t.y;y<t.y+t.h;y++)for(let x=t.x;x<t.x+t.w;x++)coverage[y*w+x]++;
  const values=new Float32Array(t.width*t.height*16*3);for(let i=0;i<values.length;i++)values[i]=[.2,.4,.6][i%3];sr.copyTile(out,w*2,values,t,2);
  assert.equal(sr.tileInput(input,w,t).length,t.width*t.height*3);
 }
 assert.ok(coverage.every(n=>n===1),'Each source pixel belongs to exactly one retained core');
 for(let i=0;i<out.length;i++)assert.equal(out[i],[51,102,153,255][i%4]);
}
// 2x output averages four native 4x pixels, not a point sample.
const native=new Float32Array(4*4*3);for(let y=0;y<4;y++)for(let x=0;x<4;x++)for(let c=0;c<3;c++)native[(y*4+x)*3+c]=(y*4+x)/16;
const down=new Uint8ClampedArray(16);sr.copyTile(down,2,native,{x:0,y:0,w:1,h:1,left:0,top:0,width:1},2);assert.equal(down[0],Math.round(2.5/16*255));
const manifest=JSON.parse(read('app/vendor/super-resolution/anime-v3.json'));
const weights=fs.readFileSync(new URL('../app/vendor/super-resolution/anime-v3-f32.bin',import.meta.url));assert.equal(weights.length,2485696);assert.equal(crypto.createHash('sha256').update(weights).digest('hex'),manifest.weightsSha256);assert.equal(manifest.layers.length,18);
const tf=fs.readFileSync(new URL('../app/vendor/super-resolution/tf-4.22.0.min.js',import.meta.url));assert.equal(tf.length,1469843);assert.equal(crypto.createHash('sha256').update(tf).digest('hex'),'300dfae273d20b4046f46a06d735688f03675a807561e9bcb5f664eb2f3d2831');
const attributes=read('.gitattributes');for(const file of ['anime-v3.json','tf-4.22.0.min.js'])assert.ok(attributes.includes('app/vendor/super-resolution/'+file+' -text'),'Git checkout must preserve checked asset bytes: '+file);
for(const file of ['image-upscale-core.js','image-upscale-ui.js','image-upscale-worker.js'])new Function(read('app/'+file));
const shell=read('app/service-worker.js').split('];')[0],html=read('app/index.html');
assert.ok(!shell.includes('tf-4.22.0')&&!shell.includes('anime-v3'),'Large assets must not be precached');assert.ok(!html.includes('tf-4.22.0')&&!html.includes('anime-v3'));
for(const name of ['image-upscale-ui.js','image-upscale-core.js','image-upscale-worker.js','image-upscale.css']){assert.ok(shell.includes(name));assert.ok(read('.github/workflows/windows-release.yml').includes('app/'+name+';.'))}
assert.ok(html.includes('image-upscale-ui.js?v=97-hd-compare'));assert.ok(html.includes('image-upscale.css?v=97-hd-compare'));
const ui=read('app/image-upscale-ui.js'),template=ui.slice(ui.indexOf('<dialog'),ui.indexOf("const dialog=$"));
assert.ok(template.indexOf('id="image-upscale-start"')>template.indexOf('<footer>'),'The primary HD start action belongs in the bottom footer');
for(const marker of ['id="image-upscale-handle" role="slider"','id="image-upscale-divider-hit"','data-upscale-mode="before"','data-upscale-mode="split"','data-upscale-mode="after"','id="image-upscale-details"'])assert.ok(template.includes(marker),'Missing HD interaction: '+marker);
console.log('Image HD core OK: caps, alpha, interpolation, valid-core tiling, native reduction, checksums, syntax, lazy assets and packaging.');
