---
name: terminal-ascii-art
description: Colored terminal rendering with crossterm, Unicode glyph harmony, procedural pattern algorithms (Truchet, DLA, stepped frets, Aztec diamond, masonry), HSL palette generation, seed-deterministic themes. Trigger on terminal art, ascii art, crossterm color, unicode art, procedural patterns, glyph rendering, ANSI color, terminal palette.
license: MIT
metadata:
  audience: developers
  workflow: terminal-rendering
---

## What this covers

Patterns for building colored ASCII/Unicode art renderers in Rust using crossterm for ANSI escape output. Covers the Cell grid abstraction, color palette systems, and procedural generation algorithms for filling grids with structured visual patterns.

Reference implementation: `~/projects/ascii-renderer/`

## Colored grid rendering

### Cell type

Replace `Vec<Vec<char>>` with a colored grid:

```rust
use crossterm::style::Color;

struct Cell {
    ch: char,
    fg: Color,
    bg: Color,
}

type Grid = Vec<Vec<Cell>>;
```

Every drawing primitive takes a `Color` parameter. This is the foundational pattern -- without it, color is an afterthought bolted onto string manipulation.

### ANSI escape output

Terminal color works by embedding invisible escape sequences in the byte stream:

```
\x1b[38;2;R;G;Bm   set foreground to RGB
\x1b[48;2;R;G;Bm   set background to RGB
\x1b[0m             reset all formatting
```

Each color change costs ~20 bytes of escape overhead. **Run-length optimization** is critical: only emit new escape codes when the color changes from the previous cell.

```rust
fn render_grid(grid: &Grid) {
    let mut out = io::BufWriter::new(io::stdout().lock());
    let mut cur_fg = Color::Reset;

    for row in grid {
        for cell in row {
            if cell.fg != cur_fg {
                write!(out, "{}", SetForegroundColor(cell.fg)).unwrap();
                cur_fg = cell.fg;
            }
            write!(out, "{}", cell.ch).unwrap();
        }
        // reset bg at end of line to prevent bleeding into terminal padding
        writeln!(out).unwrap();
    }
    write!(out, "{}", ResetColor).unwrap();
    out.flush().unwrap();
}
```

Key: `BufWriter` wrapping stdout. Without it, every `write!` is a syscall.

### crossterm dependency

```toml
crossterm = "0.26"
```

Provides `Color::Rgb{r,g,b}`, `SetForegroundColor`, `SetBackgroundColor`, `ResetColor`. Thin wrapper over ANSI escape formatting with platform abstraction (Unix ANSI vs Windows console API).

## Palette generation

### Seed-deterministic HSL rotation

```rust
fn make_palette(seed: u64) -> [Color; 5] {
    let base_hue = (seed % 360) as f64;
    [
        hsl(base_hue, 0.3, 0.15),              // background (dark, muted)
        hsl((base_hue + 30.0) % 360.0, 0.6, 0.55),  // primary
        hsl((base_hue + 180.0) % 360.0, 0.5, 0.45), // secondary (complement)
        hsl((base_hue + 60.0) % 360.0, 0.7, 0.65),  // accent (bright)
        rgb(220, 220, 220),                     // text (near-white, fixed)
    ]
}
```

The hue offsets: +30 for analogous primary, +180 for complementary secondary, +60 for analogous accent. Every seed produces a visually distinct but harmonious palette.

### Named themes

Hand-tuned RGB values grouped by temperature:

| Theme | Category | Background | Character |
|-------|----------|-----------|-----------|
| ember | warm | near-black warm | burnt orange, dried blood, amber |
| terracotta | warm | dark earth | clay, sage, sand |
| sakura | warm | dark plum | cherry blossom, bark, petal pink |
| arctic | cool | deep night | ice blue, steel, frost |
| deep | cool | abyss | ocean blue, purple depth, bioluminescent |
| moss | cool | forest floor | moss green, dark fern, lichen |
| bone | mono | charcoal | bone, stone, ivory |
| silver | mono | gunmetal | silver, pewter, platinum |
| neon | vivid | void | electric green, hot pink, cyan |
| nerv | vivid | eva purple-black | nerv red, eva purple, warning orange |
| mitla | vivid | obsidian earth | gold stone, red clay, jade |

## Unicode glyph harmony rules

Empirical rules about which glyphs look good together. Discovered through iteration.

### Compatibility matrix

| Glyph class | Examples | Blends with | Clashes with |
|-------------|----------|-------------|-------------|
| Angular diagonals | `╱ ╲` | Angular crystals, box-drawing | Round glyphs |
| Angular crystals | `╳ ╬ ┼ ╪ ▪` | Diagonals, box-drawing | Round glyphs |
| Round glyphs | `○ ● ◆ ◈ ◇` | Other rounds (as accents) | Angular backgrounds |
| Braille | `⡷ ⣟ ⢿ ⣻ ⣿` | Nothing (reads as static) | Everything (use for dissolution) |
| Block elements | `█ ▓ ▒ ░` | Everything | Nothing (neutral fill) |
| Double box-drawing | `║ ═ ╔ ╗ ╚ ╝` | Single box (as contrast) | Use for borders/frames only |
| Single box-drawing | `│ ─ ┌ ┐ └ ┘` | Everything structural | Fine everywhere |

### Rules of thumb

