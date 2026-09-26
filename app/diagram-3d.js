/* Parametric, editable axonometric feature-map blocks for architecture figures. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SkechuDiagram3D=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const limits={width:[35,260],height:[30,270],depth:[8,90],count:[1,10],gap:[0,36],yaw:[-60,60],elevation:[0,55],gridRows:[0,12],gridCols:[0,12]};
  const defaults=Object.freeze({width:142,height:168,depth:8,count:3,gap:6,yaw:30,elevation:18,projection:'paper',gridRows:0,gridCols:0,gridStyle:'tonal',color:'#DFE8FA',title:'Feature maps',detail:'H × W × C'});
  function normalize(input={}){
    const out={...defaults};
    for(const [key,[min,max]] of Object.entries(limits)){
      const value=input[key]===undefined?out[key]:Number(input[key]);
      if(!Number.isFinite(value)||value<min||value>max||['count','gridRows','gridCols'].includes(key)&&!Number.isInteger(value))throw new RangeError(`${key} must be between ${min} and ${max}`);
      out[key]=value;
    }
    if((out.gridRows===0)!==(out.gridCols===0)||out.gridRows===1||out.gridCols===1||out.gridRows*out.gridCols>144)throw new RangeError('Grid needs 2–12 rows and columns, at most 144 cells');
    if(input.gridStyle!==undefined){if(!['tonal','categorical'].includes(input.gridStyle))throw new TypeError('gridStyle must be tonal or categorical');out.gridStyle=input.gridStyle}
    if(input.projection!==undefined){if(!['paper','axonometric'].includes(input.projection))throw new TypeError('projection must be paper or axonometric');out.projection=input.projection}
    for(const key of ['title','detail']){
      if(input[key]!==undefined){if(typeof input[key]!=='string'||input[key].length>80)throw new TypeError(`${key} must be short text`);out[key]=input[key]}
    }
    if(input.color!==undefined){if(typeof input.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(input.color))throw new TypeError('color must be #RRGGBB');out.color=input.color}
    return out;
  }
  function mix(hex,target,weight){
    const v=hex.slice(1).match(/../g).map(part=>parseInt(part,16)),t=target===255?255:0;
    return '#'+v.map(channel=>Math.round(channel*(1-weight)+t*weight).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function project(x,y,z,camera){
    if(camera.projection==='paper')return {x:x+y*camera.sy,y:z-y*camera.se};
    return {x:x*camera.cy+y*camera.sy,y:x*camera.sy*camera.se-y*camera.cy*camera.se+z*camera.ce};
  }
  function polygon(points,fill,stroke,name,group,serial,strokeWidth=1.35){
    return {id:`cube-${serial}`,type:'polygon',name,points,cornerRadius:0,fill,stroke,strokeWidth,opacity:1,label:'',r:0,layerGroup:{...group}};
  }
  function gridFill(options,row,col){
    const index=(row*7+col*11+row*col*3)%13;
    if(options.gridStyle==='categorical')return ['#DFE8FA','#DCE6CE','#F0DEDC','#E6DCF0','#EEE8D6'][index%5];
    return [options.color,mix(options.color,255,.18),mix(options.color,0,.04),mix(options.color,255,.32)][index%4];
  }
  function caption(value,x,y,w,h,size,color,group,serial,bold=false){
    return {id:`cube-${serial}`,type:'text',box:true,name:`文字 · ${value}`,x,y,w,h,text:value,size,fontFamily:'Arial',align:'center',valign:'middle',marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,lineHeight:1.08,bold,italic:false,color,r:0,opacity:1,layerGroup:{...group}};
  }
  function createBlock(input={}){
    const options=normalize(input),x=Number(input.x??0),y=Number(input.y??0);
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('x and y must be finite');
    const yaw=options.yaw*Math.PI/180,elev=options.elevation*Math.PI/180;
    const camera={cy:Math.cos(yaw),sy:Math.sin(yaw),se:Math.sin(elev),ce:Math.cos(elev),projection:options.projection};
    const raw=[],all=[];
    const P=(a,b,c)=>{const p=project(a,b,c,camera);all.push(p);return p};
    for(let layer=options.count-1;layer>=0;layer--){
      const front=layer*(options.depth+options.gap),back=front+options.depth;
      const A=P(0,front,0),B=P(options.width,front,0),C=P(options.width,front,options.height),D=P(0,front,options.height);
      const E=P(0,back,0),F=P(options.width,back,0),G=P(options.width,back,options.height),H=P(0,back,options.height);
      const tint=layer%2?mix(options.color,255,.12):options.color;
      raw.push({points:[A,B,F,E],fill:mix(tint,255,.18),name:`第 ${layer+1} 層 · 上面`});
      if(options.yaw>=0)raw.push({points:[B,F,G,C],fill:mix(tint,0,.07),name:`第 ${layer+1} 層 · 側面`});
      else raw.push({points:[E,A,D,H],fill:mix(tint,0,.07),name:`第 ${layer+1} 層 · 側面`});
      raw.push({points:[A,B,C,D],fill:tint,name:`第 ${layer+1} 層 · 正面`,leader:layer===0});
      if(layer===0&&options.gridRows){
        for(let row=0;row<options.gridRows;row++)for(let col=0;col<options.gridCols;col++){
          const x0=options.width*col/options.gridCols,x1=options.width*(col+1)/options.gridCols;
          const z0=options.height*row/options.gridRows,z1=options.height*(row+1)/options.gridRows;
          raw.push({points:[P(x0,front,z0),P(x1,front,z0),P(x1,front,z1),P(x0,front,z1)],fill:gridFill(options,row,col),name:`Tensor cell ${row+1}, ${col+1}`,grid:true});
        }
      }
    }
    const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x));
    const minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
    const geometryWidth=maxX-minX,geometryHeight=maxY-minY;
    const width=Math.max(geometryWidth,145),left=x+(width-geometryWidth)/2;
    const group={id:'diagram-3d-group',name:options.title||'立體神經網路方塊',collapsed:true,paintMode:'solid'};
    let serial=0;
    const items=raw.map(face=>{
      const points=face.points.map(p=>({x:+(left+p.x-minX).toFixed(3),y:+(y+34+p.y-minY).toFixed(3)}));
      const item=polygon(points,face.fill,face.grid?'#A5A0AD':'#817D8B',face.name,group,++serial,face.grid?0.65:1.0);
      if(face.leader)item.diagram3d={...options};
      return item;
    });
    if(options.title)items.push(caption(options.title,x,y,width,28,16,'#17243A',group,++serial,true));
    if(options.detail)items.push(caption(options.detail,x,y+38+geometryHeight,width,24,13,'#586B80',group,++serial));
    const geometry={x:left,y:y+34,width:geometryWidth,height:geometryHeight};
    const frontPoints=items.find(it=>it.diagram3d).points,centerY=frontPoints.reduce((sum,p)=>sum+p.y,0)/4;
    return {items,width,height:64+geometryHeight,options,geometry,ports:{left:{x:left,y:centerY},right:{x:left+geometryWidth,y:centerY}}};
  }
  function createNetwork(input={}){
    const view=normalize({yaw:input.yaw,elevation:input.elevation,projection:input.projection});
    const common={yaw:view.yaw,elevation:view.elevation,projection:view.projection};
    const stages=[
      {title:'Input',detail:'224 × 224 × 3',width:160,height:230,depth:17,count:1,gap:0,color:'#EBE8DE'},
      {title:'Conv 1',detail:'112 × 112 × 64',width:122,height:174,depth:16,count:3,gap:8,color:'#DFE8FA'},
      {title:'Pool',detail:'56 × 56 × 64',width:96,height:135,depth:14,count:2,gap:7,color:'#E6DCF0'},
      {title:'Conv 2',detail:'28 × 28 × 128',width:83,height:110,depth:17,count:4,gap:7,gridRows:4,gridCols:4,gridStyle:'tonal',color:'#DFE8FA'},
      {title:'GAP',detail:'1 × 1 × 128',width:49,height:64,depth:22,count:1,gap:0,color:'#DCE6CE'},
      {title:'Classifier',detail:'1 × 1 × K',width:44,height:54,depth:15,count:3,gap:5,color:'#F0DEDC'}
    ];
    const blockGap=(1096-stages.reduce((sum,spec)=>sum+createBlock({...spec,...common}).width,0))/(stages.length-1);
    if(blockGap<16)throw new RangeError('Network blocks need more horizontal space');
    const blocks=[],positions=[];let cursor=52,serial=0;
    for(let i=0;i<stages.length;i++){
      const spec=stages[i],probe=createBlock({...spec,...common}),atY=365-probe.ports.left.y;
      const block=createBlock({...spec,...common,x:cursor,y:atY});
      block.items.forEach(it=>{it.id=`network-item-${++serial}`;it.layerGroup.id=`network-stage-${i+1}`});
      blocks.push(...block.items);positions.push(block.ports);
      cursor+=block.width+(i===stages.length-1?0:blockGap);
    }
    if(cursor>1160)throw new RangeError('Network layout exceeds the canvas');
    const g={id:'network-guide',name:'標題與流程連線',collapsed:true};
    const lines=[];
    lines.push({id:`network-item-${++serial}`,type:'text',box:true,name:'文字 · 立體 CNN 架構',x:53,y:34,w:1070,h:47,text:'Perspective CNN architecture',size:31,fontFamily:'Arial',align:'left',valign:'middle',marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,lineHeight:1.05,bold:true,color:'#17243A',r:0,opacity:1,layerGroup:{...g}});
    lines.push({id:`network-item-${++serial}`,type:'text',box:true,name:'文字 · 視角',x:53,y:84,w:1050,h:24,text:`Editable 3D feature volumes   ·   yaw ${view.yaw}°   ·   elevation ${view.elevation}°`,size:14,fontFamily:'Arial',align:'left',valign:'middle',marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,lineHeight:1.05,bold:false,color:'#586B80',r:0,opacity:1,layerGroup:{...g}});
    for(let i=0;i<positions.length-1;i++){
      const a=positions[i],b=positions[i+1];
      lines.push({id:`network-item-${++serial}`,type:'arrow',name:`階段 ${i+1} → ${i+2}`,points:[{x:a.right.x+7,y:a.right.y},{x:b.left.x-7,y:b.left.y}],color:'#48444F',width:1.4,head:7,headShape:'triangle',startHead:false,endHead:true,style:'solid',closed:false,fill:'#ffffff',fillOpacity:0,curved:false,r:0,opacity:1,layerGroup:{...g}});
    }
    lines.push({id:`network-item-${++serial}`,type:'text',box:true,name:'文字 · 示意註記',x:53,y:585,w:1095,h:28,text:'Example layout · replace stage names, tensor sizes and operations with the actual model before publication.',size:13,fontFamily:'Arial',align:'center',valign:'middle',marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,lineHeight:1.05,bold:false,color:'#586B80',r:0,opacity:1,layerGroup:{...g}});
    return {name:'可調視角立體 CNN 架構',width:1200,height:675,items:[...lines,...blocks]};
  }
  return Object.freeze({defaults,limits,normalize,createBlock,createNetwork});
});
