# Unicode Terminal Art -- Character Palette & Resources

## Character Reference

### Block Elements (U+2580-U+259F)

**Eighth blocks (vertical):** `▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▔`
**Eighth blocks (horizontal):** `▏ ▎ ▍ ▌ ▋ ▊ ▉ █ ▐ ▕`

**Half blocks:** `▀ ▄ ▌ ▐`
Key technique: set fg color = one pixel, bg color = other pixel. Each cell becomes 2 independently colored pixels. This is the foundation of most terminal image renderers.

**Quadrant blocks (2x2 sub-cell pixels):**
```
▘ ▝ ▖ ▗   single quadrants: UL, UR, LL, LR
▚ ▞       diagonal pairs: UL+LR, UR+LL
▙ ▛ ▜ ▟   three-quadrant combos
```
16 possible states per cell using quadrants + space + `█`. Missing combos (upper half, left half, etc.) are covered by the half-block chars.

**Shading:** `░ ▒ ▓ █` (25% / 50% / 75% / 100%)

---

### Box Drawing (U+2500-U+257F)

128 characters total.

**Light:** `─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼`
**Heavy:** `━ ┃ ┏ ┓ ┗ ┛ ┣ ┫ ┳ ┻ ╋`
**Double:** `═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬`
**Rounded corners:** `╭ ╮ ╰ ╯`
**Diagonals:** `╱ ╲ ╳`

**Dashed lines:**
```
┄ ┅  triple dash horizontal (light/heavy)
┆ ┇  triple dash vertical (light/heavy)
┈ ┉  quadruple dash horizontal (light/heavy)
┊ ┋  quadruple dash vertical (light/heavy)
╌ ╍  double dash horizontal (light/heavy)
╎ ╏  double dash vertical (light/heavy)
```

**Half lines (stubs):** `╴ ╵ ╶ ╷` light, `╸ ╹ ╺ ╻` heavy
**Mixed weight:** `╼ ╾ ╽ ╿`
**Mixed single/double corners:** `╒ ╕ ╘ ╛` (single vert + double horiz), `╓ ╖ ╙ ╜` (double vert + single horiz)

---

### Geometric Shapes -- Triangles

**Solid pointing (3 sizes):**
```
▲ ▼ ◀ ▶   full
▴ ▾ ◂ ▸   small
⯅ ⯆ ⯇ ⯈   medium
```

**Outline pointing:**
```
△ ▽ ◁ ▷   full
▵ ▿ ◃ ▹   small
```

**Corner/quarter triangles (best for tiling and corner embellishments):**
```
◤ ◥ ◣ ◢   filled quarter-square
◸ ◹ ◺ ◿   outline quarter-square
```

**Special:** `◬` dotted, `◭` left-half black, `◮` right-half black, `⊿` right triangle

**Canadian Syllabics (underused, clean geometric forms):**
`ᐃ ᐁ ᐅ ᐊ` and `ᐱ ᐯ ᐳ ᐸ`

**Math/logic wedges:** `∆ ∇` increment/nabla, `∧ ∨` logical and/or, `⊲ ⊳` subgroup

---

### Geometric Shapes -- Other

**Squares:** `■ □ ▪ ▫ ◻ ◼ ◽ ◾ ▢ ▣`
**Filled squares:** `▤ ▥ ▦ ▧ ▨ ▩` (horizontal, vertical, crosshatch, diagonal fills)
**Half-filled:** `◧ ◨ ◩ ◪ ◫ ◰ ◱ ◲ ◳`
**Diamonds:** `◆ ◇ ◈ ◊`
**Circles:** `● ○ ◉ ◌ ◍ ◎ ◦ ◯`
**Half/quarter circles:** `◐ ◑ ◒ ◓ ◔ ◕ ◖ ◗`
**Arc quadrants:** `◜ ◝ ◞ ◟ ◠ ◡`
**Stars:** `★ ☆ ✦ ✧ ✶ ✷ ✱ ✲ ✳ ✴`
**Rectangles:** `▬ ▭ ▮ ▯ ▰ ▱`

---

### Corner & Bracket Decorations

```
⌜ ⌝ ⌞ ⌟   half-bracket corners
「 」 『 』   CJK corner brackets (note: fullwidth, 2 columns)
﹁ ﹂ ﹃ ﹄   presentation form corners
⊢ ⊣ ⊤ ⊥    turnstile operators (T-shaped decorations)
```

---

### Braille Patterns (U+2800-U+28FF)

256 characters. Each encodes a 2x4 dot grid = 8 pixels per cell.

