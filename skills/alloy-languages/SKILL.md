---
name: alloy-languages
description: Alloy language packages — TypeScript, C#, Java, Python, Go components, package anatomy for building new targets (Rust), name policies, scopes, symbols
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/alloy-framework/alloy
  local: ~/projects/alloy
  depth: advanced
---
## What I do
- Use language-specific components for TypeScript, C#, Java, Python, Go
- Understand language package internal structure for creating new targets
- Map language constructs to Alloy components (declarations, types, imports)
- Apply language-specific naming conventions, scope rules, and symbol resolution
- Create new language packages (e.g. Rust) following the established pattern

## When to use me
Use when working with Alloy language packages, building language-specific code generation, or creating a new language target. Trigger on: "alloy typescript", "alloy csharp", "alloy python", "alloy go", "alloy java", "alloy language package", "alloy rust target", "custom alloy language".

## Available packages

| Package | Import | Files | Status |
|---------|--------|-------|--------|
| @alloy-js/typescript | `import * as ts from "@alloy-js/typescript"` | 67 | Most complete |
| @alloy-js/csharp | `import * as cs from "@alloy-js/csharp"` | Stable-ish |
| @alloy-js/java | `import * as java from "@alloy-js/java"` | Stable-ish |
| @alloy-js/python | `import * as py from "@alloy-js/python"` | v0.3.0 |
| @alloy-js/go | `import * as go from "@alloy-js/go"` | 52 | v0.1.0 |
| @alloy-js/json | `import * as json from "@alloy-js/json"` | Available |
| @alloy-js/markdown | `import * as md from "@alloy-js/markdown"` | Available |

No `@alloy-js/rust` exists yet.

## Language package anatomy

Every language package follows the same structure. The pattern is consistent across TS, Go, C#, etc.

```
packages/<lang>/src/
  index.ts              # re-exports everything
  name-policy.ts        # naming conventions (casing, reserved words)
  create-package.ts     # optional: package/module scaffolding
  builtins/             # built-in type/package mappings
    index.ts
  components/           # JSX components for language constructs
    SourceFile.tsx       # language-aware source file
    Declaration.tsx      # base declaration wrapper
    Reference.tsx        # reference rendering (import generation)
    ...                  # language-specific: StructDeclaration, ClassDeclaration, etc.
    stc/index.ts         # string template component wrappers
  context/              # language-specific contexts
  scopes/               # scope subclasses
    <lang>.ts            # base scope class
    module.ts            # module/file scope
    lexical.ts           # block/function scope
    package.ts           # package/namespace scope
  symbols/              # symbol subclasses
    <lang>.ts            # base symbol class
    reference.tsx        # reference rendering component
    factories.ts         # createScope/createSymbol helpers
```

### The three things every language package must define

**1. Name policy** -- how identifiers are cased per element kind

```typescript
// TypeScript name policy
export type TypeScriptElements =
  | "function" | "parameter" | "class" | "variable"
  | "enum" | "enum-member" | "interface" | "type"
  | "object-member-data" | "class-member-data" | "interface-member";

export function createTSNamePolicy(): NamePolicy<TypeScriptElements> {
  return createNamePolicy((name, element) => {
    switch (element) {
      case "class": case "type": case "interface": case "enum": case "enum-member":
        return pascalCase(name);
      default:
        return camelCase(name);
    }
  });
}

// Go name policy -- simpler, mostly passthrough (Go uses casing for visibility)
export type GoElements =
  | "parameter" | "type-parameter" | "function"
  | "type" | "variable" | "struct-member" | "interface-member";

export function createGoNamePolicy(): NamePolicy<GoElements> {
  return createNamePolicy((name, element) => {
    return ensureNonReservedName(name, element); // minimal transform
  });
}
```

Each policy also handles reserved word avoidance (appending `_` suffix).

**2. Symbol subclass** -- language-specific metadata on symbols

```typescript
// TypeScript: needs export, default, type vs value distinction, member spaces
class TSOutputSymbol extends OutputSymbol {
  static readonly memberSpaces = ["static", "instance", "private-static", "private-instance"];
  // Reactive properties via raw track()/trigger():
  export: boolean;
  default: boolean;
  tsFlags: TSSymbolFlags;  // LocalImportSymbol | TypeSymbol | ParameterSymbol | Nullish
  get isTypeSymbol() { return !!(this.tsFlags & TSSymbolFlags.TypeSymbol); }
}

// Go: simpler -- visibility is just capitalization, needs package tracking
class GoSymbol extends OutputSymbol {
  get enclosingPackage(): PackageSymbol | undefined {
    // walks member spaces and declaration spaces to find package
  }
}
```

**3. Scope subclasses** -- language-specific scope hierarchy

TypeScript scopes:
```
TSPackageScope → TSModuleScope → TSLexicalScope
                                 TSMemberScope
```

Go scopes:
```
GoScope → GoPackageScope → GoModuleScope → GoSourceFileScope → GoLexicalScope
                                                                GoFunctionScope
                                                                GoNamedTypeScope
```

## TypeScript package components

