const RING_DEPTH = { R1: 0, R2: 1, R3: 2, R4: 3, R5: 4, R6: 5 };

export function collectLineage(startId, nodeLinksIdx, nodeById) {
  const lineageNodeIds = new Set([startId]);
  const queue = [startId];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const nodeId = queue.shift();
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const depth = RING_DEPTH[node.ring] ?? 99;

    for (const key of nodeLinksIdx.get(nodeId) ?? []) {
      const [src, tgt] = key.split('→');
      const otherId = src === nodeId ? tgt : src;
      const other = nodeById.get(otherId);
      if (!other) continue;
      if ((RING_DEPTH[other.ring] ?? 99) < depth && !visited.has(otherId)) {
        visited.add(otherId);
        lineageNodeIds.add(otherId);
        queue.push(otherId);
      }
    }
  }

  const lineageLinkKeys = new Set();
  lineageNodeIds.forEach(nodeId => {
    for (const key of nodeLinksIdx.get(nodeId) ?? []) {
      const [src, tgt] = key.split('→');
      if (lineageNodeIds.has(src) && lineageNodeIds.has(tgt)) lineageLinkKeys.add(key);
    }
  });
  return { lineageNodeIds, lineageLinkKeys };
}

export function buildNodeLinksIndex(layoutNodes, links, nodeById) {
  const index = new Map(layoutNodes.map(node => [node.id, []]));
  links.forEach(link => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source || !target) return;
    if ((source.ring === 'R1' && target.ring === 'R5') ||
        (source.ring === 'R5' && target.ring === 'R1')) return;
    const key = `${link.source}→${link.target}`;
    index.get(link.source)?.push(key);
    index.get(link.target)?.push(key);
  });
  return index;
}
