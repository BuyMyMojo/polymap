export type RelationshipType =
  | 'primary_partner'
  | 'partner'
  | 'nesting_partner'
  | 'anchor_partner'
  | 'fwb'
  | 'casual'
  | 'queerplatonic'
  | 'comet'
  | 'friend'
  | 'metamour'
  | 'tbd';

export interface PersonLink {
  label: string;
  url: string;
}

export interface Person {
  id: string;
  name: string;
  pronouns?: string;
  photo?: string;
  color?: string;
  links?: PersonLink[];
}

export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  label?: string;
}

export interface Settings {
  theme: 'dark' | 'light';
  nodeScale: 'uniform' | 'connections';
  mainNode?: string;
}

export interface PolyculeData {
  settings: Settings;
  people: Person[];
  relationships: Relationship[];
}
