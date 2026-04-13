---
name: book-project
description: >
  Build mdBooks that teach any domain through code implementations,
  conceptual frameworks, or pure prose. Scales from a 5-page pamphlet
  to a 50-chapter reference. Handles reader calibration (taste-fitting,
  knowledge heatmap, interest weighting), LLM-driven structure proposal
  with progressive validation, and per-tier execution.
  Trigger on: "mdbook", "book project", "teach through code",
  "learn X through Y", book planning, TOC review, chapter writing,
  or any request to build an educational book with or without code.
  Companion skills: book-supplements, book-assessment (medium+ tiers),
  book-typography, book-crosslink.
---

# Book Project (Core)

Build mdBooks that teach any domain. Code-heavy Rust to pure prose.
Pamphlet to 50 chapters. The system calibrates to the reader, not
the other way around.

**Companion skills** (co-trigger as needed):
- `book-supplements` -- slides, flashcards, labs, cheatsheets
- `book-assessment` -- self-assessment tests, progress tracker (medium+ only)
- `book-typography` -- margin notes, timelines, glossary, connections map
- `book-crosslink` -- multi-book project linking

---

## Step 0: Reader Calibration

Before planning anything, understand the reader. This produces a
Reader Profile that configures everything downstream.

See `references/taste-fitting.md` for the full protocol with examples.

### A. Topic + Concept Brainstorm

User states the subject. Brainstorm 15-20 key concepts from the
domain. Present as a flat numbered list with one-line descriptions.

Use domain knowledge to include concepts the user might not think to
list but that are structurally important -- prerequisites, bridging
concepts, foundational ideas that later concepts assume.

### B. Knowledge Heatmap

Present the concept list. User rates each:

| Rating | Meaning | Book treatment |
|--------|---------|---------------|
| `new` | Never encountered | Full chapter, full depth |
| `heard` | Name rings a bell, vague on mechanics | Highest-value chapters |
| `explain` | Could explain the basics to someone | Compressed: recap or light chapter |
| `teach` | Could teach it | Skip, or one-paragraph reference |

**Gap detection**: Check whether `new` concepts have prerequisites
the user didn't rate. Surface these: "Understanding X requires Y.
How familiar are you with Y?"

The user does not know the topological sort of their own knowledge
gaps. The LLM does. Use domain knowledge to identify hidden
prerequisites and structural dependencies the user can't see from
their current position.

### C. Interest Weighting

"Pick 3-5 concepts you most want to deeply understand."

Top picks get boosted depth (one level above default). The highest
pick becomes the destination concept for shortest-path reading order.

### D. Taste-Fitting

Show 3 example snippets on a neutral topic. Each uses a different
style. User rates 1-10. See `references/taste-fitting.md` for
the snippets and inference table.

Then two quick A/B comparisons:
1. Code annotation density (clean vs. commented)
2. Chapter length preference (~500w / ~1500w / ~3000w)

### E. Narrative Framing (Optional)

"Some books use a recurring narrative frame -- characters or scenarios
that mirror the technical content. GEB's Tortoise and Achilles.
A packet's journey through the network stack. A war room debugging
session that opens each chapter. Want something like that?"

If yes:
- LLM proposes 2-3 framing candidates based on subject matter
- User picks, modifies, or suggests their own
- Placement: pre-chapter vignette, or woven into section transitions

Example frame types:
- **Dialogue**: Two characters exploring ideas (GEB style)
- **Day-in-the-life**: Follow an entity through the system
- **Incident response**: Each chapter opens with a problem scenario
- **Socratic**: Question-and-answer that builds toward the concept
- **Alternate history**: "What if this was never invented?"
- **None**: Straight textbook

### Output: Reader Profile

```
## Reader Profile
Style: [inferred from snippet ratings, e.g. "hook-first, code-dense, light history"]
Code annotations: [minimal / moderate / annotated]
Default depth: [1-5, from chapter length preference]
Boosted: [concepts from interest picks] -> depth N+1
Knowledge floor: {concept: new/heard/explain/teach, ...}
Language: [rust / python / go / pseudocode / prose-only]
Size: [pamphlet / micro / small / medium / large]
Narrative frame: [none / description of chosen frame]
```

---

## Step 1: Project Setup

Factual questions only. Taste and knowledge are captured in Step 0.

| Question | Options |
|----------|---------|
| Language mode | `rust` / `other:<lang>` / `pseudocode` / `prose-only` |
| Size tier | `pamphlet` (1-5) / `micro` (5-10) / `small` (10-20) / `medium` (20-35) / `large` (35-55) |
| Code level | `none` / `beginner` / `intermediate` / `advanced` (if language mode has code) |
| Supplements | Multi-select from tier defaults (see `book-supplements` skill) |
| Multi-book? | If yes, see `book-crosslink` skill |

Size tier determines process weight. See `references/planning-tiers.md`.

---

## Step 2: Structure Proposal

**The LLM proposes structure. The user validates.**

The reader has domain interest but not the dependency graph. The LLM
has latent knowledge of how concepts relate, what depends on what,
and what ordering produces understanding most efficiently. The book
is a computed path from the reader's current knowledge to their
desired knowledge.

### 2a. Dependency Graph

From concept inventory + knowledge heatmap + domain knowledge:

