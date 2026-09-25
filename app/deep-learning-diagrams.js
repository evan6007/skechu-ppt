/* Editable deep-learning figure starters. Every mark is a native Skechu item. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SkechuDeepLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const C = Object.freeze({
    ink: '#17243A', muted: '#586B80', line: '#B9C9D7', teal: '#137E82',
    tealLite: '#D9F2EF', blue: '#326BBC', blueLite: '#E3EEFF',
    peach: '#F5A663', peachLite: '#FFF0DE', violet: '#8162B3',
    violetLite: '#EEE7F8', pink: '#DB6F91', pinkLite: '#FFE7EE',
    green: '#4A9A72', greenLite: '#E1F3E7', paper: '#FFFFFF',
    pale: '#F6F9FC', gray: '#E8EEF4'
  });

  const templateMeta = Object.freeze([
    {id:'attention-fusion',name:'注意力模組與多分支融合',description:'SE、通道、空間與座標注意力，加上共享主幹、融合與嵌入輸出。'},
    {id:'perspective-cnn',name:'平面 CNN 示意圖',description:'平面堆疊的卷積特徵圖、池化、全連接層與分類輸出。'},
    {id:'conditional-diffusion',name:'條件式擴散與 U-Net',description:'前向加噪、迭代去噪、條件訊號與含跳接的 U-Net。'},
    {id:'graph-tensor-diffusion',name:'圖與張量擴散流程',description:'空間節點、鄰接圖、遮罩矩陣、GNN 潛在表示與擴散去噪。'},
    {id:'material-aware-depth',name:'材質感知單目深度',description:'共享編碼器、基準深度、特殊材質遮罩與局部深度修正。'}
  ]);

  const componentMeta = Object.freeze([
    {id:'feature-map-stack',name:'平面特徵圖堆疊',description:'多層平面堆疊，可標示卷積特徵的尺寸。'},
    {id:'attention-block',name:'注意力模組',description:'輸入、池化、權重與逐元素調整的可編輯模組。'},
    {id:'unet-block',name:'U-Net 與跳接',description:'編碼、瓶頸、解碼和跨層連線。'},
    {id:'tensor-grid',name:'彩色張量矩陣',description:'用獨立色格表示特徵、潛在變數或遮罩。'},
    {id:'merge-operator',name:'融合運算節點',description:'雙輸入與單輸出的加法或拼接節點。'},
    {id:'diffusion-step',name:'單步去噪流程',description:'帶時間條件的 xₜ → 去噪器 → xₜ₋₁。'}
  ]);

  class Builder {
    constructor() { this.items=[]; this.serial=0; this.groupSerial=0; }
    group(name) { return {id:`dl-group-${++this.groupSerial}`,name,collapsed:true}; }
    add(item,group) {
      const value={id:`dl-item-${++this.serial}`,r:0,opacity:1,...item};
      if(group) value.layerGroup={...group};
      this.items.push(value);
      return value;
    }
  }

  function box(b,x,y,w,h,fill=C.paper,stroke=C.line,g,name='區塊',radius=12,sw=1.5) {
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
      width:opts.width||2,head:opts.head||8,headShape:'triangle',startHead:false,
      endHead:opts.endHead!==false,style:opts.dash?'dash':'solid',closed:false,
      fill:C.paper,fillOpacity:0,curved:false},g);
  }
  function line(b,x1,y1,x2,y2,g,opts={}) {
    return arrow(b,[{x:x1,y:y1},{x:x2,y:y2}],g,{...opts,endHead:false});
  }
  function labelBox(b,label,x,y,w,h,fill,stroke,g,opts={}) {
    box(b,x,y,w,h,fill,stroke,g,`${label} · 背景`,opts.radius??10,opts.sw??1.5);
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
    const w=o.w||105,h=o.h||120,count=o.count||4,skew=o.skew||14,
      step=o.step||10,color=o.color||C.blue,back=o.back||C.blueLite,
      g=o.group||b.group(o.title||'特徵圖堆疊');
    for(let i=count-1;i>=0;i--){
      const dx=i*step,dy=(count-1-i)*5;
      polygon(b,[{x:x+dx,y:y+dy+skew},{x:x+w+dx,y:y+dy},
        {x:x+w+dx,y:y+h+dy},{x:x+dx,y:y+h+dy+skew}],
        i===0?back:C.paper,color,g,`特徵圖平面 ${count-i}`,1.6);
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
    'material-aware-depth':materialAwareDepth
  };

  const components={
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

  function createTemplate(id) {
    const meta=templateMeta.find(t=>t.id===id);
    if(!meta)throw new RangeError(`Unknown deep-learning template: ${id}`);
    const b=new Builder();
    templates[id](b);
    return {name:meta.name,width:1200,height:675,items:b.items};
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
    return {items:b.items,width:entry.width,height:entry.height};
  }
  return Object.freeze({templateMeta,componentMeta,createTemplate,createComponent});
});
