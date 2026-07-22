---
name: tree-sitter-grammars
description: Tree-sitter grammar authoring — grammar.js DSL, rule functions (seq, choice, repeat, prec, field, alias), extras, conflicts, externals, and testing
license: MIT
compatibility: opencode
metadata:
  source: https://tree-sitter.github.io/tree-sitter/creating-parsers/
  depth: advanced
---
## What I do
- Write tree-sitter grammars using the grammar.js DSL
- Use rule functions for sequencing, alternatives, repetition, precedence
- Configure extras (whitespace/comments), conflicts, and externals
- Set up field names and aliases for clean parse trees
- Test grammars with tree-sitter CLI

## When to use me
Use when creating or modifying a tree-sitter grammar for a language, understanding grammar structure for debugging parse issues, or extending language support.

## Project setup

```bash
# Create a new grammar project
tree-sitter init

# Project naming convention: tree-sitter-<language>
# e.g., tree-sitter-mylang
```

## Grammar structure

```javascript
// grammar.js
export default grammar({
  name: 'mylang',

  extras: $ => [/\s/, $.comment],     // tokens allowed anywhere
  conflicts: $ => [[$.type, $.expr]], // intentional ambiguities
  word: $ => $.identifier,            // keyword extraction token
  supertypes: $ => [$.expression, $.statement], // abstract categories
  inline: $ => [$.expr_helper],       // inline rules (remove from tree)

  rules: {
    source_file: $ => repeat($.statement),

    statement: $ => choice(
      $.assignment,
      $.function_declaration,
      $.expression_statement,
    ),

    // ...more rules
  }
})
```

## Rule functions

### Sequencing
```javascript
seq(rule1, rule2, ...)
// Matches rules in order. Like EBNF concatenation.
seq('if', '(', $.expression, ')', $.block)
```

### Alternatives
```javascript
choice(rule1, rule2, ...)
// Matches one of the alternatives. Order is irrelevant.
choice($.string, $.number, $.boolean)
```

### Repetition
```javascript
repeat(rule)    // zero or more (EBNF: rule*)
repeat1(rule)   // one or more (EBNF: rule+)
optional(rule)  // zero or one (EBNF: rule?)
```

### Tokens
```javascript
token(rule)
// Combine a complex rule into a single token (leaf node).
// The sub-rules won't create individual nodes.
token(seq('0x', /[0-9a-fA-F]+/))

token.immediate(rule)
// Same as token(), but no whitespace allowed before match.
// Useful for string escape sequences, template parts.
token.immediate(/[^"\\]+/)
```

### Fields
```javascript
field('name', rule)
// Assigns a field name to a child node.
// Makes the node accessible by name in the parse tree.
field('condition', $.expression)
field('body', $.block)
```

### Aliases
```javascript
alias(rule, name)
// Makes a rule appear with a different name in the tree.
alias($.identifier, $.type_name)  // named alias (appears as node type)
alias('begin', 'keyword')         // string alias
```

## Precedence and associativity

### Numeric precedence
```javascript
prec(number, rule)
// Higher number wins during LR(1) conflicts.
prec(1, seq($.expr, '+', $.expr))
prec(2, seq($.expr, '*', $.expr))  // * binds tighter than +
```

### Associativity
```javascript
prec.left([number], rule)   // left-associative (a + b + c = (a + b) + c)
prec.right([number], rule)  // right-associative (a = b = c = a = (b = c))

// Number is optional, defaults to 0
prec.left(seq($.expr, '+', $.expr))
```

### Dynamic precedence
```javascript
prec.dynamic(number, rule)
// Applied at parse time for genuine ambiguities (GLR).
// Use when static precedence can't resolve the conflict.
```

## Grammar configuration

### extras
Tokens that can appear anywhere between other tokens:
```javascript
extras: $ => [
  /\s/,          // whitespace
  $.comment,     // comments
]
```
Default is whitespace only.

### conflicts
Declare intentional LR(1) conflicts. The parser uses GLR to explore all branches:
```javascript
conflicts: $ => [
  [$.type_expression, $.value_expression],  // same prefix, different parse
]
```

### externals
Tokens handled by a custom C scanner (for context-sensitive lexing):
```javascript
externals: $ => [
  $.indent,
  $.dedent,
  $.newline,
  $.string_content,
]
```
Requires implementing `scanner.c` with `tree_sitter_<lang>_external_scanner_*` functions.

### word
The keyword extraction token. Enables tree-sitter to correctly handle keywords vs identifiers:
```javascript
word: $ => $.identifier
```

### supertypes
Abstract node categories hidden from the tree but available in queries:
```javascript
supertypes: $ => [$.expression, $.statement, $.declaration]
```

### inline
Rules replaced by their definition at all usage sites (removes a tree level):
```javascript
inline: $ => [$.semicolon_terminated]
```

### precedences
Named precedence levels in descending order:
```javascript
precedences: $ => [
  ['member', 'call', 'unary', 'binary', 'ternary', 'assign']
]
// Then use: prec.left('binary', ...)
```

### reserved
Contextual reserved words:
```javascript
reserved: $ => ({
  default: ['if', 'else', 'while', 'for'],
  type_context: ['string', 'number'],  // reserved only in type positions
})
```

## Development workflow

```bash
tree-sitter generate   # Regenerate parser from grammar.js
tree-sitter parse file.ext   # Parse a file and show the tree
tree-sitter test       # Run corpus tests
tree-sitter highlight file.ext  # Test highlighting queries
```

### Corpus tests
Place test files in `test/corpus/`:
```
==================
Test Name
==================

source code here

---

(expected_tree
  (structure))
```

## Common patterns

### Comma-separated lists
```javascript
commaSep: rule => seq(rule, repeat(seq(',', rule)))
commaSep1: rule => seq(rule, repeat(seq(',', rule)))
optionalCommaSep: rule => optional(commaSep(rule))
```

### Operator precedence table
```javascript
const PREC = { assign: 1, or: 2, and: 3, compare: 4, add: 5, mul: 6, unary: 7 }

binary_expression: $ => choice(
  prec.left(PREC.add, seq($.expr, '+', $.expr)),
  prec.left(PREC.mul, seq($.expr, '*', $.expr)),
  // ...
)
```
