export function arcLabelFontSizePx(node) {
  if (node.ring === 'R6') {
    const spanDeg = (node.endAngle - node.startAngle) * 180 / Math.PI;
    return Math.max(3.5, Math.min(8, spanDeg * 2));
  }

  switch (node.ring) {
    case 'R1': return 10;
    case 'R2': return 9;
    case 'R3': return 9;
    case 'R4': return 8.5;
    case 'R5': return 8;
    default:   return 8;
  }
}

export function truncateArcLabel(node) {
  const label = String(node.label ?? '');
  const span = Math.max(0, node.endAngle - node.startAngle);
  const radius = (node.innerRadius + node.outerRadius) / 2;
  const available = Math.max(0, radius * span - 1);
  const fontSize = arcLabelFontSizePx(node);
  const averageGlyphWidth = fontSize * (node.ring === 'R5' || node.ring === 'R6' ? 0.62 : 0.56);
  const capacity = Math.floor(available / averageGlyphWidth);

  if (label.length <= capacity) return label;
  if (capacity <= 1) return '…';
  return `${label.slice(0, capacity - 1)}…`;
}
