/* Retain unchanged SVG nodes: editing one item must not rebuild a large scene. */
const EditorRender = (() => {
  const hosts = new WeakMap();
  function patchNode(node, next) {
    if (node.nodeType !== next.nodeType || node.nodeName !== next.nodeName || node.namespaceURI !== next.namespaceURI) {
      node.replaceWith(next); return next;
    }
    if (node.nodeType !== 1) {
      if (node.nodeValue !== next.nodeValue) node.nodeValue = next.nodeValue;
      return node;
    }
    for (const attr of [...node.attributes]) if (!next.hasAttributeNS(attr.namespaceURI, attr.localName)) node.removeAttributeNS(attr.namespaceURI, attr.localName);
    for (const attr of next.attributes) if (node.getAttributeNS(attr.namespaceURI, attr.localName) !== attr.value) node.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    // Page thumbnails own a separately cached scene inside their page button.
    if (next.hasAttribute('data-render-island')) return node;
    let child = node.firstChild;
    for (const replacement of [...next.childNodes]) {
      if (!child) { node.append(replacement); continue; }
      const following = child.nextSibling;
      patchNode(child, replacement); child = following;
    }
    while (child) { const following = child.nextSibling; child.remove(); child = following; }
    return node;
  }
  function blocks(entries, compose) {
    const result = [], seen = new Map();
    for (let i = 0; i < entries.length;) {
      const first = entries[i]; let end = i + 1;
      if (first.key) while (end < entries.length && entries[end].key === first.key) end++;
      const identity = first.key ? 'coverage:' + first.key : first.renderKey;
      const occurrence = seen.get(identity) || 0; seen.set(identity, occurrence + 1);
      result.push({key: JSON.stringify([identity, occurrence]), markup: first.key ? compose(entries.slice(i, end), 'main-batch-' + i) : first.markup});
      i = end;
    }
    return result;
  }
  function render(host, entries, compose) {
    if (!entries.length) { host.replaceChildren(); hosts.set(host, {entries:new Map(),count:0}); return; }
    let cache = hosts.get(host);
    // Other tools may temporarily replace the scene (trace/region previews).
    // Validate ownership before reusing any nodes from the previous render.
    if (!cache || host.childNodes.length !== cache.count || [...cache.entries.values()].some(e => e.nodes.some(n => n.parentNode !== host))) {
      host.replaceChildren(); cache = {entries: new Map(), count: 0};
    }
    const next = new Map(), parser = host.namespaceURI === 'http://www.w3.org/2000/svg' ? document.createElementNS(host.namespaceURI, 'svg') : document.createElement('div');
    let cursor = host.firstChild, tail = null, count = 0;
    for (const block of blocks(entries, compose)) {
      let entry = cache.entries.get(block.key);
      if (!entry || entry.markup !== block.markup) {
        parser.innerHTML = block.markup;
        const replacements = [...parser.childNodes];
        const nodes = replacements.map((n, i) => entry?.nodes[i] ? patchNode(entry.nodes[i], n) : n);
        if (entry) for (const n of entry.nodes.slice(nodes.length)) n.remove();
        entry = {markup: block.markup, nodes};
      }
      // Refresh the cursor after patches which replace/remove its current node.
      if (cursor && cursor.parentNode !== host) cursor = tail ? tail.nextSibling : host.firstChild;
      for (const node of entry.nodes) {
        if (node !== cursor) host.insertBefore(node, cursor || null);
        cursor = node.nextSibling; tail = node; count++;
      }
      next.set(block.key, entry);
    }
    for (const [key, entry] of cache.entries) if (!next.has(key)) entry.nodes.forEach(n => n.remove());
    hosts.set(host, {entries: next, count});
  }
  return {render};
})();