```tsx
import * as ts from "@alloy-js/typescript";

// File-level
<ts.SourceFile path="models.ts">
<ts.PackageDirectory name="my-pkg" version="1.0.0">
<ts.BarrelFile export="." />

// Declarations
<ts.InterfaceDeclaration export name="User" refkey={ref}>
<ts.ClassDeclaration name="Client" export refkey={ref}>
<ts.TypeDeclaration export name="UserId" refkey={ref}>
<ts.VarDeclaration export name="config" refkey={ref}>
<ts.FunctionDeclaration export name="create" params={params} returnType="User">
<ts.EnumDeclaration export name="Status">

// Members
<ts.InterfaceMember name="id" type="string" />
<ts.MemberDeclaration name="count" type="number" />
<ts.ClassMethod async name="fetch" parameters={params} returnType={ret}>

// Expressions
<ts.FunctionCallExpression target="fetch" args={[endpoint, options]} />
<ts.ObjectExpression>
<ts.ArrayExpression>
<ts.NewExpression type={classRef} args={args} />
<ts.ArrowFunction params={params}>

// Documentation
<ts.JSDoc>
<ts.JSDocComment>
<ts.JSDocParam name="id" type="string">
```

## Go package components

```tsx
import * as go from "@alloy-js/go";

<go.SourceFile path="models.go" package="models">
<go.ModuleDirectory name="mymodule">

<go.TypeDeclaration name="User" kind="struct">
<go.InterfaceDeclaration name="Reader">
<go.FunctionDeclaration name="NewUser" params="name string" returnType="*User">
<go.VarDeclaration name="defaultUser" type="User">

// Go-specific
<go.Pointer type={typeRef} />
<go.TypeParameters>{/* generic constraints */}</go.TypeParameters>
<go.Parameters>{/* function params */}</go.Parameters>
```

## End-to-end walkthrough (from docs)

The canonical example: REST API schema → TypeScript client.

```tsx
import { For, Output, render, writeOutput, refkey } from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";

// 1. Create context for the API schema
const ApiContext = createContext<ApiContext>();

// 2. Build component tree
const output = render(
  <Output namePolicy={ts.createTSNamePolicy()}>
    <ApiContext.Provider value={createApiContext(api)}>
      <ts.PackageDirectory name={`${api.name}-client`} version="1.0.0">
        <ts.SourceFile path="models.ts">
          <For each={api.models}>
            {(model) => (
              <ts.InterfaceDeclaration export name={model.name} refkey={refkey(model)}>
                <For each={model.properties} comma hardline enderPunctuation>
                  {(prop) => <ts.InterfaceMember name={prop.name} type={resolveType(prop)} />}
                </For>
              </ts.InterfaceDeclaration>
            )}
          </For>
        </ts.SourceFile>
        <ts.SourceFile path="client.ts">
          <Client />   {/* references model refkeys → auto-imports from models.ts */}
        </ts.SourceFile>
        <ts.BarrelFile export="." />
      </ts.PackageDirectory>
    </ApiContext.Provider>
  </Output>
);

writeOutput(output, "./alloy-output");
```

Key patterns demonstrated:
- `refkey(model)` creates identity-stable keys from schema objects
- Cross-file references resolve automatically (client.ts imports from models.ts)
- `<For>` handles list rendering with formatting control
- Context provides schema access without prop drilling
- Name policy auto-recases (snake_case from spec → camelCase in output)

## Building a Rust language package

No `@alloy-js/rust` exists. To build one, follow the Go package as a template (simpler than TS):

**name-policy.ts:**
```typescript
export type RustElements =
  | "function" | "parameter" | "type" | "variable"
  | "constant" | "struct-member" | "enum-variant"
  | "trait" | "module" | "macro";

export function createRustNamePolicy(): NamePolicy<RustElements> {
  return createNamePolicy((name, element) => {
    switch (element) {
      case "type": case "trait": case "enum-variant":
        return pascalCase(name);
      case "constant":
        return screamingSnakeCase(name);
      default:
        return snakeCase(name);
    }
  });
}
```

**symbols/rust.ts:**
```typescript
class RustSymbol extends OutputSymbol {
  // Default pub. Visibility override available via context if needed later.
  // No member spaces needed (no static/instance distinction in Rust)
}
```

**scopes:**
```
RustScope → RustCrateScope → RustModuleScope → RustLexicalScope
                                                 RustImplScope
                                                 RustFunctionScope
```

