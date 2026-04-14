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

export function simulate(data: PolyculeData): { nodes: SimNode[]; links: SimLink[] } {
  const count = data.people.length;

  // Pre-compute connection counts for node scaling
  const connCount = new Map<string, number>();
  data.people.forEach(p => connCount.set(p.id, 0));
  data.relationships.forEach(r => {
    connCount.set(r.from, (connCount.get(r.from) ?? 0) + 1);
    connCount.set(r.to, (connCount.get(r.to) ?? 0) + 1);
  });

  // Deterministic circle layout as starting positions
  const nodes: SimNode[] = data.people.map((p, i) => {
    const angle = (i / count) * 2 * Math.PI;
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

  // Scale forces with graph size so denser graphs spread out properly
  const chargeStrength = -Math.max(800, count * 140);
  const linkDistance = Math.max(180, 140 + count * 10);

  const sim = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.35)
    )
    .force('charge', forceManyBody<SimNode>().strength(chargeStrength))
    .force('center', forceCenter(WIDTH / 2, HEIGHT / 2).strength(0.06))
    .force('collision', forceCollide<SimNode>(NODE_RADIUS + 40))
    // Lower alphaDecay → more ticks before cooling, gives layout more time to settle
    .alphaDecay(0.015)
    .stop();

  const iterations = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()));
  for (let i = 0; i < iterations; ++i) sim.tick();

  return { nodes, links };
}
