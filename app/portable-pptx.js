/* Browser-only, native DrawingML export. No Office/COM, uploads,
 * external relationships, or executable clipboard formats. Input is a bounded
 * geometry snapshot, never arbitrary XML. One px = .75 pt = 9525 EMU.
 */
const PortablePptx = (() => {
  'use strict';
  const EMU = 9525, LIMIT = 24 * 1024 * 1024;
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const encoder = new TextEncoder();
  const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function number(value, min, max, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${label}超出可匯出範圍`);
    return value;
  }
  function color(value) {
    if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw Error('填色必須是六位數色碼');
    return value.slice(1).toUpperCase();
  }
  const point = p => ({x:number(p?.x,-100000,100000,'座標'), y:number(p?.y,-100000,100000,'座標')});
  function fill(value) {
    if (!value) return null;
    const opacity = number(value.opacity ?? 1,0,1,'透明度');
    if (value.type === 'solid') return {type:'solid',color:color(value.color),opacity};
    if (value.type !== 'linear' || !Array.isArray(value.stops) || value.stops.length < 2 || value.stops.length > 10) throw Error('目前可匯出純色或 2–10 個色標的原生線性漸層');
    return {type:'linear',opacity,angle:number(value.angle,0,360,'漸層角度'),stops:value.stops.map(s=>({color:color(s.color),position:number(s.position,0,1,'色標位置'),opacity:number(s.opacity ?? 1,0,1,'色標透明度')})).sort((a,b)=>a.position-b.position)};
  }
  function validate(scene) {
    if (scene?.version !== 1 || !Array.isArray(scene.shapes) || !scene.shapes.length || scene.shapes.length > 10000) throw Error('請選取 1–10,000 個可編輯物件');
    let segments = 0, characters = 0, imageBytes = 0;
    return scene.shapes.map(s => {
      const box = {x:number(s.x,-100000,100000,'位置'),y:number(s.y,-100000,100000,'位置'),w:number(s.w,.001,5000,'寬度'),h:number(s.h,.001,5000,'高度')};
      const base = {...box,rotation:number(s.rotation ?? 0,-36000,36000,'旋轉角度')};
      if (s.kind === 'image') {
        if(typeof s.src!=='string'||s.src.length>12000000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(s.src))throw Error('底圖必須是內嵌 PNG，不能使用外部連結或本機路徑');
        const bytes=Uint8Array.from(atob(s.src.slice(22)),c=>c.charCodeAt(0));
        const view=new DataView(bytes.buffer);
        if(bytes.length<33||view.getUint32(0)!==0x89504e47||view.getUint32(4)!==0x0d0a1a0a||view.getUint32(8)!==13||view.getUint32(12)!==0x49484452)throw Error('PNG 檔頭不正確');
        const w=view.getUint32(16),h=view.getUint32(20);
        if(!w||!h||w>8192||h>8192||w*h>16000000||(imageBytes+=bytes.length)>9000000)throw Error('底圖過大，請分批匯出');
        return {...base,kind:'image',bytes};
      }
      if (s.kind === 'text') {
        if (typeof s.text !== 'string' || typeof s.font !== 'string' || s.font.length > 128 || (characters += s.text.length) > 200000) throw Error('文字過長或字型格式不正確');
        const margins = (s.margins ?? [0,0,0,0]);
        if (!Array.isArray(margins) || margins.length !== 4) throw Error('文字邊距格式不正確');
        return {...base,kind:'text',text:s.text,font:s.font,size:number(s.size,1,1200,'字級'),color:color(s.color),bold:!!s.bold,italic:!!s.italic,
          align:{left:'l',center:'ctr',right:'r'}[s.align] || 'l',valign:{top:'t',middle:'ctr',bottom:'b'}[s.valign] || 't',
          lineHeight:number(s.lineHeight ?? 1.05,.5,5,'行距'),margins:margins.map(m=>number(m,0,5000,'文字邊距'))};
      }
      if (s.kind !== 'path' || !Array.isArray(s.contours) || !s.contours.length || s.contours.length > 2000) throw Error('不支援的可編輯物件類型');
      const contours = s.contours.map(c => {
        if (!Array.isArray(c.segments) || !c.segments.length || (segments += c.segments.length) > 100000) throw Error('曲線過大，請分批匯出（上限 100,000 段）');
        const parts = c.segments.map(p=>Object.fromEntries(['p0','c1','c2','p3'].map(k=>[k,point(p[k])])));
        for (let i=1;i<parts.length;i++) if (Math.hypot(parts[i-1].p3.x-parts[i].p0.x,parts[i-1].p3.y-parts[i].p0.y)>1e-4) throw Error('曲線中途斷開，請拆成獨立輪廓');
        if (c.closed && Math.hypot(parts[0].p0.x-parts.at(-1).p3.x,parts[0].p0.y-parts.at(-1).p3.y)>1e-4) throw Error('封閉輪廓的首尾不一致');
        return {closed:!!c.closed,segments:parts};
      });
      const stroke = s.stroke ? {color:color(s.stroke.color),width:number(s.stroke.width,0,100,'線寬'),dash:!!s.stroke.dash,
        head:['triangle','stealth','diamond','oval'].includes(s.stroke.head)?s.stroke.head:'triangle',start:!!s.stroke.start,end:!!s.stroke.end} : null;
      return {...base,kind:'path',contours,fill:fill(s.fill),stroke};
    });
  }
  const emu = value => Math.round(value * EMU);
  const colored = (hex,opacity=1) => `<a:srgbClr val="${hex}"><a:alpha val="${Math.round(opacity*100000)}"/></a:srgbClr>`;
  function fillXml(f) {
    if (!f || f.opacity === 0) return '<a:noFill/>';
    if (f.type === 'solid') return `<a:solidFill>${colored(f.color,f.opacity)}</a:solidFill>`;
    return `<a:gradFill rotWithShape="1"><a:gsLst>${f.stops.map(s=>`<a:gs pos="${Math.round(s.position*100000)}">${colored(s.color,s.opacity*f.opacity)}</a:gs>`).join('')}</a:gsLst><a:lin ang="${Math.round(f.angle*60000)}" scaled="1"/><a:tileRect/></a:gradFill>`;
  }
  function shapeXml(s,index,origin) {
    const w=Math.max(1,emu(s.w)),h=Math.max(1,emu(s.h));
    const transform=`<a:xfrm rot="${Math.round(((s.rotation%360+360)%360)*60000)}"><a:off x="${emu(s.x-origin.x)}" y="${emu(s.y-origin.y)}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`;
    if(s.kind==='image')return `<p:pic><p:nvPicPr><p:cNvPr id="${index+2}" name="Skechu picture ${index+1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${s.relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${transform}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    const nonvisual=`<p:nvSpPr><p:cNvPr id="${index+2}" name="Skechu ${s.kind} ${index+1}"/><p:cNvSpPr${s.kind==='text'?' txBox="1"':''}/><p:nvPr/></p:nvSpPr>`;
    if (s.kind==='text') {
      const runProps=`sz="${Math.round(s.size*75)}" b="${s.bold?1:0}" i="${s.italic?1:0}"`;
      const typeface=`<a:latin typeface="${xml(s.font)}"/><a:ea typeface="${xml(s.font)}"/><a:cs typeface="${xml(s.font)}"/>`;
      const text=s.text.split(/\r?\n/).map(line=>`<a:p><a:pPr algn="${s.align}"><a:lnSpc><a:spcPts val="${Math.round(s.size*s.lineHeight*75)}"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr><a:r><a:rPr ${runProps}><a:solidFill>${colored(s.color)}</a:solidFill>${typeface}</a:rPr><a:t xml:space="preserve">${xml(line)}</a:t></a:r><a:endParaRPr ${runProps}/></a:p>`).join('');
      const [l,t,r,b]=s.margins;
      return `<p:sp>${nonvisual}<p:spPr>${transform}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" anchor="${s.valign}" lIns="${emu(l)}" tIns="${emu(t)}" rIns="${emu(r)}" bIns="${emu(b)}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${text}</p:txBody></p:sp>`;
    }
    const pt=p=>`<a:pt x="${emu(p.x-s.x)}" y="${emu(p.y-s.y)}"/>`;
    // Each contour has its own moveTo/close: no synthetic bridges across holes.
    const commands=s.contours.map(c=>`<a:moveTo>${pt(c.segments[0].p0)}</a:moveTo>`+c.segments.map(p=>`<a:cubicBezTo>${pt(p.c1)}${pt(p.c2)}${pt(p.p3)}</a:cubicBezTo>`).join('')+(c.closed?'<a:close/>':'')).join('');
    const geometry=`<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${w}" h="${h}" fill="${s.fill?'norm':'none'}" stroke="${s.stroke?.width>0?1:0}" extrusionOk="0">${commands}</a:path></a:pathLst></a:custGeom>`;
    const st=s.stroke;
    const line=st?.width>0?`<a:ln w="${emu(st.width)}" cap="rnd"><a:solidFill>${colored(st.color)}</a:solidFill>${st.dash?'<a:custDash><a:ds d="'+Math.round(1200000/st.width)+'" sp="'+Math.round(800000/st.width)+'"/></a:custDash>':'<a:prstDash val="solid"/>'}<a:round/><a:headEnd type="${st.start?st.head:'none'}"/><a:tailEnd type="${st.end?st.head:'none'}"/></a:ln>`:'<a:ln><a:noFill/></a:ln>';
    return `<p:sp>${nonvisual}<p:spPr>${transform}${geometry}${fillXml(s.fill)}${line}</p:spPr></p:sp>`;
  }
  function groupRoot(){return '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'}
  function relations(entries){return declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries.map(([type,target],i)=>`<Relationship Id="rId${i+1}" Type="${R}/${type}" Target="${target}"/>`).join('')}</Relationships>`}
  function bounds(shapes){
    let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
    for(const s of shapes){const a=s.rotation*Math.PI/180,c=Math.cos(a),n=Math.sin(a),pad=(s.stroke?.width||0)*5+24,cx=s.x+s.w/2,cy=s.y+s.h/2;
      for(const dx of [-s.w/2,s.w/2])for(const dy of [-s.h/2,s.h/2]){const px=cx+dx*c-dy*n,py=cy+dx*n+dy*c;x=Math.min(x,px-pad);y=Math.min(y,py-pad);right=Math.max(right,px+pad);bottom=Math.max(bottom,py+pad)}}
    const w=Math.max(128,right-x),h=Math.max(128,bottom-y);
    if(w>5000||h>5000)throw Error('選取範圍超過 PPT 圖頁大小，請分批匯出');
    return{x,y,w,h};
  }
  function parts(scene) {
    const shapes=validate(scene),b=bounds(shapes),files={};
    const slideRelations=[['slideLayout','../slideLayouts/slideLayout1.xml']];
    for(const s of shapes)if(s.kind==='image'){
      const name=`picture${slideRelations.length}.png`;
      files[`ppt/media/${name}`]=s.bytes;
      slideRelations.push(['image',`../media/${name}`]);s.relId=`rId${slideRelations.length}`;
    }
    const document=(name,body)=>files[name]=declaration+body;
    const ns=`xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"`;
    const types={'ppt/presentation.xml':'presentationml.presentation.main','ppt/slides/slide1.xml':'presentationml.slide','ppt/slideMasters/slideMaster1.xml':'presentationml.slideMaster','ppt/slideLayouts/slideLayout1.xml':'presentationml.slideLayout','ppt/theme/theme1.xml':'theme'};
    document('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${Object.entries(types).map(([name,type])=>`<Override PartName="/${name}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('')}</Types>`);
    files['_rels/.rels']=relations([['officeDocument','ppt/presentation.xml']]);
    document('ppt/presentation.xml',`<p:presentation ${ns}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="${emu(b.w)}" cy="${emu(b.h)}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
    files['ppt/_rels/presentation.xml.rels']=relations([['slideMaster','slideMasters/slideMaster1.xml'],['slide','slides/slide1.xml']]);
    const colorMap='<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
    document('ppt/slideMasters/slideMaster1.xml',`<p:sldMaster ${ns}><p:cSld><p:spTree>${groupRoot()}</p:spTree></p:cSld>${colorMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
    files['ppt/slideMasters/_rels/slideMaster1.xml.rels']=relations([['slideLayout','../slideLayouts/slideLayout1.xml'],['theme','../theme/theme1.xml']]);
    document('ppt/slideLayouts/slideLayout1.xml',`<p:sldLayout ${ns} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${groupRoot()}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
    files['ppt/slideLayouts/_rels/slideLayout1.xml.rels']=relations([['slideMaster','../slideMasters/slideMaster1.xml']]);
    document('ppt/slides/slide1.xml',`<p:sld ${ns}><p:cSld><p:spTree>${groupRoot()}${shapes.map((s,i)=>shapeXml(s,i,b)).join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    files['ppt/slides/_rels/slide1.xml.rels']=relations(slideRelations);
    if(slideRelations.length>1)files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>');
    const colors=['000000','FFFFFF','172033','F5F5F5','6D28D9','2563EB','16A34A','FF7920','DC2626','475569','0000FF','800080'];
    const names=['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
    const ph='<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    const font='<a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/>';
    document('ppt/theme/theme1.xml',`<a:theme xmlns:a="${A}" name="Skechu"><a:themeElements><a:clrScheme name="Skechu">${names.map((name,i)=>`<a:${name}><a:srgbClr val="${colors[i]}"/></a:${name}>`).join('')}</a:clrScheme><a:fontScheme name="Skechu"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme><a:fmtScheme name="Skechu"><a:fillStyleLst>${ph.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${[6350,12700,19050].map(w=>`<a:ln w="${w}">${ph}<a:prstDash val="solid"/></a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${ph.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
    return files;
  }
  // ZIP store avoids large dependencies and works offline on Safari/Firefox too.
  const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
  function crc32(data){let n=0xffffffff;for(const byte of data)n=crcTable[(n^byte)&255]^(n>>>8);return(n^0xffffffff)>>>0}
  function zip(files){
    const entries=Object.entries(files).map(([name,data])=>({name:encoder.encode(name),data:data instanceof Uint8Array?data:encoder.encode(data)}));
    const size=entries.reduce((n,e)=>n+76+e.name.length*2+e.data.length,22);
    if(size>LIMIT)throw Error('匯出超過 24 MB，請縮小選取範圍或分批匯出');
    const result=new Uint8Array(size),view=new DataView(result.buffer);let offset=0;
    const u16=(p,n)=>view.setUint16(p,n,true),u32=(p,n)=>view.setUint32(p,n,true);
    for(const e of entries){e.offset=offset;e.crc=crc32(e.data);u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0x800);u16(offset+12,33);u32(offset+14,e.crc);u32(offset+18,e.data.length);u32(offset+22,e.data.length);u16(offset+26,e.name.length);result.set(e.name,offset+30);result.set(e.data,offset+30+e.name.length);offset+=30+e.name.length+e.data.length}
    const central=offset;
    for(const e of entries){u32(offset,0x02014b50);u16(offset+4,20);u16(offset+6,20);u16(offset+8,0x800);u16(offset+14,33);u32(offset+16,e.crc);u32(offset+20,e.data.length);u32(offset+24,e.data.length);u16(offset+28,e.name.length);u32(offset+42,e.offset);result.set(e.name,offset+46);offset+=46+e.name.length}
    u32(offset,0x06054b50);u16(offset+8,entries.length);u16(offset+10,entries.length);u32(offset+12,offset-central);u32(offset+16,central);return result;
  }
  return Object.freeze({version:1,parts,validate,encode:scene=>zip(parts(scene))});
})();
