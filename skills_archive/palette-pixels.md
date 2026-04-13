---
name: palette-pixels
description: Unicode sub-cell pixel characters -- quadrants (2x2), sextants (2x3), half-blocks (1x2), wedge triangles, diagonal fills for terminal pixel art
type: reference
---

# Pixels

## Half-blocks (1x2, 2 colors via fg+bg)
▀ upper half = fg top, bg bottom
▄ lower half = fg bottom, bg top
█ full = both fg
(space) = both bg

## Quadrants (2x2 binary grid)
▘ ▝ ▖ ▗  single quadrants: UL UR LL LR
▚ ▞      diagonal pairs: UL+LR, UR+LL
▙ ▛ ▜ ▟  three-quadrant combos

Complete 2x2 truth table:
```
0000=(space) 0100=▘ 1000=▝ 1100=▀
0001=▖      0101=▌ 1001=▞ 1101=▛
0010=▗      0110=▚ 1010=▐ 1110=▜
0011=▄      0111=▙ 1011=▟ 1111=█
```

## Sextants (2x3 filled grid, U+1FB00-1FB3B)
Grid per cell: [1][2] / [3][4] / [5][6]

🬀 🬁 🬂 🬃 🬄 🬅 🬆 🬇 🬈 🬉 🬊 🬋 🬌 🬍 🬎 🬏
🬐 🬑 🬒 🬓 🬔 🬕 🬖 🬗 🬘 🬙 🬚 🬛 🬜 🬝 🬞 🬟
🬠 🬡 🬢 🬣 🬤 🬥 🬦 🬧 🬨 🬩 🬪 🬫 🬬 🬭 🬮 🬯
🬰 🬱 🬲 🬳 🬴 🬵 🬶 🬷 🬸 🬹 🬺 🬻

Plus existing chars completing the set: █ ▌ ▐ ▀ ▄ (space)

## Wedge triangles (smooth diagonals, U+1FB3C-1FB6F)
🬼 🬽 🬾 🬿 🭀 🭁 🭂 🭃 🭄 🭅 🭆 🭇 🭈 🭉 🭊 🭋
🭌 🭍 🭎 🭏 🭐 🭑 🭒 🭓 🭔 🭕 🭖 🭗 🭘 🭙 🭚 🭛
🭜 🭝 🭞 🭟 🭠 🭡 🭢 🭣 🭤 🭥 🭦 🭧 🭨 🭩 🭪 🭫
🭬 🭭 🭮 🭯

## Diagonal half-fills (legacy computing)
🮚 upper+lower triangular half block
🮛 left+right triangular half block
🮜 upper-left triangular medium shade
🮝 upper-right triangular medium shade
🮞 lower-right triangular medium shade
🮟 lower-left triangular medium shade

## Corner triangles (quarter-cell fills)
◤ ◥ ◣ ◢  filled quarter-square
◸ ◹ ◺ ◿  outline quarter-square

## Resolution hierarchy
```
1x1  plain char
1x2  half-blocks (▀/▄) + fg/bg = 2 colored pixels per cell
2x2  quadrants = 4 binary sub-pixels per cell
2x3  sextants = 6 binary sub-pixels per cell
2x4  braille = 8 dot sub-pixels per cell (see palette-braille)
```
