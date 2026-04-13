---
name: book-supplements
description: >
  Generate study supplements for mdBook projects: presenterm terminal
  slide decks, mdanki Anki flashcards, guided labs, and terminal-printable
  cheatsheets. Part of the book-project skill family. Availability
  scales by size tier (see planning-tiers.md in book-project).
  Trigger on: "presenterm", "mdanki", "flashcards", "anki", "slides",
  "cheatsheet", "lab", "study materials", "review deck", or any request
  to generate study supplements from book chapters.
---

# Book Supplements

Generate study materials from book chapters. All supplements
live in the `supplements/` directory of the project.

**Tier availability** (see `book-project/references/planning-tiers.md`):
- pamphlet: optional flashcards only
- micro: slides + flashcards
- small+: all supplement types

```
supplements/
├── slides/          # presenterm (_XX_name.md)
├── flashcards/      # mdanki source (_XX_name.md)
├── labs/            # guided exercises (_XX_name/)
└── cheatsheets/     # one-pagers (_XX_name.md)
```

---

## presenterm Slides (slides/_XX_name.md)

Terminal slide decks for chapter review. Uses markdown with `---` separators.

**Max 8 slides per chapter. This is review, not re-teaching.**

Slide order:
1. Title + one-liner
2. State of the art before (historical mode) OR problem statement
3. Historical context bullets (historical mode only)
4-5. Core idea (one concept per slide, sparse)
6. Key code (most important snippet, max 15 lines)
7. Connections (builds on / leads to / siblings)
8. "Remember This" (Aha moment + 2-3 key checklist items)

For margin-note content on slides, use presenterm column layouts:

```markdown
<!-- column_layout: [3, 1] -->
<!-- column: 0 -->
Main content here.
<!-- column: 1 -->
> **Tip:** Sidebar note here.
<!-- reset_layout -->
```

---

## mdanki Flashcards (flashcards/_XX_name.md)

mdanki format: each H2 is the card front, content below is the back.

**4-8 cards per chapter. Quality over quantity.**

Card categories to draw from:

| Category | Front pattern | Back pattern |
|----------|--------------|-------------|
| Problem | "What problem did [X] solve?" | 1-2 sentences |
| Insight | "What is the key insight?" (= Aha moment) | 1-2 sentences |
| Code mapping | "What struct/trait models [X]?" | 3-5 line snippet |
| Predecessor | "What came before [X]?" | Name + limitation |
| Comparison | "[X] vs [Y]: key difference?" | 1 sentence |
| Gotcha | "What breaks without [X]?" | 1-2 sentences |
| Anecdote | From sidebar content | Name, year, detail |
| Definition | "Define [term]" | 1 sentence (= glossary entry) |

Rules:
- At least one code-mapping card per chapter.
- Aha moment always becomes an Insight card.
- Sidebar content becomes Anecdote cards.
- `remember`-type margin notes are card candidates.
- Answers must be terse. Split rather than elaborate.

---

## Labs (labs/_XX_name/)

Deeper than chapter exercises. 30-90 minutes. Produces working code.

```
_XX_name/
├── README.md       # Problem statement, goals, hints
├── starter/        # Cargo project with TODOs
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs  # Partially implemented
│       └── main.rs # Test harness
└── solution/       # Complete working version
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        └── main.rs
```

### Lab Types

- **Build from scratch**: Reimplement the concept with only the book page as reference.
- **Extend**: Start from chapter code, add a feature or variant.
- **Compare siblings**: Implement both sides of an interlude enum, benchmark.
- **Break it**: Remove a component, observe and explain the failure.

### Rules
- Target 40-60% of chapters. Not every chapter needs a lab.
- Sibling-comparison labs (spanning interludes) are highest value.
- `starter/` must compile and run, just with wrong/incomplete output.
- README.md must include:
  - Goal
  - Prerequisites (which chapters)
  - Estimated time
  - "You'll know you're done when..." (concrete success criteria)
  - Progressive hints in `<details>` tags (not spoilers)

---

## Cheatsheets (cheatsheets/_XX_name.md)

Terminal-printable via `bat`, `glow`, or `cat`. **Hard limit: 60 lines.**

```markdown
# _XX: Concept Name -- Cheatsheet

## In One Sentence
[The concept in one sentence]

## Key Struct
```rust
struct ConceptName {
    field: Type, // role
}
```

## Key Function
```rust
fn core_operation(input) -> output {
    // the 3-5 lines that matter
}
```

## Watch Out For
- [Common mistake #1]
- [Common mistake #2]

## Connections
← _XX (prerequisite) → _XX (next)
↔ _XX (sibling/alternative)
```

Rules:
- One struct, one function, max.
- "Watch Out For" = things the reader will actually get wrong.
- `tip` and `caution` margin notes feed this section.

---

## Supplement Distribution by Size Tier

Supplement defaults scale with book size. More is not better — unused
supplements are waste.

| Tier | Slides | Flashcards | Cheatsheets | Labs |
|------|--------|------------|-------------|------|
| `micro` (5–10 ch) | all chapters | all chapters | skip | 1–2 total, highest-value only |
| `small` (10–20 ch) | all chapters | all chapters | key chapters (~30%) | 30–40% |
| `medium` (20–35 ch) | all chapters | all chapters | all chapters | 40–60% |
| `large` (35–55 ch) | per-Part summary deck | all chapters | all chapters | 40–50% |

**`large` tier slides:** one 8–12 slide deck per Part covering the arc of
that part, plus individual decks for the most important chapters only.
Per-chapter decks for every chapter in a 40+ chapter book is unsustainable.

Default to the tier's settings. Do not generate supplements for chapters
that don't exist yet. Supplement generation happens in Phase 5, after
the chapter is written.

---

## Reference Files

- `references/supplement-examples.md` -- concrete examples of every format