1. **Angular + angular = good.** Truchet diagonals blend with box-drawing and angular crystals.
2. **Round + angular = bad.** Circle glyphs work as isolated accents (flower centers) but not as fill over angular backgrounds.
3. **Braille = corruption zones.** So visually dense they read as "glitch." Use at dissolution boundaries only.
4. **Block elements are neutral.** No directional bias, blend with anything. Good for backgrounds.
5. **Double-line = heavy/structural.** Use for outer frames. Single-line = light/organic, use for inner detail.
6. **Mixing single and double** creates visual hierarchy.

## Procedural pattern algorithms

### Truchet tiles

Simplest possible generative primitive. Two tiles (`╱` `╲`), coin flip per cell.

```rust
grid[y][x] = if rng.random() { '╱' } else { '╲' };
```

Zero adjacency constraints, zero contradiction risk. 1 bit of information per cell produces emergent curving paths and enclosed regions. Works as background texture layer.

**Computational cost**: O(w*h), one random call per cell.

### Stepped fret (xicalcoliuhqui)

Rectangular spiral where each successive loop tightens by 1 cell. Turtle walk with 90-degree turns.

**Arm length sequence**: `n, n, n-1, n-1, n-2, n-2, ..., 1, 1`

Each length appears twice because two 90-degree turns complete one side of the rectangle, and two adjacent sides share the same dimension before the spiral shrinks.

```rust
let mut arms = Vec::new();
for i in (1..=steps).rev() {
    arms.push(i);  // horizontal arm
    arms.push(i);  // vertical arm (same length)
}
// walk: draw arm, place corner, turn right, repeat
```

Glyphs: `─ │` for arms, `┌ ┐ └ ┘` for corners.

**Historical context**: Mitla (Oaxaca) walls have 100,000+ individually carved stones in fret patterns. 6 base designs combined 3 at a time yield 100+ permutations. 5 steps per fret (possibly corresponding to 5 visible planets).

**Computational cost**: O(steps * arm_length), linear in border length.

### Aztec diamond (domino shuffling)

Iterative growth algorithm. Diamond of order n: cells where |x|+|y| <= n. Tiled by dominoes (1x2 or 2x1).

**Algorithm** (grow from order k to k+1):

1. **MOVE**: Each half-domino cell shifts 1 cell outward in its labeled direction (N up, S down, E right, W left). Cells move independently, splitting each domino.
2. **DESTROY**: Find collisions. After the move, legitimate domino halves are always 3 cells apart. Therefore ANY adjacent pair (S-above-N, E-left-of-W) in the post-move state is necessarily a collision from two dominoes that swapped through each other. Remove both.
3. **FILL**: Empty cells form disjoint 2x2 blocks. Randomly tile each with horizontal or vertical domino pair.

**Arctic circle phenomenon**: For large n, four frozen corners of regular brickwork emerge, surrounding a central temperate zone of randomness. The boundary converges to a circle of radius n/sqrt(2). The four frozen quadrants naturally map to four palette colors.

**Computational cost**: O(n^3) -- n shuffling steps, each touching O(n^2) cells.

### DLA (Diffusion-Limited Aggregation)

Particles random-walk and freeze on contact with existing cluster. Produces fractal dendritic crystal growth.

Key tuning: **spawn particles near the existing cluster**, not from canvas edges. Edge spawning wastes walk steps in empty space. Distance-from-seed determines glyph zone (structural core, geometric mid, braille dissolution at far edges).

**Computational cost**: O(particles * max_steps). The expensive primitive. 3000 particles * 2000 steps = 6M random walks.

### GRIS-style binary trees

Queue-based binary recursive split. Box-drawing curves at branch points, flat canopy line, branch spread halves with depth.

Color strategy: lighten the branch color at each depth level. Trunk is darkest, tips are lightest. `lighten(color, depth * 20)` where lighten adds to each RGB channel.

### Masonry bond patterns (designed, not yet implemented)

Background texture fills. Running bond (half-brick offset per row), herringbone (checkerboard of horizontal/vertical dominoes), basket weave, random bond (Nebos algorithm: force stretchers to break long perpend runs).

## Primitive roles

| Role | Best primitive | Why |
|------|---------------|-----|
| Background texture | Truchet, masonry | Low visual weight, fills uniformly |
| Border decoration | Stepped fret | Structured, repeating, bounded |
| Organic fill | DLA, Aztec diamond temperate zone | Fractal/random, high visual interest |
| Structural accent | Binary trees | Anchor the eye, occupy significant space |
| Point accent | Flower stamps | Small, high contrast, rhythm markers |
| Content frame | Box-drawing rectangles | Clear boundary for readable text |

## References

- crossterm crate: ANSI terminal control for Rust
- [Aztec Diamond algorithm (UC Louvain)](https://sites.uclouvain.be/aztecdiamond/algorithm/)
- [Xicalcoliuhqui (Wikipedia)](https://en.wikipedia.org/wiki/Xicalcoliuhqui)
- [Mitla stepped-fret mosaics](https://uncoveredhistory.com/mexico/mitla-the-mysterious-stepped-fret-mosaics/)
- [ASCII Automata v2](https://hlnet.neocities.org/ascii-automata) -- edge-matching glyph propagation
- Full reference: `~/projects/ascii-renderer/RESEARCH.md`