1. Identify prerequisite relationships (A must come before B)
2. Identify clusters (natural groups -> Parts)
3. Identify forks (2+ approaches to same problem -> comparison sections)
4. Compute the path from knowledge floor to interest picks
5. Filter: skip `teach`-rated concepts, compress `explain`-rated ones
6. Note where the reader's `new` items cluster -- these are the
   chapters that need the most careful scaffolding

### 2b. Progressive Validation

Do not dump the full outline. Reveal structure incrementally and
collect feedback at each zoom level.

**Round 1 -- Parts only.**
"Here's how I'd organize this into major sections:"
```
Part I: [theme] -- after this you'll understand [X]
Part II: [theme] -- after this you'll understand [Y]
```
"Does this arc make sense? Anything feel out of order or missing?"

Restructure before proceeding.

**Round 2 -- Parts + opening chapters.**
"Here's how each section opens -- the first 2-3 chapters:"

Show chapter titles with one-line descriptions. Get feedback on
entry points, pacing, assumed knowledge.

**Round 3 -- Full chapter list.**
Complete TOC with difficulty tags, depth assignments, reading orders.

### 2c. TOC Evaluation

Run before locking the outline:

- Every concept from inventory has a home (chapter or section)
- Every chapter's prereqs appear earlier in the linear order
- Depth is consistent (except intentional boosts from interest picks)
- Difficulty generally trends upward
- Size tier caps respected
- `heard`-rated concepts get full chapters
- `explain`-rated concepts are compressed
- No orphan chapters (nothing depends on them and they're not capstones)
- If narrative frame exists, each part has a natural scene break

---

## Step 3: Writing

Execution scales by size tier. See `references/planning-tiers.md`
for tier-specific process, tracking artifacts, and gate checks.

### Chapter Components

**Every chapter (all tiers):**
- One-liner summary
- Key insight / Aha callout
- Walkthrough (code or conceptual, per language mode)
- "What I Should Know" checklist (3-6 testable items)
- Connections (builds on / leads to)

**If historical appetite is high (snippet C rated 6+):**
- "State of the art before this"
- Historical context section

**If narrative frame is enabled:**
- Pre-chapter vignette

See `references/chapter-template.md` for the full template.

### Code-Prose Interleaving

Never dump an entire file as one code block. Walk through code in
narrative order with prose paragraphs between snippets.

- **Rust mode**: ANCHOR markers + `{{#include}}`. See `references/lang-rust.md`.
- **Other languages**: Inline fenced code blocks in the .md. Same
  interleaving discipline -- each snippet gets transitional prose.
- **Prose-only**: Tables, mermaid diagrams, structured examples.

### Code Annotation Density

Driven by Reader Profile `code_annotations` setting:

| Setting | Pub item doc | Field comments | Inline comments |
|---------|-------------|----------------|-----------------|
| `minimal` | One line | None | None -- prose handles explanation |
| `moderate` | One line | None | `// Step N:` in complex functions |
| `annotated` | Full doc | One line each | Step-by-step |

Default: `minimal` at depth 1-3, `moderate` at 4, `annotated` at 5.
Taste-fitting result overrides the default.

### Prose Quality Levels

`skel` -> `d1` -> `d2` -> `final`

See `references/prose-levels.md` for definitions and transition rules.
The per-part review cycle applies at small+ tiers.

---

## Project Structure

Adapts to language mode and size tier.

### Rust mode
```
project/
  Cargo.toml
  src/lib.rs                     # shared types + #[path] module declarations
  book/
    book.toml
    src/
      SUMMARY.md
      [part_N/]_XX_slug.md       # chapter prose
      [part_N/]_XX_slug.rs       # colocated implementation
  supplements/                   # if enabled
  PLANNING.md                    # micro+ only
  README.md
```

### Non-Rust code mode
```
project/
  book/
    book.toml
    src/
      SUMMARY.md
      [part_N/]_XX_slug.md       # prose with inline code blocks
  supplements/
  PLANNING.md                    # micro+ only
  README.md
```

### Pamphlet (any language)
```
project/
  book/
    book.toml
    src/
      SUMMARY.md
      _XX_slug.md                # flat, no part dirs
  README.md                      # reader profile + outline (no PLANNING.md)
```

Key rules:
- Part directories: underscores (`part_1`), not hyphens
- Chapter files: `_XX_` prefix for sort order
- Flat layout when < 10 chapters (no part subdirectories)
- Rust: single `Cargo.toml` at root, `src/lib.rs` declares modules via `#[path]`
- Pamphlet: no PLANNING.md, outline lives in README

---

## Reference Files

- `references/taste-fitting.md` -- full calibration protocol: snippets, heatmap, inference rules
- `references/planning-tiers.md` -- process scaling: pamphlet to large, tracking formats, gates
- `references/chapter-template.md` -- language-neutral chapter template
- `references/lang-rust.md` -- Rust-specific: Cargo, ANCHOR markers, lib.rs, naming, cargo test
- `references/depth-calibration.md` -- the 1-5 depth scale
- `references/prose-levels.md` -- skel/d1/d2/final definitions and transitions
- `references/prose-pass-template.md` -- d1->d2 automated rewrite prompt
- `references/scaffold-scripts.md` -- bash scripts for mechanical tasks
- `references/reading-orders.md` -- multiple reading path templates
