import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import type { PolyculeData } from '../types.js';
import type { SimNode, SimLink } from '../simulate.js';
import { generateSVG } from './svg.js';
import { NODE_RADIUS } from '../simulate.js';

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_RETRIES = 2;
/** Render at 3× the base node diameter for crisp output */
const CROP_SIZE = NODE_RADIUS * 2 * 3;

/**
 * Fetch an image URL and convert it to a circular-cropped PNG data URI.
 * Uses sharp to handle any input format (JPEG, WebP, AVIF, PNG, …) and
 * applies a circle alpha mask so no SVG clipPath is needed in resvg.
 */
async function fetchCircularPng(url: string): Promise<string | null> {
  let rawBuf: Buffer | null = null;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        if (attempt < FETCH_RETRIES) continue;
        return null;
      }
      rawBuf = Buffer.from(await res.arrayBuffer());
      break;
    } catch (err) {
      clearTimeout(timer);
      const reason = err instanceof Error ? err.message : String(err);
      if (attempt < FETCH_RETRIES) {
        process.stderr.write(`  Retry ${attempt}/${FETCH_RETRIES - 1} for ${url} (${reason})\n`);
        continue;
      }
      return null;
    }
  }

  if (!rawBuf) return null;

  try {
    // SVG circle mask — white fill inside circle, transparent outside
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${CROP_SIZE}" height="${CROP_SIZE}">` +
      `<circle cx="${CROP_SIZE / 2}" cy="${CROP_SIZE / 2}" r="${CROP_SIZE / 2}" fill="white"/>` +
      `</svg>`
    );

    const png = await sharp(rawBuf)
      .resize(CROP_SIZE, CROP_SIZE, { fit: 'cover', position: 'centre' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    process.stderr.write(`  Warning: could not process image ${url}: ${err}\n`);
    return null;
  }
}

export async function generatePNG(
  data: PolyculeData,
  nodes: SimNode[],
  links: SimLink[],
  outputWidth = 1400,
  showLegend = false,
  showEdgeLabels = true,
  showNames = true
): Promise<Buffer> {
  const photoNodes = nodes.filter(n => n.photo);

  if (photoNodes.length > 0) {
    process.stdout.write(`Fetching ${photoNodes.length} profile image(s)...`);
  }

  const embedImages = new Map<string, string>();
  for (const node of photoNodes) {
    const uri = await fetchCircularPng(node.photo!);
    if (uri) {
      embedImages.set(node.id, uri);
    } else {
      process.stderr.write(
        `\n  Warning: could not load photo for "${node.name}" (${node.photo}) — using initials fallback\n`
      );
    }
  }

  if (photoNodes.length > 0) {
    process.stdout.write(` ${embedImages.size}/${photoNodes.length} loaded\n`);
  }

  const failedIds = new Set(
    photoNodes.filter(n => !embedImages.has(n.id)).map(n => n.id)
  );

  const svgStr = await generateSVG(data, nodes, links, {
    embedImages,
    failedIds,
    preCropped: true,
    showLegend,
    showEdgeLabels,
    showNames,
  });

  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: outputWidth },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}
