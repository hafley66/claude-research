---
name: book-assessment
description: >
  Self-assessment test suites and CLI progress tracking for mdBook
  projects. Generates per-chapter test suites mapped to "What I Should
  Know" checklists. Rust projects get cargo test suites; non-Rust get
  concept-check quizzes. bookctl CLI for progress tracking at large
  tier. Part of the book-project skill family. Medium+ tiers only.
  Trigger on: "self-assessment", "cargo test assessment", "bookctl",
  "progress tracker", "track progress", "what should I know", "quiz",
  "test my understanding", or any request to verify understanding or
  track study progress.
---

# Book Assessment

Self-assessment tests and progress tracking for mdBook projects.

**Tier availability** (see `book-project/references/planning-tiers.md`):
- pamphlet/micro: skip (not enough chapters to justify)
- small: optional cargo tests (Rust mode only)
- medium: full test suite
- large: full test suite + bookctl CLI

Two components (medium+ Rust mode): a test suite crate and a CLI tracker binary.

```
crate/
├── assess/                     # self-assessment test suites
│   ├── Cargo.toml              # depends on all chapter crates
│   ├── src/lib.rs              # shared test utilities
│   └── tests/
│       ├── _01_test.rs
│       ├── _02_test.rs
│       └── ...
└── bookctl/                    # progress tracker CLI
    ├── Cargo.toml
    └── src/main.rs
```

---

## Self-Assessment Test Suite

See `references/self-assessment.md` for the full spec.

Per-chapter test files with three categories:

### Conceptual Tests
Assert properties, invariants, expected behaviors. Call chapter crate
functions and check qualitative outcomes.

### Numerical Tests
Given known inputs, assert correct outputs within tolerance. Reader
should be able to compute by hand.

### Structural Tests
Assert implementation has required components. Check types, signatures,
module structure.

### Mapping to "What I Should Know"

| Checklist Item | Test Category |
|---------------|--------------|
| "I can explain what X does" | Conceptual (behavior test) |
| "I can trace fn Y by hand" | Numerical (known input/output) |
| "I understand why Z was insufficient" | Conceptual (failure test) |
| "I can modify W and predict effect" | Conceptual or numerical |

### Running

```bash
cargo test -p assess                          # all chapters
cargo test -p assess --test _04_test          # one chapter
cargo test -p assess --test _04_test conceptual  # one category
cargo test -p assess --test _04_test -- --nocapture  # see output
```

---

## Progress Tracker (bookctl)

See `references/bookctl-spec.md` for the full spec.

Rust CLI binary. Reads/writes `.bookctl.toml` in project root (gitignored).

### Key Commands

```bash
bookctl init                    # setup from SUMMARY.md
bookctl status                  # overview
bookctl status _13              # chapter detail
bookctl mark _13 read           # mark chapter read
bookctl mark _13 lab done       # mark lab complete
bookctl mark _13 cards done     # flashcards reviewed
bookctl mark _13 assess pass    # assessment passed
bookctl next                    # suggest next chapter
bookctl next --path shortest    # by specific reading order
bookctl list --difficulty hard  # filter chapters
bookctl list --status todo      # filter by completion
bookctl timeline                # ASCII progress timeline
bookctl assess _04              # run tests + auto-update status
bookctl reset _13               # reset chapter progress
```

### State File (.bookctl.toml)

```toml
[meta]
book = "project-name"
reading_order = "linear"

[chapters._01_perceptron]
difficulty = "easy"
read = true
lab = "done"
flashcards = "done"
assessment = "pass"
notes = "Finally get why XOR breaks it"
```

### Implementation

- `clap` for arg parsing
- `toml` crate for state
- Reads SUMMARY.md to discover chapters
- `std::process::Command` for `cargo test` in `bookctl assess`
- ANSI colors with `--no-color` flag
- No network access. Entirely local.

---

## Reference Files

- `references/self-assessment.md` -- test suite design, categories, examples
- `references/bookctl-spec.md` -- full CLI specification
