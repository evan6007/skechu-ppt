/* No image upload and no server inference. Heavy dependencies load on demand. */
importScripts('image-upscale-core.js?v=86-browser-hd');
let running=false;
self.onmessage=async event=>{
 if(running)return;running=true;let model=null;
 try{
  const input=event.data,{width,height,data,scale,method}=input,dimensions=SkechuUpscale.validate(input),started=performance.now();
  const progress=(stage,percent)=>postMessage({type:'progress',stage,percent});
  if(method==='resize'){
   const result=SkechuUpscale.resize(input,p=>progress('一般放大（Lanczos，非 AI）',p));
   postMessage({type:'result',...result,stats:{method:'resize',backend:'worker-cpu',ms:Math.round(performance.now()-started)}},[result.data.buffer]);return;
  }
  if(method!=='anime')throw Error('請選擇支援的高清模式');
  for(let i=3;i<data.length;i+=4)if(data[i]<255)throw Error('動漫模型暫不支援透明圖片；可改選「一般放大（非 AI）」保留透明度');
  progress('載入瀏覽器引擎（1.47 MB）',2);
  importScripts('vendor/super-resolution/tf-4.22.0.min.js');
  let available=false;try{available=await tf.setBackend('webgl');await tf.ready()}catch{}
  if(!available||tf.getBackend()!=='webgl')throw Error('這個瀏覽器無法在背景啟用 GPU。請改選「一般放大（非 AI）」或使用開啟硬體加速的 Chrome／Edge；不會改用慢速 AI CPU 運算');
  tf.env().set('WEBGL_CPU_FORWARD',false);
  // Do not let a GPU texture pool grow across differently shaped edge tiles.
  tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD',0);
  model=await SkechuUpscale.loadModel(tf,new URL('vendor/super-resolution/',location.href),s=>progress(s,5));
  const small=!!input.lowMemory,tileSize=small?64:128,work=SkechuUpscale.tiles(width,height,tileSize,20);
  const output=new Uint8ClampedArray(dimensions.width*dimensions.height*4);
  const idleMemory=tf.memory();let peakBytes=idleMemory.numBytes;
  for(let index=0;index<work.length;index++){
   const tile=work[index],rgb=SkechuUpscale.tileInput(data,width,tile);
   progress(`動漫 AI 高清 · ${index+1}/${work.length} 區塊`,8+Math.round(index/work.length*86));
   const values=await SkechuUpscale.infer(tf,model,rgb,tile.width,tile.height);
   SkechuUpscale.copyTile(output,dimensions.width,values,tile,scale);
   peakBytes=Math.max(peakBytes,tf.memory().numBytes);
   // Yield between tiles; cancel closes the Worker and its WebGL context.
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const tensorsAfter=tf.memory().numTensors;
  if(tensorsAfter!==idleMemory.numTensors)throw Error('高清運算未能釋放暫存，已停止以保護記憶體');
  model.dispose();model=null;
  postMessage({type:'result',data:output,...dimensions,stats:{method:'anime',backend:'webgl',model:'Real-ESRGAN AnimeVideo-v3',tiles:work.length,tileSize,
   ms:Math.round(performance.now()-started),persistentTensorBytes:peakBytes,tensorLeak:false}},[output.buffer]);
 }catch(error){postMessage({type:'error',message:error.message||String(error)})}
 finally{model?.dispose();running=false}
};
