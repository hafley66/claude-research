---
name: ast-grep-api
description: ast-grep programmatic APIs — Node.js (NAPI) and Python bindings for parsing, searching, and rewriting code with SgRoot and SgNode
license: MIT
compatibility: opencode
metadata:
  source: https://ast-grep.github.io/reference/api.html
  depth: intermediate
---
## What I do
- Parse code into AST using Node.js or Python API
- Search for patterns programmatically with SgNode.find/findAll
- Extract matched metavariables
- Apply code rewrites and commit edits
- Use rule configs programmatically (kind, pattern, regex, relational, composite)

## When to use me
Use when building tools on top of ast-grep, writing codemods in JS/Python, or integrating structural search into a pipeline.

## Node.js (NAPI) API

### Parse and search
```javascript
import { parse, Lang } from '@ast-grep/napi'

const root = parse(Lang.JavaScript, `console.log("hello")`)
const node = root.root()

// Find single match
const match = node.find('console.log($ARG)')

// Find all matches
const matches = node.findAll('console.log($$$ARGS)')

// Check if node matches
if (node.matches('console.$METHOD($$$)')) { /* ... */ }
```

### SgRoot
```javascript
const sgRoot = parse(Lang.TypeScript, sourceCode)
sgRoot.root()      // -> SgNode (root of the tree)
sgRoot.filename()  // -> string (file path or "anonymous")
```

### SgNode inspection
```javascript
node.kind()        // tree-sitter node type: "call_expression"
node.text()        // source text of the node
node.range()       // { start: {line, column}, end: {line, column} }
node.isLeaf()      // true if no children
node.isNamed()     // true if named (not punctuation/operator)
```

### SgNode traversal
```javascript
node.parent()      // parent node
node.children()    // all child nodes
node.field('body') // child by field name
node.ancestors()   // walk up the tree
node.next()        // next sibling
node.prev()        // previous sibling
```

### SgNode relational checks
```javascript
node.inside(ruleOrPattern)
node.has(ruleOrPattern)
node.precedes(ruleOrPattern)
node.follows(ruleOrPattern)
```

### Metavariable extraction
```javascript
const match = node.find('console.log($ARG)')
match.getMatch('ARG')              // -> SgNode for the captured arg
match.getMultipleMatches('ARGS')   // -> SgNode[] for $$$ARGS
```

### Code rewriting
```javascript
const root = parse(Lang.JavaScript, source)
const node = root.root()

// Collect edits
const edits = node.findAll('var $X = $Y').map(n => n.replace('const $X = $Y'))

// Apply all edits, get new source
const newSource = node.commitEdits(edits)
```

### findInFiles (batch processing)
```javascript
import { findInFiles, Lang } from '@ast-grep/napi'

const config = {
  paths: ['src/'],
  matcher: {
    rule: { pattern: 'console.log($$$)' },
    language: Lang.JavaScript,
  }
}

// Callback receives matches per file
const results = await findInFiles(config, (filePath, matches) => {
  return matches.length
})
```

### Rule configs (NapiConfig)
```javascript
node.find({
  rule: {
    all: [
      { pattern: '$OBJ.$METHOD($$$)' },
      { inside: { kind: 'function_declaration' } }
    ]
  },
  constraints: {
    METHOD: { regex: '^(log|warn|error)$' }
  }
})
```

## Python API

### Parse and search
```python
from ast_grep_py import SgRoot

root = SgRoot("console.log('hello')", "javascript")
node = root.root()

# Find single match
match = node.find(pattern="console.log($ARG)")

# Find all matches
matches = node.find_all(pattern="console.log($$$ARGS)")

# Check if node matches
if node.matches(pattern="console.$METHOD($$$)"):
    pass
```

### SgNode methods (snake_case equivalents)
```python
node.kind()
node.text()
node.range()
node.is_leaf()
node.is_named()
node.parent()
node.children()
node.field("body")
node.ancestors()
node.next()
node.prev()

# Relational
node.inside(pattern="...")
node.has(kind="identifier")
node.precedes(pattern="...")
node.follows(pattern="...")

# Captures
match.get_match("ARG")             # -> SgNode
match.get_multiple_matches("ARGS") # -> list[SgNode]
```

### Code rewriting (Python)
```python
root = SgRoot(source, "python")
node = root.root()
edits = [m.replace("new_code($X)") for m in node.find_all(pattern="old_code($X)")]
new_source = node.commit_edits(edits)
```

### Rule kwargs (Python)
```python
# find() and find_all() accept Rule fields as kwargs
node.find(kind="call_expression", regex="console\\..*")
node.find_all(
    rule={"all": [{"pattern": "$X + $Y"}, {"not": {"regex": "^0"}}]},
    constraints={"X": {"kind": "identifier"}}
)
```

## Rust API

Unstable. Docs at https://docs.rs/ast-grep-core/latest/ast_grep_core/. Use for building custom tools or extending ast-grep internals.
