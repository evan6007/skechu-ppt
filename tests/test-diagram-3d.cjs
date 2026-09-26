const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const blocks=require('../app/diagram-3d.js');

test('camera changes projected native cuboid faces',()=>{
  const right=blocks.createBlock({x:20,y:30,yaw:40,elevation:28,count:3});
  const left=blocks.createBlock({x:20,y:30,yaw:-40,elevation:28,count:3});
  const high=blocks.createBlock({x:20,y:30,yaw:40,elevation:50,count:3});
  for(const block of [right,left,high]){
    assert.equal(block.items.filter(it=>it.type==='polygon').length,9);
    assert.equal(block.items.filter(it=>it.type==='text').length,2);
    assert.equal(new Set(block.items.map(it=>it.id)).size,block.items.length);
    assert.ok(block.items.every(it=>it.layerGroup?.id));
    for(const item of block.items){
      const points=item.points||[{x:item.x,y:item.y},{x:item.x+item.w,y:item.y+item.h}];
      assert.ok(points.every(p=>p.x>=20-.001&&p.x<=20+block.width+.001&&p.y>=30-.001&&p.y<=30+block.height+.001));
    }
  }
  const side=b=>b.items.find(it=>it.name==='第 1 層 · 側面').points;
  assert.notDeepEqual(side(right),side(left));
  assert.notDeepEqual(side(right),side(high));
  assert.equal(right.items.find(it=>it.diagram3d).diagram3d.yaw,40);
});

test('layer count and validation are bounded',()=>{
  assert.equal(blocks.createBlock({count:1,title:'',detail:''}).items.length,3);
  assert.equal(blocks.createBlock({count:10,title:'',detail:''}).items.length,30);
  assert.throws(()=>blocks.createBlock({yaw:61}),RangeError);
  assert.throws(()=>blocks.createBlock({count:2.5}),RangeError);
  assert.throws(()=>blocks.createBlock({color:'red'}),TypeError);
  assert.throws(()=>blocks.createBlock({gridRows:6,gridCols:0}),RangeError);
  assert.throws(()=>blocks.createBlock({gridRows:13,gridCols:2}),RangeError);
  assert.throws(()=>blocks.createBlock({gridRows:3,gridCols:3,gridStyle:'noise'}),TypeError);
});

test('gridded feature face follows camera projection and stays editable',()=>{
  const spec={x:25,y:35,width:120,height:150,count:2,gridRows:4,gridCols:5,gridStyle:'categorical',title:'',detail:''};
  const left=blocks.createBlock({...spec,yaw:-34,elevation:23});
  const right=blocks.createBlock({...spec,yaw:34,elevation:23});
  const cells=left.items.filter(it=>it.name.startsWith('Tensor cell'));
  assert.equal(cells.length,20);
  assert.equal(left.items.length,26);
  assert.equal(new Set(cells.map(it=>it.fill)).size,5);
  assert.ok(cells.every(it=>it.type==='polygon'&&it.points.length===4&&it.layerGroup.id));
  assert.notDeepEqual(cells[0].points,right.items.find(it=>it.name==='Tensor cell 1, 1').points);
  assert.equal(left.items.find(it=>it.diagram3d).diagram3d.gridRows,4);
});

test('CNN sample uses six grouped 3D stages within the canvas',()=>{
  const figure=blocks.createNetwork({yaw:-40,elevation:27});
  assert.equal(figure.width,1200);assert.equal(figure.height,675);
  assert.equal(new Set(figure.items.map(it=>it.layerGroup.id)).size,7);
  assert.equal(figure.items.filter(it=>it.type==='arrow').length,5);
  assert.equal(figure.items.filter(it=>it.diagram3d).length,6);
  for(const item of figure.items){
    for(const p of item.points||[{x:item.x,y:item.y},{x:item.x+item.w,y:item.y+item.h}]){
      assert.ok(p.x>=0&&p.x<=1200&&p.y>=0&&p.y<=675,`${item.name}: outside canvas`);
    }
  }
});

test('browser script exposes the same generator',()=>{
  const browser={};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/diagram-3d.js'),'utf8'),browser);
  assert.equal(browser.SkechuDiagram3D.createBlock({count:2}).items.length,8);
});

test('paper projection keeps front faces and cells axis aligned at every camera setting',()=>{
  for(const yaw of [-60,-30,0,30,60])for(const elevation of [0,18,55]){
    const b=blocks.createBlock({projection:'paper',yaw,elevation,gridRows:3,gridCols:4});
    for(const item of b.items.filter(it=>it.diagram3d||it.name.startsWith('Tensor cell'))){
      const [a,c,d,e]=item.points;
      assert.equal(a.y,c.y);assert.equal(c.x,d.x);assert.equal(d.y,e.y);assert.equal(e.x,a.x);
    }
  }
  assert.throws(()=>blocks.createBlock({projection:'unknown'}),TypeError);
  const paper=blocks.createBlock({projection:'paper'}),axon=blocks.createBlock({projection:'axonometric'});
  assert.notDeepEqual(paper.items.find(it=>it.diagram3d).points,axon.items.find(it=>it.diagram3d).points);
});

test('CNN visible front centers and connector endpoints share one measured baseline',()=>{
  for(const projection of ['paper','axonometric'])for(const yaw of [-60,0,60]){
    const fig=blocks.createNetwork({projection,yaw,elevation:35});
    for(const it of fig.items.filter(it=>it.diagram3d))assert.ok(Math.abs(it.points.reduce((sum,p)=>sum+p.y,0)/4-365)<.001);
    for(const arrow of fig.items.filter(it=>it.type==='arrow'))assert.ok(arrow.points.every(p=>Math.abs(p.y-365)<.001));
  }
});
