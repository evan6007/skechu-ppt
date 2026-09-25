/* Gallery controls for native, editable deep-learning diagram objects. */
(function(root){
  'use strict';
  const icons={'feature-map-stack':'▱','attention-block':'✧','unet-block':'⋈','tensor-grid':'▦','merge-operator':'⊕','diffusion-step':'↝'};
  function initialize(bridge){
    const catalog=root.SkechuDeepLearning,dialog=document.getElementById('deep-learning-dialog');
    if(!catalog||!dialog||!bridge)return;
    const open=document.getElementById('open-deep-learning'),close=document.getElementById('close-deep-learning');
    const search=document.getElementById('deep-learning-search');
    const templates=document.getElementById('deep-learning-templates'),components=document.getElementById('deep-learning-components');
    let populated=false;
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
        const icon=document.createElement('span');icon.className='dl-component-icon';icon.textContent=icons[meta.id]||'◇';icon.setAttribute('aria-hidden','true');
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
    open.addEventListener('click',()=>{populate();search.value='';filter();dialog.showModal();search.focus();});
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    search.addEventListener('input',filter);
    dialog.addEventListener('click',event=>{
      const template=event.target.closest('[data-template]'),component=event.target.closest('[data-component]');
      if(!template&&!component)return;
      try{
        if(template)bridge.insertTemplate(template.dataset.template);
        else bridge.insertComponent(component.dataset.component);
        dialog.close();
      }catch(error){console.error(error);bridge.notify(error.message||'無法加入架構圖');}
    });
  }
  root.initializeDeepLearningUI=initialize;
})(globalThis);
