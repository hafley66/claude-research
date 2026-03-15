---
name: tree-sitter-queries
description: Tree-sitter query language — S-expression patterns, captures, field names, predicates, quantifiers, anchors, alternations, and wildcards
license: MIT
compatibility: opencode
metadata:
  source: https://tree-sitter.github.io/tree-sitter/using-parsers/queries/
  depth: intermediate
---
## What I do
- Write tree-sitter queries using S-expression syntax
- Use captures, predicates, quantifiers, and anchors
- Filter matches with #eq?, #match?, #any-of? predicates
- Build queries for syntax highlighting, code analysis, and editor features
- Understand the difference between tree-sitter queries and ast-grep patterns

## When to use me
Use when writing tree-sitter queries directly (for highlighting, editor features, or tools that consume tree-sitter queries), or understanding the query language that underpins tree-sitter-based tooling.

## Note on ast-grep vs tree-sitter queries
ast-grep uses its own pattern syntax (code-as-pattern + metavariables), not tree-sitter's S-expression query language. Tree-sitter queries are used in editors (Neovim, Helix), syntax highlighting, and tools that consume `.scm` query files. Both systems operate on the same parse trees.

## S-expression basics

Match a node type with parentheses:
```scheme
(function_declaration)
```

Match with children:
```scheme
(function_declaration
  name: (identifier)
  body: (statement_block))
```

## Captures

Tag matched nodes with `@name` for extraction:
```scheme
(function_declaration
  name: (identifier) @function.name
  body: (statement_block) @function.body)
```

Captures appear after the node they reference.

## Field names

Prefix child patterns with `field_name:` to match specific structural roles:
```scheme
(assignment_expression
  left: (identifier) @variable
  right: (call_expression) @value)
```

## Negated fields

Match nodes that lack a specific field:
```scheme
(class_declaration
  name: (identifier) @class.name
  !type_parameters)
```
Matches classes without generic type parameters.

## Anonymous nodes

Match literal tokens (operators, keywords, punctuation) with double quotes:
```scheme
(binary_expression
  operator: "!="
  right: (null) @null.check)
```

## Wildcards

```scheme
(_)     ; matches any named node
_       ; matches any node (named or anonymous)
```

## Quantifiers

```scheme
(comment)+          ; one or more comments
(comment)*          ; zero or more comments
(string)?           ; optional string

; Quantified groups
((number) ("," (number))*)    ; comma-separated numbers
```

Quantifiers apply to the preceding pattern or group.

## Alternations

Square brackets for alternatives:
```scheme
(call_expression
  function: [
    (identifier) @function.direct
    (member_expression
      property: (property_identifier) @function.method)
  ])
```

## Anchors

The `.` operator constrains sibling position:
```scheme
; First child only
(array . (number) @first)

; Last child only
(array (number) @last .)

; Immediate siblings (no nodes between them)
(statement_block
  (return_statement) @ret
  .
  (expression_statement) @after-ret)
```

Anchors ignore anonymous nodes when constraining.

## Predicates

### #eq? / #not-eq?
Compare capture text to a string or another capture:
```scheme
((identifier) @builtin
  (#eq? @builtin "self"))

; Compare two captures
((assignment_expression
  left: (identifier) @left
  right: (identifier) @right)
  (#eq? @left @right))
```

### #match? / #not-match?
Regex match on capture text:
```scheme
((identifier) @constant
  (#match? @constant "^[A-Z][A-Z_]+$"))
```

### #any-of? / #not-any-of?
Match against a set of strings:
```scheme
((identifier) @builtin
  (#any-of? @builtin "arguments" "module" "console" "window"))
```

### #any-eq? / #any-match?
For quantified captures, match if any captured node satisfies (instead of all):
```scheme
((comment)+ @comments
  (#any-match? @comments "TODO"))
```

### #is? / #is-not?
Assert properties on captures:
```scheme
((identifier) @variable
  (#is-not? local))
```

## Directives

### #set!
Associate metadata with a pattern:
```scheme
((comment) @injection.content
  (#set! injection.language "markdown"))
```

### #select-adjacent!
Filter captures to only adjacent nodes.

### #strip!
Remove regex-matched text from a capture.

## Predicate placement

Predicates go inside the outermost pattern parentheses, after all node patterns:
```scheme
((binary_expression
  left: (number_literal) @left
  right: (number_literal) @right)
  (#eq? @left @right))
```

## Common query file types

| File | Purpose |
|------|---------|
| `highlights.scm` | Syntax highlighting |
| `injections.scm` | Language injection (e.g., JS in HTML) |
| `locals.scm` | Local variable scoping |
| `textobjects.scm` | Editor text objects (Neovim) |
| `indents.scm` | Auto-indentation rules |
