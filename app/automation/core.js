/* Transport-independent, opt-in command boundary. No DOM, network or eval. */
(function(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = (code, message) => { throw Object.assign(new Error(message), {code}); };
  function validate(value, schema, path = 'arguments') {
    const type = schema.type;
    if (type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_ARGUMENT', `${path}: expected object`);
      for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail('INVALID_ARGUMENT', `${path}.${key}: required`);
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties, key)) fail('INVALID_ARGUMENT', `${path}.${key}: unknown property`);
        validate(value[key], schema.properties[key], `${path}.${key}`);
      }
    } else if (type === 'array') {
      if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > schema.maxItems) fail('INVALID_ARGUMENT', `${path}: invalid array size`);
      if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) fail('INVALID_ARGUMENT', `${path}: duplicate entries`);
      value.forEach((v,i) => validate(v, schema.items, `${path}[${i}]`));
    } else if (type === 'string') {
      if (typeof value !== 'string' || value.length < (schema.minLength || 0) || value.length > (schema.maxLength || 10000) || schema.pattern && !new RegExp(schema.pattern).test(value)) fail('INVALID_ARGUMENT', `${path}: invalid string`);
    } else if (type === 'number' || type === 'integer') {
      if (typeof value !== 'number' || !Number.isFinite(value) || type === 'integer' && !Number.isInteger(value) || value < schema.minimum || value > schema.maximum) fail('INVALID_ARGUMENT', `${path}: out of range`);
    } else if (type === 'boolean' && typeof value !== 'boolean') fail('INVALID_ARGUMENT', `${path}: expected boolean`);
    if (schema.enum && !schema.enum.includes(value)) fail('INVALID_ARGUMENT', `${path}: unsupported value`);
  }
  function create(host, definitions) {
    let scope = null, fingerprint = '', revision = 0, executing = false, task = null, generation = 0;
    const definitionsByName = new Map(definitions.map(d => [d.name, d]));
    function revoke() { scope = null; generation++; task?.controller.abort(); task = null; host.notify?.('disabled'); }
    function read() {
      const doc = host.read();
      if (!scope) fail('NOT_AUTHORIZED', 'Enable automation in the editor first.');
      if (scope.projectId !== doc.projectId || scope.pageId !== doc.pageId) { revoke(); fail('PAGE_CHANGED', 'Page changed; authorize the new page explicitly.'); }
      const next = JSON.stringify([doc.items, doc.canvas]);
      if (next !== fingerprint) { fingerprint = next; revision++; }
      return {...doc, context:{...scope, revision}};
    }
    function checkContext(expected) {
      const doc = read();
      if (!expected || expected.projectId !== doc.context.projectId || expected.pageId !== doc.context.pageId || expected.revision !== revision) fail('STALE_DOCUMENT', 'The artwork changed. Read the page again before editing.');
      return doc;
    }
    function targets(doc, ids, writable = true) {
      const found = ids.map(key => doc.items.find(it => it.id === key));
      if (found.some(it => !it)) fail('NOT_FOUND', 'An object no longer exists.');
      if (writable && found.some(it => it.locked)) fail('LOCKED', 'Unlock the objects in the editor first.');
      return found;
    }
    function ensureCompleteConnections(doc, ids) {
      const chosen = new Set(ids), junctions = new Map();
      for (const it of doc.items) {
        for (const key of Object.values(it.pointJunctions || {})) {
          if (!junctions.has(key)) junctions.set(key, []);
          junctions.get(key).push(it.id);
        }
        const links = [...Object.values(it.attachments || {}).map(link=>link.owner), ...(it.regionFill?.sources || [])];
        if (links.some(owner => chosen.has(owner) !== chosen.has(it.id))) fail('LINKED_OBJECTS', 'Include connected lines, owners and fill regions together.');
      }
      for (const owners of junctions.values()) if (owners.some(id=>chosen.has(id)) && owners.some(id=>!chosen.has(id))) fail('LINKED_OBJECTS', 'Include every line sharing these junctions.');
    }
    function prepareDiagramItems(source, existing) {
      if (!Array.isArray(source) || !source.length || source.length > 1000) fail('INVALID_COMPONENT', 'The diagram component has an invalid object count.');
      const placeholders = new Set();
      for (const it of source) {
        if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !it.id || placeholders.has(it.id)
          || !['box','polygon','ellipse','arrow','text'].includes(it.type) || it.referenceOnly) fail('INVALID_COMPONENT', 'The diagram component contains an unsupported object.');
        placeholders.add(it.id);
        if (it.type === 'polygon' || it.type === 'arrow') {
          if (!Array.isArray(it.points) || it.points.length < (it.type === 'arrow' ? 2 : 3)
            || it.points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) fail('INVALID_COMPONENT', 'The diagram component has invalid geometry.');
        } else if (![it.x,it.y,it.w,it.h].every(Number.isFinite)) fail('INVALID_COMPONENT', 'The diagram component has invalid geometry.');
      }
      const created = clone(source), used = new Set(existing.map(it => it.id));
      function fresh(prefix = '') {
        for (let attempt = 0; attempt < 100; attempt++) {
          const candidate = prefix + host.uid();
          if (candidate.length > 160) fail('INVALID_COMPONENT', 'Generated object ID is too long.');
          if (!used.has(candidate)) { used.add(candidate); return candidate; }
        }
        fail('INVALID_COMPONENT', 'Could not allocate unique diagram IDs.');
      }
      const idMap = new Map(created.map(it => [it.id, fresh()]));
      const groupMap = new Map(), junctionMap = new Map();
      const remap = owner => {
        if (!idMap.has(owner)) fail('INVALID_COMPONENT', 'The diagram component has an external object link.');
        return idMap.get(owner);
      };
      for (const it of created) {
        it.id = remap(it.id);
        if (it.layerGroup != null) {
          const group = it.layerGroup;
          if (!group || typeof group.id !== 'string' || !group.id) fail('INVALID_COMPONENT', 'The diagram component has an invalid group.');
          if (!groupMap.has(group.id)) groupMap.set(group.id, fresh('diagram-group-'));
          group.id = groupMap.get(group.id);
        }
        if (it.pointJunctions) {
          for (const [index,key] of Object.entries(it.pointJunctions)) {
            if (typeof key !== 'string' || !key) fail('INVALID_COMPONENT', 'The diagram component has an invalid junction.');
            if (!junctionMap.has(key)) junctionMap.set(key, fresh('diagram-junction-'));
            it.pointJunctions[index] = junctionMap.get(key);
          }
        }
        if (it.attachments) for (const link of Object.values(it.attachments)) if (link) link.owner = remap(link.owner);
        if (it.regionFill) {
          if (!Array.isArray(it.regionFill.sources)) fail('INVALID_COMPONENT', 'The diagram component has invalid fill links.');
          it.regionFill.sources = it.regionFill.sources.map(remap);
        }
      }
      return created;
    }
    function diagramLibrary() {
      const library = host.deepLearning || root.SkechuDeepLearning;
      if (!library || !Array.isArray(library.componentMeta) || typeof library.createComponent !== 'function') fail('NOT_READY', 'The diagram component library is unavailable.');
      return library;
    }
    function block3dLibrary() {
      const library = host.diagram3d || root.SkechuDiagram3D;
      if (!library || typeof library.createBlock !== 'function') fail('NOT_READY', 'The 3D diagram library is unavailable.');
      return library;
    }
    function finish(next, selected) {
      host.apply(next, selected);
      const context = read().context;
      host.notify?.('updated');
      return {context, ids:selected, count:selected.length};
    }
    const taskInfo = () => ({taskId:task.id,status:task.status,progress:task.progress,stats:task.result?.stats,error:task.error,context:task.context});
    async function execute(name, args = {}) {
      const definition = definitionsByName.get(name);
      if (!definition) fail('UNKNOWN_COMMAND', 'Unknown command.');
      validate(args, definition.inputSchema);
      // Only one command can commit/ask for confirmation at a time. No hidden queue.
      if (executing) fail('BUSY', 'Another command is running.');
      executing = true;
      try {
        let doc = read();
        if (host.busy()) fail('BUSY', 'Finish the current gesture, stroke or dialog first.');
        if (args.context) doc = checkContext(args.context);
        if (name === 'read_document') {
          const offset=args.offset || 0, limit=args.limit || 50;
          return {context:doc.context,name:doc.name,canvas:doc.canvas,selection:doc.selection,total:doc.items.length,offset,
            nextOffset:offset+limit<doc.items.length?offset+limit:null,
            objects:doc.items.slice(offset,offset+limit).map(it => {
              const data={id:it.id,type:it.type,name:it.name,locked:!!it.locked,hidden:!!it.hidden,reference:!!it.referenceOnly,
                bounds:host.bounds(it),style:{fill:it.type==='text'?it.color:it.fill,stroke:it.type==='text'?undefined:it.stroke || it.color,strokeWidth:it.strokeWidth ?? it.width,opacity:it.opacity ?? 1},anchorCount:it.points?.length || 0};
              if (it.layerGroup?.id) data.group={id:it.layerGroup.id,name:it.layerGroup.name};
              if (it.diagram3d) data.diagram3d=clone(it.diagram3d);
              if (args.includeGeometry && it.points) { data.points=clone(it.points); data.handles=clone(it.pointHandleAngles || {}); }
              return data;
            })};
        }
        if (name === 'select_objects') { targets(doc,args.ids,false); host.select(args.ids); return {context:read().context,ids:args.ids}; }
        if (name === 'export_svg') return {context:doc.context,mimeType:'image/svg+xml',svg:host.exportSvg()};
        if (name === 'list_diagram_components') return {context:doc.context,components:clone(diagramLibrary().componentMeta)};
        if (name === 'history') { if (task?.status==='running') fail('BUSY','Cancel tracing first.'); host.history(args.action); return {context:read().context}; }
        if (name === 'trace_image') {
          if (task) fail('BUSY','Apply or cancel the previous tracing job first.');
          const ref=targets(doc,[args.imageId],false)[0];
          if (ref.type!=='image' || !ref.referenceOnly) fail('INVALID_ARGUMENT','Choose a reference image.');
          const current=task={id:host.uid(),status:'running',progress:0,context:doc.context,controller:new AbortController()};
          const options={mode:'auto',threshold:150,accuracy:2.5,simplify:90,minLength:3,autoFill:false};
          for(const key of Object.keys(options)) if (args[key] !== undefined) options[key]=args[key];
          Promise.resolve().then(()=>host.trace(clone(ref),options,current.controller.signal,p=>{current.progress=p})).then(result=>{
            if(task!==current || current.controller.signal.aborted)return;
            if (!Array.isArray(result.items) || result.items.length>5000) throw Error('Trace exceeds the 5000-path limit.');
            current.result=result;current.status='ready';current.progress=100;host.notify?.('trace-ready');
          }).catch(error=>{if(task===current){current.status='error';current.error=String(error.message);host.notify?.('trace-error')}});
          return taskInfo();
        }
        if (['get_task','cancel_task','apply_trace'].includes(name)) {
          if (!task || args.taskId!==task.id) fail('NOT_FOUND','Tracing job not found.');
          if (name==='get_task') return taskInfo();
          if (name==='cancel_task') {task.controller.abort();task=null;return {cancelled:true};}
          if (task.status!=='ready') fail('NOT_READY','Tracing has not completed.');
          checkContext(task.context);
          const created=task.result.items;
          if(doc.items.length+created.length>10000)fail('LIMIT','Page object limit reached.');
          const result=finish([...clone(doc.items),...created],created.map(it=>it.id));
          task=null;return result;
        }
        if (name==='create_shapes') {
          const created=args.shapes.map(s=>{
            const common={id:host.uid(),name:s.name || 'API shape',r:0,fill:'#f3f3f3',stroke:'#4b4b4b',strokeWidth:3,opacity:1,...s.style};
            return s.kind==='ellipse'?{...common,type:'ellipse',x:s.x,y:s.y,w:s.width,h:s.height}
              :{...common,type:'polygon',cornerRadius:0,points:[{x:s.x,y:s.y},{x:s.x+s.width,y:s.y},{x:s.x+s.width,y:s.y+s.height},{x:s.x,y:s.y+s.height}],label:'',labelX:s.x+s.width/2,labelY:s.y+s.height/2};
          });
          if(doc.items.length+created.length>10000) fail('LIMIT','Page object limit reached.');
          return finish([...clone(doc.items),...created],created.map(it=>it.id));
        }
        if (name==='create_diagram_component') {
          const library = diagramLibrary();
          if (!library.componentMeta.some(meta => meta.id === args.componentId)) fail('INVALID_ARGUMENT', 'Unknown diagram component.');
          const result = library.createComponent(args.componentId, {x:args.x,y:args.y});
          const created = prepareDiagramItems(result?.items, doc.items);
          if (doc.items.length + created.length > 10000) fail('LIMIT', 'Page object limit reached.');
          return {...finish([...clone(doc.items),...created],created.map(it=>it.id)),componentId:args.componentId};
        }
        if (name==='create_diagram_block_3d') {
          const {context:unused,...options}=args;
          const result=block3dLibrary().createBlock(options);
          const created=prepareDiagramItems(result?.items,doc.items);
          if (doc.items.length+created.length>10000) fail('LIMIT','Page object limit reached.');
          return {...finish([...clone(doc.items),...created],created.map(it=>it.id)),block3d:result.options};
        }
        const selected=targets(doc,args.ids), idSet=new Set(args.ids);
        if (name==='delete_objects') {
          ensureCompleteConnections(doc,args.ids);
          const grant=generation;
          if (!await host.confirmDelete(args.ids.length)) return {cancelled:true,context:read().context};
          if(grant!==generation) fail('NOT_AUTHORIZED','Authorization changed.');
          checkContext(args.context);
          if(host.busy()) fail('BUSY','The editor is busy.');
          return finish(clone(doc.items.filter(it=>!idSet.has(it.id))),[]);
        }
        const next=clone(doc.items);
        if (name==='update_objects') {
          if (!Object.keys(args.style).length) fail('INVALID_ARGUMENT','Provide at least one style property.');
          for(const it of selected) {
            if (it.type==='image' && Object.keys(args.style).some(k=>k!=='opacity')) fail('UNSUPPORTED','Images support opacity only.');
            if (it.type==='text' && Object.keys(args.style).some(k=>!['fill','opacity'].includes(k))) fail('UNSUPPORTED','Text supports fill and opacity only.');
            if (it.type==='arrow' && args.style.fill && !it.closed) fail('UNSUPPORTED','Open strokes cannot receive a fill.');
          }
          for(const it of next.filter(it=>idSet.has(it.id))) for(const [key,value] of Object.entries(args.style))
            it[it.type==='text'&&key==='fill'?'color':it.type==='arrow'&&key==='stroke'?'color':it.type==='arrow'&&key==='strokeWidth'?'width':key]=value;
        } else if (name==='move_objects') {
          ensureCompleteConnections(doc,args.ids);
          if (selected.some(it=>it.explicitBezier || it.regionFill)) fail('UNSUPPORTED','Move computed fill regions and explicit curves with the editor for now.');
          for(const it of next.filter(it=>idSet.has(it.id))) {
            if(it.points)it.points=it.points.map(p=>({x:p.x+args.dx,y:p.y+args.dy}));else{it.x+=args.dx;it.y+=args.dy;}
            if(Number.isFinite(it.labelX)){it.labelX+=args.dx;it.labelY+=args.dy;}
          }
        }
        return finish(next,args.ids);
      } finally { executing=false; }
    }
    return Object.freeze({execute,list:()=>clone(definitions),status:()=>({enabled:!!scope,task:task?taskInfo():null}),
      grant(){revoke();const doc=host.read();if(!doc.pageId)fail('NOT_READY','Load a page first.');scope={projectId:doc.projectId,pageId:doc.pageId};fingerprint='';return read().context;},
      revoke,checkScope(){if(scope)try{read()}catch{}},validate});
  }
  root.SkechuAutomationCore={create,validate};
})(globalThis);
