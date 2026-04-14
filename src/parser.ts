import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import type { PolyculeData, Settings, Person, Relationship, RelationshipType } from './types.js';

const VALID_TYPES = new Set<RelationshipType>([
  'primary_partner', 'partner', 'nesting_partner', 'anchor_partner', 'fwb', 'casual',
  'unlabeled', 'queerplatonic', 'comet', 'friend', 'metamour', 'tbd',
]);

export function parseConfig(filePath: string): PolyculeData {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(`Cannot read file: ${filePath}`);
  }

  const data = load(raw) as Record<string, unknown>;
  if (!data || typeof data !== 'object') throw new Error('Config must be a YAML object');
  if (!Array.isArray(data['people'])) throw new Error('"people" must be an array');
  if (!Array.isArray(data['relationships'])) throw new Error('"relationships" must be an array');

  const s = data['settings'] as Record<string, unknown> | undefined;
  const settings: Settings = {
    theme: s?.['theme'] === 'light' ? 'light' : 'dark',
    nodeScale: s?.['nodeScale'] === 'connections' ? 'connections' : 'uniform',
    // mainNode validated below once person IDs are known
  };

  const people: Person[] = (data['people'] as unknown[]).map((p, i) => {
    const person = p as Record<string, unknown>;
    if (!person?.['id']) throw new Error(`Person[${i}] missing "id"`);
    if (!person?.['name']) throw new Error(`Person "${person['id']}" missing "name"`);
    return {
      id: String(person['id']),
      name: String(person['name']),
      pronouns: person['pronouns'] != null ? String(person['pronouns']) : undefined,
      photo: person['photo'] != null ? String(person['photo']) : undefined,
      color: person['color'] != null ? String(person['color']) : undefined,
      links: Array.isArray(person['links'])
        ? (person['links'] as Record<string, unknown>[]).map(l => ({
            label: String(l['label']),
            url: String(l['url']),
          }))
        : [],
    };
  });

  const ids = new Set(people.map(p => p.id));

  const mainNodeRaw = s?.['mainNode'] != null ? String(s['mainNode']) : undefined;
  if (mainNodeRaw !== undefined) {
    if (!ids.has(mainNodeRaw)) throw new Error(`settings.mainNode "${mainNodeRaw}" is not a valid person id`);
    settings.mainNode = mainNodeRaw;
  }

  const relationships: Relationship[] = (data['relationships'] as unknown[]).map((r, i) => {
    const rel = r as Record<string, unknown>;
    if (!rel?.['from']) throw new Error(`Relationship[${i}] missing "from"`);
    if (!rel?.['to']) throw new Error(`Relationship[${i}] missing "to"`);
    if (!rel?.['type']) throw new Error(`Relationship[${i}] missing "type"`);
    const type = rel['type'] as string;
    if (!VALID_TYPES.has(type as RelationshipType)) {
      throw new Error(
        `Relationship[${i}] invalid type "${type}". Valid: ${[...VALID_TYPES].join(', ')}`
      );
    }
    const from = String(rel['from']);
    const to = String(rel['to']);
    if (!ids.has(from)) throw new Error(`Unknown person "${from}"`);
    if (!ids.has(to)) throw new Error(`Unknown person "${to}"`);
    return {
      from,
      to,
      type: type as RelationshipType,
      label: rel['label'] != null ? String(rel['label']) : undefined,
    };
  });

  return { settings, people, relationships };
}
