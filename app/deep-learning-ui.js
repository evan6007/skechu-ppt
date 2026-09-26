/* Gallery controls for native, editable deep-learning diagram objects. */
(function(root){
  'use strict';
  function initialize(bridge){
    const catalog=root.SkechuDeepLearning,dialog=document.getElementById('deep-learning-dialog');
    if(!catalog||!dialog||!bridge)return;
    const open=document.getElementById('open-deep-learning'),close=document.getElementById('close-deep-learning');
    const search=document.getElementById('deep-learning-search');
    const templates=document.getElementById('deep-learning-templates'),components=document.getElementById('deep-learning-components');
    const controls=document.getElementById('dl-3d-controls'),preview=document.getElementById('dl-3d-preview');
    const error=document.getElementById('dl-3d-error'),viewLabel=document.getElementById('dl-3d-view-label');
    const insert3d=document.getElementById('dl-3d-insert'),update3d=document.getElementById('dl-3d-update'),network3d=document.getElementById('dl-3d-network');
    let populated=false;
    function blockOptions(){const values=Object.fromEntries(new FormData(controls));return root.SkechuDiagram3D.normalize(values)}
    function fillBlockControls(options){for(const [key,value] of Object.entries(options)){const input=controls.elements.namedItem(key);if(input)input.value=value}refreshBlockPreview()}
    function refreshBlockPreview(){
      try{
        const options=blockOptions();preview.innerHTML=bridge.previewBlock3D(options);
        for(const key of ['yaw','elevation'])controls.querySelector(`[data-for="${key}"]`).textContent=`${options[key]}°`;
        viewLabel.textContent=`${options.projection==='paper'?'論文正面投影':'立體斜投影'} · 水平 ${options.yaw}° · 俯視 ${options.elevation}° · ${options.count} 層${options.gridRows?` · ${options.gridRows} × ${options.gridCols} 格狀張量`:''}`;
        error.textContent='';insert3d.disabled=false;update3d.disabled=false;network3d.disabled=false;
      }catch(cause){error.textContent=cause.message;insert3d.disabled=true;update3d.disabled=true;network3d.disabled=true}
    }
    function card(meta,kind){
      const button=document.createElement('button');button.type='button';
      button.className=kind==='template'?'dl-template-card':'dl-component-card';
      button.dataset[kind]=meta.id;
      if(kind==='template'){
        const thumb=document.createElement('span');thumb.className='dl-thumb';thumb.innerHTML=bridge.previewTemplate(meta.id);
        const title=document.createElement('strong');title.textContent=meta.name;
        const detail=document.createElement('small');detail.textContent=meta.description;
        const action=document.createElement('span');action.className='dl-action';action.textContent='建立新圖頁';
        button.append(thumb,title,detail,action);
      }else{
        const icon=document.createElement('span');icon.className='dl-component-preview';icon.innerHTML=bridge.previewComponent(meta.id);icon.setAttribute('aria-hidden','true');
        const info=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');
        title.textContent=meta.name;detail.textContent=meta.description;info.append(title,detail);button.append(icon,info);
      }
      return button;
    }
    function populate(){
      if(populated)return;
      for(const meta of catalog.templateMeta)templates.append(card(meta,'template'));
      for(const meta of catalog.componentMeta)components.append(card(meta,'component'));
      populated=true;
    }
    function filter(){const term=search.value.trim().toLocaleLowerCase();dialog.querySelectorAll('[data-template],[data-component]').forEach(button=>{button.hidden=!!term&&!button.textContent.toLocaleLowerCase().includes(term)});}
    open.addEventListener('click',()=>{
      populate();search.value='';filter();const selected=bridge.selectedBlock3D();update3d.hidden=!selected;
      if(selected)fillBlockControls(selected.options);else refreshBlockPreview();
      dialog.showModal();controls.elements.namedItem('yaw').focus();
    });
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    search.addEventListener('input',filter);
    controls.addEventListener('input',refreshBlockPreview);
    controls.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const presets={paper:{projection:'paper',yaw:30,elevation:18,depth:8,gap:6},front:{projection:'paper',yaw:0,elevation:0,depth:8,gap:0},volume:{projection:'axonometric',yaw:30,elevation:20,depth:16,gap:8}};fillBlockControls({...blockOptions(),...presets[button.dataset.view]})}));
    controls.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{controls.elements.namedItem('color').value=button.dataset.color;refreshBlockPreview()}));
    controls.addEventListener('submit',event=>event.preventDefault());
    function runBlockAction(action){try{action(blockOptions());dialog.close()}catch(cause){error.textContent=cause.message;bridge.notify(cause.message||'無法建立立體方塊')}}
    insert3d.addEventListener('click',()=>runBlockAction(options=>bridge.insertBlock3D(options)));
    update3d.addEventListener('click',()=>runBlockAction(options=>bridge.updateBlock3D(options)));
    network3d.addEventListener('click',()=>runBlockAction(options=>bridge.insertNetwork3D({yaw:options.yaw,elevation:options.elevation,projection:options.projection})));
    dialog.addEventListener('click',event=>{
      const template=event.target.closest('[data-template]'),component=event.target.closest('[data-component]');
      if(!template&&!component)return;
      try{
        const options={labels:document.getElementById('dl-label-mode').value};
        if(template)bridge.insertTemplate(template.dataset.template,options);
        else bridge.insertComponent(component.dataset.component,options);
        dialog.close();
      }catch(error){console.error(error);bridge.notify(error.message||'無法加入架構圖');}
    });
  }
  root.initializeDeepLearningUI=initialize;
})(globalThis);
