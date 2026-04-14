// Browser-only. Bundled by esbuild — no Node.js APIs.
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { drag as d3drag } from 'd3-drag';
import type { PolyculeData, Person, Relationship } from '../types.js';
import { RELATIONSHIP_STYLES, nodeColor, initials } from '../styles.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeDatum extends Person {
  index?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  connectionCount: number;
}

interface LinkDatum {
  source: NodeDatum;
  target: NodeDatum;
  relationship: Relationship;
  index?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_RADIUS = 28;
const LABEL_OFFSET = 16;

// ─── Theme helpers ────────────────────────────────────────────────────────────

function getThemeColors(dark: boolean) {
  return {
    bg: dark ? '#0d1117' : '#f0f4f8',
    grid: dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)',
    text: dark ? '#e6edf3' : '#1c1e21',
    textMuted: dark ? '#8b949e' : '#65676b',
    nodeLabelBg: dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
    edgeLabelBg: dark ? 'rgba(13,17,23,0.75)' : 'rgba(240,244,248,0.8)',
    panelBg: dark ? 'rgba(22,27,34,0.95)' : 'rgba(255,255,255,0.97)',
    legendBg: dark ? 'rgba(13,17,23,0.45)' : 'rgba(255,255,255,0.5)',
    panelBorder: dark ? 'rgba(48,54,61,0.9)' : 'rgba(208,215,222,0.9)',
    panelText: dark ? '#e6edf3' : '#1c1e21',
    panelMuted: dark ? '#8b949e' : '#65676b',
    btnBg: dark ? 'rgba(33,38,45,0.9)' : 'rgba(255,255,255,0.9)',
    btnBorder: dark ? 'rgba(48,54,61,0.8)' : 'rgba(208,215,222,0.8)',
    btnText: dark ? '#8b949e' : '#65676b',
  };
}

