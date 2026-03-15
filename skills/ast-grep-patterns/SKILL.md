---
name: ast-grep-patterns
description: ast-grep pattern syntax — metavariables, multi-node matching, pattern parsing, strictness levels, selector/context patterns, and debugging
license: MIT
compatibility: opencode
metadata:
  source: https://ast-grep.github.io/guide/pattern-syntax.html
  depth: intermediate
---
## What I do
- Write ast-grep patterns using code-as-pattern syntax
- Use metavariables ($VAR, $$$VAR, $$VAR) for structural matching
- Debug pattern parsing issues with playground and --debug-query
- Choose correct strictness level for matching precision
- Use selector/context pattern objects for ambiguous or incomplete code

## When to use me
Use when writing ast-grep patterns for search or rewrite, debugging why a pattern doesn't match, or choosing between pattern string vs pattern object syntax.

## Metavariable syntax

### Single-node metavariables
`$NAME` matches exactly one AST node. Must start with `$`, followed by uppercase letters, underscores, or digits.

```
# Valid
$META, $META_VAR, $META_VAR1, $_, $_123

# Invalid (lowercase, leading digit, kebab-case)
$invalid, $123, $KEBAB-CASE
```

`console.log($GREETING)` matches calls with exactly one argument. Does not match zero or multiple arguments.

### Multi-node metavariables
`$$$` matches zero or more AST nodes.

```
# Match any number of arguments
console.log($$$)

# Named capture of all arguments
console.log($$$ARGS)

# Capture function params and body
function $FUNC($$$ARGS) { $$$ }
```

### Non-capturing metavariables
Prefix with underscore: `$_FUNC` matches but does not capture. Useful when you need structural matching without extraction.

### Unnamed node metavariables
`$$VAR` (double dollar) captures unnamed tree-sitter nodes (operators, punctuation). Single `$VAR` targets named nodes only.

### Identity constraint
Reusing the same metavariable name requires identical matches:
```
$A == $A    # matches a == a, NOT a == b
```

## Pattern object syntax

For patterns that are ambiguous or incomplete code, use the object form:

```yaml
rule:
  pattern:
    context: 'const obj = { a: 123 }'
    selector: pair
```

- `context`: Wraps the pattern in surrounding code so tree-sitter can parse it
- `selector`: AST node kind to extract from the parsed context

This solves cases where bare code fragments parse incorrectly (e.g., `"a": 123` in JSON, `a: 123` as labeled statement vs object pair).

## Strictness levels

Control how precisely patterns match via `--strictness` flag or pattern config:

| Level | Behavior |
|-------|----------|
| `cst` | Exact match including all trivial nodes (punctuation, operators) |
| `smart` | Default. Skips trivial nodes intelligently |
| `ast` | Matches named nodes only, ignores all unnamed nodes |
| `relaxed` | Loosest matching, skips more structural differences |
| `signature` | Matches function signatures ignoring body |

## Pattern parsing pipeline

1. **Preprocess**: `$` metavariables replaced with language-specific expando characters
2. **Parse**: Tree-sitter parses the preprocessed text
3. **Extract**: Effective AST node identified (innermost node with multiple children)
4. **Detect**: Expando characters converted back to metavariables

## Debugging patterns

```bash
# Show how pattern parses
ast-grep run --pattern 'your.pattern' --debug-query ast

# Use the online playground for visual AST inspection
# https://ast-grep.github.io/playground.html
```

## Limitations

- Metavariables must occupy complete AST nodes: `obj.on$EVENT` fails (partial text)
- Metavariables inside string content don't work: `"Hello $WORLD"` fails
- Pattern code must be valid parseable code for the target language
