const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const diagrams = require('../app/deep-learning-diagrams.js');

const TYPES = new Set(['polygon', 'box', 'ellipse', 'arrow', 'text']);

function pointsOf(item) {
  if (item.points) return item.points;
  return [{x:item.x,y:item.y},{x:item.x+item.w,y:item.y+item.h}];
}

function validateItems(items, bounds) {
  assert.ok(items.length > 0);
  assert.equal(new Set(items.map(item => item.id)).size, items.length,
    'every generated item needs a distinct editable ID');
  for (const item of items) {
    assert.ok(TYPES.has(item.type), `${item.name}: unsupported native type ${item.type}`);
    assert.ok(item.name && typeof item.name === 'string');
    assert.ok(item.layerGroup?.id && item.layerGroup?.name,
      `${item.name}: missing editor layer group`);
    if (item.type === 'arrow') assert.ok(item.points.length >= 2);
    if (item.type === 'polygon') assert.ok(item.points.length >= 3);
    if (item.type === 'text') {
      assert.equal(item.box,true);
      assert.ok(item.text.length > 0 && item.size >= 10);
    }
    if (!item.points) assert.ok(item.w > 0 && item.h > 0);
    for (const point of pointsOf(item)) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y),
        `${item.name}: non-finite geometry`);
      if (bounds) {
        assert.ok(point.x >= bounds.x - .001 && point.x <= bounds.x + bounds.w + .001,
          `${item.name}: x outside drawing`);
        assert.ok(point.y >= bounds.y - .001 && point.y <= bounds.y + bounds.h + .001,
          `${item.name}: y outside drawing`);
      }
    }
  }
}

test('five figure templates contain only editable, grouped native geometry', () => {
  assert.equal(diagrams.templateMeta.length,5);
  assert.equal(new Set(diagrams.templateMeta.map(meta=>meta.id)).size,5);
  for (const meta of diagrams.templateMeta) {
    assert.ok(meta.name && meta.description);
    const figure=diagrams.createTemplate(meta.id);
    assert.equal(figure.name,meta.name);
    assert.equal(figure.width,1200);
    assert.equal(figure.height,675);
    validateItems(figure.items,{x:0,y:0,w:1200,h:675});
    assert.ok(new Set(figure.items.map(item=>item.layerGroup.id)).size >= 3,
      `${meta.id}: expected logical editable groups`);
  }
});

test('templates carry their characteristic scientific diagram elements', () => {
  const labels=id=>diagrams.createTemplate(id).items
    .filter(item=>item.type==='text').map(item=>item.text).join(' | ');
  const attention=labels('attention-fusion');
  for (const term of ['SE BLOCK','CHANNEL ATTENTION','SPATIAL ATTENTION',
    'COORDINATE ATTENTION','Embedding']) assert.ok(attention.includes(term));

  const cnn=diagrams.createTemplate('perspective-cnn');
  assert.ok(cnn.items.filter(item=>item.type==='polygon' &&
    item.name.startsWith('特徵圖平面')).length >= 20,
    'CNN perspective must have independently editable map planes');
  assert.match(labels('perspective-cnn'),/224 × 224 × 3/);

  const diffusion=labels('conditional-diffusion');
  for (const term of ['Forward','Denoising U-Net','CONDITIONING','Semantic map'])
    assert.ok(diffusion.includes(term));

  const graph=labels('graph-tensor-diffusion');
  for (const term of ['kNN graph','Gene × spot matrix','GNN','Re-mask'])
    assert.ok(graph.includes(term));

  const depth=labels('material-aware-depth');
  for (const term of ['Baseline depth','Material mask','Local residual',
    'all pixels / masked pixels']) assert.ok(depth.includes(term));
});

test('all six components are movable units with measured footprints', () => {
  assert.equal(diagrams.componentMeta.length,6);
  assert.equal(new Set(diagrams.componentMeta.map(meta=>meta.id)).size,6);
  for (const meta of diagrams.componentMeta) {
    const origin=diagrams.createComponent(meta.id,{x:0,y:0});
    const moved=diagrams.createComponent(meta.id,{x:210,y:180});
    assert.ok(origin.width > 0 && origin.height > 0);
    assert.equal(origin.items.length,moved.items.length);
    validateItems(origin.items,{x:0,y:0,w:origin.width,h:origin.height});
    validateItems(moved.items,{x:210,y:180,w:origin.width,h:origin.height});
    for(let i=0;i<origin.items.length;i++) {
      const before=pointsOf(origin.items[i]),after=pointsOf(moved.items[i]);
      assert.equal(before.length,after.length);
      for(let p=0;p<before.length;p++) {
        assert.equal(after[p].x-before[p].x,210);
        assert.equal(after[p].y-before[p].y,180);
      }
    }
    assert.ok(origin.items.every(item=>item.layerGroup.name===meta.name));
  }
});

test('unknown starter and invalid component coordinates fail clearly', () => {
  assert.throws(()=>diagrams.createTemplate('missing'),RangeError);
  assert.throws(()=>diagrams.createComponent('missing'),RangeError);
  assert.throws(()=>diagrams.createComponent('tensor-grid',{x:Infinity,y:5}),TypeError);
});

test('browser script exposes the same global generator without CommonJS', () => {
  const source=fs.readFileSync(path.join(__dirname,'../app/deep-learning-diagrams.js'),'utf8');
  const browser={};
  vm.runInNewContext(source,browser,{filename:'deep-learning-diagrams.js'});
  assert.equal(typeof browser.SkechuDeepLearning.createTemplate,'function');
  assert.equal(browser.SkechuDeepLearning.createTemplate('attention-fusion').width,1200);
});
