---
name: ast-grep-rules
description: ast-grep YAML rule configuration — atomic, relational, and composite rules, constraints, utils, file filtering, and rule composition
license: MIT
compatibility: opencode
metadata:
  source: https://ast-grep.github.io/reference/rule.html
  depth: intermediate
---
## What I do
- Write YAML rule files with atomic, relational, and composite rules
- Compose rules using all/any/not/matches operators
- Filter matches with constraints on metavariables
- Define reusable utility rules
- Control file scope with files/ignores globs
- Configure linting output with severity, message, note, labels

## When to use me
Use when writing ast-grep YAML rules for linting or code transformation, composing multiple matching conditions, or setting up a rule project.

## Minimal rule structure

```yaml
id: no-console-log
language: JavaScript
rule:
  pattern: console.log($$$ARGS)
```

Three required fields: `id`, `language`, `rule`.

## Atomic rules

Match a single AST node by one criterion.

### pattern
```yaml
rule:
  pattern: console.log($ARG)
```
Object form with selector/context:
```yaml
rule:
  pattern:
    context: 'obj.method()'
    selector: call_expression
    strictness: smart
```

### kind
Match by tree-sitter node type:
```yaml
rule:
  kind: call_expression
```

### regex
Match node text against Rust regex (must match entire text):
```yaml
rule:
  regex: ^[a-z]+$
```

### nthChild
Match by position among siblings (1-based):
```yaml
rule:
  nthChild: 1          # first child
  # or: nthChild: "2n+1"  # odd children (An+B formula)
  # or: nthChild: { position: 2, reverse: true, ofRule: { kind: argument } }
```

## Relational rules

Match based on position relative to other nodes.

### inside
Node must be contained within another matching node:
```yaml
rule:
  pattern: await $_
  inside:
    kind: for_in_statement
    stopBy: end          # search to root (default: "neighbor")
```

### has
Node must contain a descendant matching the sub-rule:
```yaml
rule:
  kind: function_declaration
  has:
    kind: return_statement
    stopBy: end
    field: body          # only search in the body field
```

### follows / precedes
Sibling ordering constraints:
```yaml
rule:
  kind: import_declaration
  follows:
    kind: expression_statement
    stopBy: end
```

### stopBy options
- `"neighbor"` (default): immediate surrounding nodes only
- `"end"`: search all the way to root/leaf
- Rule object: stop when a node matches the given rule

### field option
Restrict `inside`/`has` to a specific AST field (e.g., `body`, `arguments`, `left`).

## Composite rules

Combine rules with boolean logic.

### all (implicit AND)
```yaml
rule:
  all:
    - pattern: $OBJ.$METHOD($$$ARGS)
    - has:
        kind: string
```
Note: all fields in a single rule object are implicitly AND-ed. Use explicit `all` when order matters.

### any (OR)
```yaml
rule:
  any:
    - pattern: console.log($$$)
    - pattern: console.warn($$$)
    - pattern: console.error($$$)
```

### not (negation)
```yaml
rule:
  pattern: console.$METHOD($$$)
  not:
    pattern: console.error($$$)
```

### matches (reference utility rule)
```yaml
rule:
  matches: is-console-call
utils:
  is-console-call:
    pattern: console.$METHOD($$$)
```

## Constraints

Filter matches by metavariable properties:
```yaml
rule:
  pattern: console.log($ARG)
constraints:
  ARG:
    kind: identifier    # only match when ARG is an identifier, not a string
```

## Utils

Reusable named rules scoped to the current file:
```yaml
utils:
  is-test-file:
    inside:
      kind: call_expression
      has:
        pattern: describe($$$)
      stopBy: end
```

## Linting fields

```yaml
id: no-await-in-loop
language: TypeScript
severity: warning              # hint | info | warning | error | off
message: "Don't use await inside loops"
note: |
  Performing await in each iteration prevents parallelization.
  Consider Promise.all() instead.
url: https://eslint.org/docs/rules/no-await-in-loop
rule:
  pattern: await $_
  inside:
    any:
      - kind: for_in_statement
      - kind: while_statement
    stopBy: end
labels:
  AWAIT_EXPR:
    style: primary
    message: "This await blocks the loop"
```

## File filtering

```yaml
files:
  - "src/**/*.ts"
ignores:
  - "**/*.test.ts"
  - "node_modules/**"
```

`ignores` is checked before `files`.

## Suppression comments

```javascript
// ast-grep-ignore
riskyCall();

// ast-grep-ignore: no-console-log, no-await-in-loop
console.log("allowed here");
```

## Key behavior

All fields in a rule object are implicitly AND-ed. A node must satisfy every field to match. At least one positive rule (not just `not`) must be present.