**Components needed:**
- `StructDeclaration`, `EnumDeclaration`, `TraitDeclaration`
- `ImplBlock`, `FunctionDeclaration`
- `UseStatement` (imports)
- `ModDeclaration`
- `SourceFile` (creates file AND module scope simultaneously -- Rust's mod=file convention)
- `Reference` (use paths: `crate::`, `super::`, `self::`)
- `LifetimeParameter`, `LifetimeBound` (no analog in other packages, needed for `&'a str`, `where T: 'a`)

## Cross-language portability issues from source study

Things learned from reading the Alloy core and language package source that create friction when targeting non-C#/TS/Java languages, especially Rust:

**Reactive track/trigger boilerplate on symbols.** Every observable property on `OutputSymbol` subclasses manually calls `track(this, GET, "prop")` in the getter and `trigger(this, SET, "prop", newVal, oldVal)` in the setter. TSOutputSymbol does this for `export`, `default`, `tsFlags`. For Rust with pub-by-default, the symbol subclass is thin -- less boilerplate than TS. But any reactive property added later (e.g. if visibility becomes context-driven) requires this wiring.

**Declaration spaces assume types-vs-values split.** TSOutputSymbol checks whether a symbol lives in a "types" space or "values" space to determine if it's a type symbol. Rust has three namespaces (types, values, macros), and a struct name lives in both types and values (like TS classes). This needs careful mapping.

**Reference resolution and Rust's module-tree paths.** The binder computes `pathUp`/`pathDown` between reference scope and declaration scope, then the language Reference component turns that into an import statement. TypeScript turns pathDown into `import { X } from "./file.js"` (file-path-based). Rust's `use` paths are module-tree-relative (`crate::`, `super::`, `self::`). This might actually map MORE naturally to the binder's scope-chain diff than TS does, because if RustModuleScope = file, then pathDown through module scopes IS the `use` path segments. The Reference component would join pathDown scope names with `::` and prepend `crate::` or `super::` based on whether we go through the root. Needs exploration but the architecture may be a better fit for Rust than for TS.

**Member spaces don't model trait impls.** TS has 4 member spaces (static, instance, private-static, private-instance). Go has none. Rust needs a different concept: a type can have inherent impl members AND multiple trait impl members, and trait impls can be in entirely different modules from the type. No existing language package handles "a symbol's members are defined by an impl block that lives elsewhere."

**Scope hierarchy doesn't model Rust's module = file convention.** In Rust, `mod foo;` declares a module that corresponds to a file (`foo.rs` or `foo/mod.rs`). The scope tree and the file tree are the same thing. In TS/Go, scopes and files are somewhat independent. A Rust `SourceFile` component would need to simultaneously create a file AND a module scope, and `mod` declarations inside files would need to create either inline scopes or new files.

**Visibility: default pub.** Rust has scope-relative visibility (`pub(crate)`, `pub(super)`, `pub(in path)`) but for codegen purposes, default everything to `pub`. Implement as a `VisibilityContext` (see alloy-core skill) -- emitter wraps the tree with `value="pub"`, components call `useVisibility(props.pub)`. This lets individual components opt out without prop drilling.

**Lifetimes have no analog in other packages.** Lifetime parameters (`'a`) on structs, functions, impl blocks, and trait bounds are unique to Rust. They participate in type expressions (`&'a str`) and generic bounds (`where T: 'a + Clone`). No existing Alloy component or symbol concept handles this. Needs new components and likely a lifetime-tracking context.

**Name conflict resolution doesn't apply.** TS resolves conflicts by appending numbers (`User`, `User1`). Rust forbids name conflicts in the same scope entirely. The `nameConflictResolver` on the binder should probably emit a diagnostic error for Rust instead of renaming.

**Rust module collision: can't have `foo.rs` and `foo/` in the same directory.** When an endpoint or module has sub-endpoints, the file and its directory cannot share a name. Use distinct base names instead of the Rust `mod.rs` convention -- e.g. `list_users.rs` + `list_users_auto.rs` rather than `users.rs` + `users/mod.rs`. The CodegenPair pattern (see alloy-core skill) naturally avoids this because `AutoFile` and `StubFile` use different suffixes on the same base name.

**Serde attributes: no rename.** `SerdeContainerConfig` and `SerdeFieldConfig` convert to `#[serde(...)]` attr strings but do NOT support rename or renameAll. Names pass through verbatim from the input schema. Container options: `tag`, `content`, `untagged`, `denyUnknownFields`, `default`, `transparent`. Field options: `skip`, `skipSerializing`, `skipDeserializing`, `skipSerializingIf`, `default`, `flatten`, `with`, `alias`.

**Colocated model placement.** Models live as deep as possible in the file tree, collocated with the code that primarily owns them. Hoist to the common ancestor only when a model is referenced across module boundaries. No separate `models/` folder. Alloy's refkey system resolves `use crate::` paths regardless of file location.

**Formatting: ignore prettier, use rustfmt.** Alloy's formatting intrinsics (group, indent, hardline) use prettier doc IR under the hood. Do not fight this for Rust output. Emit syntactically valid Rust without caring about style, pipe through `rustfmt` as a post-processing step. Do not invest time in getting Alloy's formatting to match Rust conventions.

## Example prompts
"Generate TypeScript interfaces using Alloy components"
"Create a Go struct with methods using Alloy"
"Show me the structure of the Go Alloy language package"
"Build a minimal Rust language package for Alloy"
"How does cross-file import resolution work in the TypeScript package?"

## Verification
- Language-specific components render valid syntax for target language
- Naming conventions match language idioms (check with name policy tests)
- Cross-file imports resolve correctly per language rules
- `ALLOY_TRACE=resolve` shows successful resolution for all refkeys
