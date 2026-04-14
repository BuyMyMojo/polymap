import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { PolyculeData, Person, Relationship } from './types.js';

export interface SimNode extends SimulationNodeDatum, Person {
  x: number;
  y: number;
  connectionCount: number;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
  relationship: Relationship;
}

const WIDTH = 960;
const HEIGHT = 720;
export const NODE_RADIUS = 28;

/** Count edge crossings in the settled layout (lower = better) */
function countCrossings(links: SimLink[]): number {
  let count = 0;
  for (let i = 0; i < links.length - 1; i++) {
    for (let j = i + 1; j < links.length; j++) {
      const a = links[i].source, b = links[i].target;
      const c = links[j].source, d = links[j].target;
      // Edges sharing a node cannot cross
      if (a.id === c.id || a.id === d.id || b.id === c.id || b.id === d.id) continue;
      if (segmentsIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) count++;
    }
  }
  return count;
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false; // parallel / collinear
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * BFS order starting from `forcedStart` (if given) or the highest-degree node.
 * Places directly connected nodes consecutively on the initial circle so
 * the force simulation starts with fewer crossings to resolve.
 */
function bfsOrder(people: Person[], relationships: Relationship[], forcedStart?: string): Person[] {
  if (people.length === 0) return people;
  const adj = new Map<string, string[]>();
  people.forEach(p => adj.set(p.id, []));
  relationships.forEach(r => {
    adj.get(r.from)?.push(r.to);
    adj.get(r.to)?.push(r.from);
  });

  const startId = forcedStart ?? [...adj.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? people[0].id;
  const visited = new Set<string>();
  const queue = [startId];
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    // Enqueue neighbours highest-degree first so hubs stay clustered
    queue.push(
      ...(adj.get(id) ?? [])
        .filter(n => !visited.has(n))
        .sort((a, b) => (adj.get(b)?.length ?? 0) - (adj.get(a)?.length ?? 0)),
    );
  }

  const rank = new Map(order.map((id, i) => [id, i]));
  return [...people].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

function runOnce(
  orderedPeople: Person[],
  data: PolyculeData,
  connCount: Map<string, number>,
  startAngle: number,
  chargeStrength: number,
  linkDistance: number,
  mainNodeId?: string,
): { nodes: SimNode[]; links: SimLink[] } {
  const count = orderedPeople.length;
  // Non-main nodes distributed on circle; main node starts at center
  const nonMain = orderedPeople.filter(p => p.id !== mainNodeId);
  const nodes: SimNode[] = orderedPeople.map((p, i) => {
    if (p.id === mainNodeId) {
      return {
        ...p,
        x: WIDTH / 2,
        y: HEIGHT / 2,
        connectionCount: connCount.get(p.id) ?? 0,
      };
    }
    const circleIdx = nonMain.findIndex(n => n.id === p.id);
    const angle = startAngle + (circleIdx / Math.max(nonMain.length, 1)) * 2 * Math.PI;
    return {
      ...p,
      x: WIDTH / 2 + Math.cos(angle) * 220,
      y: HEIGHT / 2 + Math.sin(angle) * 220,
      connectionCount: connCount.get(p.id) ?? 0,
    };
  });

  const nodeById = new Map<string, SimNode>(nodes.map(n => [n.id, n]));
  const links: SimLink[] = data.relationships.map(r => ({
    source: nodeById.get(r.from)!,
    target: nodeById.get(r.to)!,
    relationship: r,
  }));

  // Pin main node at center for the entire simulation so others orbit around it
  const mainNode = mainNodeId ? nodeById.get(mainNodeId) : undefined;
  if (mainNode) {
    mainNode.fx = WIDTH / 2;
    mainNode.fy = HEIGHT / 2;
  }

  const sim = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.35),
    )
    .force('charge', forceManyBody<SimNode>().strength(chargeStrength))
    .force('center', forceCenter(WIDTH / 2, HEIGHT / 2).strength(0.06))
    .force('collision', forceCollide<SimNode>(NODE_RADIUS + 40))
    .alphaDecay(0.015)
    .stop();

  const iterations = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
  for (let i = 0; i < iterations; ++i) sim.tick();

  // Release pin — positions are baked in, no longer need fx/fy
  if (mainNode) {
    mainNode.fx = undefined;
    mainNode.fy = undefined;
  }

  return { nodes, links };
}

export function simulate(data: PolyculeData): { nodes: SimNode[]; links: SimLink[] } {
  const count = data.people.length;
  if (count === 0) return { nodes: [], links: [] };

  // Pre-compute connection counts for node scaling
  const connCount = new Map<string, number>();
  data.people.forEach(p => connCount.set(p.id, 0));
  data.relationships.forEach(r => {
    connCount.set(r.from, (connCount.get(r.from) ?? 0) + 1);
    connCount.set(r.to, (connCount.get(r.to) ?? 0) + 1);
  });

  // Scale forces with graph size so denser graphs spread out properly
  const chargeStrength = -Math.max(800, count * 140);
  const linkDistance = Math.max(180, 140 + count * 10);

  const mainNodeId = data.settings.mainNode;

  // Three initial orderings × four circle rotations = up to 12 candidates.
  // Pick the settled layout with the fewest edge crossings.
  // When mainNode is set, always start BFS from it so its neighbours radiate outward.
  const orderings = [
    data.people,
    bfsOrder(data.people, data.relationships, mainNodeId),
    [...data.people].sort((a, b) => (connCount.get(b.id) ?? 0) - (connCount.get(a.id) ?? 0)),
  ];
  const ROTATIONS = 4;

  let best: { nodes: SimNode[]; links: SimLink[]; crossings: number } | null = null;

  outer:
  for (const ordering of orderings) {
    for (let r = 0; r < ROTATIONS; r++) {
      const startAngle = (r / ROTATIONS) * 2 * Math.PI;
      const result = runOnce(ordering, data, connCount, startAngle, chargeStrength, linkDistance, mainNodeId);
      const crossings = countCrossings(result.links);
      if (!best || crossings < best.crossings) {
        best = { ...result, crossings };
        if (crossings === 0) break outer; // perfect layout — stop early
      }
    }
  }

  return { nodes: best!.nodes, links: best!.links };
}
