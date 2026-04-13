---
name: unicode-terminal-art
description: Unicode character palettes for terminal/TUI art -- block elements, box drawing, geometric shapes, braille patterns, sextants, rendering techniques
trigger: unicode terminal art, utf8 graphics, terminal drawing characters, box drawing, block elements, braille art, TUI borders, unicode triangles, geometric shapes unicode, character cell graphics, half-block rendering, sextant characters
---

# Unicode Terminal Art -- Character Palette & Techniques

## Block Elements (U+2580-U+259F)

### Eighth Blocks
Vertical: `▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▔`
Horizontal: `▏ ▎ ▍ ▌ ▋ ▊ ▉ █ ▐ ▕`

### Half Blocks
`▀ ▄ ▌ ▐`

Core technique: set fg = one pixel, bg = other. Each cell = 2 independently colored pixels. Foundation of most terminal image renderers.

### Quadrant Blocks (2x2 sub-cell)
```
▘ ▝ ▖ ▗   single: UL, UR, LL, LR
▚ ▞       diagonal: UL+LR, UR+LL
▙ ▛ ▜ ▟   three-quadrant
```
16 possible states per cell. Missing combos covered by half-blocks.

### Shading
`░ ▒ ▓ █` (25% / 50% / 75% / 100%)

---

## Box Drawing (U+2500-U+257F)

Light: `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`
Heavy: `━ ┃ ┏ ┓ ┗ ┛ ┣ ┫ ┳ ┻ ╋`
Double: `═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬`
Rounded: `╭ ╮ ╰ ╯`
Diagonals: `╱ ╲ ╳`

### Dashed
```
┄ ┅  triple dash h (light/heavy)    ┆ ┇  triple dash v
┈ ┉  quadruple dash h               ┊ ┋  quadruple dash v
╌ ╍  double dash h                  ╎ ╏  double dash v
```

### Half Lines (stubs)
Light: `╴ ╵ ╶ ╷`  Heavy: `╸ ╹ ╺ ╻`

### Mixed Weight
`╼ ╾ ╽ ╿` (light-to-heavy transitions)

### Mixed Single/Double Corners
`╒ ╕ ╘ ╛` single vert + double horiz
`╓ ╖ ╙ ╜` double vert + single horiz

---

## Geometric Shapes -- Triangles

### Solid Pointing (3 sizes)
Full: `▲ ▼ ◀ ▶`  Small: `▴ ▾ ◂ ▸`  Medium: `⯅ ⯆ ⯇ ⯈`

### Outline Pointing
Full: `△ ▽ ◁ ▷`  Small: `▵ ▿ ◃ ▹`

### Corner/Quarter Triangles (KEY for tiling)
Filled: `◤ ◥ ◣ ◢`  Outline: `◸ ◹ ◺ ◿`

These naturally compose into angular borders, corner motifs, and diagonal edges.

### Special
`◬` dotted, `◭` left-half black, `◮` right-half black, `⊿` right triangle

### Canadian Syllabics (underused geometric forms)
`ᐃ ᐁ ᐅ ᐊ` and `ᐱ ᐯ ᐳ ᐸ` -- clean triangles, well-rendered in most monospace fonts

### Math/Logic Wedges
`∆ ∇` increment/nabla, `∧ ∨` logical and/or, `⊲ ⊳` subgroup

---

## Geometric Shapes -- Other

Squares: `■ □ ▪ ▫ ◻ ◼ ◽ ◾ ▢ ▣`
Filled squares: `▤ ▥ ▦ ▧ ▨ ▩`
Half-filled: `◧ ◨ ◩ ◪ ◫ ◰ ◱ ◲ ◳`
Diamonds: `◆ ◇ ◈ ◊`
Circles: `● ○ ◉ ◌ ◍ ◎ ◦ ◯`
Half/quarter circles: `◐ ◑ ◒ ◓ ◔ ◕ ◖ ◗`
Arc quadrants: `◜ ◝ ◞ ◟ ◠ ◡`
Stars: `★ ☆ ✦ ✧ ✶ ✷ ✱ ✲ ✳ ✴`

---

## Corner & Bracket Decorations

```
⌜ ⌝ ⌞ ⌟   half-bracket corners
「 」 『 』   CJK corner brackets (fullwidth: 2 columns each)
﹁ ﹂ ﹃ ﹄   presentation form corners
⊢ ⊣ ⊤ ⊥    turnstile operators (T-shaped)
```

---

## Braille Patterns (U+2800-U+28FF)

256 chars. 2x4 dot grid = 8 pixels per cell.

```
Dot layout:     Bit values:
(1) (4)         0x01  0x08
(2) (5)         0x02  0x10
(3) (6)         0x04  0x20
(7) (8)         0x40  0x80
```

Codepoint = `U+2800 + bitmask`. Dots 1+2+5 = `0x01|0x02|0x10` = U+2813 = `⠓`

Key: `⠀` empty, `⣿` full, `⡇` left col, `⢸` right col, `⠉` top row, `⣀` bottom row

80x24 terminal = 160x96 effective pixel resolution.

---

## Sextant Characters (U+1FB00-U+1FB3B)

60 chars. 2x3 subgrid = 6 pixels per cell. Higher density than quadrants.

**Font support:** requires Cascadia Code, JetBrains Mono, Iosevka, or similar. Not universal yet.

---

## Smooth Mosaic / Diagonal Blocks (U+1FB3C-U+1FB67)

~38 chars for diagonal/wedge shapes. Smoother angled lines than rectangular blocks. Same font caveat as sextants.

---

## Large Symbol Construction (U+239B-U+23B3)

```
⎛ ⎜ ⎝  /  ⎞ ⎟ ⎠   parenthesis pieces
⎡ ⎢ ⎣  /  ⎤ ⎥ ⎦   bracket pieces
⎧ ⎨ ⎩  /  ⎫ ⎬ ⎭   brace pieces
```

Scan lines: `⎺ ⎻ ⎼ ⎽`

---

## Rendering Techniques

### Half-Block (2x1 per cell)
Use `▄` with bg=upper pixel, fg=lower pixel. Each cell = 2 vertical pixels. Most common technique. Used by pixterm, chafa, notcurses `NCBLIT_2x1`.

### Quadrant (2x2 per cell)
4 pixels per cell using quadrant chars. Used by notcurses `NCBLIT_2x2`.

### Sextant (2x3 per cell)
6 pixels per cell using U+1FB00 block. Highest block-element density. Used by notcurses `NCBLIT_3x2`, chafa. Requires font support.

### Braille (2x4 per cell)
8 pixels per cell. Highest subpixel count but sparse dots -- best for line drawings, plots, wireframes. Used by drawille, plotille, notcurses `NCBLIT_BRAILLE`.

---

## Pattern Examples

```
◤▔▔▔▔▔▔◥        ╔═══════════╗        ▗▄▖
                 ║ ╭───────╮ ║        ▐██▌
◣▁▁▁▁▁▁◢        ║ │ Hello  │ ║        ▝▀▘
                 ║ ╰───────╯ ║
                 ╚═══════════╝     ░░▒▒▓▓██
```
