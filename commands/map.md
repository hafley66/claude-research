# /map

Spatial snapshot of what we're building or touching. The reader should walk away feeling oriented -- where things are, how they connect, what the shape is.

## Arguments
- (none): scoped to this session's work
- `full`: the whole relevant subsystem
- `zone <name>`: zoom into one area

## Instructions

Draw the system, not the conversation. This is a blueprint, not a status update (that's `/vibes`).

Show structure, containment, flow, boundaries, counts. Collapse details where a count suffices. Skip implementation internals.

### Visual rules

- Shape matches topology. A tree is fine when it's a tree. A flow is fine when it's a flow. Don't default to one shape.
- Avoid generic output. If it looks like something `tree` would print, it's too boring. Find the interesting structure.
- One screen max. One visual gulp.

### Purpose

The user is a human reading a text stream. They lose spatial orientation in long sessions. This command exists to re-ground them in the structure of the thing, not the history of the conversation. After reading a /map they should think "ok, I see where everything is."
