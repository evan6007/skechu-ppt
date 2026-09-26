/* Editable deep-learning figure starters. Every mark is a native Skechu item. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SkechuDeepLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const C = Object.freeze({
    ink: '#302D35', muted: '#77717E', line: '#B9B1BE', teal: '#82936C',
    tealLite: '#E7EDDE', blue: '#9CAAC3', blueLite: '#DFE8FA',
    peach: '#C49A65', peachLite: '#F4EADB', violet: '#A497B4',
    violetLite: '#E8E0EF', pink: '#C2A4A4', pinkLite: '#F2E5E3',
    green: '#82936C', greenLite: '#E4EAD9', paper: '#FFFFFF',
    pale: '#FAF8EF', gray: '#EDEAE5'
  });

  const templateMeta = Object.freeze([
    {id:'latent-diffusion-paper',name:'Latent Diffusion 論文圖',description:'梯形 U-Net、去噪迴圈、條件輸入與潛在解碼。',width:1400,height:700},
    {id:'vision-transformer-paper',name:'Vision Transformer 論文圖',description:'影像切塊、token、層疊 Transformer 與輸出。',width:1400,height:600},
    {id:'attention-fusion',name:'注意力模組與多分支融合',description:'SE、通道、空間與座標注意力，加上共享主幹、融合與嵌入輸出。'},
    {id:'perspective-cnn',name:'平面 CNN 示意圖',description:'平面堆疊的卷積特徵圖、池化、全連接層與分類輸出。'},
    {id:'conditional-diffusion',name:'條件式擴散與 U-Net',description:'前向加噪、迭代去噪、條件訊號與含跳接的 U-Net。'},
    {id:'graph-tensor-diffusion',name:'圖與張量擴散流程',description:'空間節點、鄰接圖、遮罩矩陣、GNN 潛在表示與擴散去噪。'},
    {id:'material-aware-depth',name:'材質感知單目深度',description:'反光物體與深度示意、多尺度重組、門控殘差修正。',width:1560,height:900}
  ]);

  const componentMeta = Object.freeze([
    {id:'encoder-funnel',name:'Encoder 收斂梯形',description:'高到低解析度的收斂輪廓。'},
    {id:'decoder-funnel',name:'Decoder 展開梯形',description:'低到高解析度的展開輪廓。'},
    {id:'unet-hourglass',name:'U-Net 沙漏與跳接',description:'收斂、瓶頸、展開及跨層跳接。'},
    {id:'unet-pyramid',name:'U-Net 多尺度金字塔',description:'不同解析度的 U 形特徵堆疊。'},
    {id:'transformer-tower',name:'Transformer 層疊',description:'Token、重複層與 residual 路徑。'},
    {id:'diffusion-chain',name:'Diffusion 加噪序列',description:'乾淨訊號逐步轉為噪聲。'},
    {id:'denoising-loop',name:'Diffusion 去噪迴圈',description:'時間條件、U-Net 與反覆去噪。'},
    {id:'cross-attention-bridge',name:'Cross-attention 跨流融合',description:'Query 和條件 Key/Value 的雙路輸入。'},
    {id:'latent-bottleneck',name:'Latent 潛在空間',description:'Encoder、潛在張量、Decoder。'},
    {id:'reflective-scene',name:'反光物體與深度配對',description:'相同場景的 RGB 與深度示意。'},

    {id:'patch-embedding',name:'影像切塊與嵌入',description:'Patch → linear projection → token sequence。'},
    {id:'token-sequence',name:'Token 序列',description:'可編輯的向量序列與位置編碼標示。'},
    {id:'transformer-encoder',name:'Transformer 編碼器',description:'Pre-norm、MHSA、MLP 和兩條 residual skip。'},
    {id:'qkv-attention',name:'Q / K / V 注意力',description:'縮放點積、Softmax、Value 加權與多頭合併。'},
    {id:'multiscale-decoder',name:'DPT 多尺度解碼器',description:'Reassemble、四種解析度與逐級融合。'},
    {id:'conv-norm-activation',name:'卷積、正規化與激活',description:'Conv 3×3 → Norm → GELU。'},
    {id:'upsample-block',name:'上採樣',description:'小特徵矩陣放大為兩倍空間解析度。'},
    {id:'residual-adapter',name:'門控殘差子網路',description:'投影、Gate、Residual 與逐元素乘法。'},

    {id:'feature-map-stack',name:'平面特徵圖堆疊',description:'多層平面堆疊，可標示卷積特徵的尺寸。'},
    {id:'attention-block',name:'注意力模組',description:'輸入、池化、權重與逐元素調整的可編輯模組。'},
    {id:'unet-block',name:'U-Net 與跳接',description:'編碼、瓶頸、解碼和跨層連線。'},
    {id:'tensor-grid',name:'彩色張量矩陣',description:'用獨立色格表示特徵、潛在變數或遮罩。'},
    {id:'merge-operator',name:'融合運算節點',description:'雙輸入與單輸出的加法或拼接節點。'},
    {id:'diffusion-step',name:'單步去噪流程',description:'帶時間條件的 xₜ → 去噪器 → xₜ₋₁。'}
  ]);

  class Builder {
    constructor() { this.items=[]; this.serial=0; this.groupSerial=0; }
    group(name) { return {id:`dl-group-${++this.groupSerial}`,name,collapsed:true,paintMode:'solid'}; }
    add(item,group) {
      const value={id:`dl-item-${++this.serial}`,r:0,opacity:1,...item};
      if(group) value.layerGroup={...group};
      this.items.push(value);
      return value;
    }
  }

  function box(b,x,y,w,h,fill=C.paper,stroke=C.line,g,name='區塊',radius=8,sw=1) {
    return b.add({type:'box',name,x,y,w,h,radius,fill,stroke,strokeWidth:sw},g);
  }
  function ellipse(b,x,y,w,h,fill=C.paper,stroke=C.line,g,name='節點',sw=1.5) {
    return b.add({type:'ellipse',name,x,y,w,h,fill,stroke,strokeWidth:sw},g);
  }
  function polygon(b,points,fill,stroke,g,name='多邊形',sw=1.5) {
    return b.add({type:'polygon',name,points,cornerRadius:0,fill,stroke,strokeWidth:sw,label:''},g);
  }
  function text(b,label,x,y,w,h,size=17,color=C.ink,g,opts={}) {
    return b.add({type:'text',box:true,name:`文字 · ${label}`,x,y,w,h,text:label,
      size,fontFamily:'Arial',align:opts.align||'left',valign:opts.valign||'middle',
      marginLeft:0,marginRight:0,marginTop:0,marginBottom:0,lineHeight:1.08,
      bold:!!opts.bold,italic:!!opts.italic,color},g);
  }
  function arrow(b,points,g,opts={}) {
    return b.add({type:'arrow',name:opts.name||'連線',points,color:opts.color||C.ink,
      width:opts.width||1.3,head:opts.head||6,headShape:'triangle',startHead:false,
      endHead:opts.endHead!==false,style:opts.dash?'dash':'solid',closed:false,
      fill:C.paper,fillOpacity:0,curved:false},g);
  }
  function line(b,x1,y1,x2,y2,g,opts={}) {
    return arrow(b,[{x:x1,y:y1},{x:x2,y:y2}],g,{...opts,endHead:false});
  }
  function labelBox(b,label,x,y,w,h,fill,stroke,g,opts={}) {
    box(b,x,y,w,h,fill,stroke,g,`${label} · 背景`,opts.radius??7,opts.sw??1);
    text(b,label,x+7,y+2,w-14,h-4,opts.size??16,opts.color||C.ink,g,
      {align:'center',bold:opts.bold!==false});
  }
  function header(b,kicker,title,subtitle,number) {
    const g=b.group('圖題與頁碼');
    box(b,34,25,9,56,C.teal,C.teal,g,'左側色條',4,0);
    text(b,kicker.toUpperCase(),59,21,820,20,12,C.teal,g,{bold:true});
    text(b,title,58,40,1080,39,31,C.ink,g,{bold:true});
    text(b,subtitle,59,81,1050,27,14,C.muted,g);
    line(b,48,115,1152,115,g,{color:C.gray,width:2});
    text(b,`SKECHU  /  DEEP LEARNING FIGURES                                      ${number} / 05`,
      50,637,1100,21,11,C.muted,g,{align:'center'});
  }
  function sectionTitle(b,label,x,y,w,g,color=C.teal) {
    box(b,x,y+3,5,22,color,color,g,`${label} 色條`,2,0);
    text(b,label,x+14,y,w-14,28,18,C.ink,g,{bold:true});
  }

  // A stack is made of four editable quadrilateral planes, not an image.
  function drawFeatureMapStack(b,x,y,o={}) {
    const w=o.w||105,h=o.h||120,count=o.count||4,skew=0,
      step=o.step||6,color=o.color||C.violet,back=o.back||C.violetLite,
      g=o.group||b.group(o.title||'特徵圖堆疊');
    for(let i=count-1;i>=0;i--){
      const dx=i*step,dy=(count-1-i)*step*.5;
      polygon(b,[{x:x+dx,y:y+dy},{x:x+w+dx,y:y+dy},
        {x:x+w+dx,y:y+h+dy},{x:x+dx,y:y+h+dy}],
        i===0?back:C.paper,color,g,`特徵圖平面 ${count-i}`,1);
    }
    if(o.title) text(b,o.title,x-4,y-31,w+count*step+30,25,17,C.ink,g,{bold:true});
    if(o.detail) text(b,o.detail,x-8,y+h+skew+20,w+count*step+40,22,13,C.muted,g);
    return {width:w+(count-1)*step,height:h+skew+43};
  }
  function drawTensorGrid(b,x,y,o={}) {
    const rows=o.rows||4,cols=o.cols||6,cell=o.cell||17,g=o.group||b.group(o.title||'張量矩陣');
    const colors=o.colors||[C.violetLite,C.pinkLite,C.gray,C.tealLite,C.paper];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const key=(r*7+c*11+(r*c)%5)%colors.length;
      box(b,x+c*cell,y+r*cell,cell-1,cell-1,
        o.mask&&(r+c)%4===0?C.ink:colors[key],C.line,g,`張量 [${r+1},${c+1}]`,0,.7);
    }
    if(o.title) text(b,o.title,x-5,y-27,cols*cell+30,22,14,C.ink,g,{bold:true});
    return {width:cols*cell,height:rows*cell};
  }
  function drawAttentionBlock(b,x,y,o={}) {
    const w=o.w||246,h=o.h||184,g=o.group||b.group(o.title||'注意力模組'),
      tint=o.tint||C.tealLite,accent=o.accent||C.teal;
    box(b,x,y,w,h,C.paper,C.line,g,`${o.title||'注意力'} 外框`,14,1.4);
    box(b,x,y,w,33,tint,tint,g,'標題列',12,0);
    text(b,o.title||'Attention',x+14,y+5,w-28,24,16,accent,g,{bold:true});
    text(b,o.subtitle||'feature-dependent gating',x+14,y+39,w-28,20,12,C.muted,g);
    drawFeatureMapStack(b,x+16,y+79,{w:38,h:52,count:3,step:6,skew:7,
      color:accent,back:tint,group:g});
    arrow(b,[{x:x+81,y:y+115},{x:x+99,y:y+115}],g,{color:accent,width:1.7});
    labelBox(b,o.pool||'Pool',x+99,y+93,64,43,tint,accent,g,{size:11,radius:8,sw:1.2});
    arrow(b,[{x:x+166,y:y+115},{x:x+174,y:y+115}],g,{color:accent,width:1.7});
    ellipse(b,x+178,y+99,32,32,C.paper,accent,g,'Sigmoid 門控',1.5);
    text(b,'σ',x+184,y+101,20,27,19,accent,g,{align:'center',bold:true});
    arrow(b,[{x:x+214,y:y+115},{x:x+w-12,y:y+115}],g,{color:accent,width:1.7});
    text(b,o.footer||'weighted feature map',x+13,y+h-29,w-26,21,12,C.muted,g,
      {align:'center'});
    return {width:w,height:h};
  }
  function drawMerge(b,x,y,o={}) {
    const g=o.group||b.group('融合節點'),sign=o.sign||'⊕';
    line(b,x,y+25,x+37,y+25,g,{color:C.blue,width:2});
    line(b,x+13,y+68,x+37,y+43,g,{color:C.pink,width:2});
    ellipse(b,x+38,y+19,45,45,C.paper,C.ink,g,'融合運算',2);
    text(b,sign,x+43,y+23,35,34,22,C.ink,g,{align:'center',bold:true});
    arrow(b,[{x:x+84,y:y+41},{x:x+122,y:y+41}],g,{color:C.ink,width:2});
    text(b,o.label||'Fusion',x+28,y+70,86,22,13,C.muted,g,{align:'center'});
    return {width:124,height:94};
  }
  function drawUnet(b,x,y,o={}) {
    const w=o.w||326,h=o.h||176,g=o.group||b.group('U-Net 區塊');
    box(b,x,y,w,h,C.paper,C.blue,g,'U-Net 外框',15,1.7);
    text(b,o.title||'Denoising U-Net',x+17,y+10,w-34,29,18,C.ink,g,{bold:true});
    const nodeY=y+76,nodeW=66,nodeH=44;
    labelBox(b,'Encoder',x+19,nodeY,nodeW,nodeH,C.blueLite,C.blue,g,{size:12});
    labelBox(b,'Bottleneck',x+w/2-42,nodeY+16,84,nodeH,C.violetLite,C.violet,g,{size:11});
    labelBox(b,'Decoder',x+w-85,nodeY,nodeW,nodeH,C.tealLite,C.teal,g,{size:12});
    arrow(b,[{x:x+85,y:nodeY+22},{x:x+w/2-44,y:nodeY+38}],g,{color:C.blue,width:1.8});
    arrow(b,[{x:x+w/2+43,y:nodeY+38},{x:x+w-86,y:nodeY+22}],g,{color:C.teal,width:1.8});
    arrow(b,[{x:x+52,y:nodeY-4},{x:x+52,y:nodeY-16},
      {x:x+w-52,y:nodeY-16},{x:x+w-52,y:nodeY-4}],g,
      {color:C.peach,width:1.8,name:'跨層跳接'});
    text(b,'skip connection',x+w/2-60,nodeY-37,120,17,11,C.peach,g,
      {align:'center',bold:true});
    text(b,o.footer||'multi-scale features',x+18,y+h-25,w-36,18,12,C.muted,g,
      {align:'center'});
    return {width:w,height:h};
  }
  function drawDiffusionStep(b,x,y,o={}) {
    const g=o.group||b.group('單步去噪流程');
    drawTensorGrid(b,x,y+37,{rows:3,cols:3,cell:18,title:'xₜ',group:g});
    arrow(b,[{x:x+63,y:y+65},{x:x+83,y:y+65}],g,{color:C.ink,width:1.8});
    labelBox(b,'Denoiser',x+89,y+43,86,48,C.blueLite,C.blue,g,{size:13});
    arrow(b,[{x:x+179,y:y+65},{x:x+198,y:y+65}],g,{color:C.ink,width:1.8});
    drawTensorGrid(b,x+204,y+37,{rows:3,cols:3,cell:18,title:'xₜ₋₁',group:g});
    labelBox(b,'t',x+112,y+108,34,27,C.peachLite,C.peach,g,{size:13,radius:6});
    arrow(b,[{x:x+129,y:y+107},{x:x+129,y:y+95}],g,{color:C.peach,width:1.3});
    return {width:260,height:140};
  }
  function drawGraph(b,x,y,o={}) {
    const g=o.group||b.group('節點與鄰接圖'),nodes=[
      [17,38],[47,13],[79,37],[34,72],[77,79],[113,60],[120,16]
    ];
    for(const [a,d] of [[0,1],[0,3],[1,2],[2,4],[2,6],[3,4],[4,5],[5,6]])
      line(b,x+nodes[a][0],y+nodes[a][1],x+nodes[d][0],y+nodes[d][1],g,
        {color:C.muted,width:1.5});
    nodes.forEach(([nx,ny],i)=>ellipse(b,x+nx-8,y+ny-8,16,16,
      i%3===0?C.pinkLite:C.violetLite,C.violet,g,`節點 ${i+1}`,1.2));
    if(o.title)text(b,o.title,x,y-26,150,21,14,C.ink,g,{bold:true});
    return {width:132,height:100};
  }

  function tokens(b,x,y,g,count=6){
    for(let i=0;i<count;i++)box(b,x+i*22,y,16,34,[C.blueLite,C.tealLite,C.violetLite][i%3],C.line,g,'Token '+(i+1),2,1);
  }
  function patchEmbedding(b,x,y,g){
    text(b,'Patch embedding',x,y,280,28,19,C.ink,g,{bold:true});
    drawTensorGrid(b,x,y+48,{rows:4,cols:4,cell:19,group:g,colors:['#DCE6CE','#DFE8FA','#F4EBF7','#E8E0EF']});
    arrow(b,[{x:x+81,y:y+90},{x:x+104,y:y+90}],g);
    labelBox(b,'Linear',x+107,y+67,63,46,C.blueLite,C.blue,g,{size:13,radius:4});
    arrow(b,[{x:x+174,y:y+90},{x:x+195,y:y+90}],g);
    tokens(b,x+199,y+73,g,4);
    text(b,'P × P patches',x,y+129,115,20,12,C.muted,g);
    text(b,'+ position',x+181,y+129,105,20,12,C.muted,g);
  }
  function transformer(b,x,y,g){
    box(b,x,y,360,190,'#F4EBF7',C.line,g,'Transformer boundary',8,1);
    text(b,'Transformer encoder × L',x+12,y+8,335,25,18,C.ink,g,{bold:true});
    const cy=y+95;
    arrow(b,[{x,y:cy},{x:x+20,y:cy}],g);
    [['LN',20,33],['MHSA',62,58],['+',133,26],['LN',169,33],['MLP',211,54],['+',294,26]].forEach(([label,dx,w])=>{
      if(label==='+'){ellipse(b,x+dx,cy-13,w,26,C.paper,C.muted,g,'Residual add');text(b,'+',x+dx,cy-13,w,26,17,C.ink,g,{align:'center'});}
      else labelBox(b,label,x+dx,cy-22,w,44,label==='LN'?C.paper:C.blueLite,C.line,g,{size:12,radius:3});
    });
    [[53,62],[120,133],[159,169],[202,211],[265,294],[320,360]].forEach(([a,z])=>arrow(b,[{x:x+a,y:cy},{x:x+z,y:cy}],g,{width:1.4,head:5}));
    arrow(b,[{x:x+10,y:cy},{x:x+10,y:y+50},{x:x+146,y:y+50},{x:x+146,y:cy-13}],g,{width:1.3});
    arrow(b,[{x:x+164,y:cy},{x:x+164,y:y+145},{x:x+307,y:y+145},{x:x+307,y:cy+13}],g,{width:1.3});
    text(b,'pre-norm · residual connections',x+20,y+158,322,22,12,C.muted,g,{align:'center'});
  }
  function qkvAttention(b,x,y,g){
    text(b,'Multi-head self-attention',x,y,330,26,18,C.ink,g,{bold:true});
    ['Q','K','V'].forEach((label,i)=>{labelBox(b,label,x+12,y+42+i*42,40,28,[C.blueLite,C.violetLite,C.tealLite][i],C.line,g,{size:14,radius:3});});
    arrow(b,[{x:x+53,y:y+56},{x:x+104,y:y+56},{x:x+104,y:y+73}],g);
    arrow(b,[{x:x+53,y:y+98},{x:x+79,y:y+98},{x:x+79,y:y+85},{x:x+104,y:y+85}],g);
    labelBox(b,'QKᵀ / √d',x+104,y+ 60,87,40,C.blueLite,C.line,g,{size:12,radius:4});
    arrow(b,[{x:x+192,y:y+80},{x:x+205,y:y+80}],g,{head:5});
    labelBox(b,'Softmax',x+205,y+60, 80,40,C.tealLite,C.line,g,{size:12,radius:4});
    arrow(b,[{x:x+245,y:y+101},{x:x+245,y:y+126}],g);
    arrow(b,[{x:x+53,y:y+140},{x:x+230,y:y+140}],g);
    ellipse(b,x+231,y+126,28,28,C.paper,C.muted,g,'Attention value product');text(b,'×',x+231,y+126,28,28,16,C.ink,g,{align:'center'});
    arrow(b,[{x:x+260,y:y+140},{x:x+277,y:y+140}],g,{width:1.3,head:5});
    labelBox(b,'Concat\nProj',x+278,y+119,50,43,C.violetLite,C.line,g,{size:10,radius:3});
    text(b,'per head',x+94,y+162,140,22,12,C.muted,g);
  }
  function dptFusion(b,x,y,g){
    box(b,x,y,360,280,'#E9EDDF',C.line,g,'DPT decoder boundary',8,1);
    text(b,'DPT decoder',x+12,y+8,320,25,18,C.ink,g,{bold:true});
    text(b,'Reassemble → multi-scale fusion',x+12,y+35,336,20,12,C.muted,g);
    line(b,x,y+125,x+8,y+125,g);line(b,x+8,y+125,x+8,y+63,g);line(b,x+8,y+63,x+305,y+63,g);
    for(let i=0;i<4;i++){
      const dx=20+i*81;
      arrow(b,[{x:x+dx+28,y:y+63},{x:x+dx+28,y:y+78}],g,{width:1.3,head:5});
      labelBox(b,'R'+(i+1),x+dx,y+78,55,29,C.violetLite,C.line,g,{size:12,radius:3});
      arrow(b,[{x:x+dx+28,y:y+108},{x:x+dx+28,y:y+120}],g,{width:1.3,head:5});
      const faceSize=18+i*6,stackWidth=faceSize+3;
      drawFeatureMapStack(b,x+dx+28-stackWidth/2,y+122,{w:faceSize,h:faceSize,count:2,step:3,group:g,color:C.violet,back:C.violetLite});
      arrow(b,[{x:x+dx+28,y:y+122+faceSize+1.5},{x:x+dx+28,y:y+201}],g,{width:1.1,head:5});
      labelBox(b,i===0?'Refine':'Fuse ↑2',x+dx,y+202, 60, 30,C.violetLite,C.line,g,{size:10,radius:3});
      if(i<3)arrow(b,[{x:x+dx+60,y:y+217},{x:x+dx+81,y:y+217}],g,{width:1.3,head:5});
    }
    arrow(b,[{x:x+323,y:y+217},{x:x+348,y:y+217},{x:x+348,y:y+125},{x:x+360,y:y+125}],g,{width:1.4,head:5});
    text(b,'coarse',x+20,y+242,75,20,11,C.muted,g);text(b,'fine',x+273,y+242, 60,20,11,C.muted,g);
  }

  function convBlock(b,x,y,g){
    text(b,'Convolution block',x,y,250,26,18,C.ink,g,{bold:true});
    ['Conv 3×3','Norm','GELU'].forEach((v,i)=>{labelBox(b,v,x+i*85,y+48,75,42,[C.blueLite,C.paper,C.tealLite][i],C.line,g,{size:12,radius:4});if(i<2)arrow(b,[{x:x+i*85+75,y:y+69},{x:x+(i+1)*85,y:y+69}],g,{head:4,width:1.2});});
  }
  function upsample(b,x,y,g){
    text(b,'Upsample ×2',x,y,220,26,18,C.ink,g,{bold:true});
    drawTensorGrid(b,x+5,y+50,{rows:2,cols:2,cell:15,group:g});arrow(b,[{x:x+43,y:y+66},{x:x+96,y:y+66}],g);
    drawTensorGrid(b,x+105,y+37,{rows:4,cols:4,cell:15,group:g});text(b,'H × W → 2H × 2W',x,y+111,210,20,12,C.muted,g);
  }
  function residualAdapter(b,x,y,g){
    box(b,x,y,420,220,'#E9EDDF',C.line,g,'Candidate adapter boundary',8,1);
    text(b,'Proposed residual adapter',x+14,y+9,390,25,18,C.ink,g,{bold:true});
    arrow(b,[{x,y:y+112},{x:x+18,y:y+112}],g);
    labelBox(b,'1×1 Conv\nResize',x+18,y+81,85,62,C.peachLite,C.line,g,{size:12,radius:4});
    text(b,'H × W',x+20,y+180,80,22,12,C.muted,g,{align:'center'});
    arrow(b,[{x:x+104,y:y+112},{x:x+119,y:y+112},{x:x+119,y:y+ 70},{x:x+135,y:y+70}],g,{head:5});
    arrow(b,[{x:x+119,y:y+112},{x:x+119,y:y+158},{x:x+135,y:y+158}],g,{head:5});
    labelBox(b,'Conv → σ',x+135,y+50,100,40,C.tealLite,C.line,g,{size:13,radius:4});
    labelBox(b,'Conv',x+135,y+138,100,40,C.peachLite,C.line,g,{size:13,radius:4});
    arrow(b,[{x:x+236,y:y+70},{x:x+294,y:y+70},{x:x+294,y:y+96}],g,{head:5});
    arrow(b,[{x:x+236,y:y+158},{x:x+294,y:y+158},{x:x+294,y:y+128}],g,{head:5});
    text(b,'G',x+250,y+44,35,22,13,C.teal,g);text(b,'R',x+250,y+164,35,22,13,C.peach,g);
    ellipse(b,x+278,y+96,32,32,C.paper,C.muted,g,'Gated residual');text(b,'×',x+278,y+96,32,32,18,C.ink,g,{align:'center'});
    arrow(b,[{x:x+311,y:y+112},{x:x+420,y:y+112}],g);
    text(b,'ΔD = G ⊙ R',x+310,y+137,105,24,13,C.ink,g);
  }

  function insertPart(b,id,x,y){const group=b.group(id);components[id].draw(b,x,y,group);return group;}
  // Identical geometry in RGB and depth: editable reflective cylinder on a plane.
  function drawReflectiveScene(b,x,y,w,h,g,depth=false){
    const rect=(a,c,d,e,fill,name)=>box(b,x+a*w,y+c*h,d*w,e*h,fill,fill,g,name,0,0);
    rect(0,0,1,1,depth?'#34375D':'#E6E9ED','Scene background');
    for(let i=0;i<8;i++)rect(0,.60+i*.05,1,.051,depth?['#535584','#646596','#7576A6','#8987B2','#9D97BE','#B3ABC9','#C9BED5','#E1D3E1'][i]:'#D3D6DB','Ground plane');
    if(!depth)ellipse(b,x+.20*w,y+.79*h,.67*w,.13*h,'#B1B6BF','#B1B6BF',g,'Contact shadow',0);
    const colors=depth?['#C5BDDC','#D5CAE1','#E3D4E4','#EBDDE8','#E3D4E4','#D5CAE1','#C5BDDC']:['#626E80','#A5B0BE','#F5F7FA','#FFFFFF','#B2BDCC','#6E7D91','#D5DDE6'];
    ellipse(b,x+.30*w,y+.70*h,.42*w,.16*h,colors[2],colors[2],g,'Cylinder base',0);
    colors.forEach((c,i)=>rect(.30+i*.06,.28,.061,.50,c,'Cylinder surface'));
    ellipse(b,x+.30*w,y+.20*h,.42*w,.16*h,depth?'#DDD0E3':'#ECF0F5',depth?'#DDD0E3':'#7D8999',g,'Cylinder top',depth?0:.7);
    if(!depth)ellipse(b,x+.35*w,y+.235*h,.32*w,.085*h,'#7C899B','#D9E0E8',g,'Reflective rim',.7);
  }
  // Model-specific silhouettes. Geometry stays native and opaque in every export.
  function funnel(b,x,y,w,h,g,expand=false,label=''){
    const inset=h*.28,fill=expand?C.tealLite:C.blueLite,edge=expand?'#879B76':'#8C9CB8';
    const points=expand?[{x,y:y+inset},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h-inset}]:[{x,y},{x:x+w,y:y+inset},{x:x+w,y:y+h-inset},{x,y:y+h}];
    polygon(b,points,fill,edge,g,expand?'Decoder expanding trapezoid':'Encoder contracting trapezoid',1.7);
    if(label)text(b,label,x+8,y+h/2-22,w-16,44,26,C.ink,g,{align:'center',bold:true});
  }
  function hourglass(b,x,y,g){
    funnel(b,x+10,y+48,140,160,g,false,'E');
    funnel(b,x+200,y+48,140,160,g,true,'D');
    arrow(b,[{x:x+150,y:y+128},{x:x+200,y:y+128}],g,{width:2});
    [0,1,2].forEach(i=>arrow(b,[{x:x+35+i*32,y:y+54+i*13},{x:x+35+i*32,y:y+12+i*12},{x:x+315-i*32,y:y+12+i*12},{x:x+315-i*32,y:y+54+i*13}],g,{color:C.muted,dash:true,width:1.2}));
    text(b,'U-Net',x+70,y+218,210,32,26,C.ink,g,{align:'center',bold:true});
  }
  function pyramid(b,x,y,g){
    const xs=[10,95,180,265,350],ys=[28,91,139,91,28],sizes=[62,48,36,48,62];
    for(let i=0;i<5;i++){
      const cx=x+xs[i]+sizes[i]/2,cy=y+ys[i]+sizes[i]/2;
      drawFeatureMapStack(b,x+xs[i],y+ys[i],{w:sizes[i],h:sizes[i],count:3,step:4,group:g,back:i<3?C.blueLite:C.tealLite});
      if(i<4)arrow(b,[{x:x+xs[i]+sizes[i]+8,y:cy},{x:x+xs[i]+sizes[i]+22,y:cy},{x:x+xs[i]+sizes[i]+22,y:y+ys[i+1]+sizes[i+1]/2},{x:x+xs[i+1],y:y+ys[i+1]+sizes[i+1]/2}],g,{width:1.8});
      if(i<2)arrow(b,[{x:cx,y:y+ys[i]},{x:cx,y:y+8+i*42},{x:x+xs[4-i]+sizes[4-i]/2,y:y+8+i*42},{x:x+xs[4-i]+sizes[4-i]/2,y:y+ys[4-i]}],g,{dash:true,color:C.muted});
    }
    text(b,'U-Net',x+130,y+201,170,32,26,C.ink,g,{align:'center',bold:true});
  }
  function transformerTower(b,x,y,g){
    for(let i=2;i>=0;i--)box(b,x+28+i*8,y+39-i*8,152,183,i?C.paper:'#F1EBF6',C.violet,g,'Repeated Transformer layer',8,1.4);
    labelBox(b,'MLP',x+48,y+68,112,40,C.violetLite,C.violet,g,{size:24});
    labelBox(b,'MHSA',x+48,y+137,112,40,C.blueLite,C.blue,g,{size:24});
    arrow(b,[{x:x+104,y:y+68},{x:x+104,y:y+60}],g,{width:1.7,head:4});
    arrow(b,[{x:x+104,y:y+137},{x:x+104,y:y+108}],g,{width:1.7});
    arrow(b,[{x:x+104,y:y+214},{x:x+104,y:y+177}],g,{width:1.7});
    arrow(b,[{x:x+104,y:y+195},{x:x+172,y:y+195},{x:x+172,y:y+121},{x:x+104,y:y+121}],g,{width:1.2});
    arrow(b,[{x:x+104,y:y+122},{x:x+36,y:y+122},{x:x+36,y:y+54},{x:x+104,y:y+54}],g,{width:1.2});
    ellipse(b,x+98,y+115,12,12,C.paper,C.muted,g,'Attention residual sum',1);
    ellipse(b,x+98,y+48,12,12,C.paper,C.muted,g,'MLP residual sum',1);
    tokens(b,x+31,y+246,g,7);arrow(b,[{x:x+104,y:y+246},{x:x+104,y:y+222}],g);
    text(b,'× L',x+182,y+95,55,40,24,C.ink,g);
    text(b,'Transformer',x+12,y+292,220,34,26,C.ink,g,{align:'center',bold:true});
  }
  function noiseTile(b,x,y,size,level,g){
    const n=8,cell=size/n,tones=['#D9D4E6','#8E839F','#F7F3F8','#A9A1B9','#655E79'];
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const shape=(c>=2&&c<=5&&r>=1&&r<=6),noisy=((r*13+c*7)%17)/17<level;
      box(b,x+c*cell,y+r*cell,cell+.1,cell+.1,noisy?tones[(r*5+c*3+r*c)%tones.length]:(shape?'#D7DFCA':'#454760'),'none',g,'Diffusion sample cell',0,0);
    }
  }
  function diffusionChain(b,x,y,g){
    [0,.35,.7,1].forEach((level,i)=>{noiseTile(b,x+i*128,y+30,86,level,g);text(b,['x₀','xₜ','…','xT'][i],x+i*128,y+130,86,32,25,C.ink,g,{align:'center'});if(i<3)arrow(b,[{x:x+i*128+90,y:y+73},{x:x+(i+1)*128-6,y:y+73}],g,{width:2});});
  }
  function denoiseLoop(b,x,y,g){
    noiseTile(b,x,y+78,72,1,g);hourglass(b,x+110,y+5,g);noiseTile(b,x+510,y+78,72,.25,g);
    arrow(b,[{x:x+77,y:y+114},{x:x+120,y:y+114}],g,{width:2});
    arrow(b,[{x:x+450,y:y+114},{x:x+505,y:y+114}],g,{width:2});
    arrow(b,[{x:x+545,y:y+155},{x:x+545,y:y+292},{x:x+35,y:y+292},{x:x+35,y:y+155}],g,{width:1.6,color:C.violet});
    text(b,'× T',x+260,y+298,85,34,26,C.ink,g,{align:'center'});
    text(b,'t',x+100,y+245,40,28,24,C.ink,g,{align:'center'});
    arrow(b,[{x:x+120,y:y+245},{x:x+120,y:y+180}],g,{color:C.peach});
  }
  function crossBridge(b,x,y,g){
    tokens(b,x+15,y+10,g,5);tokens(b,x+15,y+168,g,5);
    arrow(b,[{x:x+123,y:y+27},{x:x+165,y:y+27},{x:x+165,y:y+78}],g);
    arrow(b,[{x:x+123,y:y+185},{x:x+165,y:y+185},{x:x+165,y:y+125}],g);
    labelBox(b,'Q',x+140,y+52,50,36,C.blueLite,C.blue,g,{size:24});
    labelBox(b,'K,V',x+130,y+132,70,36,C.tealLite,C.teal,g,{size:24});
    ellipse(b,x+223,y+83,46,46,C.paper,C.violet,g,'Cross attention',1.6);text(b,'⊗',x+223,y+83,46,46,28,C.ink,g,{align:'center'});
    arrow(b,[{x:x+190,y:y+70},{x:x+210,y:y+70},{x:x+210,y:y+95},{x:x+223,y:y+95}],g);
    arrow(b,[{x:x+200,y:y+150},{x:x+210,y:y+150},{x:x+210,y:y+116},{x:x+223,y:y+116}],g);
    arrow(b,[{x:x+269,y:y+106},{x:x+305,y:y+106}],g);tokens(b,x+310,y+89,g,4);
  }
  function latentBridge(b,x,y,g){
    funnel(b,x,y+15,110,150,g,false,'E');drawTensorGrid(b,x+150,y+60,{rows:4,cols:4,cell:15,group:g});funnel(b,x+250,y+15,110,150,g,true,'D');
    arrow(b,[{x:x+110,y:y+90},{x:x+145,y:y+90}],g);arrow(b,[{x:x+211,y:y+90},{x:x+250,y:y+90}],g);
    text(b,'z',x+150,y+133,60,32,26,C.ink,g,{align:'center'});
  }
  function diffusionPaper(b){
    let g=b.group('Latent diffusion inference');
    text(b,'Latent diffusion',60,32,650,42,32,C.ink,g,{bold:true});
    noiseTile(b,65,160,136,1,g);text(b,'zT',65,312,136,34,28,C.ink,g,{align:'center'});
    arrow(b,[{x:211,y:228},{x:290,y:228}],g,{width:2});
    hourglass(b,280,100,g);
    arrow(b,[{x:625,y:228},{x:650,y:228}],g,{width:2});
    labelBox(b,'Step',650,207,80,42,C.violetLite,C.violet,g,{size:24});
    arrow(b,[{x:730,y:228},{x:740,y:228}],g,{width:2,head:4});
    noiseTile(b,750,160,136,0,g);text(b,'z₀',750,312,136,34,28,C.ink,g,{align:'center'});
    arrow(b,[{x:900,y:228},{x:955,y:228}],g,{width:2});funnel(b,955,123,160,210,g,true,'D');
    arrow(b,[{x:1116,y:228},{x:1180,y:228}],g,{width:2});drawReflectiveScene(b,1190,160,136,136,g,false);
    text(b,'Image',1170,312,176,34,28,C.ink,g,{align:'center'});
    arrow(b,[{x:735,y:228},{x:735,y:400},{x:244,y:400},{x:244,y:228}],g,{color:C.violet,width:2});
    text(b,'Denoising × T',336,412,290,36,28,C.ink,g,{align:'center'});
    g=b.group('Diffusion conditioning');
    labelBox(b,'Condition',350,530,250,66,C.tealLite,C.teal,g,{size:28});
    arrow(b,[{x:475,y:530},{x:475,y:460},{x:578,y:460},{x:578,y:286}],g,{color:C.teal,width:2});
    text(b,'t',290,516,42,34,28,C.ink,g,{align:'center'});arrow(b,[{x:312,y:516},{x:312,y:310}],g,{color:C.peach,width:2});
    g=b.group('Forward diffusion');
    text(b,'Forward noising',790,440,450,36,28,C.ink,g,{bold:true});diffusionChain(b,790,475,g);
  }
  function transformerPaper(b){
    let g=b.group('Vision Transformer pipeline');
    text(b,'Vision Transformer',60,32,740,42,32,C.ink,g,{bold:true});
    drawReflectiveScene(b,55,200,144,144,g,false);
    arrow(b,[{x:207,y:272},{x:255,y:272}],g,{width:2});drawTensorGrid(b,265,200,{rows:4,cols:4,cell:36,group:g,colors:[C.blueLite,C.violetLite,C.tealLite]});
    text(b,'Patches',265,365,144,36,28,C.ink,g,{align:'center'});
    arrow(b,[{x:420,y:272},{x:465,y:272}],g,{width:2});labelBox(b,'Embed',465,240,130,64,C.blueLite,C.blue,g,{size:28});
    tokens(b,480,355,g,5);arrow(b,[{x:530,y:305},{x:530,y:348}],g,{width:2});
    arrow(b,[{x:590,y:372},{x:640,y:372},{x:640,y:454},{x:794,y:454},{x:794,y:416}],g,{width:2});
    g=b.group('Transformer repeated encoder');
    transformerTower(b,690,170,g);
    arrow(b,[{x:794,y:209},{x:794,y:120},{x:1050,y:120},{x:1050,y:210}],g,{width:2});
    g=b.group('Prediction head');
    labelBox(b,'Head',980,210,140,64,C.tealLite,C.teal,g,{size:28});
    arrow(b,[{x:1120,y:242},{x:1200,y:242}],g,{width:2});
    [76,116,46,92].forEach((w,i)=>box(b,1200,190+i*32,w,19,[C.blueLite,C.tealLite,C.violetLite,C.pinkLite][i],C.line,g,'Class score',2,1));
    text(b,'Prediction',1170,350,180,36,28,C.ink,g,{align:'center'});
  }
  function sculptedDepth(b){
    const g=b.group('Reflective depth overview');
    text(b,'(a)',40,30,70,36,28,C.ink,g,{bold:true});
    drawReflectiveScene(b,65,125,160,160,g,false);text(b,'RGB',65,310,160,36,28,C.ink,g,{align:'center'});
    arrow(b,[{x:236,y:205},{x:305,y:205}],g,{width:2});
    // ViT keeps a constant token width; the decoder expands spatial resolution.
    for(let i=2;i>=0;i--)box(b,315+i*10,112-i*9,168,186,i?C.paper:C.blueLite,C.blue,g,'ViT layer stack',6,1.5);
    text(b,'ViT',340,171,118,48,32,C.ink,g,{bold:true,align:'center'});tokens(b,325,256,g,7);
    for(let i=0;i<4;i++)arrow(b,[{x:503,y:141+i*42},{x:555,y:141+i*42},{x:605,y:175+i*20},{x:630,y:175+i*20}],g,{width:1.5});
    funnel(b,630,107,204,196,g,true,'DPT');
    arrow(b,[{x:836,y:205},{x:895,y:205}],g,{width:2});
    drawFeatureMapStack(b,900,165,{w:78,h:78,count:3,step:6,group:g,back:C.violetLite});text(b,'F',900,310,90,36,28,C.ink,g,{align:'center'});
    arrow(b,[{x:991,y:205},{x:1040,y:205}],g,{width:2});funnel(b,1040,155,108,100,g,true,'D₀');
    arrow(b,[{x:1150,y:205},{x:1222,y:205}],g,{width:2});
    ellipse(b,1222,183,44,44,C.paper,C.ink,g,'Depth sum',1.7);text(b,'+',1222,183,44,44,30,C.ink,g,{align:'center'});
    arrow(b,[{x:1267,y:205},{x:1325,y:205}],g,{width:2});drawReflectiveScene(b,1335,125,160,160,g,true);
    text(b,'Depth¹',1325,310,180,36,28,C.ink,g,{align:'center'});
    const detail=b.group('Multi-scale fusion');
    line(b,40,390,1500,390,detail,{color:C.line,width:1});text(b,'(b)  Multi-scale fusion',40,415,670,38,28,C.ink,detail,{bold:true});
    const xs=[80,250,420,590],sides=[35,52,70,88];
    xs.forEach((x,i)=>{
      tokens(b,x-10,492,detail,4);arrow(b,[{x:x+32,y:528},{x:x+32,y:569}],detail,{width:1.6});
      drawFeatureMapStack(b,x+32-sides[i]/2,575,{w:sides[i],h:sides[i],count:3,step:5,group:detail,back:C.violetLite});
      arrow(b,[{x:x+32,y:580+sides[i]},{x:x+32,y:704}],detail,{width:1.6});
      ellipse(b,x+12,704,40,40,C.paper,C.violet,detail,'Scale fusion',1.5);text(b,'+',x+12,704,40,40,28,C.ink,detail,{align:'center'});
      if(i<3)arrow(b,[{x:x+53,y:724},{x:x+182,y:724}],detail,{width:1.6});
    });
    text(b,'Reassemble',245,542,260,32,24,C.muted,detail,{align:'center'});
    text(b,'↑2',182,758,50,32,24,C.muted,detail);text(b,'↑2',352,758,50,32,24,C.muted,detail);text(b,'↑2',522,758,50,32,24,C.muted,detail);
    arrow(b,[{x:642,y:724},{x:710,y:724}],detail,{width:1.6});text(b,'F',714,705,36,38,28,C.ink,detail);
    const r=b.group('Proposed gated residual');text(b,'(c)  Proposed refinement',815,415,680,38,28,C.ink,r,{bold:true});
    arrow(b,[{x:1015,y:205},{x:1015,y:365},{x:785,y:365},{x:785,y:612},{x:830,y:612}],r,{color:C.peach,width:1.7});
    drawFeatureMapStack(b,830,578,{w:58,h:58,count:2,step:5,group:r,back:C.violetLite});
    arrow(b,[{x:895,y:612},{x:925,y:612},{x:925,y:534},{x:962,y:534}],r,{width:1.7});
    arrow(b,[{x:925,y:612},{x:925,y:710},{x:962,y:710}],r,{width:1.7});
    funnel(b,962,494,110,80,r,true,'σ');funnel(b,962,670,110,80,r,true,'R');
    arrow(b,[{x:1073,y:534},{x:1110,y:534}],r,{width:1.7});arrow(b,[{x:1073,y:710},{x:1110,y:710}],r,{width:1.7});
    drawTensorGrid(b,1110,504,{rows:4,cols:4,cell:15,group:r,colors:[C.tealLite,'#C6D4B6',C.paper]});drawTensorGrid(b,1110,680,{rows:4,cols:4,cell:15,group:r,colors:[C.violetLite,C.paper,'#C7BBD9']});
    text(b,'G',1120,575,40,32,25,C.ink,r);text(b,'R',1120,750,40,32,25,C.ink,r);
    arrow(b,[{x:1171,y:534},{x:1244,y:534},{x:1244,y:600}],r,{width:1.7});arrow(b,[{x:1171,y:710},{x:1244,y:710},{x:1244,y:644}],r,{width:1.7});
    ellipse(b,1222,600,44,44,C.paper,C.ink,r,'Gate product',1.7);text(b,'×',1222,600,44,44,28,C.ink,r,{align:'center'});
    arrow(b,[{x:1267,y:622},{x:1360,y:622}],r,{width:1.7});drawTensorGrid(b,1360,584,{rows:4,cols:4,cell:19,group:r,colors:[C.tealLite,C.violetLite,C.paper]});
    text(b,'ΔD',1360,685,76,36,28,C.ink,r,{align:'center'});
    arrow(b,[{x:1398,y:584},{x:1398,y:365},{x:1244,y:365},{x:1244,y:227}],r,{color:C.peach,width:1.7});
    text(b,'¹ Schematic depth',1250,830,260,32,22,C.muted,r,{align:'right'});
  }

  function modernDepth(b){
    const panels=b.group('Figure panels');
    box(b,30,25,1740,305,C.pale,'#C4BEAF',panels,'Inference panel',26,1);
    box(b,48,72,752,240,'#F4EBF7','#D1C3D8',panels,'Representation panel',22,1);
    box(b,817,72,935,240,'#E9EDDF','#C1CBAC',panels,'Prediction panel',22,1);
    text(b,'(a)  Depth estimation',55,36,800,28,21,C.ink,panels,{bold:true});
    box(b,30,390,930,420,'#F4EBF7','#D1C3D8',panels,'Decoder detail',24,1);
    box(b,980,390,790,420,C.pinkLite,'#CFB5B2',panels,'Refinement detail',24,1);
    text(b,'(b)  Multi-scale reassembly',55,402,800,28,21,C.ink,panels,{bold:true});
    text(b,'(c)  Proposed depth refinement',1005,402,720,28,21,C.ink,panels,{bold:true});
    const flow=b.group('Inference flow');
    [[150,195,190,195],[290,195,320,195],[448,195,495,195],[1010,195,1070,195],[1142,195,1190,195],[1320,195,1380,195],[1452,195,1550,195],[1590,195,1650,195]].forEach(([x,y,ex,ey])=>arrow(b,[{x,y},{x:ex,y:ey}],flow));
    arrow(b,[{x:1165,y:195},{x:1165,y:351},{x:1000,y:351},{x:1000,y:548},{x:1020,y:548}],flow,{color:C.peach});
    arrow(b,[{x:1700,y:533},{x:1700,y:350},{x:1570,y:350},{x:1570,y:215}],flow,{color:C.peach});
    arrow(b,[{x:900,y:266},{x:900,y:357},{x:490,y:357},{x:490,y:390}],flow,{color:C.muted,dash:true,endHead:false,width:1});
    const overview=b.group('Backbone overview');
    drawReflectiveScene(b,70,155,80,80,overview,false);
    text(b,'Reflective object',60,249,115,23,14,C.ink,overview,{align:'center'});
    labelBox(b,'Patch\nembedding',190,165,100,60,C.blueLite,C.blue,overview,{size:15});
    tokens(b,320,178,overview,6);
    labelBox(b,'ViT\nencoder',495,130,115,130,C.blueLite,C.blue,overview,{size:19});
    for(let i=0;i<4;i++){
      const cy=141+i*36;
      arrow(b,[{x:610,y:cy},{x:665,y:cy}],overview);
      labelBox(b,'t'+(i+1),665,cy-13,80,26,C.violetLite,C.line,overview,{size:13,radius:3});
      arrow(b,[{x:745,y:cy},{x:850,y:cy}],overview);
    }
    labelBox(b,'DPT\ndecoder',850,126,160,140,C.blueLite,C.blue,overview,{size:19});
    drawTensorGrid(b,1070,159,{rows:6,cols:6,cell:12,group:overview,colors:[C.violetLite,'#DAD0E5','#F1EBF5']});
    text(b,'F',1070,249,72,23,16,C.ink,overview,{align:'center'});
    labelBox(b,'Depth\nhead',1190,165,130,60,C.blueLite,C.blue,overview,{size: 17});
    drawReflectiveScene(b,1380,159,72,72,overview,true);
    text(b,'D₀',1380,249,72,23,16,C.ink,overview,{align:'center'});
    ellipse(b,1550,175,40,40,C.paper,C.ink,overview,'Residual sum',1.1);text(b,'+',1550,175,40,40,22,C.ink,overview,{align:'center'});
    drawReflectiveScene(b,1650,159,72,72,overview,true);
    text(b,'Depth (schematic)',1618,277,136,20,12,C.muted,overview,{align:'center'});
    text(b,'D̂',1650,249,72,23,16,C.ink,overview,{align:'center'});
    const scales=b.group('Token reassembly and spatial fusion');
    for(let i=0;i<4;i++){
      const x=90+i*210,cx=x+70,side=25+i*10;
      text(b,'t'+(i+1),x,447,30,22,14,C.ink,scales);tokens(b,x+35,440,scales,4);
      arrow(b,[{x:cx,y:477},{x:cx,y:501}],scales);
      labelBox(b,'Reshape\n1×1 Conv',x,502,140, 50,C.blueLite,C.blue,scales,{size:15});
      arrow(b,[{x:cx,y:553},{x:cx,y:580}],scales);
      labelBox(b,'Resize',x,581,140,36,C.blueLite,C.blue,scales,{size:15});
      text(b,['H/32 × W/32','H/16 × W/16','H/8 × W/8','H/4 × W/4'][i],x,624,140,22,12,C.muted,scales,{align:'center'});
      drawFeatureMapStack(b,cx-(side+4)/2,663,{w:side,h:side,count:2,step:4,group:scales,color:C.violet,back:C.violetLite});
      arrow(b,[{x:cx,y:646},{x:cx,y:662}],scales);
      arrow(b,[{x:cx,y:663+side+2},{x:cx,y:738}],scales);
      labelBox(b,i===0?'Refine':'Fuse + ↑2',x,739,140, 40,C.violetLite,C.line,scales,{size:15});
      if(i<3)arrow(b,[{x:x+141,y:759},{x:x+210,y:759}],scales);
    }
    arrow(b,[{x:861,y:759},{x:916,y:759}],scales);text(b,'F',916,746,30,26,16,C.ink,scales);
    const refine=b.group('Spatially aligned gated residual');
    drawTensorGrid(b,1020,516,{rows:4,cols:4,cell:16,group:refine,colors:[C.violetLite,'#DAD0E5','#F1EBF5']});
    text(b,'F',1020,588,64,23,16,C.ink,refine,{align:'center'});
    arrow(b,[{x:1084,y:548},{x:1120,y:548}],refine);
    labelBox(b,'1×1 Conv\nResize',1120,518,110,60,C.blueLite,C.blue,refine,{size:15});
    text(b,'H × W',1120,588,110,23,13,C.muted,refine,{align:'center'});
    arrow(b,[{x:1230,y:548},{x:1250,y:548},{x:1250,y:487},{x:1290,y:487}],refine);
    arrow(b,[{x:1250,y:548},{x:1250,y:647},{x:1290,y:647}],refine);
    labelBox(b,'3×3 Conv\nSigmoid',1290,460,140,54,C.blueLite,C.blue,refine,{size:15});
    labelBox(b,'3×3 Conv',1290,620,140,54,C.blueLite,C.blue,refine,{size:15});
    arrow(b,[{x:1430,y:487},{x:1460,y:487}],refine);arrow(b,[{x:1430,y:647},{x:1460,y:647}],refine);
    drawTensorGrid(b,1460,455,{rows:4,cols:4,cell:16,group:refine,colors:['#DCE6CE','#C8D6B8','#EBF0E2']});
    drawTensorGrid(b,1460,615,{rows:4,cols:4,cell:16,group:refine,colors:[C.violetLite,'#DAD0E5','#F1EBF5']});
    text(b,'G',1460,526,64,23,16,C.ink,refine,{align:'center'});text(b,'R',1460,686,64,23,16,C.ink,refine,{align:'center'});
    arrow(b,[{x:1524,y:487},{x:1588,y:487},{x:1588,y:545}],refine);
    arrow(b,[{x:1524,y:647},{x:1588,y:647},{x:1588,y:581}],refine);
    ellipse(b,1570,545,36,36,C.paper,C.ink,refine,'Gate times residual',1.1);text(b,'×',1570,545,36,36,21,C.ink,refine,{align:'center'});
    arrow(b,[{x:1606,y:563},{x:1670,y:563}],refine);
    drawTensorGrid(b,1670,533,{rows:4,cols:4,cell:15,group:refine,colors:['#DCE6CE','#C8D6B8','#EBF0E2']});
    text(b,'ΔD',1670,599,60,23,16,C.ink,refine,{align:'center'});
    text(b,'D̂ = D₀ + G ⊙ R',1190,749,440, 30,20,C.ink,refine,{align:'center'});
    const training=b.group('Training loss');
    text(b,'Training only',55,868,205,26,15,C.muted,training);
    labelBox(b,'D*',365,857,95,50,C.gray,C.line,training,{size:16});
    arrow(b,[{x:460,y:882},{x:660,y:882}],training,{dash:true});
    labelBox(b,'Depth loss',660,857,165,50,C.paper,C.line,training,{size:16});
    arrow(b,[{x:1722,y:195},{x:1788,y:195},{x:1788,y:882},{x:825,y:882}],training,{dash:true,color:C.muted});
  }

  function attentionFusion(b) {
    header(b,'architecture study','Attention modules and multi-branch fusion',
      'Editable SE, channel, spatial and coordinate attention patterns',1);
    const specs=[
      ['SE BLOCK','Global\nAvgPool','channel recalibration',C.peachLite,C.peach],
      ['CHANNEL ATTENTION','Avg / Max\nPool','what features matter',C.violetLite,C.violet],
      ['SPATIAL ATTENTION','Channel\nPool','where features matter',C.blueLite,C.blue],
      ['COORDINATE ATTENTION','X / Y\nPool','position-aware gating',C.greenLite,C.green]
    ];
    specs.forEach((s,i)=>drawAttentionBlock(b,46+i*281,139,{w:260,h:177,
      title:s[0],pool:s[1],footer:s[2],tint:s[3],accent:s[4]}));
    const g=b.group('多分支注意力融合');
    sectionTitle(b,'MULTI-BRANCH INFERENCE',48,346,390,g);
    labelBox(b,'Input',52,438,86,67,C.pale,C.line,g,{size:17});
    arrow(b,[{x:141,y:471},{x:177,y:471}],g);
    labelBox(b,'Shared\nencoder',181,431,119,80,C.blueLite,C.blue,g,
      {size:16});
    const ys=[385,447,509], names=['Channel','Spatial','SE / CA'],
      fills=[C.violetLite,C.blueLite,C.peachLite], strokes=[C.violet,C.blue,C.peach];
    ys.forEach((yy,i)=>{
      arrow(b,[{x:303,y:471},{x:344,y:471},{x:344,y:yy+21},
        {x:376,y:yy+21}],g,{width:1.7,color:C.muted});
      labelBox(b,names[i],381,yy,155,42,fills[i],strokes[i],g,{size:15});
      arrow(b,[{x:540,y:yy+21},{x:589,y:yy+21},
        {x:589,y:471},{x:624,y:471}],g,{width:1.7,color:strokes[i]});
    });
    ellipse(b,633,449,44,44,C.paper,C.ink,g,'融合運算',2);
    text(b,'⊕',641,456,28,28,21,C.ink,g,{align:'center',bold:true});
    arrow(b,[{x:680,y:471},{x:721,y:471}],g);
    labelBox(b,'Fused\nfeatures',725,431,118,80,C.tealLite,C.teal,g,{size:15});
    arrow(b,[{x:847,y:471},{x:885,y:471}],g);
    labelBox(b,'Embedding',890,439,119,63,C.violetLite,C.violet,g,{size:15});
    arrow(b,[{x:1013,y:471},{x:1043,y:471}],g);
    labelBox(b,'Task loss',1047,439,103,63,C.pinkLite,C.pink,g,{size:15});
    text(b,'Choose the attention branch as an ablation, then measure the task effect.',
      49,581,1080,28,14,C.muted,g);
  }

  function perspectiveCnn(b) {
    header(b,'visual vocabulary','Perspective CNN feature maps',
      'A native-vector view of receptive fields, channel depth and classification',2);
    const stages=[
      {x:49,y:197,w:102,h:260,count:4,color:C.peach,back:C.peachLite,title:'INPUT',detail:'224 × 224 × 3'},
      {x:235,y:234,w:94,h:205,count:5,color:C.pink,back:C.pinkLite,title:'CONV 1',detail:'112 × 112 × 64'},
      {x:427,y:275,w:85,h:153,count:5,color:C.peach,back:C.peachLite,title:'CONV 2',detail:'56 × 56 × 128'},
      {x:604,y:311,w:75,h:111,count:5,color:C.blue,back:C.blueLite,title:'CONV 3',detail:'28 × 28 × 256'},
      {x:764,y:343,w:65,h:68,count:4,color:C.violet,back:C.violetLite,title:'CONV 4',detail:'14 × 14 × 512'}
    ];
    stages.forEach((s,i)=>{
      drawFeatureMapStack(b,s.x,s.y,{...s,step:i===0?10:8,skew:12});
      if(i<stages.length-1){
        const nx=stages[i+1].x;
        arrow(b,[{x:s.x+s.w+(s.count-1)*(i===0?10:8)+12,y:s.y+s.h/2},
          {x:nx-14,y:stages[i+1].y+stages[i+1].h/2}],
          b.group(`卷積 ${i+1} 連線`),{color:C.muted,width:1.8});
      }
    });
    const g=b.group('分類頭');
    arrow(b,[{x:864,y:381},{x:906,y:381}],g,{color:C.muted});
    labelBox(b,'GAP',911,345,74,70,C.tealLite,C.teal,g,{size:19});
    arrow(b,[{x:989,y:381},{x:1017,y:381}],g);
    labelBox(b,'FC',1021,355,56,51,C.blueLite,C.blue,g,{size:17});
    arrow(b,[{x:1080,y:381},{x:1100,y:381}],g);
    labelBox(b,'ŷ',1104,356,47,49,C.greenLite,C.green,g,{size:22});
    text(b,'global average\npooling',903,429,92,45,12,C.muted,g,
      {align:'center'});
    const legend=b.group('圖例');
    line(b,53,551,1149,551,legend,{color:C.gray,width:1.7});
    [[C.peachLite,C.peach,'convolution'],[C.pinkLite,C.pink,'pooling'],
      [C.blueLite,C.blue,'feature extraction'],[C.greenLite,C.green,'prediction']]
      .forEach((entry,i)=>{
        box(b,67+i*270,575,26,20,entry[0],entry[1],legend,'圖例色塊',3,1.4);
        text(b,entry[2],101+i*270,574,195,23,13,C.muted,legend);
      });
  }

  function conditionalDiffusion(b) {
    header(b,'generative models','Conditional diffusion and U-Net',
      'Forward noising, iterative denoising and conditioning in one diagram',3);
    const g=b.group('前向與反向擴散主流程');
    sectionTitle(b,'FORWARD → REVERSE PROCESS',49,132,520,g);
    drawTensorGrid(b,58,206,{rows:3,cols:3,cell:20,title:'x₀',group:g});
    arrow(b,[{x:122,y:237},{x:153,y:237}],g);
    labelBox(b,'Encoder',157,208,95,58,C.blueLite,C.blue,g,{size:15});
    arrow(b,[{x:256,y:237},{x:281,y:237}],g);
    drawTensorGrid(b,284,206,{rows:3,cols:3,cell:20,title:'z₀',group:g});
    arrow(b,[{x:347,y:237},{x:375,y:237}],g);
    labelBox(b,'Forward\nnoise',379,202,117,70,C.peachLite,C.peach,g,{size:15});
    arrow(b,[{x:500,y:237},{x:531,y:237}],g);
    drawTensorGrid(b,534,206,{rows:3,cols:3,cell:20,title:'zₜ',group:g,
      colors:[C.violetLite,C.pinkLite,C.gray,C.tealLite]});
    arrow(b,[{x:597,y:237},{x:625,y:237}],g);
    labelBox(b,'Iterative\ndenoising',629,202,122,70,C.violetLite,C.violet,g,
      {size:15});
    arrow(b,[{x:755,y:237},{x:787,y:237}],g);
    drawTensorGrid(b,790,206,{rows:3,cols:3,cell:20,title:'ẑ₀',group:g});
    arrow(b,[{x:853,y:237},{x:884,y:237}],g);
    labelBox(b,'Decoder',888,208,95,58,C.tealLite,C.teal,g,{size:15});
    arrow(b,[{x:987,y:237},{x:1018,y:237}],g);
    drawTensorGrid(b,1022,206,{rows:3,cols:3,cell:20,title:'x̂₀',group:g,
      colors:[C.greenLite,C.tealLite,C.paper]});
    text(b,'repeat T steps',655,283,150,22,12,C.violet,g,
      {align:'center',bold:true});
    const lower=b.group('去噪網路與條件');
    box(b,44,340,1107,265,C.pale,C.line,lower,'去噪網路區塊',17,1.3);
    sectionTitle(b,'DENOISER DETAIL',66,357,430,lower,C.violet);
    drawTensorGrid(b,86,470,{rows:4,cols:4,cell:19,title:'zₜ',group:lower});
    arrow(b,[{x:166,y:508},{x:218,y:508}],lower);
    drawUnet(b,223,397,{w:448,h:170,title:'Denoising U-Net + cross-attention',
      footer:'noise prediction  εθ(zₜ, t, c)',group:lower});
    arrow(b,[{x:675,y:508},{x:721,y:508}],lower);
    drawTensorGrid(b,727,470,{rows:4,cols:4,cell:19,title:'zₜ₋₁',group:lower,
      colors:[C.greenLite,C.tealLite,C.paper]});
    const cg=b.group('條件訊號');
    box(b,840,392,279,183,C.paper,C.violet,cg,'條件輸入外框',12,1.3);
    text(b,'CONDITIONING',857,402,245,27,15,C.violet,cg,{bold:true});
    [['Text',C.peachLite,C.peach],['Semantic map',C.pinkLite,C.pink],
      ['Image / feature',C.greenLite,C.green]].forEach((a,i)=>
        labelBox(b,a[0],855,438+i*39,246,31,a[1],a[2],cg,
          {size:13,radius:7,sw:1}));
    arrow(b,[{x:840,y:501},{x:705,y:501},{x:705,y:422},
      {x:672,y:422}],cg,{color:C.violet,width:1.8,dash:true,
      name:'條件訊號到交叉注意力'});
  }

  function graphTensorDiffusion(b) {
    header(b,'multimodal workflow','Graph and tensor diffusion',
      'Spatial observations, masked expression features and graph-conditioned denoising',4);
    const top=b.group('空間資料到潛在表示');
    sectionTitle(b,'SPATIAL ENCODING',49,130,440,top);
    box(b,51,192,145,101,C.pale,C.line,top,'空間觀測區塊',10,1.2);
    for(let i=0;i<17;i++){
      const px=68+(i*41)%111,py=210+(i*29)%66;
      ellipse(b,px,py,7,7,i%4===0?C.pinkLite:C.violetLite,
        i%4===0?C.pink:C.violet,top,`空間測點 ${i+1}`,.7);
    }
    text(b,'Spatial spots',51,295,145,24,13,C.muted,top,{align:'center'});
    arrow(b,[{x:201,y:244},{x:238,y:244}],top);
    drawGraph(b,243,203,{title:'kNN graph',group:top});
    arrow(b,[{x:380,y:244},{x:422,y:244}],top);
    drawTensorGrid(b,428,209,{rows:5,cols:7,cell:15,title:'Gene × spot matrix',
      group:top,mask:true});
    arrow(b,[{x:536,y:244},{x:576,y:244}],top);
    labelBox(b,'GNN\nencoder',580,197,112,97,C.violetLite,C.violet,top,
      {size:17});
    arrow(b,[{x:696,y:244},{x:734,y:244}],top);
    drawTensorGrid(b,738,211,{rows:5,cols:7,cell:15,title:'Latent X̂',group:top});
    arrow(b,[{x:847,y:244},{x:885,y:244}],top);
    labelBox(b,'Re-mask',889,213,96,65,C.peachLite,C.peach,top,{size:14});
    arrow(b,[{x:989,y:244},{x:1024,y:244}],top);
    drawTensorGrid(b,1028,211,{rows:5,cols:7,cell:15,title:'Masked X̂',
      group:top,mask:true});
    line(b,51,330,1150,330,top,{color:C.gray,width:2,dash:true});
    const low=b.group('擴散去噪與觀測條件');
    sectionTitle(b,'LATENT DIFFUSION',49,352,430,low,C.violet);
    drawTensorGrid(b,57,432,{rows:5,cols:5,cell:17,title:'x̂₀',group:low});
    arrow(b,[{x:146,y:474},{x:180,y:474}],low);
    labelBox(b,'Forward\ndiffusion',184,432,130,85,C.greenLite,C.green,low,
      {size:16});
    arrow(b,[{x:318,y:474},{x:350,y:474}],low);
    drawTensorGrid(b,354,432,{rows:5,cols:5,cell:17,title:'x̂ₜ',group:low,
      colors:[C.violetLite,C.pinkLite,C.gray,C.blueLite]});
    arrow(b,[{x:443,y:474},{x:478,y:474}],low);
    drawUnet(b,482,388,{w:355,h:190,title:'Graph-conditioned denoiser',
      footer:'predict ε from latent state and observations',group:low});
    arrow(b,[{x:841,y:474},{x:875,y:474}],low);
    drawTensorGrid(b,879,432,{rows:5,cols:5,cell:17,title:'x̂ₜ₋₁',group:low,
      colors:[C.greenLite,C.pinkLite,C.paper]});
    arrow(b,[{x:970,y:474},{x:1003,y:474}],low);
    drawTensorGrid(b,1007,432,{rows:5,cols:5,cell:17,title:'Output',group:low,
      colors:[C.greenLite,C.tealLite,C.paper]});
    const condition=b.group('觀測條件連線');
    labelBox(b,'Observed spots',489,591,141,29,C.pinkLite,C.pink,condition,
      {size:12,radius:6,sw:1});
    arrow(b,[{x:561,y:589},{x:561,y:572}],condition,
      {color:C.pink,dash:true,width:1.4});
    text(b,'mask-aware reconstruction',855,586,266,24,13,C.muted,condition);
  }

  function materialAwareDepth(b) {
    header(b,'research proposal','Material-aware monocular depth estimation',
      'A proposed modular architecture for specular and transparent regions',5);
    const g=b.group('材質感知深度主流程');
    sectionTitle(b,'SHARED VISUAL FEATURES',51,136,450,g);
    box(b,53,213,144,127,C.pale,C.line,g,'輸入 RGB 影像',11,1.3);
    polygon(b,[{x:69,y:310},{x:95,y:250},{x:124,y:293},{x:156,y:233},
      {x:180,y:309}],C.blueLite,C.blue,g,'抽象場景輪廓',1.3);
    ellipse(b,127,226,29,29,C.peachLite,C.peach,g,'反光物件示意',1.2);
    text(b,'RGB image',53,344,144,24,14,C.muted,g,{align:'center'});
    arrow(b,[{x:201,y:277},{x:246,y:277}],g);
    labelBox(b,'Shared\nencoder',251,226,145,103,C.blueLite,C.blue,g,
      {size:18});
    arrow(b,[{x:401,y:277},{x:460,y:277},{x:460,y:224},
      {x:493,y:224}],g,{color:C.blue});
    arrow(b,[{x:401,y:277},{x:460,y:277},{x:460,y:423},
      {x:493,y:423}],g,{color:C.violet});
    const base=b.group('基準深度分支');
    labelBox(b,'Baseline depth\nD₀',498,184,179,81,C.tealLite,C.teal,base,
      {size:16});
    text(b,'whole-image estimate',496,274,184,22,13,C.muted,base,
      {align:'center'});
    const mask=b.group('特殊材質偵測分支');
    labelBox(b,'Material mask\nM',498,383,179,81,C.violetLite,C.violet,mask,
      {size:16});
    text(b,'specular / transparent',495,472,185,22,13,C.muted,mask,
      {align:'center'});
    const refine=b.group('局部修正與深度輸出');
    arrow(b,[{x:683,y:224},{x:765,y:224},{x:765,y:321},
      {x:790,y:321}],refine,{color:C.teal});
    arrow(b,[{x:683,y:423},{x:765,y:423},{x:765,y:358},
      {x:790,y:358}],refine,{color:C.violet});
    labelBox(b,'Local residual\nrefinement  ΔD',794,287,193,106,C.peachLite,C.peach,
      refine,{size:17});
    arrow(b,[{x:991,y:340},{x:1023,y:340}],refine);
    labelBox(b,'Final depth\nD̂ = D₀ + M·ΔD',1027,291,123,98,C.greenLite,C.green,
      refine,{size:14});
    const metrics=b.group('驗證與消融');
    line(b,51,525,1149,525,metrics,{color:C.gray,width:1.8});
    [['A','Baseline'],['B','+ material mask'],['C','+ local refinement'],
      ['EVAL','all pixels / masked pixels']].forEach((a,i)=>{
      const x=53+i*279,w=i===3?259:253;
      box(b,x,548,w,52,i===3?C.pale:C.paper,C.line,metrics,`${a[1]} 驗證卡`,9,1.1);
      box(b,x+8,558,36,32,i===3?C.tealLite:C.blueLite,
        i===3?C.teal:C.blue,metrics,'驗證編號',6,1);
      text(b,a[0],x+8,559,36,29,12,i===3?C.teal:C.blue,metrics,
        {align:'center',bold:true});
      text(b,a[1],x+52,554,w-58,39,i===3?13:14,C.ink,metrics,
        {bold:true});
    });
  }

  const templates={
    'attention-fusion':attentionFusion,'perspective-cnn':perspectiveCnn,
    'conditional-diffusion':conditionalDiffusion,
    'graph-tensor-diffusion':graphTensorDiffusion,
    'material-aware-depth':sculptedDepth,
    'latent-diffusion-paper':diffusionPaper,'vision-transformer-paper':transformerPaper
  };

  const components={
    'encoder-funnel':{width:240,height:200,draw:(b,x,y,g)=>{funnel(b,x+10,y+10,220,180,g,false,'Encoder')}},
    'decoder-funnel':{width:240,height:200,draw:(b,x,y,g)=>{funnel(b,x+10,y+10,220,180,g,true,'Decoder')}},
    'unet-hourglass':{width:360,height:260,draw:(b,x,y,g)=>{hourglass(b,x,y,g)}},
    'unet-pyramid':{width:430,height:240,draw:(b,x,y,g)=>{pyramid(b,x,y,g)}},
    'transformer-tower':{width:240,height:330,draw:(b,x,y,g)=>{transformerTower(b,x,y,g)}},
    'diffusion-chain':{width:480,height:170,draw:(b,x,y,g)=>{diffusionChain(b,x,y,g)}},
    'denoising-loop':{width:590,height:340,draw:(b,x,y,g)=>{denoiseLoop(b,x,y,g)}},
    'cross-attention-bridge':{width:410,height:220,draw:(b,x,y,g)=>{crossBridge(b,x,y,g)}},
    'latent-bottleneck':{width:370,height:190,draw:(b,x,y,g)=>{latentBridge(b,x,y,g)}},
    'reflective-scene':{width:400,height:210,draw:(b,x,y,g)=>{drawReflectiveScene(b,x,y,160,160,g,false);arrow(b,[{x:x+170,y:y+80},{x:x+228,y:y+80}],g);drawReflectiveScene(b,x+240,y,160,160,g,true);text(b,'RGB',x,y+175,160,32,26,C.ink,g,{align:'center'});text(b,'Depth',x+240,y+175,160,32,26,C.ink,g,{align:'center'})}},

    'patch-embedding':{width:286,height:150,draw:patchEmbedding},
    'transformer-encoder':{width:360,height:190,draw:transformer},
    'qkv-attention':{width:330,height:186,draw:qkvAttention},
    'multiscale-decoder':{width:360,height:280,draw:dptFusion},
    'conv-norm-activation':{width:250,height:100,draw:convBlock},
    'upsample-block':{width:220,height:132,draw:upsample},
    'residual-adapter':{width:420,height:220,draw:residualAdapter},
    'token-sequence':{width:220,height:100,draw:(b,x,y,g)=>{text(b,'Token sequence',x,y,220,26,18,C.ink,g,{bold:true});tokens(b,x+10,y+40,g,9);text(b,'N × D',x,y+78,220,22,12,C.muted,g,{align:'center'});}},

    'feature-map-stack':{width:200,height:208,draw:(b,x,y,g)=>
      drawFeatureMapStack(b,x+21,y+40,{w:104,h:107,count:4,title:'FEATURE MAPS',
        detail:'H × W × C',color:C.blue,back:C.blueLite,group:g})},
    'attention-block':{width:246,height:184,draw:(b,x,y,g)=>
      drawAttentionBlock(b,x,y,{group:g,title:'CHANNEL ATTENTION',
        subtitle:'squeeze → gate → reweight'})},
    'unet-block':{width:326,height:176,draw:(b,x,y,g)=>
      drawUnet(b,x,y,{group:g})},
    'tensor-grid':{width:170,height:133,draw:(b,x,y,g)=>
      drawTensorGrid(b,x+17,y+35,{rows:5,cols:7,cell:18,title:'LATENT TENSOR',group:g})},
    'merge-operator':{width:124,height:94,draw:(b,x,y,g)=>
      drawMerge(b,x,y,{group:g,sign:'⊕',label:'Feature fusion'})},
    'diffusion-step':{width:290,height:140,draw:(b,x,y,g)=>
      drawDiffusionStep(b,x+5,y,{group:g})}
  };

  function applyLabels(items,options){
    if(options.labels!==undefined&&!['short','none'].includes(options.labels))throw new TypeError('labels must be short or none');
    return options.labels==='none'?items.filter(it=>it.type!=='text'):items;
  }
  function createTemplate(id,options={}) {
    const meta=templateMeta.find(t=>t.id===id);
    if(!meta)throw new RangeError(`Unknown deep-learning template: ${id}`);
    const b=new Builder();
    templates[id](b);
    return {name:meta.name,width:meta.width||1200,height:meta.height||675,items:applyLabels(b.items,options)};
  }
  function createComponent(id,options={}) {
    const entry=components[id],meta=componentMeta.find(c=>c.id===id);
    if(!entry)throw new RangeError(`Unknown deep-learning component: ${id}`);
    const x=options.x===undefined?80:Number(options.x),
      y=options.y===undefined?80:Number(options.y);
    if(!Number.isFinite(x)||!Number.isFinite(y))
      throw new TypeError('Component x and y must be finite numbers.');
    const b=new Builder(),g=b.group(meta.name);
    entry.draw(b,x,y,g);
    return {items:applyLabels(b.items,options),width:entry.width,height:entry.height};
  }
  return Object.freeze({templateMeta,componentMeta,createTemplate,createComponent});
});
