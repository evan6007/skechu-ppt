/* Browser-local image enhancement. Real-ESRGAN weights retain their BSD license. */
globalThis.SkechuUpscale=(()=>{
 const MODEL_BYTES=2485696,MODEL_SHA='b66812bd06d6f5c803c1236b738f56ffc55ba15c7d8881187bb0a3d0a61a1709';
 function validate({width,height,data,scale=2,lowMemory=false}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>4096||height>4096||width*height>2100000)
   throw Error('目前支援 2 × 2 至 210 萬像素、單邊不超過 4096 的圖片；請先選較小的底圖');
  if(![2,4].includes(scale)||width*scale>8192||height*scale>8192||width*height*scale*scale>(lowMemory?8000000:16000000))throw Error(`輸出上限為 ${lowMemory?'800':'1600'} 萬像素、單邊 8192；請改選 2× 或較小圖片`);
  if(!(data instanceof Uint8ClampedArray)||data.length!==width*height*4)throw Error('圖片像素資料不正確');
  return {width:width*scale,height:height*scale};
 }
 function tiles(width,height,size=128,pad=20){
  if(!Number.isInteger(size)||size<8||size>256||!Number.isInteger(pad)||pad<18||pad>32)throw Error('Invalid tile settings');
  const out=[];
  for(let y=0;y<height;y+=size)for(let x=0;x<width;x+=size){
   const w=Math.min(size,width-x),h=Math.min(size,height-y),left=Math.max(0,x-pad),top=Math.max(0,y-pad),right=Math.min(width,x+w+pad),bottom=Math.min(height,y+h+pad);
   out.push({x,y,w,h,left,top,width:right-left,height:bottom-top});
  }
  return out;
 }
 function tileInput(data,width,tile){
  const rgb=new Float32Array(tile.width*tile.height*3);
  for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
   const src=((tile.top+y)*width+tile.left+x)*4,dst=(y*tile.width+x)*3;
   for(let c=0;c<3;c++)rgb[dst+c]=data[src+c]/255;
  }
  return rgb;
 }
 async function loadModel(tf,base,progress=()=>{}){
  progress('載入動漫模型（2.49 MB）');
  const [json,binary]=await Promise.all([fetch(new URL('anime-v3.json',base)),fetch(new URL('anime-v3-f32.bin',base))]);
  if(!json.ok||!binary.ok)throw Error('模型下載失敗，請確認網路後重試；圖片未上傳');
  const manifest=await json.json(),buffer=await binary.arrayBuffer();
  if(buffer.byteLength!==MODEL_BYTES||manifest.weightsBytes!==MODEL_BYTES||manifest.layers?.length!==18)throw Error('模型版本或大小不正確');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==MODEL_SHA||manifest.weightsSha256!==MODEL_SHA)throw Error('模型完整性檢查失敗，請重新載入');
  const data=new Float32Array(buffer),allocated=[];
  function tensor(spec,expected){
   if(!spec||JSON.stringify(spec.shape)!==JSON.stringify(expected)||!Number.isInteger(spec.offset)||spec.offset<0
    ||spec.length!==expected.reduce((s,v)=>s*v,1)||spec.offset+spec.length>data.length)throw Error('模型張量格式不正確');
   const value=tf.tensor(data.subarray(spec.offset,spec.offset+spec.length),spec.shape,'float32');allocated.push(value);return value;
  }
  try{
   const layers=manifest.layers.map((layer,i)=>({weight:tensor(layer.weight,[3,3,i===0?3:64,i===17?48:64]),
    bias:tensor(layer.bias,[i===17?48:64]),alpha:i===17?null:tensor(layer.alpha,[64])}));
   return {layers,dispose:()=>allocated.forEach(t=>t.dispose())};
  }catch(error){allocated.forEach(t=>t.dispose());throw error}
 }
 async function infer(tf,model,rgb,width,height){
  let value=tf.tensor4d(rgb,[1,height,width,3]),output=null;
  try{
   for(const layer of model.layers){
    const next=tf.tidy(()=>{const conv=tf.add(tf.conv2d(value,layer.weight,1,'same'),layer.bias);return layer.alpha?tf.prelu(conv,layer.alpha):conv});
    value.dispose();value=next;
   }
   output=tf.depthToSpace(value,4,'NHWC');
   const residual=await output.data(),result=new Float32Array(residual.length),ow=width*4;
   for(let y=0;y<height*4;y++)for(let x=0;x<ow;x++){
    const dst=(y*ow+x)*3,src=(Math.floor(y/4)*width+Math.floor(x/4))*3;
    for(let c=0;c<3;c++)result[dst+c]=residual[dst+c]+rgb[src+c];
   }
   return result;
  }finally{value.dispose();output?.dispose()}
 }
 function copyTile(target,outputWidth,values,tile,scale){
  const stride=tile.width*4,step=4/scale,ox=(tile.x-tile.left)*4,oy=(tile.y-tile.top)*4;
  for(let y=0;y<tile.h*scale;y++)for(let x=0;x<tile.w*scale;x++){
   const dst=((tile.y*scale+y)*outputWidth+tile.x*scale+x)*4;
   for(let c=0;c<3;c++){
    let sum=0;for(let dy=0;dy<step;dy++)for(let dx=0;dx<step;dx++)sum+=values[((oy+y*step+dy)*stride+ox+x*step+dx)*3+c];
    target[dst+c]=sum/(step*step)*255;
   }
   target[dst+3]=255;
  }
 }
 function lanczosWeights(length,scale){
  const sinc=x=>Math.abs(x)<1e-8?1:Math.sin(Math.PI*x)/(Math.PI*x);
  return Array.from({length:length*scale},(_,x)=>{
   const center=(x+.5)/scale-.5,entries=[];let total=0;
   for(let i=Math.floor(center)-2;i<=Math.floor(center)+3;i++){
    const d=center-i,w=Math.abs(d)>=3?0:sinc(d)*sinc(d/3);entries.push([Math.max(0,Math.min(length-1,i)),w]);total+=w;
   }
   return entries.map(([i,w])=>[i,w/total]);
  });
 }
 function resize(input,progress=()=>{}){
  const {width,height,data,scale=2}=input,{width:ow,height:oh}=validate(input);
  const xs=lanczosWeights(width,scale),ys=lanczosWeights(height,scale),temp=new Float32Array(ow*height*4),out=new Uint8ClampedArray(ow*oh*4);
  for(let y=0;y<height;y++){
   for(let x=0;x<ow;x++)for(const [xx,w] of xs[x]){const src=(y*width+xx)*4,dst=(y*ow+x)*4,a=data[src+3]/255;for(let c=0;c<3;c++)temp[dst+c]+=data[src+c]*a*w;temp[dst+3]+=data[src+3]*w}
   if(y%64===0)progress(Math.round(y/height*45));
  }
  for(let y=0;y<oh;y++){
   for(let x=0;x<ow;x++){
    const sum=[0,0,0,0];for(const [yy,w] of ys[y])for(let c=0;c<4;c++)sum[c]+=temp[(yy*ow+x)*4+c]*w;
    const dst=(y*ow+x)*4,a=Math.max(0,Math.min(255,sum[3]));out[dst+3]=a;
    if(a>1e-4)for(let c=0;c<3;c++)out[dst+c]=sum[c]*255/a;
   }
   if(y%64===0)progress(45+Math.round(y/oh*50));
  }
  return {data:out,width:ow,height:oh};
 }
 return {validate,tiles,tileInput,loadModel,infer,copyTile,resize};
})();
