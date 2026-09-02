importScripts('auto-trace.js');
self.onmessage=event=>{
  try{const result=AutoTrace.run(event.data,(percent,stage)=>self.postMessage({type:'progress',percent,stage}));self.postMessage({type:'result',result})}
  catch(error){self.postMessage({type:'error',message:error.message||String(error)})}
};
