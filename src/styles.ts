import type { RelationshipType } from './types.js';

export interface RelationshipStyle {
  color: string;
  width: number;
  dashArray: string;
  label: string;
  double?: boolean;
}

export const RELATIONSHIP_STYLES: Record<RelationshipType, RelationshipStyle> = {
  primary_partner: {
    color: '#f1c40f',
    width: 4,
    dashArray: '',
    label: 'Primary Partners',
  },
  partner: {
    color: '#ff6b9d',
    width: 3,
    dashArray: '',
    label: 'Partners',
  },
  nesting_partner: {
    color: '#ff4757',
    width: 3,
    dashArray: '',
    label: 'Nesting Partners',
    double: true,
  },
  anchor_partner: {
    color: '#c0392b',
    width: 4,
    dashArray: '10,4',
    label: 'Anchor Partners',
  },
  fwb: {
    color: '#a55eea',
    width: 2.5,
    dashArray: '8,4',
    label: 'Friends with Benefits',
  },
  casual: {
    color: '#45aaf2',
    width: 2,
    dashArray: '3,5',
    label: 'Casual',
  },
  queerplatonic: {
    color: '#26de81',
    width: 2,
    dashArray: '12,3,3,3',
    label: 'Queerplatonic',
  },
  comet: {
    color: '#a5b1c2',
    width: 1.5,
    dashArray: '18,8',
    label: 'Comet',
  },
  friend: {
    color: '#4fc3f7',
    width: 1.5,
    dashArray: '',
    label: 'Friends',
  },
  metamour: {
    color: '#546e7a',
    width: 1,
    dashArray: '4,6',
    label: 'Metamour',
  },
  tbd: {
    color: '#78909c',
    width: 1.5,
    dashArray: '6,3,2,3',
    label: 'TBD',
  },
};

const PALETTE = [
  '#e91e8c', '#9c27b0', '#3f51b5', '#2196f3', '#009688',
  '#4caf50', '#ff9800', '#f44336', '#00bcd4', '#8bc34a',
];

export function nodeColor(id: string, explicit?: string): string {
  if (explicit) return explicit;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}