```
Dot layout:     Bit values:
(1) (4)         0x01  0x08
(2) (5)         0x02  0x10
(3) (6)         0x04  0x20
(7) (8)         0x40  0x80
```

Codepoint = `U+2800 + bitmask`. Example: dots 1+2+5 = `0x01 | 0x02 | 0x10` = `0x13` = U+2813 = `⠓`

**Key chars:** `⠀` empty, `⣿` full, `⡇` left col, `⢸` right col, `⠉` top row, `⣀` bottom row, `⠛` upper 2x2, `⣤` lower 2x2

**Effective resolution:** 80x24 terminal becomes 160x96 pixels.

---

### Sextant Characters (U+1FB00-U+1FB3B)

60 characters. 2x3 subgrid per cell = 6 pixels. Higher density than quadrants.

```
Grid layout per cell:
(1) (2)
(3) (4)
(5) (6)
```

**Font support caveat:** requires newer fonts -- Cascadia Code, JetBrains Mono, Iosevk. Not all terminals render U+1FB00 range yet.

---

### Smooth Mosaic / Diagonal Blocks (U+1FB3C-U+1FB67)

~38 characters for diagonal and wedge shapes within cells. Allows smoother angled lines than rectangular block staircase patterns. Same font support caveat as sextants.

---

### Large Symbol Construction (U+239B-U+23B3)

**Bracket/brace pieces:**
```
⎛ ⎜ ⎝   left parenthesis: upper, extension, lower
⎞ ⎟ ⎠   right parenthesis: upper, extension, lower
⎡ ⎢ ⎣   left bracket: upper, extension, lower
⎤ ⎥ ⎦   right bracket: upper, extension, lower
⎧ ⎨ ⎩   left brace: upper, middle, lower
⎫ ⎬ ⎭   right brace: upper, middle, lower
```

**Scan lines:** `⎺ ⎻ ⎼ ⎽` (fine horizontal positioning at 4 vertical positions)

---

### Decorative Symbols

**Floral/ornamental:** `❦ ❧ ✿ ❀ ❁`
**Snowflakes:** `❄ ❅ ❆`
**Card suits:** `♠ ♣ ♥ ♦ ♡ ♢`
**Math-as-decoration:** `∞ ≈ ∴ ∵ ⊕ ⊗ ⊙`

---

## Key Rendering Techniques

**Half-block double resolution:** Use `▀`/`▄` with independent fg+bg colors for 2 vertical pixels per cell. This is what pixterm, chafa, and notcurses `NCBLIT_2x1` use.

**Quadrant 2x2 pixels:** Map 4 pixels per cell using quadrant chars + space + `█`. Used by notcurses `NCBLIT_2x2`.

**Sextant 2x3 pixels:** Map 6 pixels per cell using U+1FB00-1FB3B. Highest-resolution block-element technique. Used by notcurses `NCBLIT_3x2` and chafa.

**Braille 2x4 pixels:** Map 8 pixels per cell. Highest subpixel count but dots are sparse -- looks dotted rather than filled. Best for line drawings, plots, wireframes. Used by drawille, plotille, notcurses `NCBLIT_BRAILLE`.

**Corner triangle tiling:** `◤◥◣◢` naturally compose into angular borders and decorative corner motifs.

---

## Resources

### Official Unicode Charts (PDFs)

