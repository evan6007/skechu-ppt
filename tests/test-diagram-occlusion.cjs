const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const cubes=require('../app/diagram-3d.js');
const catalog=require('../app/deep-learning-diagrams.js');
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../app/paint-layers.js'),'utf8'),ctx);
test('opaque stacks draw front fills after back outlines, including saved legacy blocks',()=>{
  for(const legacy of [false,true]){
    const block=cubes.createBlock({count:4,gridRows:4,gridCols:4}).items;
    if(legacy)block.forEach(it=>delete it.layerGroup.paintMode);
    const before=JSON.stringify(block),painted=ctx.paintSceneItems(block);
    assert.equal(painted.length,block.length,'faces must not be split into a global outline overlay');
    assert.deepEqual(Array.from(painted,it=>it.id),block.map(it=>it.id));
    assert.ok(painted.filter(it=>it.type==='polygon').every(it=>it.opacity===1));
    assert.equal(JSON.stringify(block),before);
  }
});
test('all reusable scientific components preserve native painter order through save/load',()=>{
  for(const meta of catalog.componentMeta){
    const items=JSON.parse(JSON.stringify(catalog.createComponent(meta.id).items));
    assert.deepEqual(Array.from(ctx.paintSceneItems(items),it=>it.id),items.map(it=>it.id));
  }
});
