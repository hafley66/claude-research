---
name: typespec-tooling
description: TypeSpec tooling — CLI commands, VS Code extension, formatter, package manager, reproducibility, tracing
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/handbook/cli https://typespec.io/tooling
  depth: intro
---
## What I do
- Initialize projects with `tsp init` (empty, REST API template)
- Compile with `tsp compile` and emitter options
- Format code with `tsp format` using built-in formatter
- Install packages with `tsp install` package manager
- Configure tracing for debugging compilation
- Use VS Code extension for syntax highlighting, completion, diagnostics
- Ensure reproducibility with locked package versions

## When to use me
Use this when setting up TypeSpec tooling, debugging compilation, or configuring editor support.

## Core patterns

### CLI commands
```bash
# Initialize project
tsp init              # Interactive template selection
tsp init --template rest-api

# Compile
tsp compile           # Compile all .tsp files
tsp compile --emit @typespec/openapi3
tsp compile --watch   # Watch mode

# Format
tsp format            # Format all .tsp files
tsp format --check    # Check formatting without writing

# Package management
tsp install           # Install dependencies from tspconfig.yaml
tsp install @typespec/http
tsp remove @typespec/http
```

### tspconfig.yaml
```yaml
version: 1.0.0

emit:
  - "@typespec/openapi3"
  - "@typespec/json-schema"

options:
  "@typespec/openapi3":
    output-file: "openapi.yaml"

imports:
  - "@typespec/http"
  - "@typespec/rest"

trace:
  - "*"
```

### VS Code extension
- Syntax highlighting for .tsp files
- Code completion (Ctrl+Space)
- Diagnostic errors inline
- Go to definition (F12)
- Format on save
- Playground integration

### Formatter rules
- Consistent indentation (2 spaces default)
- Decorator ordering
- Model property sorting
- Interface operation grouping

### Tracing
```yaml
trace:
  - "compiler:*"
  - "emitter:*"
```

View trace output in terminal or VS Code output panel.

### Reproducibility
```yaml
# Lock package versions
dependencies:
  "@typespec/compiler": "1.9.0"
  "@typespec/http": "1.9.0"
  "@typespec/openapi3": "1.9.0"
```

Commit tspconfig.yaml with locked versions for consistent builds.

### Playground
- https://typespec.io/playground
- Share snippets via URL
- Test compilation without local setup
- Experiment with decorators and emitters

## Example prompts
"Initialize a new TypeSpec REST API project"
"Configure tspconfig.yaml with OpenAPI and JSON Schema emitters"
"Debug compilation with trace logging"
"Format all .tsp files in the project"

## Expected output
- Initialized project with main.tsp and tspconfig.yaml
- Compiled output files (openapi.yaml, schema.yaml)
- Formatted code with consistent style
- Trace logs for debugging issues

## Verification
- Run `tsp compile --diagnostics` to see all errors
- Check `tsp format --check` passes
- Verify VS Code extension shows no errors
- Confirm generated files match expected output
