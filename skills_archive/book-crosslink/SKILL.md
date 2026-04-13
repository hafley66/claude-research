---
name: book-crosslink
description: >
  Multi-book project linking for the book-project skill family.
  Manages cross-references between books, merged glossaries, shared
  dependencies, and combined progress tracking. Small+ tiers only.
  Trigger on: "cross-book", "multi-book", "link books", "book family",
  "shared glossary", or any request involving connections between
  multiple mdBook projects.
---

# Book Cross-Linking

Connect multiple mdBook projects into a family with shared
references, merged glossaries, and combined progress tracking.

See `references/cross-book-linking.md` for the full spec.

---

## When to Use

Cross-book linking makes sense when:
- Two domains overlap (e.g., ML book references linear algebra book)
- Same reader studies multiple related topics
- A concept in one book is a prerequisite for another book

---

## Project Layout

```
study-books/
├── ml-through-rust/
├── networking-through-rust/
├── shared/                     # optional shared crate deps
│   └── common-math/
└── books.toml                  # family registry
```

### books.toml

```toml
[family]
name = "rust-study"

[[books]]
name = "ml-through-rust"
path = "./ml-through-rust"
short = "ML"

[[books]]
name = "networking-through-rust"
path = "./networking-through-rust"
short = "Net"
```

---

## Chapter Cross-References

In chapter Connections block:

```markdown
- **Cross-ref [Net]:** [_03 TCP/IP](../../networking-through-rust/book/src/part-1/_03_tcp.md)
  -- both use sliding windows, different context
```

Rules:
- Use short name from books.toml: `[Net]`, `[ML]`
- Include one sentence on WHY they're linked
- Bidirectional: if ML links to Net, Net links back
- Don't link for superficial similarity ("both use traits")
- Do link when the same structure genuinely aids understanding in both

---

## Features

- **Glossary merging**: Terms tagged in one book appear in sibling glossaries
- **bookctl multi-book**: Combined progress view, `--book` filter
- **Shared crates**: Optional common workspace members for genuinely shared types

---

## Reference Files

- `references/cross-book-linking.md` -- full spec with examples
