/* One paint order for the editor, SVG and native PowerPoint.
 * Keep editable source objects intact; split only their rendered appearance. */
function renderedFillIsVisible(it) {
  const opacity = it.type === 'arrow' ? (it.closed ? (it.fillOpacity ?? .25) : 0) : (it.opacity ?? 1);
  return ['arrow', 'box', 'ellipse', 'polygon'].includes(it.type) && opacity > 0 && !['none', 'transparent', ''].includes(it.fill);
}
function fillOrderValue(it) { return Number.isFinite(it.fillOrder) ? it.fillOrder : 0; }
function raiseFilledItem(it, sourceItems = items) {
  it.fillOrder = sourceItems.reduce((highest, item) => Math.max(highest, fillOrderValue(item)), 0) + 1;
}
function topFilledItem(sourceItems) {
  return sourceItems.filter(renderedFillIsVisible).sort((a,b) => fillOrderValue(a)-fillOrderValue(b)).at(-1);
}
function paintSceneItems(sourceItems) {
  const reference = [], fills = [], foreground = [];
  for (const it of sourceItems) {
    if (it.referenceOnly) { reference.push(it); continue; }
    const arrow = it.type === 'arrow';
    const fillable = arrow ? it.closed : ['box', 'ellipse', 'polygon'].includes(it.type);
    const opacity = arrow ? (it.fillOpacity ?? .25) : (it.opacity ?? 1);
    const hasFill = fillable && opacity > 0 && !['none', 'transparent', ''].includes(it.fill);
    if (!hasFill) { foreground.push(it); continue; }
    const strokeWidth = arrow ? (it.width ?? 3) : (it.strokeWidth ?? 2);
    const hasStroke = strokeWidth > 0 && (arrow || !['none', 'transparent', ''].includes(it.stroke));
    if (!hasStroke && !it.label) {
      fills.push({...it, paintLayer: 'fill'});
      continue;
    }
    fills.push({...it, id: `${it.id}::paint-fill`, paintSourceId: it.id, paintLayer: 'fill',
      width: 0, strokeWidth: 0, startHead: false, endHead: false, label: ''});
    foreground.push({...it, paintLayer: 'line', ...(arrow ? {fillOpacity: 0} : {opacity: 0})});
  }
  // Stable sort keeps legacy projects in their original order until repainted.
  fills.sort((a,b) => fillOrderValue(a)-fillOrderValue(b));
  return [...reference, ...fills, ...foreground];
}

// Keep the magnifier away from the sampled pixel, including at viewport edges.
function colorLoupePosition(x, y, viewportWidth, viewportHeight, width = 112, height = 140) {
  const gap = 28, margin = 8;
  return {
    x: Math.max(margin, Math.min(viewportWidth - width - margin, x + gap + width <= viewportWidth - margin ? x + gap : x - width - gap)),
    y: Math.max(margin, Math.min(viewportHeight - height - margin, y + gap + height <= viewportHeight - margin ? y + gap : y - height - gap))
  };
}

// Opposite corner is fixed. Default is proportional, Shift allows free sizing.
function resizedReference(base, corner, dx, dy, free = false) {
  const angle = (base.r || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const localX = dx * c + dy * s, localY = -dx * s + dy * c;
  const sx = corner.includes('r') ? 1 : -1, sy = corner.includes('b') ? 1 : -1;
  let w = base.w + sx * localX, h = base.h + sy * localY;
  if (!free) {
    const factor = Math.max(20 / base.w, 20 / base.h, (w * base.w + h * base.h) / (base.w ** 2 + base.h ** 2));
    w = base.w * factor; h = base.h * factor;
  } else { w = Math.max(20, w); h = Math.max(20, h); }
  const centerX = base.x + base.w / 2 + (sx * (w - base.w) * c - sy * (h - base.h) * s) / 2;
  const centerY = base.y + base.h / 2 + (sx * (w - base.w) * s + sy * (h - base.h) * c) / 2;
  return {x: centerX - w / 2, y: centerY - h / 2, w, h};
}
