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
