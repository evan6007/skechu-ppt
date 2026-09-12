/* Self-hosted worker. Receives geometry, returns a native ZIP; no network data. */
importScripts('portable-pptx.js?v=95-copy-recovery');
onmessage=event=>{
  try{const bytes=PortablePptx.encode(event.data);postMessage({bytes},[bytes.buffer])}
  catch(error){postMessage({error:error.message||String(error)})}
};
