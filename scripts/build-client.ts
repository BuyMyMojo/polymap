/**
 * Bundles src/client/graph.ts for browser use (IIFE, minified),
 * then writes the result as a TypeScript string constant to
 * src/generated/client-bundle.ts so the CLI can inline it into HTML output.
 *
 * Run: npx tsx scripts/build-client.ts
 */
import { buildSync } from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const root = resolve(process.cwd());

const result = buildSync({
  entryPoints: [resolve(root, 'src/client/graph.ts')],
  bundle: true,
  format: 'iife',
  globalName: '_PM',
  minify: true,
  platform: 'browser',
  target: ['es2017'],
  write: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'warning',
});

if (result.errors.length > 0) {
  console.error('Client bundle errors:', result.errors);
  process.exit(1);
}

const bundle = result.outputFiles[0].text;

const output = `// AUTO-GENERATED — do not edit manually.
// Regenerate with: npm run build:client
export const CLIENT_BUNDLE = ${JSON.stringify(bundle)};
`;

mkdirSync(resolve(root, 'src/generated'), { recursive: true });
writeFileSync(resolve(root, 'src/generated/client-bundle.ts'), output, 'utf8');

console.log(`✓ Client bundle: ${(bundle.length / 1024).toFixed(1)} kB → src/generated/client-bundle.ts`);