- [Block Elements](https://www.unicode.org/charts/PDF/U2580.pdf)
- [Box Drawing](https://www.unicode.org/charts/PDF/U2500.pdf)
- [Geometric Shapes](https://www.unicode.org/charts/PDF/U25A0.pdf)
- [Braille Patterns](https://www.unicode.org/charts/PDF/U2800.pdf)
- [Symbols for Legacy Computing](https://www.unicode.org/charts/PDF/U1FB00.pdf)
- [Legacy Computing names list](https://www.unicode.org/charts/nameslist/n_1FB00.html)

### Wikipedia

- [Block Elements](https://en.wikipedia.org/wiki/Block_Elements)
- [Box-drawing Characters](https://en.wikipedia.org/wiki/Box-drawing_characters)
- [Geometric Shapes](https://en.wikipedia.org/wiki/Geometric_Shapes_(Unicode_block))
- [Braille Patterns](https://en.wikipedia.org/wiki/Braille_Patterns)
- [Symbols for Legacy Computing](https://en.wikipedia.org/wiki/Symbols_for_Legacy_Computing)
- [ANSI Art](https://en.wikipedia.org/wiki/ANSI_art)

### Interactive References

- [Compart: All Unicode Blocks](https://www.compart.com/en/unicode/block) -- master index, browsable per-character
- [Compart: Block Elements](https://www.compart.com/en/unicode/block/U+2500)
- [Compart: Braille Patterns](https://www.compart.com/en/unicode/block/U+2800)
- [Compart: Geometric Shapes](https://www.compart.com/en/unicode/block/U+25A0)
- [Compart: Legacy Computing](https://www.compart.com/en/unicode/block/U+1FB00)
- [Codepoints.net: Block Elements](https://codepoints.net/block_elements)
- [jrgraphix Box Drawing chart](https://jrgraphix.net/r/Unicode/2500-257F)
- [tamivox.org Box-drawing reference](http://tamivox.org/dave/boxchar/index.html)

### Tutorials & Blog Posts

- [John D. Cook: Drawing with Unicode block characters](https://www.johndcook.com/blog/2019/10/21/box-drawing-unicode/) -- practical intro
- [(Almost) Square Pixels in the Terminal](https://www.uninformativ.de/blog/postings/2016-12-17/0/POSTING-en.html) -- half-block pixel technique
- [Terminal Pixel Art (Medium)](https://medium.com/@l.mugnaini/terminal-pixel-art-ad386d186dad) -- half-block walkthrough
- [Beej's Unicode Pixel Art](https://beej.us/upart/) -- interactive tool/guide
- [FOSDEM 2021: Notcurses blingful TUIs (slides)](https://archive.fosdem.org/2021/schedule/event/notcurses/attachments/slides/4479/export/events/attachments/notcurses/slides/4479/notcurses_fosdem_2021.pdf) -- blitter taxonomy, sextant vs quadrant vs braille
- [HN: Unicode 13 sextants advance terminal rendering](https://news.ycombinator.com/item?id=24956014) -- deep discussion of sextant blitters

### Libraries & Tools

- **[notcurses](https://github.com/dankamongmen/notcurses)** (C) -- the most sophisticated Unicode terminal graphics library. Half-block, quadrant, sextant, braille blitters. Sixel/Kitty bitmap support. [Wiki/docs](https://nick-black.com/dankwiki/index.php/Notcurses)
- **[chafa](https://github.com/hpjansson/chafa)** (C) -- image-to-terminal converter. Outputs sixel, kitty, unicode mosaics. Custom glyph loading. [Homepage](https://hpjansson.org/chafa/)
- **[drawille](https://github.com/asciimoo/drawille)** (Python) -- the original braille plotting library. 2x4 subpixel resolution per cell
- **[plotille](https://github.com/tammoippen/plotille)** (Python) -- scatter plots, histograms, heatmaps in braille. No dependencies
- **[blessed](https://github.com/chjj/blessed)** (Node.js) -- high-level terminal interface, reimplements curses from scratch
- **[termbox2](https://github.com/termbox/termbox2)** (C) -- minimal cell-based terminal I/O. Single-header. 32-bit color
- **[pixterm](https://github.com/eliukblau/pixterm)** (Go) -- image-to-terminal via half-block technique with true color
- **[Durdraw](https://github.com/cmang/durdraw)** (Python) -- modern ANSI/ASCII/Unicode art editor. Animation, 256 colors. [Homepage](https://durdraw.org/)
- **[ublocks-ascii-art](https://github.com/NyxCode/ublocks-ascii-art)** (Rust) -- image-to-terminal using block elements
- **[Botspot/unicode-art](https://github.com/Botspot/unicode-art)** -- shell script that categorizes useful unicode art chars by shape

### Archives & Collections

- [16colo.rs](https://16colo.rs/) -- massive archive of historical and modern ANSI art
- [awesome-tuis](https://github.com/rothgar/awesome-tuis) -- curated list of TUI projects
- [GitHub topic: ansi-art](https://github.com/topics/ansi-art)

---

## Pattern Examples

### Double-line frame with rounded inner corners
```
╔═══════════╗
║ ╭───────╮ ║
║ │ Hello  │ ║
║ ╰───────╯ ║
╚═══════════╝
```

### Corner triangles for angular borders
```
◤▔▔▔▔▔▔◥

◣▁▁▁▁▁▁◢
```

### Quadrant-based smooth curve
```
▗▄▖
▐██▌
▝▀▘
```

### Shade gradient bar
```
░░▒▒▓▓██
```

### Triangle fan corner embellishment
```
◤◥▲▴          ▴▲◤◥
◣◢▶ᐅ        ᐊ◀◣◢
  ◣◢          ◣◢
```
