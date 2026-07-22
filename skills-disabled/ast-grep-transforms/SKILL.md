---
name: ast-grep-transforms
description: ast-grep code rewriting — fix patterns, metavariable substitution, transform operations (replace, substring, convert, rewrite), and FixConfig
license: MIT
compatibility: opencode
metadata:
  source: https://ast-grep.github.io/guide/rewrite-code.html
  depth: intermediate
---
## What I do
- Write fix patterns for automatic code rewriting
- Use metavariable substitution in fix strings
- Apply transform operations to manipulate captured text before substitution
- Use FixConfig for advanced fix behavior (expandStart, expandEnd)
- Chain rewriters for recursive/selective transformations

## When to use me
Use when writing ast-grep rules that modify code, performing codemods, or building complex transformations that need string manipulation of captured values.

## Basic fix

```yaml
id: var-to-let
language: JavaScript
rule:
  pattern: var $NAME = $VALUE
fix: let $NAME = $VALUE
```

CLI equivalent:
```bash
ast-grep run --pattern 'var $NAME = $VALUE' --rewrite 'let $NAME = $VALUE' --lang js
```

## Metavariable substitution

Metavariables from the `rule` are available in `fix`:

```yaml
rule:
  pattern: $X = $Y
fix: $Y = $X
```

Multi-node metavariables work too:
```yaml
rule:
  pattern: |
    def foo($X):
      $$$BODY
fix: |-
  def bar($X):
    $$$BODY
```

### Indentation preservation
ast-grep preserves the indentation level of metavariables in the fix string. The indentation of `$$$BODY` in the fix template determines output indentation.

### Unmatched metavariables
A metavariable in `fix` that wasn't captured by the rule becomes an empty string.

## Transform operations

Transform manipulates metavariable text before it's used in `fix` or `message`. Each transform creates a new named variable.

### replace
Regex find-and-replace on captured text:
```yaml
transform:
  NEW_NAME:
    replace:
      source: $OLD_NAME
      replace: "^get_"        # Rust regex
      by: "fetch_"
```
Supports capture groups in the `by` string.

### substring
Extract a slice of captured text (Python-style indexing):
```yaml
transform:
  INNER:
    substring:
      source: $WRAPPER
      startChar: 1        # inclusive, supports negative
      endChar: -1          # exclusive, supports negative
```
Unicode-aware character indexing.

### convert
Case conversion:
```yaml
transform:
  SNAKE:
    convert:
      source: $CAMEL_NAME
      toCase: snakeCase
      separatedBy: [caseChange]   # optional word boundary hints
```

Supported cases: `lowerCase`, `upperCase`, `capitalize`, `camelCase`, `snakeCase`, `kebabCase`, `pascalCase`

Separators: `dash`, `dot`, `space`, `slash`, `underscore`, `caseChange`

### rewrite (experimental)
Apply rewriter rules to selectively transform sub-nodes:
```yaml
transform:
  NEW_ARGS:
    rewrite:
      source: $$$ARGS
      rewriters: [transform-arg]
      joinBy: ", "

rewriters:
  - id: transform-arg
    rule:
      pattern: $X
    fix: wrap($X)
```
Matches nodes hierarchically, applying only the first matching rewriter per node.

## FixConfig (advanced)

For fixes that need to expand beyond the matched node (e.g., remove trailing commas):

```yaml
fix:
  template: ''
  expandEnd:
    regex: ','
```

Fields:
- `template`: The replacement text (same as string fix)
- `expandStart`: Rule or regex to extend the replacement range backward
- `expandEnd`: Rule or regex to extend the replacement range forward

## Combining transform + fix

```yaml
id: rename-getter
language: Python
rule:
  pattern: def get_$NAME(self): $$$BODY
transform:
  FETCH_NAME:
    replace:
      source: $NAME
      replace: "^(.+)$"
      by: "fetch_$1"
fix: |-
  def $FETCH_NAME(self): $$$BODY
```

## Practical example: case conversion codemod

```yaml
id: camel-to-snake
language: Python
rule:
  kind: identifier
  regex: "[a-z][a-zA-Z]+"
  inside:
    kind: function_definition
    field: name
transform:
  SNAKE:
    convert:
      source: $$$
      toCase: snakeCase
      separatedBy: [caseChange]
fix: $SNAKE
```

## Limitations

- One fix per rule (single node replacement)
- Cannot append uppercase letters directly after metavariables in fix strings; use transform instead
- Non-matched metavariables become empty strings, which can produce invalid code if not handled
