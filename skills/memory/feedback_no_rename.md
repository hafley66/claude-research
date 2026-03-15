---
name: no-auto-rename
description: Never auto-rename fields/identifiers for casing conventions in codegen - names pass through verbatim, only keyword-escape
type: feedback
---

Never apply automatic case transformation (snake_case, PascalCase, etc.) to identifiers in code generation. Names pass through exactly as provided. Cross-repo grepping on the original name is more valuable than enforcing language-idiomatic casing.

**Why:** Renaming destroys grep-ability across repos. If a field is called `getUserById` in the source schema, it should be `getUserById` in the generated output. The caller decides casing, not the codegen tool.

**How to apply:** In name policies, only handle keyword escaping (like Rust's `r#` prefix). No `snakeCase()`, `pascalCase()`, or any casing transforms. This applies to all codegen work, not just Alloy/Rust.
