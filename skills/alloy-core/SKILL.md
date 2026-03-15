---
name: alloy-core
description: Alloy code generation framework - JSX component model, Output/SourceFile/SourceDirectory, rendering, string templates, file I/O, async resources
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/alloy-framework/alloy
  depth: intermediate
---
## What I do
- Generate source code using JSX components or string template API
- Manage output trees with Output, SourceFile, SourceDirectory
- Handle cross-file references via refkey() with automatic import resolution
- Render component trees to disk with ay.render() and writeOutput
- Support async file operations: AppendFile, CopyFile, TemplateFile, UpdateFile
- Format generated code with built-in formatters

## When to use me
Use when authoring code generation with the Alloy framework, creating output file trees, or understanding how Alloy's component model maps JSX to source text. Trigger on: "alloy", "code generation JSX", "alloy component", "ay.Output", "ay.SourceFile", "alloy render".

## Core concepts

### The component model
Alloy borrows from React/Solid. Components are functions that return source text trees. JSX maps declaratively to code structure. The framework handles the hard parts: building source text from strings, linking declarations, importing dependencies, applying naming conventions, and formatting.

### Project setup
```bash
npm init @alloy-js
pnpm install && pnpm build
```

Or manually:
```bash
npm install @alloy-js/core @alloy-js/cli
npm install @alloy-js/typescript  # or csharp, java, python, go
npm install -D typescript vitest
```

Critical tsconfig setting - prevents whitespace corruption before Alloy processes JSX:
```json
{
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

Vitest config requires the Alloy rollup plugin:
```js
import { defineConfig } from "vitest/config";
import alloyPlugin from "@alloy-js/rollup-plugin";

export default defineConfig({
  plugins: [alloyPlugin()],
});
```

### JSX approach - Output tree
```tsx
import * as ay from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";

const helloWorldRef = refkey();

const tree = (
  <ay.Output>
    <ay.SourceDirectory path="src">
      <ts.SourceFile path="greeting.ts">
        <ts.VarDeclaration export name="greeting" refkey={helloWorldRef}>
          "Hello world"
        </ts.VarDeclaration>
      </ts.SourceFile>

      <ts.SourceFile path="index.ts">
        <ts.VarDeclaration export name="main">
          {helloWorldRef}  {/* auto-generates import from greeting.ts */}
        </ts.VarDeclaration>
      </ts.SourceFile>
    </ay.SourceDirectory>
  </ay.Output>
);

const result = ay.render(tree);
// result contains rendered files with resolved imports
```

### String template approach (no JSX)
```typescript
import * as ay from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";

const tree = ay.Output({}).children(
  ts.SourceFile({ path: "test1.ts" }).children(
    ts.VarDeclaration({ name: "v" }).code`"value"`
  )
);
```

### Core components (ay.*)

| Component | Purpose |
|-----------|---------|
| `<ay.Output>` | Root container for all generated output |
| `<ay.SourceFile path="...">` | Generic source file (any language) |
| `<ay.SourceDirectory path="...">` | Directory in output tree |
| `<ay.Scope>` | Creates a new naming/symbol scope |

### File I/O components (v0.19.0+)
```tsx
// Append to existing file
<AppendFile path="log.txt">new content</AppendFile>

// Copy a file
<CopyFile src="template.txt" dest="output.txt" />

// Template file with variable substitution
<TemplateFile path="config.json" template={tmpl} vars={vars} />

// Update existing file (read-modify-write)
<UpdateFile path="manifest.json" transform={fn} />
```

### References and symbols
The `refkey()` system handles cross-file references automatically:
1. A declaration creates a symbol with a refkey
2. Any component referencing that refkey gets automatic imports
3. Naming conventions are applied per-language

```tsx
const userRef = refkey();

// Declaration site
<ts.InterfaceDeclaration export name="User" refkey={userRef}>
  name: string;
  age: number;
</ts.InterfaceDeclaration>

// Reference site (different file) - import auto-generated
<ts.VarDeclaration name="currentUser" type={userRef}>
  null
</ts.VarDeclaration>
```

### Async resources (v0.19.0+)
```typescript
import { createResource, createFileResource, renderAsync } from "@alloy-js/core";

// Fetch external data during generation
const schema = createResource(async () => {
  return await fetchSchema("https://api.example.com/schema");
});

// Read file content
const template = createFileResource("./templates/base.rs");

// Must use renderAsync instead of render
const result = await renderAsync(tree);
```

### Building and testing
```bash
npx alloy build           # production build
npx alloy build --dev     # with debug info
vitest run                # run tests
```

### Status
Pre-beta. APIs will change. Currently supported languages: TypeScript, C#, Java, Python, Go, JSON, Markdown.

## Example prompts
"Create an Alloy output tree that generates TypeScript interfaces"
"Set up a new Alloy project for code generation"
"Use refkey to create cross-file references with automatic imports"
"Generate multiple source files in a directory structure"

## Verification
- `npx alloy build` succeeds
- `vitest run` passes
- Generated files contain correct imports and references
- Output directory structure matches component tree
