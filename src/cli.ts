import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join, basename, extname } from 'path';
import { parseConfig } from './parser.js';
import { simulate } from './simulate.js';
import { generateSVG } from './exporters/svg.js';
import { generatePNG } from './exporters/png.js';
import { generateStandaloneHTML, generateEmbedJS } from './exporters/html.js';

const program = new Command();

program
  .name('polymap')
  .description('Generate interactive polycule relationship maps from YAML')
  .version('0.1.0');

program
  .command('generate <input>')
  .description('Generate map from a YAML config file')
  .option('-o, --output <dir>', 'output directory', '.')
  .option(
    '-f, --format <formats>',
    'comma-separated output formats: html,svg,png',
    'html,svg,png'
  )
  .option('-n, --name <prefix>', 'output filename prefix (default: input filename without extension)')
  .option('--width <pixels>', 'PNG output width in pixels', '1400')
  .option('--title <title>', 'HTML page title', 'Polycule Map')
  .option('--legend', 'render relationship legend on SVG/PNG exports', false)
  .option('--no-labels', 'hide edge label text on SVG/PNG exports')
  .option('--no-names', 'hide node name labels on SVG/PNG exports')
  .action(async (input: string, opts) => {
    const inputPath = resolve(input);
    const outputDir = resolve(opts.output as string);
    const formats = (opts.format as string).split(',').map(s => s.trim().toLowerCase());
    const prefix = (opts.name as string | undefined) ?? basename(inputPath, extname(inputPath));
    const pngWidth = parseInt(opts.width as string, 10) || 1400;
    const title = opts.title as string;
    const showLegend = Boolean(opts.legend);
    const showEdgeLabels = opts.labels !== false;
    const showNames = opts.names !== false;

    mkdirSync(outputDir, { recursive: true });

    let data;
    try {
      data = parseConfig(inputPath);
    } catch (err) {
      console.error(`Error parsing config: ${(err as Error).message}`);
      process.exit(1);
    }

    console.log(`Loaded ${data.people.length} people, ${data.relationships.length} relationships`);

    // Run force simulation for static exports
    const needsSimulation = formats.includes('svg') || formats.includes('png');
    let simResult: ReturnType<typeof simulate> | null = null;
    if (needsSimulation) {
      process.stdout.write('Running force simulation...');
      simResult = simulate(data);
      process.stdout.write(' done\n');
    }

    for (const fmt of formats) {
      switch (fmt) {
        case 'html': {
          const htmlPath = join(outputDir, `${prefix}.html`);
          const embedPath = join(outputDir, `${prefix}-embed.js`);
          writeFileSync(htmlPath, generateStandaloneHTML(data, { title }), 'utf8');
          writeFileSync(embedPath, generateEmbedJS(data), 'utf8');
          console.log(`HTML  → ${htmlPath}`);
          console.log(`Embed → ${embedPath}`);
          break;
        }

        case 'svg': {
          const svgPath = join(outputDir, `${prefix}.svg`);
          const svgStr = await generateSVG(data, simResult!.nodes, simResult!.links, { showLegend, showEdgeLabels, showNames });
          writeFileSync(svgPath, svgStr, 'utf8');
          console.log(`SVG   → ${svgPath}`);
          break;
        }

        case 'png': {
          const pngPath = join(outputDir, `${prefix}.png`);
          const pngBuf = await generatePNG(data, simResult!.nodes, simResult!.links, pngWidth, showLegend, showEdgeLabels, showNames);
          writeFileSync(pngPath, pngBuf);
          console.log(`PNG   → ${pngPath}`);
          break;
        }

        default:
          console.warn(`Unknown format "${fmt}" — skipping`);
      }
    }

    console.log('Done.');
  });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