// ─── CSS injection ────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById('polymap-styles')) return;
  const style = document.createElement('style');
  style.id = 'polymap-styles';
  style.textContent = `
    .polymap-wrap { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .polymap-wrap svg { display: block; width: 100%; height: 100%; cursor: grab; }
    .polymap-wrap svg:active { cursor: grabbing; }
    .polymap-node { cursor: pointer; }
    .polymap-node:hover .pm-halo { opacity: 0.35 !important; }
    .polymap-node:hover .pm-ring { stroke-width: 3 !important; }

    .pm-info-panel {
      position: absolute;
      min-width: 200px;
      max-width: 280px;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid;
      pointer-events: auto;
      z-index: 100;
      transition: opacity 0.15s ease;
    }
    .pm-info-panel.hidden { opacity: 0; pointer-events: none; }
    .pm-info-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .pm-info-avatar {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #fff;
      background-size: cover; background-position: center;
      overflow: hidden;
    }
    .pm-info-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .pm-info-name { font-size: 15px; font-weight: 600; line-height: 1.2; }
    .pm-info-pronouns { font-size: 12px; margin-top: 1px; }
    .pm-info-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      font-size: 18px; line-height: 1; padding: 0 2px; opacity: 0.5;
      transition: opacity 0.1s;
    }
    .pm-info-close:hover { opacity: 1; }
    .pm-info-links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .pm-info-link {
      font-size: 12px; padding: 3px 9px; border-radius: 20px;
      border: 1px solid; text-decoration: none; opacity: 0.85;
      transition: opacity 0.1s;
    }
    .pm-info-link:hover { opacity: 1; }

    .pm-controls {
      position: absolute; top: 12px; right: 12px;
      display: flex; flex-direction: column; gap: 6px; z-index: 50;
    }
    .pm-btn {
      border: 1px solid; border-radius: 8px; padding: 6px 12px;
      font-size: 12px; cursor: pointer; backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px); transition: opacity 0.1s;
      white-space: nowrap;
    }
    .pm-btn:hover { opacity: 0.8; }

    .pm-legend {
      position: absolute; bottom: 12px; left: 12px; z-index: 50;
      border: 1px solid; border-radius: 10px; padding: 10px 14px;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      min-width: 160px;
    }
    .pm-legend.hidden { display: none; }
    .pm-legend-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .pm-legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-size: 12px; }
    .pm-legend-line { flex-shrink: 0; }
  `;
  document.head.appendChild(style);
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function init(container: HTMLElement, data: PolyculeData): void {
  injectStyles();

  let isDark = data.settings.theme !== 'light';
  let legendVisible = true;
  let labelsVisible = true;
  let namesVisible = true;
  let currentTransform: ZoomTransform = zoomIdentity;

  const wrap = document.createElement('div');
  wrap.className = 'polymap-wrap';
  container.appendChild(wrap);

  // ── Build node/link data ──────────────────────────────────────────────────

  const connectionCounts = new Map<string, number>();
  data.people.forEach(p => connectionCounts.set(p.id, 0));
  data.relationships.forEach(r => {
    connectionCounts.set(r.from, (connectionCounts.get(r.from) ?? 0) + 1);
    connectionCounts.set(r.to, (connectionCounts.get(r.to) ?? 0) + 1);
  });

  const nodeCount = data.people.length;
  const nodes: NodeDatum[] = data.people.map((p, i) => {
    const angle = (i / nodeCount) * 2 * Math.PI;
    const r = 220;
    return {
      ...p,
      x: 480 + Math.cos(angle) * r,
      y: 360 + Math.sin(angle) * r,
      vx: 0, vy: 0, fx: null, fy: null,
      connectionCount: connectionCounts.get(p.id) ?? 0,
    };
  });

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  const links: LinkDatum[] = data.relationships.map(r => ({
    source: nodeById.get(r.from)!,
    target: nodeById.get(r.to)!,
    relationship: r,
  }));

  function nodeRadius(d: NodeDatum): number {
    if (data.settings.nodeScale === 'connections') {
      return BASE_RADIUS + d.connectionCount * 4;
    }
    return BASE_RADIUS;
  }

  // ── SVG scaffold ─────────────────────────────────────────────────────────

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrap.appendChild(svgEl);
  const svg = select(svgEl);

  const defs = svg.append('defs');

  // Grid pattern
  const gridPat = defs.append('pattern')
    .attr('id', 'pm-grid')
    .attr('width', 40).attr('height', 40)
    .attr('patternUnits', 'userSpaceOnUse');
  gridPat.append('path')
    .attr('d', 'M 40 0 L 0 0 0 40')
    .attr('fill', 'none')
    .attr('class', 'pm-grid-path')
    .attr('stroke-width', '1');

  // Single clip path for all circular nodes (applied in local group space)
  defs.append('clipPath').attr('id', 'pm-node-clip')
    .append('circle').attr('r', BASE_RADIUS);

  // Glow filter for nodes
  const nodeGlow = defs.append('filter')
    .attr('id', 'pm-node-glow')
    .attr('x', '-60%').attr('y', '-60%')
    .attr('width', '220%').attr('height', '220%');
  nodeGlow.append('feGaussianBlur')
    .attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur');
  const nodeGlowMerge = nodeGlow.append('feMerge');
  nodeGlowMerge.append('feMergeNode').attr('in', 'blur');
  nodeGlowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Glow filter for edges
  const edgeGlow = defs.append('filter')
    .attr('id', 'pm-edge-glow')
    .attr('x', '-40%').attr('y', '-40%')
    .attr('width', '180%').attr('height', '180%');
  edgeGlow.append('feGaussianBlur')
    .attr('in', 'SourceGraphic').attr('stdDeviation', '2.5').attr('result', 'blur');
  const edgeGlowMerge = edgeGlow.append('feMerge');
  edgeGlowMerge.append('feMergeNode').attr('in', 'blur');
  edgeGlowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Background
  const bgRect = svg.append('rect')
    .attr('class', 'pm-bg')
    .attr('width', '100%').attr('height', '100%');

  // Grid overlay
  svg.append('rect')
    .attr('class', 'pm-grid-rect')
    .attr('width', '100%').attr('height', '100%')
    .attr('fill', 'url(#pm-grid)');

  // Main transform group (zoom target)
  const g = svg.append('g').attr('class', 'pm-graph-root');

  const edgeGroup = g.append('g').attr('class', 'pm-edges');
  const nodeGroup = g.append('g').attr('class', 'pm-nodes');

  // ── Render edges ─────────────────────────────────────────────────────────

  const edgeGs = edgeGroup.selectAll<SVGGElement, LinkDatum>('g.pm-edge')
    .data(links).join('g').attr('class', 'pm-edge');

  // Background line (for double-stroke style)
  const edgeBg = edgeGs.append('line')
    .attr('class', 'pm-edge-bg')
    .attr('stroke-linecap', 'round');

  const edgeLine = edgeGs.append('line')
    .attr('class', 'pm-edge-line')
    .attr('stroke-linecap', 'round');

  // Edge label group (rect + text)
  const edgeLabelG = edgeGs.append('g').attr('class', 'pm-edge-label');
  edgeLabelG.append('rect')
    .attr('rx', 4).attr('ry', 4)
    .attr('x', -28).attr('y', -8)
    .attr('width', 56).attr('height', 14);
  edgeLabelG.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('y', 0)
    .attr('font-size', '9')
    .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
    .attr('font-weight', '500');

  // Apply edge styles — set dynamic label rect width based on text length
  edgeGs.each(function(d) {
    const s = RELATIONSHIP_STYLES[d.relationship.type];
    const labelStr = d.relationship.label ?? s.label;
    const lw = Math.max(40, labelStr.length * 5.5 + 12);
    select(this).select('rect').attr('x', -lw / 2).attr('width', lw);

    const g = select(this);
    const bg = g.select<SVGLineElement>('.pm-edge-bg');
    const line = g.select<SVGLineElement>('.pm-edge-line');
    const labelG = g.select<SVGGElement>('.pm-edge-label');
    const labelText = labelG.select('text');

    if (s.double) {
      bg.attr('stroke-width', s.width * 2.6).style('visibility', 'visible');
    } else {
      bg.style('visibility', 'hidden');
    }

    line
      .attr('stroke', s.color)
      .attr('stroke-width', s.width)
      .attr('stroke-dasharray', s.dashArray || null)
      .attr('opacity', '0.85')
      .attr('filter', 'url(#pm-edge-glow)');

    labelText.text(labelStr).attr('fill', s.color);
  });

  // ── Render nodes ─────────────────────────────────────────────────────────

  const nodeGs = nodeGroup.selectAll<SVGGElement, NodeDatum>('g.polymap-node')
    .data(nodes).join('g')
    .attr('class', 'polymap-node')
    .attr('data-id', d => d.id);

  nodeGs.each(function(d) {
    const r = nodeRadius(d);
    const color = nodeColor(d.id, d.color);
    const g = select(this);

    // Outer halo glow
    g.append('circle')
      .attr('class', 'pm-halo')
      .attr('r', r + 10)
      .attr('fill', color)
      .attr('opacity', 0.15);

    if (d.photo) {
      // Clip path circle (large radius to accommodate scaled nodes)
      // We reuse pm-node-clip but with inline style override via foreignObject isn't needed —
      // the defs clip is fine for BASE_RADIUS. For connections-scaled nodes, append per-node clip.
      const clipId = `pm-clip-${d.id}`;
      select(svgEl).select('defs')
        .append('clipPath').attr('id', clipId)
        .append('circle').attr('r', r);

      g.append('image')
        .attr('href', d.photo)
        .attr('x', -r).attr('y', -r)
        .attr('width', r * 2).attr('height', r * 2)
        .attr('clip-path', `url(#${clipId})`)
        .attr('preserveAspectRatio', 'xMidYMid slice');
    } else {
      g.append('circle')
        .attr('r', r)
        .attr('fill', color)
        .attr('filter', 'url(#pm-node-glow)');
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', Math.round(r * 0.5))
        .attr('font-weight', '700')
        .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .attr('fill', '#ffffff')
        .attr('pointer-events', 'none')
        .text(initials(d.name));
    }

    // Border ring
    g.append('circle')
      .attr('class', 'pm-ring')
      .attr('r', r)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Name label background + text
    const labelY = r + LABEL_OFFSET;
    g.append('rect')
      .attr('class', 'pm-label-bg')
      .attr('rx', 4).attr('ry', 4)
      .attr('x', -36).attr('y', labelY - 9)
      .attr('width', 72).attr('height', 15);
    g.append('text')
      .attr('class', 'pm-label-text')
      .attr('text-anchor', 'middle')
      .attr('y', labelY)
      .attr('font-size', '11')
      .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
      .attr('pointer-events', 'none')
      .text(d.name);
  });

  // ── Simulation ────────────────────────────────────────────────────────────

  const simulation = forceSimulation<NodeDatum>(nodes)
    .force(
      'link',
      forceLink<NodeDatum, LinkDatum>(links)
        .id(d => d.id)
        .distance(170)
        .strength(0.5)
    )
    .force('charge', forceManyBody<NodeDatum>().strength(-500))
    .force('center', forceCenter(480, 360).strength(0.08))
    .force('collision', forceCollide<NodeDatum>(d => nodeRadius(d) + 24))
    .on('tick', ticked);

  function ticked() {
    edgeGs.each(function(d) {
      const g = select(this);
      const x1 = d.source.x, y1 = d.source.y;
      const x2 = d.target.x, y2 = d.target.y;
      g.select('.pm-edge-bg').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
      g.select('.pm-edge-line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
      g.select('.pm-edge-label').attr('transform', `translate(${(x1 + x2) / 2},${(y1 + y2) / 2})`);
    });
    nodeGs.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  let pinnedNode: NodeDatum | null = null;

  const dragBehavior = d3drag<SVGGElement, NodeDatum>()
    .on('start', (event, d) => {
      // Unpin any previously pinned node before pinning the new one
      if (pinnedNode && pinnedNode !== d) {
        pinnedNode.fx = null;
        pinnedNode.fy = null;
      }
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      pinnedNode = d;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event) => {
      if (!event.active) simulation.alphaTarget(0);
      // Node stays pinned until next drag or double-click
    });

  nodeGs.call(dragBehavior);

  // Double-click unpins the node
  nodeGs.on('dblclick', (event, d) => {
    event.stopPropagation();
    d.fx = null;
    d.fy = null;
    if (pinnedNode === d) pinnedNode = null;
    simulation.alphaTarget(0.1).restart();
  });

  // ── Zoom ─────────────────────────────────────────────────────────────────

  const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.05, 8])
    .filter(event => event.type !== 'dblclick')
    .on('zoom', event => {
      currentTransform = event.transform;
      g.attr('transform', event.transform.toString());
    });

  svg.call(zoomBehavior);
  svg.on('dblclick.zoom', null);

  // Click on background dismisses info panel
  svg.on('click', () => hideInfoPanel());

  // Stop click from propagating through SVG background to nodes
  nodeGs.on('click', (event, d) => {
    event.stopPropagation();
    showInfoPanel(d, event);
  });

  // ── Info panel ────────────────────────────────────────────────────────────

  const panel = document.createElement('div');
  panel.className = 'pm-info-panel hidden';
  wrap.appendChild(panel);

  function showInfoPanel(d: NodeDatum, event: MouseEvent) {
    const color = nodeColor(d.id, d.color);
    const c = getThemeColors(isDark);

    panel.style.background = c.panelBg;
    panel.style.borderColor = c.panelBorder;
    panel.style.color = c.panelText;

    const avatarHtml = d.photo
      ? `<img src="${escHtml(d.photo)}" alt="${escHtml(d.name)}"/>`
      : `<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color}">${escHtml(initials(d.name))}</span>`;

    const linksHtml = (d.links ?? []).length > 0
      ? `<div class="pm-info-links">${(d.links ?? []).map(l =>
          `<a class="pm-info-link" href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer"
             style="color:${color};border-color:${color}22">${escHtml(l.label)}</a>`
        ).join('')}</div>`
      : '';

    panel.innerHTML = `
      <div class="pm-info-header">
        <div class="pm-info-avatar" style="background:${color}">${avatarHtml}</div>
        <div>
          <div class="pm-info-name" style="color:${c.panelText}">${escHtml(d.name)}</div>
          ${d.pronouns ? `<div class="pm-info-pronouns" style="color:${c.panelMuted}">${escHtml(d.pronouns)}</div>` : ''}
        </div>
        <button class="pm-info-close" style="color:${c.panelText}" aria-label="Close">×</button>
      </div>
      ${linksHtml}
    `;

    panel.querySelector('.pm-info-close')?.addEventListener('click', hideInfoPanel);

    // Position near the node, clamped to viewport
    const wRect = wrap.getBoundingClientRect();
    const nx = currentTransform.applyX(d.x);
    const ny = currentTransform.applyY(d.y);
    const panelW = 240;
    const panelH = 120;
    let left = nx + 48;
    let top = ny - 40;
    if (left + panelW > wRect.width - 8) left = nx - panelW - 48;
    if (top + panelH > wRect.height - 8) top = wRect.height - panelH - 8;
    if (top < 8) top = 8;
    if (left < 8) left = 8;

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.classList.remove('hidden');
  }

  function hideInfoPanel() {
    panel.classList.add('hidden');
  }

  // ── Controls ─────────────────────────────────────────────────────────────

  const controls = document.createElement('div');
  controls.className = 'pm-controls';
  wrap.appendChild(controls);

  const themeBtn = document.createElement('button');
  themeBtn.className = 'pm-btn';
  themeBtn.title = 'Toggle dark/light mode';
  controls.appendChild(themeBtn);

  const legendBtn = document.createElement('button');
  legendBtn.className = 'pm-btn';
  legendBtn.textContent = 'Legend';
  legendBtn.title = 'Toggle legend';
  controls.appendChild(legendBtn);

  const labelsBtn = document.createElement('button');
  labelsBtn.className = 'pm-btn';
  labelsBtn.title = 'Toggle edge labels';
  controls.appendChild(labelsBtn);

  const namesBtn = document.createElement('button');
  namesBtn.className = 'pm-btn';
  namesBtn.title = 'Toggle node names';
  controls.appendChild(namesBtn);

  const fitBtn = document.createElement('button');
  fitBtn.className = 'pm-btn';
  fitBtn.textContent = '⊡ Fit';
  fitBtn.title = 'Fit graph to view';
  controls.appendChild(fitBtn);

  fitBtn.addEventListener('click', () => {
    const svgRect = svgEl.getBoundingClientRect();
    if (!svgRect.width) return;
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 80;
    const minY = Math.min(...ys) - 80;
    const maxX = Math.max(...xs) + 80;
    const maxY = Math.max(...ys) + 80;
    const w = maxX - minX;
    const h = maxY - minY;
    const scale = Math.min(0.9, Math.min(svgRect.width / w, svgRect.height / h));
    const tx = svgRect.width / 2 - scale * (minX + w / 2);
    const ty = svgRect.height / 2 - scale * (minY + h / 2);
    svg.transition().duration(500).call(
      zoomBehavior.transform,
      zoomIdentity.translate(tx, ty).scale(scale)
    );
  });

  // ── Legend ────────────────────────────────────────────────────────────────

  const legend = document.createElement('div');
  legend.className = 'pm-legend';
  wrap.appendChild(legend);

  // Build legend from relationship types present in this data
  const usedTypes = [...new Set(data.relationships.map(r => r.type))];

  function buildLegend(c: ReturnType<typeof getThemeColors>) {
    legend.style.background = c.legendBg;
    legend.style.borderColor = c.panelBorder;
    legend.style.color = c.panelText;

    const svgNS = 'http://www.w3.org/2000/svg';
    legend.innerHTML = `<div class="pm-legend-title" style="color:${c.panelMuted}">Relationships</div>` +
      usedTypes.map(type => {
        const s = RELATIONSHIP_STYLES[type];
        const dash = s.dashArray ? `stroke-dasharray="${s.dashArray}"` : '';
        const lineSvg = `<svg class="pm-legend-line" width="32" height="12" viewBox="0 0 32 12">
          ${s.double
            ? `<line x1="0" y1="6" x2="32" y2="6" stroke="${c.panelBg}" stroke-width="${s.width * 2.6}" stroke-linecap="round"/>
               <line x1="0" y1="6" x2="32" y2="6" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" ${dash}/>`
            : `<line x1="0" y1="6" x2="32" y2="6" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" ${dash}/>`
          }
        </svg>`;
        return `<div class="pm-legend-item" style="color:${c.panelText}">${lineSvg}<span>${s.label}</span></div>`;
      }).join('');
  }

  legendBtn.addEventListener('click', () => {
    legendVisible = !legendVisible;
    legend.classList.toggle('hidden', !legendVisible);
  });

  labelsBtn.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    edgeGs.selectAll<SVGGElement, LinkDatum>('.pm-edge-label')
      .style('display', labelsVisible ? null : 'none');
    applyTheme();
  });

  namesBtn.addEventListener('click', () => {
    namesVisible = !namesVisible;
    nodeGs.selectAll<SVGElement, NodeDatum>('.pm-label-bg, .pm-label-text')
      .style('display', namesVisible ? null : 'none');
    applyTheme();
  });

  // ── Theme application ─────────────────────────────────────────────────────

  function applyTheme() {
    const c = getThemeColors(isDark);

    // SVG background
    bgRect.attr('fill', c.bg);
    svg.selectAll<SVGPathElement, unknown>('.pm-grid-path').attr('stroke', c.grid);

    // Edge label backgrounds
    edgeGs.each(function(d) {
      const s = RELATIONSHIP_STYLES[d.relationship.type];
      select(this).select<SVGRectElement>('.pm-edge-label rect').attr('fill', c.edgeLabelBg);
      if (s.double) {
        select(this).select<SVGLineElement>('.pm-edge-bg').attr('stroke', c.bg);
      }
    });

    // Node label backgrounds + text
    nodeGs.each(function() {
      select(this).select<SVGRectElement>('.pm-label-bg').attr('fill', c.nodeLabelBg);
      select(this).select<SVGTextElement>('.pm-label-text').attr('fill', c.text);
    });

    // Controls + legend
    [themeBtn, legendBtn, labelsBtn, namesBtn, fitBtn].forEach(b => {
      b.style.background = c.btnBg;
      b.style.borderColor = c.btnBorder;
      b.style.color = c.btnText;
    });
    themeBtn.textContent = isDark ? '☀ Light' : '☾ Dark';
    labelsBtn.textContent = labelsVisible ? 'Labels On' : 'Labels Off';
    namesBtn.textContent = namesVisible ? 'Names On' : 'Names Off';

    buildLegend(c);
  }

  themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    applyTheme();
  });

  // Initial theme pass
  applyTheme();

  // Initial fit after simulation settles
  setTimeout(() => fitBtn.click(), 600);
}

// ─── Escape helper ────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Auto-init ────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  function tryInit() {
    const data = (window as Record<string, unknown>)['__POLYMAP_DATA__'] as PolyculeData | undefined;
    const container = document.getElementById('polymap-root');
    if (data && container) init(container, data);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
}
