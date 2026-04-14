import type { PolyculeData } from '../types.js';
import type { SimNode, SimLink } from '../simulate.js';
import { RELATIONSHIP_STYLES, nodeColor, initials } from '../styles.js';

const PADDING = 90;
const LABEL_OFFSET = 16;

export interface SvgOptions {
  /** Replace photo URLs with base64 data URIs for offline/PNG rendering */
  embedImages?: Map<string, string>;
  /** Node IDs whose photo fetch failed — render initials instead */
  failedIds?: Set<string>;
  /**
   * Images in embedImages are pre-cropped circular PNGs (transparent outside circle).
   * When true: skip SVG clipPath entirely — just embed image directly.
   * Required for resvg, which silently drops unsupported image formats and has
   * inconsistent clipPath-on-image support.
   */
  preCropped?: boolean;
  /** Render a relationship-type legend in the bottom-left corner */
  showLegend?: boolean;
  /** Show edge label text (default true) */
  showEdgeLabels?: boolean;
  /** Show node name labels (default true) */
  showNames?: boolean;
}

export async function generateSVG(
  data: PolyculeData,
  nodes: SimNode[],
  links: SimLink[],
  opts: SvgOptions = {}
): Promise<string> {
  const dark = data.settings.theme === 'dark';
  const bg = dark ? '#0d1117' : '#f0f4f8';
  const grid = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)';
  const textColor = dark ? '#e6edf3' : '#1c1e21';
  const nodeLabelBg = dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
  const edgeLabelBg = dark ? 'rgba(13,17,23,0.75)' : 'rgba(240,244,248,0.8)';

  // Compute viewBox from node positions
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxX = Math.max(...xs) + PADDING;
  const maxY = Math.max(...ys) + PADDING;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`);
  lines.push(`     viewBox="${minX} ${minY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">`);

  // ── Defs ──────────────────────────────────────────────────────────────────

  lines.push('<defs>');

  // Grid pattern
  lines.push(`  <pattern id="pm-grid" width="40" height="40" patternUnits="userSpaceOnUse">`);
  lines.push(`    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${grid}" stroke-width="1"/>`);
  lines.push(`  </pattern>`);

  // Glow filters
  lines.push(`  <filter id="pm-node-glow" x="-60%" y="-60%" width="220%" height="220%">`);
  lines.push(`    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>`);
  lines.push(`    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`);
  lines.push(`  </filter>`);
  lines.push(`  <filter id="pm-edge-glow" x="-40%" y="-40%" width="180%" height="180%">`);
  lines.push(`    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>`);
  lines.push(`    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`);
  lines.push(`  </filter>`);

  // Per-node clip paths for photos — not needed when images are pre-cropped
  for (const node of nodes) {
    if (!opts.preCropped && node.photo && !opts.failedIds?.has(node.id)) {
      const r = BASE_R(data, node);
      lines.push(`  <clipPath id="pm-clip-${esc(node.id)}">`);
      lines.push(`    <circle cx="${node.x}" cy="${node.y}" r="${r}"/>`);
      lines.push(`  </clipPath>`);
    }
  }

  lines.push('</defs>');

  // ── Background ────────────────────────────────────────────────────────────

  lines.push(`<rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="${bg}"/>`);
  lines.push(`<rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="url(#pm-grid)"/>`);

  // ── Edges ─────────────────────────────────────────────────────────────────

  lines.push('<g class="edges">');
  for (const link of links) {
    const s = RELATIONSHIP_STYLES[link.relationship.type];
    const x1 = link.source.x, y1 = link.source.y;
    const x2 = link.target.x, y2 = link.target.y;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

    if (s.double) {
      lines.push(`  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`);
      lines.push(`        stroke="${bg}" stroke-width="${s.width * 2.6}" stroke-linecap="round"/>`);
    }

    const dash = s.dashArray ? ` stroke-dasharray="${s.dashArray}"` : '';
    lines.push(`  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`);
    lines.push(`        stroke="${s.color}" stroke-width="${s.width}"${dash}`);
    lines.push(`        stroke-linecap="round" opacity="0.85" filter="url(#pm-edge-glow)"/>`);

    if (opts.showEdgeLabels !== false) {
      const labelText = link.relationship.label ?? s.label;
      const lw = Math.max(40, labelText.length * 5.5 + 12);
      lines.push(`  <rect x="${mx - lw / 2}" y="${my - 7}" width="${lw}" height="13" rx="4" fill="${edgeLabelBg}"/>`);
      lines.push(`  <text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="9"`);
      lines.push(`        font-family="system-ui, sans-serif" font-weight="500" fill="${s.color}">`);
      lines.push(`    ${esc(labelText)}`);
      lines.push(`  </text>`);
    }
  }
  lines.push('</g>');

  // ── Nodes ─────────────────────────────────────────────────────────────────

  lines.push('<g class="nodes">');
  for (const node of nodes) {
    const r = BASE_R(data, node);
    const color = nodeColor(node.id, node.color);
    const inits = initials(node.name);
    const labelY = node.y + r + LABEL_OFFSET;

    // Halo
    lines.push(`  <circle cx="${node.x}" cy="${node.y}" r="${r + 10}" fill="${color}" opacity="0.15"/>`);

    // Use photo if available and not in the failed-fetch set
    const usePhoto = node.photo && !opts.failedIds?.has(node.id);
    if (usePhoto) {
      const href = opts.embedImages?.get(node.id) ?? node.photo!;
      if (opts.preCropped) {
        // Image already cropped to circle with transparent bg — embed directly, no clipPath
        lines.push(`  <image href="${esc(href)}" x="${node.x - r}" y="${node.y - r}"`);
        lines.push(`         width="${r * 2}" height="${r * 2}"/>`);
      } else {
        // Browser/SVG export: use clipPath for circular crop
        lines.push(`  <image href="${esc(href)}" x="${node.x - r}" y="${node.y - r}"`);
        lines.push(`         width="${r * 2}" height="${r * 2}"`);
        lines.push(`         clip-path="url(#pm-clip-${esc(node.id)})" preserveAspectRatio="xMidYMid slice"/>`);
      }
      lines.push(`  <circle cx="${node.x}" cy="${node.y}" r="${r}" fill="none"`);
      lines.push(`          stroke="${color}" stroke-width="2" opacity="0.9"/>`);
    } else {
      lines.push(`  <circle cx="${node.x}" cy="${node.y}" r="${r}" fill="${color}" filter="url(#pm-node-glow)"/>`);
      lines.push(`  <text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="central"`);
      lines.push(`        font-size="${Math.round(r * 0.5)}" font-weight="700"`);
      lines.push(`        font-family="system-ui, sans-serif" fill="white">${esc(inits)}</text>`);
    }

    if (opts.showNames !== false) {
      const nw = Math.max(40, node.name.length * 6.5 + 12);
      lines.push(`  <rect x="${node.x - nw / 2}" y="${labelY - 9}" width="${nw}" height="15" rx="4" fill="${nodeLabelBg}"/>`);
      lines.push(`  <text x="${node.x}" y="${labelY}" text-anchor="middle" font-size="11"`);
      lines.push(`        font-family="system-ui, sans-serif" fill="${textColor}">${esc(node.name)}</text>`);
    }
  }
  lines.push('</g>');

  // ── Legend ───────────────────────────────────────────────────────────────

  if (opts.showLegend) {
    const usedTypes = [...new Set(data.relationships.map(r => r.type))];
    const ROW_H = 20;
    const PAD = 12;
    const LINE_W = 32;
    const TEXT_X = LINE_W + 10;
    const legendW = 185;
    const titleH = 22;
    const legendH = titleH + usedTypes.length * ROW_H + PAD;
    const legendX = minX + PAD;
    const legendY = minY + vbH - legendH - PAD;
    const legendBg = dark ? 'rgba(13,17,23,0.45)' : 'rgba(255,255,255,0.5)';
    const titleColor = dark ? '#8b949e' : '#65676b';

    lines.push(`<g class="pm-legend" transform="translate(${legendX},${legendY})">`);
    lines.push(`  <rect width="${legendW}" height="${legendH}" rx="8" fill="${legendBg}"/>`);
    lines.push(`  <text x="${PAD}" y="${PAD + 8}" font-size="10" font-weight="600"`);
    lines.push(`        font-family="system-ui, sans-serif" fill="${titleColor}"`);
    lines.push(`        letter-spacing="0.05em">RELATIONSHIPS</text>`);

    usedTypes.forEach((type, i) => {
      const s = RELATIONSHIP_STYLES[type];
      const rowY = titleH + i * ROW_H;
      const lineY = rowY + ROW_H / 2;
      const dash = s.dashArray ? ` stroke-dasharray="${s.dashArray}"` : '';

      lines.push(`  <g transform="translate(${PAD},0)">`);
      if (s.double) {
        lines.push(`    <line x1="0" y1="${lineY}" x2="${LINE_W}" y2="${lineY}" stroke="${legendBg}" stroke-width="${s.width * 2.6}" stroke-linecap="round"/>`);
      }
      lines.push(`    <line x1="0" y1="${lineY}" x2="${LINE_W}" y2="${lineY}" stroke="${s.color}" stroke-width="${s.width}"${dash} stroke-linecap="round"/>`);
      lines.push(`    <text x="${TEXT_X}" y="${lineY + 4}" font-size="11"`);
      lines.push(`          font-family="system-ui, sans-serif" fill="${textColor}">${esc(s.label)}</text>`);
      lines.push(`  </g>`);
    });

    lines.push('</g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

function BASE_R(data: PolyculeData, node: SimNode): number {
  if (data.settings.nodeScale === 'connections') {
    return 28 + node.connectionCount * 4;
  }
  return 28;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
