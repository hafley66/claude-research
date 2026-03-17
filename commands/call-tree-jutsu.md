# /call-tree-jutsu

Tactical readout of how control and data flow through the code in context.

## Arguments
- (none): scoped to the current problem or file in context
- `from <function>`: trace outward from a specific entry point
- `to <function>`: trace backward -- what calls this and why
- `zone <module>`: all internal call paths within a boundary

## Instructions

Read the code. Trace the calls. Map the flow.

### What to show

- **Call paths** -- who calls who. Direction and depth.
- **Data shape at each edge** -- what crosses each call boundary. Essential shape, not full signatures. `(id, config) -> Result<Vec<Row>>`.
- **Cardinality** -- 1:1, 1:N, N:M between callers and callees.
- **External effects** -- IO, network, disk, env vars, config reads, database, stdout, logging. Mark them: `[IO]`, `[NET]`, `[ENV]`, `[DB]`, `[FS]`.
- **Config/env reads** -- sites where behavior changes based on something not in the function signature.
- **Type tree** -- runtime referencing topology. Who holds who, ownership and reference boundaries (`Arc<Mutex<>>`, `Rc`, `&`, `Box`). The relational model: how you actually traverse from A to B, what indirections you pass through.
- **Traversal** -- how the code walks the type graph. Iterate vs direct-access vs search. Assumed vs checked relationships.

### Visual rules

- Topology of the diagram matches topology of the calls. Trees for trees, diamonds for diamonds, fans for fan-out.
- Box-drawing characters or spatial layout to show depth.
- Annotate edges, not just nodes.
- Collapse boring subtrees. Expand suspicious ones.
- One screen if possible. Two if genuinely large.

### Purpose

After reading a /call-tree-jutsu the user should see where data enters, how it transforms, where decisions branch, and where effects hit the world.
