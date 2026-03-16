---
name: alloy-core
description: Alloy code generation framework internals — @vue/reactivity signals, context parent-chain, binder/refkey/scope resolution, render pipeline, formatting intrinsics
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/alloy-framework/alloy
  local: ~/projects/alloy
  depth: advanced
---
## What I do
- Generate source code using JSX components backed by `@vue/reactivity` signals
- Resolve cross-file references via refkey/binder/scope with automatic import generation
- Render component trees through a reactive propagation pipeline (not virtual DOM diffing)
- Provide context via parent-chain walking (like React context but no reconciler)
- Format output using prettier's doc IR (hardline, softline, indent, group, fill)

## When to use me
Use when authoring code generation with Alloy, understanding the reactive rendering pipeline, debugging symbol resolution, or building a new language package. Trigger on: "alloy", "code generation JSX", "alloy component", "ay.Output", "ay.SourceFile", "alloy render", "refkey", "binder".

## Architecture

```
Component Tree (JSX)
    │
    ▼
Reactive Rendering ── @vue/reactivity (ref, effect, computed, shallowRef, memo)
    │
    ├─ Context ── parent-chain walking via globalContext.owner
    ├─ Symbols ── OutputSymbol (reactive props via track/trigger)
    ├─ Scopes ── OutputScope tree (parent chain, declaration spaces)
    └─ Binder ── refkey → symbol resolution (lazy, reactive refs)
    │
    ▼
RenderedTextTree
    │
    ▼
Prettier doc IR ── printTree() → formatted source strings
    │
    ▼
writeOutput() → disk
```

## Reactivity system

