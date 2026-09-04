const SKECHU_THEMES=new Set(['graphite','mist','linen']);
const SKECHU_THEME_COLORS={graphite:'#141518',mist:'#eceef1',linen:'#e9e4db'};
function applySkechuTheme(value,persist=true){
  const theme=SKECHU_THEMES.has(value)?value:'graphite';
  document.documentElement.dataset.theme=theme;
  document.querySelectorAll('[data-ui-theme]').forEach(button=>{const active=button.dataset.uiTheme===theme;button.classList.toggle('active',active);button.setAttribute('aria-checked',String(active))});
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=SKECHU_THEME_COLORS[theme];
  if(persist)try{localStorage.setItem('skechu-ui-theme',theme)}catch{}
  return theme;
}
function initializeThemeControls(){
  let saved='';try{saved=localStorage.getItem('skechu-ui-theme')||''}catch{}
  applySkechuTheme(saved||'graphite',false);
  const picker=document.getElementById('theme-switcher');if(picker)picker.addEventListener('click',event=>{const button=event.target.closest('[data-ui-theme]');if(button)applySkechuTheme(button.dataset.uiTheme)});
}
function initializeCompactUi(){
  const positionMenu=menu=>{
    const summary=menu.querySelector('summary'),popover=menu.querySelector('.action-menu-popover');if(!summary||!popover)return;
    const anchor=summary.getBoundingClientRect(),width=popover.offsetWidth,height=popover.offsetHeight,gap=7,pad=8;
    let left,top;
    if(menu.classList.contains('workspace-menu')){
      const right=anchor.right+gap,leftSide=anchor.left-width-gap;
      left=right+width<=innerWidth-pad?right:Math.max(pad,leftSide);
      top=Math.max(pad,Math.min(innerHeight-height-pad,anchor.top));
      popover.dataset.placement=right+width<=innerWidth-pad?'right':'left';
    }else{
      left=Math.max(pad,Math.min(innerWidth-width-pad,anchor.right-width));
      const below=anchor.bottom+gap;top=below+height<=innerHeight-pad?below:Math.max(pad,anchor.top-height-gap);
      popover.dataset.placement=below+height<=innerHeight-pad?'below':'above';
    }
    popover.style.left=`${Math.round(left)}px`;popover.style.top=`${Math.round(top)}px`;
  };
  document.querySelectorAll('.action-menu').forEach(menu=>menu.addEventListener('toggle',()=>{if(!menu.open)return;document.querySelectorAll('.action-menu[open]').forEach(other=>{if(other!==menu)other.removeAttribute('open')});positionMenu(menu)}));
  const shapeTrigger=document.getElementById('add-shape'),shapePopover=document.getElementById('shape-menu-popover');
  const closeShapeMenu=()=>{if(!shapeTrigger||!shapePopover)return;shapePopover.hidden=true;shapeTrigger.setAttribute('aria-expanded','false')};
  const positionShapeMenu=()=>{if(!shapeTrigger||!shapePopover)return;const anchor=shapeTrigger.getBoundingClientRect(),width=shapePopover.offsetWidth,height=shapePopover.offsetHeight,gap=7,pad=8;let left=Math.max(pad,Math.min(innerWidth-width-pad,anchor.left)),top=anchor.bottom+gap,placement='below';if(top+height>innerHeight-pad){top=Math.max(pad,anchor.top-height-gap);placement='above'}shapePopover.style.left=`${Math.round(left)}px`;shapePopover.style.top=`${Math.round(top)}px`;shapePopover.dataset.placement=placement};
  if(shapeTrigger&&shapePopover)shapeTrigger.addEventListener('click',event=>{event.stopPropagation();const opening=shapePopover.hidden;document.querySelectorAll('.action-menu[open]').forEach(menu=>menu.removeAttribute('open'));shapePopover.hidden=!opening;shapeTrigger.setAttribute('aria-expanded',String(opening));if(opening)requestAnimationFrame(positionShapeMenu)});
  document.addEventListener('click',event=>{
    const action=event.target.closest?.('.action-menu button');
    if(action)action.closest('details')?.removeAttribute('open');
    if(!event.target.closest?.('.action-menu'))document.querySelectorAll('.action-menu[open]').forEach(menu=>menu.removeAttribute('open'));
    if(!event.target.closest?.('#add-shape,#shape-menu-popover'))closeShapeMenu();
  });
  shapePopover?.addEventListener('click',event=>{if(event.target.closest('[data-shape-kind]'))closeShapeMenu()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelectorAll('.action-menu[open]').forEach(menu=>menu.removeAttribute('open'));closeShapeMenu()}});
  window.addEventListener('resize',()=>{document.querySelectorAll('.action-menu[open]').forEach(positionMenu);if(shapePopover&&!shapePopover.hidden)positionShapeMenu()});
}
