# D2 theme kit

[Open the rendered gallery in Instant](4_gallery/index.md).

## Themes and palettes

| Setting | Choices |
| --- | --- |
| Canvas | `midnight` (blue black), `charcoal` (neutral dark), `paper` (warm light) |
| Categories | `categorical` (16 colors), `clear` (8 colors) |
| Assignment | `semantic`, `round-robin`, `shuffle` |
| Randomness | `shuffle` is a seeded palette permutation, then round-robin |
| Semantic roles | `data`, `control`, `identity`, `success`, `failure`, `warning`, `storage`, `inactive` |

Every palette color has at least 4.5:1 contrast against its theme canvas. Colors
are not guaranteed distinguishable from each other or under every form of color
vision deficiency. Keep named groups, edge labels, arrowheads and meaningful dash
patterns. No magenta is used. Semantic hues stay fixed when the categorical palette
changes. Dark/light variants keep the same category ordering.

Presets include D2 `theme-overrides` for neutral container/table surfaces, readable
table text and default strokes. This prevents a host-selected built-in theme from
reintroducing pale containers behind the colored lines. Explicit per-shape styles
in the input still take precedence; inspect those when migrating an older diagram.

## Author with classes

Import one of the six generated files in `2_presets/`:

```d2
...@2_presets/midnight_categorical
vars: { d2-config: { layout-engine: dagre; pad: 32 } }
direction: right
worker: Worker { class: kit_data }
store: Store { class: kit_storage; shape: cylinder }
worker -> store: save { class: kit_edge_storage }
store -> worker: retry { class: kit_edge_warning }
```

Node/container classes: `kit_data`, `kit_control`, etc., or `kit_c0` through
`kit_c15` (`clear`: through `kit_c7`). Edge classes: `kit_edge_data`, etc., or
`kit_edge_c0` through `kit_edge_c15`. Edge classes set stroke, label color, width
and dash. Node classes set paired fill/text colors. Apply node classes to ordinary
shapes and wrapper containers. Leave SQL tables and UML class bodies unstyled:
D2 maps their stroke to body fill and font-color only to the header.

Explicit local styles override classes. The composer below emits explicit style
overrides to recolor an existing diagram even when its edges have inline styling.
It leaves shape kinds, labels, relationships, arrowheads, and layout untouched.

## Assign groups without hand-picking colors

Keep the original D2 and an assignment manifest as source inputs:

```json
{
  "theme": "midnight",
  "palette": "categorical",
  "mode": "shuffle",
  "seed": 42,
  "assignments": [
    {"target": "worker", "kind": "node", "group": "worker"},
    {"target": "(worker -> store)[0]", "kind": "edge", "group": "worker"},
    {"target": "(store -> worker)[0]", "kind": "edge", "group": "retry", "role": "warning", "dash": 3}
  ]
}
```

```bash
node 2_compose.mjs original.d2 assignments.json diagram.d2
d2 diagram.d2 diagram.svg
```

The output is self-contained, with no imports, and has a `.legend.json` sidecar.
Paste the generated source into a Markdown `d2` fence for Instant. Relative imports
are for the D2 CLI; Instant's current renderer receives a single source string.
No modification of installed md packages is needed to render explicit styles.

Group rules:

- Repeated `group` names get the same color. Use stable names across related edges.
- `semantic` requires a role for every assignment; named roles also override colors
  in either categorical mode. A group cannot have conflicting roles.
- `round-robin` assigns colors in first-occurrence group order.
- `shuffle` visits every color once before repeating, using the supplied uint32 seed.
- Palette exhaustion cycles edge dashes through solid, 3, and 6. With 16 colors,
  this gives 48 color/dash combinations before repeating. Nodes repeat after 16.
- Inserting a new group earlier changes subsequent categorical assignments. Keep
  a stable manifest order when continuity matters. Seeded shuffle is not key hashing.
- Explicit `dash` wins. Preserve an existing diagram's meaning by carrying any
  dashed logical/optional/retry edge into the manifest; default solid assignments
  otherwise replace it. Per-edge dash overrides are not reflected in the group legend.
- A target is an authored D2 key or indexed connection selector, including scope:
  `box.(a -> b)[0]`. The composer does not parse D2 or discover topology. A misspelled
  node key can create a new node in D2; compile and inspect the output.
- Always compose from the original source. Repeatedly composing generated output
  appends duplicate style definitions. Keep input and output paths separate.

For library consumers, import `themeKit`, `assignStyles`, or `compose` from
`1_theme.mjs`. Each returns source plus the color data needed to build a legend.
There are no npm dependencies; D2 performs parsing and layout.

## Regenerate and verify

```bash
node --test 1_theme.test.mjs
node 3_gallery.mjs
```

Requires Node, `d2`, and `rsvg-convert`. The gallery generator writes six presets,
four D2/SVG/PNG examples and an inline-fence Markdown gallery. Tests compile all
theme/palette combinations with graph, SQL-wrapper and sequence fixtures, exercise
palette exhaustion and seeded determinism, and check label contrast.

References: [D2 classes and precedence](https://d2lang.com/tour/classes/),
[style behavior for edges and SQL tables](https://d2lang.com/tour/style/),
[configuration variables](https://d2lang.com/tour/vars/).
