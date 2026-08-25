import { maasSearchTerms } from './maas-lenses.js';

function nodeMatchesEvidence(node, filters) {
  const metadata = node.metadata || {};
  if (filters.unresolved && !metadata.sourceQuality?.unresolved) return false;
  if (filters.routingCapable && !metadata.inventory?.routingCapable) return false;
  if (filters.bonded && !metadata.resiliency) return false;
  return true;
}

export function investigationContext(nodes, links, { query = '', filters = {} } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const hasNodeFilter = Boolean(
    normalizedQuery || filters.unresolved || filters.routingCapable || filters.bonded
  );
  const hasLinkFilter = Boolean(filters.managementVlan);
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const matches = new Set();

  if (hasNodeFilter) {
    for (const node of nodes) {
      const haystack = [
        node.label,
        node.metadata?.hostname,
        node.metadata?.sourceId,
        ...maasSearchTerms(node),
      ].filter(Boolean).join(' ').toLowerCase();
      if ((!normalizedQuery || haystack.includes(normalizedQuery)) &&
          nodeMatchesEvidence(node, filters)) {
        matches.add(node.id);
      }
    }
  }

  const linkMatches = new Set();
  if (hasLinkFilter) {
    for (const link of links) {
      if (filters.managementVlan && link.metadata?.vlanEvidence?.managementVlanObserved) {
        linkMatches.add(link.id || `${link.source}→${link.target}`);
        matches.add(link.source);
        matches.add(link.target);
      }
    }
  }

  if (!hasNodeFilter && !hasLinkFilter) {
    return { active: false, matchedNodeIds: new Set(), matchedLinkIds: new Set(), contextNodeIds: new Set() };
  }

  const context = new Set(matches);
  for (const link of links) {
    if (matches.has(link.source) || matches.has(link.target)) {
      context.add(link.source);
      context.add(link.target);
    }
  }
  return {
    active: true,
    matchedNodeIds: matches,
    matchedLinkIds: linkMatches,
    contextNodeIds: new Set([...context].filter(id => nodeById.has(id))),
  };
}

export function lodForScale(scale) {
  if (scale < 0.85) return 'overview';
  if (scale < 1.45) return 'fabric';
  return 'detail';
}