Alloy wraps `@vue/reactivity` (Vue's standalone signals library). Not React, not Solid. Vue signals.

```typescript
// Core reactive primitives (re-exported from @vue/reactivity with debug wrappers)
import { ref, shallowRef, computed, memo, effect, onCleanup } from "@alloy-js/core";

const count = ref(0);           // deep reactive cell, access via .value
const shallow = shallowRef({}); // shallow reactive (no deep proxy)
const doubled = computed(() => count.value * 2);  // lazy computed, returns Ref
const tripled = memo(() => count.value * 3);      // eager memo, returns getter fn

// effect runs immediately, re-runs when tracked refs change
effect(() => {
  console.log(count.value); // tracks count
});

// cleanup on re-run or disposal
effect(() => {
  const sub = subscribe(count.value);
  onCleanup(() => sub.unsubscribe());
});
```

Key rule: **non-JSX code in a component function is NOT reactive**. Reading a ref outside JSX/memo/computed/effect gives a snapshot, not a tracked read. JSX templates and `code` template tags ARE reactive contexts.

```tsx
function Example() {
  const v = ref(0);
  const snapshot = v.value; // always 0, never updates
  return <>{v}</>;          // reactive, updates when v changes
}
```

## Context system

Context uses a global stack (`globalContext`) with parent-chain walking. No reconciler. No fiber tree.

```typescript
// packages/core/src/context.ts
export function createContext<T>(defaultValue?: T, name?: string): ComponentContext<T>;
export function useContext<T>(context: ComponentContext<T>): T | undefined;

// useContext walks globalContext.owner chain upward until it finds
// a context entry matching the context's symbol id
```

Four parts:
1. **Interface** -- the data type
2. **Variable** -- `createContext<T>()` returns `{ id: symbol, Provider, default }`
3. **Provider** -- `<MyContext.Provider value={...}>` sets context for children via effect
4. **Accessor** -- `useContext(MyContext)` or custom `useMyThing()` wrapper

Built-in contexts provided by framework components:
- `Output` provides the binder
- `SourceDirectory` provides directory metadata
- `Declaration` provides the current declaration
- `SourceFile` provides file metadata

## Declarations and references (refkey system)

### refkey()
```typescript
import { refkey, namekey, memberRefkey } from "@alloy-js/core";

refkey()                    // unique key (backed by empty object identity)
refkey(schemaObj)           // stable key for a JS object (WeakMap identity)
refkey(schemaObj, "ser")    // composite key: same obj + discriminator
namekey("MyClass")          // refkey with an explicit name
memberRefkey(base, member)  // nested member access: base.member
```

Internally, refkeys are `{ key: string, [REFKEYABLE]() }` objects marked raw (non-reactive). Composite keys join with invisible separator `\u2063`. Same args always return same refkey.

### Using refkeys
```tsx
const userRef = refkey();

// Declaration site -- creates a symbol bound to this refkey
<ts.InterfaceDeclaration export name="User" refkey={userRef}>
  name: string;
</ts.InterfaceDeclaration>

// Reference site (different file) -- auto-generates import
<ts.VarDeclaration name="currentUser" type={userRef}>
  null
</ts.VarDeclaration>

// Object-identity refkeys for schema-driven codegen
const models = api.models.map(m =>
  <ts.InterfaceDeclaration name={m.name} refkey={refkey(m)} />
);
// Later: refkey(someModel) returns the same refkey, resolves to the declaration
```

### Binder (resolution engine)

The binder tracks all scopes and symbols. Resolution is **reactive and lazy**: `resolveDeclarationByKey` returns a `Ref` that starts `undefined` and fills in when the symbol is declared (order-independent).

```
binder.resolveDeclarationByKey(currentScope, refkey)
  → walks scope chains for both reference and declaration
  → finds common ancestor scope
  → returns { symbol, pathUp, pathDown, commonScope, memberPath }
```

Resolution emits diagnostics (warnings for unresolved refkeys) that auto-dismiss when the symbol appears. The binder uses `effect()` to reactively track symbol creation and notify waiting resolutions.

## Scopes and symbols

**OutputScope** -- abstract class, reactive properties (name, parent, children). Language packages subclass it. Scopes form a tree. Each scope has declaration spaces (named containers for symbols).

**OutputSymbol** -- abstract class, reactive. Has refkeys, a scope, member spaces, name policy. Language packages subclass it (e.g. `TSOutputSymbol` adds export/default/tsFlags).

Both use raw `@vue/reactivity` `track()`/`trigger()` on getters/setters for fine-grained reactivity.

```typescript
// Language package subclasses
class TSOutputSymbol extends OutputSymbol {
  static readonly memberSpaces = ["static", "instance", "private-static", "private-instance"];
  // reactive properties: export, default, tsFlags
}

class GoSymbol extends OutputSymbol {
  // minimal -- Go has simpler visibility (exported = capitalized)
  get enclosingPackage(): PackageSymbol | undefined { ... }
}
```

## Rendering pipeline

1. `render(tree)` or `renderAsync(tree)` -- enters root context, renders JSX tree
2. Components are functions called with props, return Children (strings, refs, other components)
3. `effect()` wraps each component's render -- when reactive deps change, that subtree re-renders
4. Results build a `RenderedTextTree` (not DOM, not virtual DOM -- a tree of text chunks + prettier doc nodes)
5. `printTree()` converts to prettier doc IR and formats
6. `writeOutput()` walks the OutputDirectory tree and writes files

```typescript
// Sync render
const output = render(<Output>...</Output>);
writeOutput(output, "./out");

// Async render (needed for resources or devtools)
const output = await renderAsync(<Output>...</Output>);
writeOutput(output, "./out");
```

## Formatting intrinsics

Alloy uses prettier's doc IR under the hood. JSX whitespace is collapsed (like HTML). Control layout with intrinsic elements:

**Line breaks:**
- `<hardline />` / `<hbr />` -- always breaks
- `<softline />` / `<sbr />` -- breaks only if group overflows line width
- `<literalline />` / `<lbr />` -- breaks, ignores indent level
- `<line />` / `<br />` -- breaks if group overflows, otherwise space

**Indentation:**
- `<indent>` / `<dedent>` / `<dedentToRoot>`
- `<align width={n}>` -- indent by specific width

**Groups and fills:**
- `<group>` -- tries to fit children on one line; if not, all breaks expand
- `<fill>` -- like group but only breaks at line boundaries (for prose)

**Conditional:**
- `<ifBreak groupId={id} flatContents={...}>` -- different content based on group break state
- `<indentIfBreak groupId={id} negate>` -- indent tied to another group's break state

**`code` template tag:**
- Preserves line breaks (unlike JSX)
- Strips leading/trailing blank lines
- First significant line sets base indent
- Indented lines with interpolations get nested indent

```tsx
const body = code`
  const x = 1;
  if (x) {
    ${innerCode}
  }
`;
```

## Reusable component patterns

### VisibilityContext (declaration-level modifier via context)

Use when a modifier (e.g. `pub`) should default ON in codegen output but allow per-component override:

```tsx
const VisibilityContext = createContext<string | undefined>();

// Hook: true → "pub ", false → "", undefined → defer to context
function useVisibility(prop?: boolean) {
  const ctx = useContext(VisibilityContext);
  if (prop === true) return "pub ";
  if (prop === false) return "";
  return ctx ?? "";
}

// Emitter wraps the tree to set default
<VisibilityContext.Provider value="pub">
  <RustModule />
</VisibilityContext.Provider>

// Component uses it
function StructDeclaration(props: { pub?: boolean }) {
  const vis = useVisibility(props.pub);
  return <>{vis}struct ...</>;
}
```

Generalizes to any declaration-level modifier that should default differently in codegen vs inline component usage.

### AppendZone (teleport / deferred collection pattern)

Named zones backed by `shallowReactive` arrays. Child components anywhere in the tree append content; the zone renders it at a defined location. Same reactive pattern as scope sets.

```tsx
// Setup
const zones = createZones(); // returns { ZoneProvider, Zone, AppendTo }

// Root
<ZoneProvider>
  <Zone name="routes" />       {/* renders here */}
  <Handlers />
</ZoneProvider>

// Anywhere in the tree
function Handler({ route }) {
  return <AppendTo zone="routes">{route.path}</AppendTo>;
}
```

Use for: router route tables, match arm dispatch tables, import collection, any "gather from children, render at top" pattern.

### CodegenPair (auto/manual file split)

Generic primitive for split-file codegen: `_auto.rs` is regenerated on every run, `.rs` is stubbed once (user-owned).

```tsx
// Context provides implPath so children can reference it
function CodegenPair({ name, children }) {
  const implPath = `${name}.rs`;
  return (
    <CodegenPairContext.Provider value={{ implPath }}>
      <AutoFile name={name}>{children}</AutoFile>
      <StubFile name={name} />
    </CodegenPairContext.Provider>
  );
}

// ImplCall renders a delegation call using implPath from context
function ImplCall({ sig }) {
  const { implPath } = useContext(CodegenPairContext);
  return <>{sig}; // impl in {implPath}</>;
}
```

Protocol-agnostic: HTTP `Endpoint`, gRPC handlers, CLI commands, event handlers all use the same primitive. `AutoFile` regenerates; `StubFile` is skipped if the file already exists.

## Built-in components

| Component | Purpose |
|-----------|---------|
| `<Output>` | Root. Creates binder, accepts namePolicy |
| `<SourceFile path="...">` | File in output tree |
| `<SourceDirectory path="...">` | Directory in output tree |
| `<Scope>` | New naming/symbol scope |
| `<Declaration>` | Declares a symbol in current scope |
| `<For each={items}>` | Map + format (comma, hardline, enderPunctuation) |
| `<Show when={cond}>` | Conditional render |
| `<Switch>` | Multi-branch conditional |
| `<Block>` | Indented block with braces |
| `<Indent>` / `<List>` | Layout helpers |
| `<AppendFile>` | Append to existing file |
| `<CopyFile>` | Copy file to output |
| `<TemplateFile>` | Variable substitution in template |
| `<UpdateFile>` | Read-modify-write |

## String template API (no JSX)

Every component has an STC (String Template Component) variant:

```typescript
import * as ay from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";

const tree = ay.Output({}).children(
  ts.SourceFile({ path: "test.ts" }).children(
    ts.VarDeclaration({ name: "v" }).code`"value"`
  )
);
```

## Project setup

```bash
npm init @alloy-js               # scaffold
pnpm install && pnpm build
```

Critical: `"jsx": "preserve"` in tsconfig (or esbuild config) prevents whitespace corruption before Alloy's babel plugin processes JSX.

Vitest needs the Alloy rollup plugin:
```js
import alloyPlugin from "@alloy-js/rollup-plugin";
export default defineConfig({
  plugins: [alloyPlugin()],
  esbuild: { jsx: "preserve", sourcemap: "both" },
});
```

## Debugging

```bash
ALLOY_TRACE=symbol,resolve npx vitest run           # console trace
ALLOY_TRACE=effect ALLOY_BREAK_ON_DID=5 node --inspect app.js  # break on trace event
ALLOY_DEBUG=1 node app.js                             # devtools UI on :8123
```

Trace phases: `scope`, `symbol`, `resolve`, `effect`, `render`. Sub-phases like `symbol.create`, `resolve.failure`.

Common errors:
- "Cannot render without a context" -- missing `<Output>` wrapper
- "Asynchronous jobs were found but render was called synchronously" -- use `renderAsync()`
- "Need binder context to create declarations" -- `<Declaration>` outside a scope

## Status
Pre-beta. APIs will change. Languages: TypeScript, C#, Java, Python, Go, JSON, Markdown. No Rust package yet.

## Example prompts
"Create an Alloy output tree that generates TypeScript interfaces"
"How does refkey resolution work across files?"
"Debug why a symbol isn't resolving"
"Explain the reactive rendering pipeline"

## Verification
- `npx alloy build` succeeds
- `vitest run` passes
- Generated files contain correct imports and references
- `ALLOY_TRACE=resolve.failure` shows no unresolved refkeys
