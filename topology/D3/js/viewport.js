import * as d3 from 'd3';

export function initViewport(svgElement, scene, {
  center = { x: 0, y: 0 },
  onScaleChange,
} = {}) {
  const svg = d3.select(svgElement);
  const applySceneTransform = transform => {
    const x = transform.x + (transform.k - 1) * center.x;
    const y = transform.y + (transform.k - 1) * center.y;
    scene.attr('transform', `translate(${x},${y}) scale(${transform.k})`);
  };
  const zoom = d3.zoom()
    .scaleExtent([1, 4])
    // The whole-Disc frame is the minimum view, so it must not drift away
    // from its centered identity transform through a pan gesture.
    .constrain(transform => transform.k <= 1 ? d3.zoomIdentity : transform)
    .on('zoom', event => {
      applySceneTransform(event.transform);
      onScaleChange?.(event.transform.k);
    });

  svg.call(zoom).on('dblclick.zoom', null);

  function transformTo(transform) {
    svg.call(zoom.transform, transform);
  }

  return {
    reset() {
      transformTo(d3.zoomIdentity);
    },
    focusNode(node, scale = 2) {
      const angle = (node.startAngle + node.endAngle) / 2;
      const radius = (node.innerRadius + node.outerRadius) / 2;
      const x = radius * Math.sin(angle);
      const y = -radius * Math.cos(angle);
      const localX = -x * scale;
      const localY = -y * scale;
      transformTo(d3.zoomIdentity
        .translate(localX - (scale - 1) * center.x, localY - (scale - 1) * center.y)
        .scale(scale));
    },
    destroy() {
      svg.on('.zoom', null);
    },
  };
}
