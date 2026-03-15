---
name: tree-sitter-core
description: Tree-sitter parser fundamentals — CST vs AST, named/unnamed nodes, fields, significance, node kinds, and how ast-grep maps to tree-sitter internals
license: MIT
compatibility: opencode
metadata:
  source: https://tree-sitter.github.io/tree-sitter/
  depth: intermediate
---
## What I do
- Explain tree-sitter's parsing model and node classification
- Distinguish named vs unnamed nodes, fields vs kinds
- Map ast-grep concepts to underlying tree-sitter structures
- Help debug AST matching issues caused by node type confusion
- Navigate tree-sitter parse trees effectively

## When to use me
Use when debugging ast-grep patterns that don't match as expected, understanding tree-sitter node types, or working directly with tree-sitter parse trees.

## What tree-sitter is

A parser generator and incremental parsing library. Given a grammar, it produces a C parser that:
- Parses any programming language into a concrete syntax tree
- Updates the tree incrementally as source code changes
- Handles syntax errors gracefully (always produces a tree)
- Runs in pure C11 with no dependencies

## CST vs AST

ast-grep operates on **Concrete Syntax Trees** despite the name. CSTs preserve all syntactic detail.

```
Source: 1 + 2

CST (what tree-sitter produces):
  binary_expression
    number_literal "1"
    "+"              <-- preserved in CST, absent in traditional AST
    number_literal "2"
```

## Node classification

### Named nodes
Defined by rule names in the grammar. Have a `kind` property.
```
binary_expression, identifier, function_declaration, string_literal
```
These are what ast-grep's `$VAR` metavariable targets.

### Unnamed (anonymous) nodes
Defined by string literals in the grammar. Represent operators, punctuation, keywords.
```
"+", ",", ";", "if", "return", "("
```
These are what ast-grep's `$$VAR` metavariable targets.

### Significance
A node is **significant** if it is named OR has a field relative to its parent. Otherwise it is **trivial**. ast-grep's pattern matching skips trivial nodes by default (in `smart` strictness).

## Fields

Fields are a parent-child relational property, not a node property.

```
assignment_expression:
  left: identifier    <-- "left" is a field name
  "="                 <-- no field
  right: expression   <-- "right" is a field name
```

Key distinction: **kind** belongs to the node itself, **field** describes the node's role in its parent.

Even unnamed nodes can have fields. In an object pair `{key: value}`, both key and value may be string nodes (same kind), but their fields (`key`, `value`) differentiate them.

### Using fields in ast-grep
```yaml
rule:
  kind: assignment_expression
  has:
    pattern: $TARGET
    field: left
```

## Special node types

### ERROR
Produced when tree-sitter can't parse a region. The parser continues and wraps unparseable text in ERROR nodes.

### MISSING
Inserted by the parser for expected tokens that aren't present (error recovery).

## How ast-grep maps to tree-sitter

| ast-grep concept | tree-sitter concept |
|------------------|---------------------|
| `$VAR` | Named node |
| `$$VAR` | Any node (including unnamed) |
| `kind: X` | Node type string |
| `field: X` | Parent-child field name |
| `pattern: code` | Parsed into tree-sitter tree, then structurally matched |
| Strictness levels | Control which nodes participate in matching |

## Inspecting parse trees

```bash
# ast-grep's debug output
ast-grep run -p 'your code' --debug-query ast -l javascript

# tree-sitter CLI
tree-sitter parse file.js
```

## Node kind discovery

To find the right `kind` value for a rule:
1. Use `ast-grep run -p 'example code' --debug-query ast` to see the tree
2. Use the ast-grep playground (https://ast-grep.github.io/playground.html)
3. Use `tree-sitter parse` on a sample file
4. Check the language's `node-types.json` in the tree-sitter grammar repo

## Common gotchas

- A `pattern` that looks right as text may parse into an unexpected node type. Always verify with --debug-query.
- `kind: expression_statement` vs `kind: call_expression`: wrapping nodes add a layer. Expression statements wrap expressions.
- String delimiters are often unnamed nodes. `"hello"` parses as a `string` node containing unnamed `"` nodes and `string_content`.
- Different languages use different kind names for similar constructs. JavaScript's `arrow_function` vs Python's `lambda`.
