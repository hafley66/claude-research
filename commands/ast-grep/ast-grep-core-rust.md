---
description: ast-grep-core crate reference for Rust consumers. API surface (AstGrep / Root / Node / Pattern / NodeMatch), lifetimes, Thread/Send story, canonical snippet, gotchas. Load before embedding ast-grep in Rust.
---

# ast-grep-core

ast-grep-core is the library form of ast-grep: AST pattern matching and code rewriting via tree-sitter. Root owns the source String and tree-sitter Tree; Node<'r> borrows Root. Lifetime 'r ensures nodes cannot outlive the source.

## API surface

- `AstGrep::parse(source, Language)` → Root; Root is Send, can move across threads
- `Root::root()` → Node; `Root::find_all(pattern)` → impl Iterator<Item = NodeMatch>
- `Node<'r>` — borrowed reference into tree; implements `Clone` but not Send (borrows Root lifetime)
- `Pattern::try_compile(pattern_str)` → compiled pattern; Arc it for reuse across multiple searches
- `NodeMatch` — wraps Node + MetaVar captures; `get_match(name)` → Option<Node>
- `Position` — byte offsets into source (not char offsets); `Position::column()` scans from line start O(n)
- `MetaVarMatcher` — constraints for capture variables; language-aware via Language trait

## Lifetime and Send story

- `Node<'r, D>` is not `Send` — holds phantom ref to Root's lifetime 'r; cannot cross thread boundaries
- `Root<D>` is `Send` when `D: Send` (holds owned String buffer and tree-sitter Tree)
- Nodes must be destructed or moved to owned types before leaving a thread context
- Pattern compilation is expensive; Arc<Pattern> and clone for multiple searches

## Canonical snippet

Parse Rust source, find all function definitions, emit text of matched nodes:

```rust
use ast_grep_core::{AstGrep, Language, Pattern};

let source = "fn foo() {} fn bar(x: i32) -> i32 { x }";
let lang = Language::Rust;
let root = AstGrep::parse(source, lang);

let pattern = Pattern::try_compile("fn $_($_) { $$$body }").unwrap();
for m in root.find_all(&pattern) {
    println!("{}", m.text());  // "fn foo() {}", "fn bar(x: i32) -> i32 { x }"
}
```

Extract a capture group:

```rust
let pattern = Pattern::try_compile("fn $name($params) { $$_ }").unwrap();
for m in root.find_all(&pattern) {
    if let Some(name_node) = m.get_match("name") {
        println!("Function: {}", name_node.text());
    }
}
```

Replace all occurrences:

```rust
let replaced = root.replace_all(&pattern, "fn $name() { todo!() }");
println!("{}", replaced);
```

## Gotchas

- `Node<'r>` borrows Root's lifetime. Closure over nodes inside `find_all()` must not escape the closure scope. Collect NodeMatch, not Node, for lifetime-safe storage.
- `Position::column()` is O(n) — scans from line boundary to target offset. Cache column lookups if called repeatedly.
- Language support depends on tree-sitter grammar availability. `Language::Rust`, `Language::TypeScript`, etc. are pre-bound in ast-grep-language crate or custom Language impl.
- Pattern compilation does AST traversal and automaton construction. Reuse compiled Patterns via Arc<Pattern> rather than re-parsing strings.
- Byte offsets in Position are UTF-8 byte indices, not char counts. Line/column computed from bytes; `source[pos.byte_index..pos.byte_index + len]` is safe.
- `text()` on Node copies the &str slice from the source buffer — zero-copy but bounded to 'r lifetime.

## Left-joins

- [ast-grep × ignore](./ast-grep-x-ignore.md) — filter file discovery via gitignore/ignore patterns
- [ast-grep × tree-sitter](./tree-sitter-core.md) — tree-sitter parser internals, grammar creation
- [ast-grep patterns](./ast-grep-patterns.md) — pattern syntax (metavars, $$$holes, kind filters, capture groups)

## Sources

- [ast-grep-core docs.rs](https://docs.rs/ast-grep-core/latest/ast_grep_core/) — fetched 2026-04-18
- [ast-grep-core crates.io](https://crates.io/crates/ast-grep-core) — fetched 2026-04-18
- [ast-grep GitHub](https://github.com/ast-grep/ast-grep) — fetched 2026-04-18
- [ast-grep documentation](https://ast-grep.github.io/) — fetched 2026-04-18
