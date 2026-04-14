# polymap

Generate interactive polycule relationship maps from a YAML config file.

Outputs a self-contained interactive HTML page, an embeddable JS snippet, a static SVG, and a PNG image.

## Requirements

- Node.js 18+

## Setup

```bash
npm install
npm run build
```

## Usage

```bash
node dist/cli.js generate <input.yaml> [options]
```

### Options

| Flag | Default | Description |
|---|---|---|
| `-o, --output <dir>` | `.` | Output directory |
| `-f, --format <list>` | `html,svg,png` | Comma-separated formats to generate |
| `-n, --name <prefix>` | input filename | Output filename prefix |
| `--width <px>` | `1400` | PNG output width in pixels |
| `--title <title>` | `Polycule Map` | HTML page title |

### Examples

```bash
# Generate all formats
node dist/cli.js generate polycule.yaml --output ./out

# HTML only, custom name
node dist/cli.js generate polycule.yaml --output ./out --format html --name my-polycule

# PNG only, higher resolution
node dist/cli.js generate polycule.yaml --output ./out --format png --width 2400
```

## Config file format

```yaml
settings:
  theme: dark          # dark | light
  nodeScale: uniform   # uniform | connections (scales node size by number of relationships)

people:
  - id: alice                        # unique identifier used in relationships
    name: Alice                      # display name
    pronouns: she/her                # optional
    photo: "https://example.com/alice.jpg"  # optional, URL to profile picture
    color: "#e91e8c"                 # optional, overrides auto-assigned colour
    links:
      - label: Instagram
        url: "https://instagram.com/alice"
      - label: Website
        url: "https://alice.me"

relationships:
  - from: alice
    to: bob
    type: partner
    label: "since 2021"   # optional, overrides the default type label on the edge
```

### Relationship types

| Type | Line style |
|---|---|
| `partner` | Solid, pink |
| `nesting_partner` | Double line, red |
| `anchor_partner` | Dashed thick, dark red |
| `fwb` | Dashed, purple |
| `casual` | Dotted, cyan |
| `queerplatonic` | Dash-dot, teal |
| `comet` | Long dash, grey |
| `friend` | Solid thin, light blue |
| `metamour` | Faint dotted, dark grey |

## Embedding in a website

Two files are generated for the `html` format:

**Standalone page** (`polycule.html`) — open directly in a browser or host as-is. Can also be embedded via `<iframe>`.

**Embed script** (`polycule-embed.js`) — drop into any existing page:

```html
<div id="polymap-root" style="width: 100%; height: 600px;"></div>
<script src="polycule-embed.js"></script>
```

No framework required. Works in any HTML page.

## Interactive controls

- **Drag** a node to reposition it (pins in place)
- **Double-click** a pinned node to release it back into the simulation
- **Scroll / pinch** to zoom
- **Click and drag** the background to pan
- **Click** a node to open an info panel with name, pronouns, and links
- **☀ Light / ☾ Dark** button — toggle theme
- **Legend** button — show/hide relationship type key
- **⊡ Fit** button — fit the whole graph into view

## Development

```bash
# Run CLI directly without building (requires tsx)
npx tsx src/cli.ts generate example.yaml --output ./out

# Rebuild client bundle only (after editing src/client/graph.ts)
npm run build:client

# Rebuild CLI only (after editing anything except src/client/)
npm run build:cli
```
