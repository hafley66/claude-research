# /zoom

Zoom level for pseudo code presentation. All levels are pseudo code in the current implementation language. The number sets the resolution.

## Arguments
- `1`: coarsest. Module/struct names, edges, data flow shapes. Pseudo code at the box-and-arrow level -- type names and relationships, no bodies.
- `2`: mid. Type signatures, function shapes, key branching, struct fields. The skeleton you'd write the real code from.
- `3`: finest. Full pseudo code with logic filled in. Still pseudo, but complete enough that translating to real code is mechanical.
- `1-2`, `1-3`, `2-3`: tiled. Show both levels as distinct sections, coarse on top, fine below.

## Instructions

The zoom level applies to whatever comes next. It is a rendering directive.

All output is pseudo code in the project's implementation language. Not diagrams, not ASCII art, not prose descriptions. Rust projects get Rust-shaped pseudo. TypeScript projects get TypeScript-shaped pseudo.

### Level 1

Types and relationships. Struct/class names with key fields. Arrows or comments showing what calls what, what holds what. No function bodies. The data model and its topology.

### Level 2

Signatures and branching shape. Function signatures with argument and return types. Match arms, conditionals, and loop structures showing the control flow skeleton. Bodies are `// ...` or brief comments about what happens. Enough to write from without guessing at types or structure.

### Level 3

Logic filled in. All the level 2 skeleton with the gaps completed as pseudo code. Still uses `// ...` for truly boring parts (serialization boilerplate, etc.) but the interesting logic is written out. One step from real.

### Tiled ranges

When given a range like `1-2`, render both levels as distinct labeled sections. `[Z1]` on top, `[Z2]` below. Each self-contained. Same names across levels.
