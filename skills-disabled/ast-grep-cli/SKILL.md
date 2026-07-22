---
name: ast-grep-cli
description: ast-grep CLI commands — run, scan, test, new, lsp; project setup with sgconfig.yml; testing rules with snapshots
license: MIT
compatibility: opencode
metadata:
  source: https://ast-grep.github.io/reference/cli.html
  depth: intermediate
---
## What I do
- Use ast-grep CLI for one-off searches and rewrites
- Set up projects with sgconfig.yml
- Organize and scan with YAML rule files
- Write and run rule tests with snapshot verification
- Debug pattern parsing with --debug-query

## When to use me
Use when running ast-grep from the command line, setting up a rule project, or testing rules.

## Commands

### ast-grep run
One-off pattern search and rewrite. Default command (bare `ast-grep` invokes `run`).

```bash
# Search
ast-grep -p 'console.log($$$)' --lang js

# Search with context
ast-grep -p 'useState($INIT)' -l tsx -A 2 -B 2

# Rewrite (interactive)
ast-grep -p 'var $X = $Y' -r 'const $X = $Y' -l js -i

# Rewrite (apply all)
ast-grep -p 'var $X = $Y' -r 'const $X = $Y' -l js -U

# JSON output
ast-grep -p 'TODO' --json pretty

# Debug how a pattern parses
ast-grep -p 'my.pattern()' --debug-query ast

# Selector: match sub-part of pattern
ast-grep -p 'const $X = foo()' --selector identifier -l js
```

Key flags:
| Flag | Purpose |
|------|---------|
| `-p, --pattern` | AST pattern to match |
| `-r, --rewrite` | Replacement string |
| `-l, --lang` | Target language |
| `--selector` | Extract sub-node from pattern by kind |
| `--strictness` | cst, smart, ast, relaxed, signature |
| `--debug-query` | Show parsed AST (ast, cst, pattern) |
| `-i, --interactive` | Confirm each replacement |
| `-U, --update-all` | Apply all replacements |
| `--json` | Output format: pretty, stream, compact |
| `-A/-B/-C` | Context lines after/before/around |
| `--stdin` | Read code from stdin |

### ast-grep scan
Scan codebase using rule files.

```bash
# Scan with project config
ast-grep scan

# Scan with explicit config
ast-grep scan -c path/to/sgconfig.yml

# Scan single rule file
ast-grep scan -r rules/no-console.yml

# Inline rule from CLI
ast-grep scan --inline-rules '{ id: test, language: js, rule: { pattern: "console.log($$$)" }, severity: warning }'

# Filter rules by ID regex
ast-grep scan --filter "no-console.*"

# Output formats
ast-grep scan --format github     # GitHub Actions annotations
ast-grep scan --format sarif      # SARIF for security tools
ast-grep scan --report-style short

# Override severity
ast-grep scan --error no-console-log
ast-grep scan --off no-debug-statements
```

### ast-grep test
Test rules against expected matches.

```bash
# Run tests
ast-grep test

# Skip snapshot verification
ast-grep test --skip-snapshot-tests

# Update all snapshots
ast-grep test -U

# Interactive snapshot review
ast-grep test -i

# Filter tests
ast-grep test -f "no-console*"
```

### ast-grep new
Scaffold projects and rules.

```bash
ast-grep new project           # interactive project setup
ast-grep new rule              # create rule from template
ast-grep new test              # create test case
ast-grep new util              # create utility rule
ast-grep new rule -l python -y # non-interactive with defaults
```

### ast-grep lsp
Start language server for editor integration.

### ast-grep completions
Generate shell completions: `ast-grep completions bash|zsh|fish|powershell`

## Project setup

### sgconfig.yml
```yaml
ruleDirs:
  - rules           # directories containing .yml rule files
testConfigs:
  - testDir: rule-tests
    snapshotDir: __snapshots__
```

### Directory structure
```
project/
  sgconfig.yml
  rules/
    no-console-log.yml
    no-await-in-loop.yml
  rule-tests/
    no-console-log-test.yml
    no-await-in-loop-test.yml
  __snapshots__/
    no-console-log-snapshot.yml
```

## Testing rules

### Test file format
```yaml
id: no-console-log
valid:
  - "logger.info('ok')"
  - "const x = 1"
invalid:
  - "console.log('bad')"
  - "console.log(a, b, c)"
```

### Test outcomes
| Result | Meaning |
|--------|---------|
| `.` | Pass |
| `N` | Noisy: rule flagged valid code (false positive) |
| `M` | Missing: rule missed invalid code (false negative) |

### Snapshot testing
After `ast-grep test -U`, snapshots capture exact match positions and messages. Subsequent runs verify output hasn't changed.

## Common flags (all commands)

| Flag | Purpose |
|------|---------|
| `--follow` | Follow symlinks |
| `--globs` | Include/exclude file paths |
| `-j, --threads` | Thread count |
| `--no-ignore` | Bypass .gitignore (hidden, dot, vcs, etc.) |
| `--inspect` | Diagnostic output (nothing, summary, entity) |
