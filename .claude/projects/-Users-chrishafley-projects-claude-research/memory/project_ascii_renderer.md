---
name: ascii-renderer-project
description: Nondeterministic ASCII art renderer using WFC, CA, L-systems -- takes YAML layout spec from LLM, produces unique terminal art every run
type: project
---

Standalone Rust CLI tool: LLM declares layout intent in YAML, renderer produces unique ASCII art each invocation.

**Why:** LLMs can't count characters. Current /map command requires manual ASCII drawing that drifts. A renderer handles all spatial math while the LLM focuses on content and structure. Each run should look different -- same spec, different visual.

**How to apply:** This is a dedicated project in ~/projects/, not a plugin feature. Will integrate with hafley plugin's /map command once built -- LLM outputs YAML spec, pipes to renderer, renderer prints to stdout.

## Engine layers

1. **Layout engine** -- region sizing, column layout, gap allocation (partially nondeterministic)
2. **Decoration engine** -- CA/WFC/L-system driven ornament generation per region type
3. **Character grid** -- 2D buffer, final compositing, stdout

## Primitives (from session riffing)

- frame, border, island, gauge, header, bar, link, arrow, flow, callout, trail, ornament, divider, text, columns, tree

## Algorithms to employ

- **Wave Function Collapse** -- constraint-propagated glyph placement for borders, ornaments, fills
- **Wolfram elementary CA** (Rule 30/90/110) -- texture generation, divider patterns
- **L-systems** -- recursive tree/graph growth, ornamental branching (GRIS-style organic trees)
- **Perlin noise** -- palette/density variation across regions
- **Markov chains** on glyph sequences -- divider patterns that feel designed but aren't deterministic
- **Edge-matching automaton** -- glyph connectivity rules (ASCII Automata v2 approach)
- **Bezier discretization** -- gauge curves at width > 3, discretized to character grid
- **Pathfinding** -- arrow/flow routing with obstacle avoidance around content

## Art references

- Armored Core 3 HUD/garage screens
- Ghost in the Shell net-dive visualizations
- Neon Genesis Evangelion NERV system diagrams
- GRIS game tree designs (organic, minimal, beautiful branching)
- Amsterdam wrought iron railings (double rail, diamond joints)
- Cambridge North station (Rule 30 architectural panels)

## Open design questions

- YAML vs custom DSL for spec format
- How much layout control vs creative freedom for the renderer
- Glyph palette curation -- which Unicode ranges to draw from
- Should trees/graphs use L-systems or a dedicated graph layout algorithm (force-directed?)
- How to handle content reflow when decoration takes unexpected space
