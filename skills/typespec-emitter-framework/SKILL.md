---
name: typespec-emitter-framework
description: TypeSpec emitter framework built on Alloy - declarative JSX emitters, useTsp() hook, writeOutput, composable emitter components, TypeSpec-to-language mapping
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/extending-typespec/emitter-framework/
  depth: advanced
---
## What I do
- Build TypeSpec emitters using Alloy's JSX component model instead of imperative navigateProgram
- Use the TypeSpec-aware Output wrapper and useTsp() hook
- Map TypeSpec types to language constructs via framework components
- Compose emitters from reusable components (e.g., drop in Zod schema generation)
- Write emitter output with writeOutput from @typespec/emitter-framework

## When to use me
Use when building TypeSpec emitters with the new Alloy-based emitter framework (not the legacy class-based AssetEmitter approach). Trigger on: "typespec emitter framework", "alloy typespec", "declarative emitter", "writeOutput", "useTsp", "typespec JSX emitter", "composable emitter", "emitter components".

## Relationship to other skills
- **typespec-custom-emitters**: Covers the older imperative $onEmit + navigateProgram approach
- **alloy-core**: The underlying JSX code generation framework (language-agnostic)
- **alloy-languages**: Language-specific Alloy components (TypeScript, C#, Python, Go, Java)
- This skill: The TypeSpec integration layer on top of Alloy

## Architecture

```
┌─────────────────────────────────┐
│  TypeSpec Emitter Framework     │  @typespec/emitter-framework
│  (TypeSpec-aware components,    │
│   useTsp(), writeOutput)        │
├─────────────────────────────────┤
│  Alloy Language Components      │  @alloy-js/typescript, etc.
│  (ts.InterfaceDeclaration, etc.)│
├─────────────────────────────────┤
│  Alloy Core                     │  @alloy-js/core
│  (Output, SourceFile, render,   │
│   refkey, symbols, scopes)      │
└─────────────────────────────────┘
```

## Core pattern: JSX-based $onEmit

```tsx
import { EmitContext } from "@typespec/compiler";
import { writeOutput } from "@typespec/emitter-framework";
import * as ay from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";

export async function $onEmit(context: EmitContext) {
  // The emitter framework's Output wraps ay.Output
  // and takes a TypeSpec Program, enabling useTsp() in children
  const tree = (
    <Output program={context.program}>
      <SourceDirectory path={context.emitterOutputDir}>
        <ts.SourceFile path="models.ts">
          {/* Framework components accept a `type` prop with a TypeSpec type */}
          {Array.from(context.program.models.values()).map(model => (
            <TypeScriptInterface type={model} />
          ))}
        </ts.SourceFile>
      </SourceDirectory>
    </Output>
  );

  // writeOutput renders and writes to disk
  await writeOutput(tree);
}
```

### Key difference from imperative emitters
The old way (typespec-custom-emitters skill) uses navigateProgram callbacks that manually build strings. The framework way uses JSX components that declaratively describe the output shape, with the framework handling string building, imports, and formatting.

## Framework components

### Output (TypeSpec-aware wrapper)
```tsx
import { Output } from "@typespec/emitter-framework";

// Wraps @alloy-js/core Output, adds TypeSpec Program context
<Output program={context.program}>
  {/* All children can use useTsp() */}
</Output>
```

### useTsp() hook
Access TypeSpec type graph and typekits from any component:
```tsx
function MyComponent() {
  const tsp = useTsp();
  const program = tsp.program;
  // Access typekits, navigate types, resolve references
  return <>{/* ... */}</>;
}
```

### TypeSpec-to-language components
The framework wraps Alloy language components and adds a `type` prop:
```tsx
// Alloy TypeScript component (manual):
<ts.InterfaceDeclaration name="User">
  name: string;
</ts.InterfaceDeclaration>

// Emitter framework component (TypeSpec-aware):
// Takes a TypeSpec Model type and auto-converts to TypeScript interface
<TypeScriptInterface type={myTypeSpecModel} />
```

### ClassMethod with TypeSpec Operation
```tsx
// Emit a TypeSpec Operation as a class method
<ClassMethod type={operation}>
  {/* body */}
</ClassMethod>
```

## Emitter composition

The framework's key feature: emitters can expose reusable components.

```tsx
// Emitter A exposes a component
export function ZodSchema({ type }) {
  // converts TypeSpec type to Zod schema code
  return <ts.VarDeclaration name={`${type.name}Schema`}>
    z.object({"{"}
      {Array.from(type.properties.values()).map(p =>
        `${p.name}: z.${mapToZodType(p.type)}()`
      ).join(",\n")}
    {"}"})
  </ts.VarDeclaration>;
}

// Emitter B uses Emitter A's component
import { ZodSchema } from "typespec-zod-emitter";

export async function $onEmit(context: EmitContext) {
  const tree = (
    <Output program={context.program}>
      <ts.SourceFile path="schemas.ts">
        {models.map(m => <ZodSchema type={m} />)}
      </ts.SourceFile>
    </Output>
  );
  await writeOutput(tree);
}
```

### Customization hooks
Emitters can expose swap points:
```tsx
// MCP server emitter exposes a dispatcher hook
<McpServer dispatcher={customDispatcher}>
  {/* generates MCP server with custom dispatch logic */}
</McpServer>
```

## Typekits
Convenient API for pulling information from the TypeSpec type graph:
```tsx
function EmitModel({ model }) {
  const tsp = useTsp();
  const typekit = tsp.typekit;

  // Get effective model type (resolves spreads, extends, etc.)
  const effective = typekit.getEffectiveModelType(model);

  // Check if template instance
  if (typekit.isTemplateInstance(model)) {
    const templateArgs = model.templateMapper?.args;
  }

  return <>{/* render model */}</>;
}
```

## Extending to non-TypeScript targets

The framework currently has deep TypeScript support. For other languages:

1. Use the corresponding Alloy language package (@alloy-js/csharp, @alloy-js/python, etc.)
2. Write your own TypeSpec-to-language mapping components
3. The framework's Output and useTsp() work with any Alloy language

```tsx
import * as py from "@alloy-js/python";

function PythonDataclass({ type }: { type: Model }) {
  const props = Array.from(type.properties.values());
  return (
    <py.Dataclass name={type.name}>
      {props.map(p => `${p.name}: ${mapToPythonType(p.type)}`).join("\n")}
    </py.Dataclass>
  );
}
```

For Rust: no @alloy-js/rust package exists yet. Options:
- Build one following the language package structure (see alloy-languages skill)
- Use `<ay.SourceFile>` with raw string templates for Rust syntax
- Use Azure/typespec-rust as reference (66.5% Rust, 21.3% TypeScript)

## Functions in the type graph (1.10+)

Functions declared with `extern fn` appear as `functionDeclarations` on Namespace nodes. Emitters can visit them via the semantic walker. Functions produce types/values at check-time, so by the time an emitter runs, function call results are already resolved in the type graph. No special emitter handling is needed for function results -- they appear as regular types.

See **typespec-functions** skill for the full function declaration and implementation pattern.

## Known limitations and feedback (from issue #2729)
- Context management is unclear beyond basic scoping examples
- Default do-nothing implementations obscure required method overrides
- No methods for emitting template declarations (blocks typespec-apiview)
- `unionVariantReference` missing (exists for enums but not unions)
- Users want declarative configuration-driven patterns:
  ```
  createAssetEmitter(
    union: () => handler,
    unionVariants: JoinVariantsWith(" | "),
    unionVariant: KeepRef
  )
  ```
- Framework is experimental, breaking changes will happen

## Example prompts
"Build a TypeSpec emitter using the Alloy framework"
"Create composable emitter components for TypeSpec models"
"Use useTsp() to access the TypeSpec type graph in a component"
"Emit TypeSpec models as Python dataclasses using the emitter framework"

## Verification
- `tsp compile --emit ./my-emitter` produces expected output
- writeOutput creates files in correct directory structure
- Cross-file references resolve with correct imports
- Composed components from other emitters integrate correctly
