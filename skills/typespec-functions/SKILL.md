---
name: typespec-functions
description: TypeSpec functions (1.10+) — extern fn declarations, JS implementations via $functions, function types, type transforms, value computation, higher-order functions
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/language-basics/functions/
  depth: advanced
---
## What I do
- Declare functions with `extern fn` that compute and return types or values
- Implement function JS backends via `$functions` export (not bare exports)
- Use function types (`fn(x: valueof string) => valueof string`) for higher-order patterns
- Transform types without mutating existing instances (replaces mutative decorators)
- Compute default values with arbitrary JS logic
- Accept options objects with `valueof` for type-safe configuration
- Pass functions as arguments to decorators and templates

## When to use me
Use this when creating type transforms, computing values at check-time, replacing mutative decorators like `@withVisibilityFilter`, or building libraries that need input-output style type manipulation. Trigger on: "extern fn", "typespec function", "function type", "$functions", "type transform", "compute default", "FunctionContext".

## Status
Experimental in TypeSpec 1.10.0 (March 2025). Declaring a function yields a warning suppressible with `#suppress "experimental-feature"`.

## Core patterns

### Declaring functions
```tsp
// No args, returns unknown (default return constraint)
extern fn createDefaultModel();

// Takes a type, returns a type
extern fn transformModel(input: string);

// Takes a value, returns a type
extern fn createFromValue(name: valueof string);

// Returns a value
extern fn getDefaultName(): valueof string;

// Takes and returns values
extern fn processFilter(filter: valueof Filter): valueof Filter;

// Optional + rest parameters
extern fn process(
  model: Model,                   // Type parameter
  name: valueof string,           // Value parameter
  optional?: string,              // Optional type parameter
  ...rest: valueof string[]       // Rest parameter with values
);
```

### Calling functions
```tsp
// In an alias (function result is a type)
alias ProcessedModel = transformModel("input");

// As a default value
model Example {
  name: string = getDefaultName();
}

// With template caching wrapper
// Functions never cache results. Templates do. Wrap function calls
// in template aliases when the same transform will be called repeatedly.
alias Read<M extends Model> = applyVisibility(M, READ_FILTER);
```

### Functions are values, not types
```tsp
extern fn example(): unknown;

// OK: function is a value, assign to const
const f = example;

// Error: a value cannot be used as a type
alias F = example;

// OK: the result of calling a function is a type
alias T = example();
```

### Type transformation (replacing mutative decorators)
```tsp
extern fn applyVisibility(input: Model, visibility: valueof VisibilityFilter): Model;

const READ_FILTER: VisibilityFilter = #{ any: #[Public] };

// Template wrapper caches the result per unique M
alias Read<M extends Model> = applyVisibility(M, READ_FILTER);
```

### Value computation
```tsp
extern fn computeDefault(fieldType: string): valueof unknown;

model Config {
  timeout: int32 = computeDefault("timeout");
}
```

### Options objects
```tsp
model CreateDerivedModelOptions {
  name?: string;
}

extern fn createDerivedModel(
  m: Reflection.Model,
  options?: valueof CreateDerivedModelOptions
): Reflection.Model;

model BaseModel { id: int32; }

alias DefaultDerived = createDerivedModel(BaseModel);
alias CustomDerived = createDerivedModel(BaseModel, #{ name: "CustomName" });
```

## Function types

Function type syntax uses `fn` keyword with `=>` for return type:

```tsp
// Examples
fn()                                              // no args, returns unknown
fn() => valueof unknown                           // no args, returns any value
fn() => unknown | valueof unknown                 // returns type or value
fn(x: valueof string) => valueof string           // string value in, string value out
fn(x?: valueof string) => valueof int32           // optional param
fn(x: valueof string, ...rest: valueof string[]) => valueof boolean  // rest params
fn(m: Reflection.Model) => void                   // model type in, void out
```

### Getting a function's type
```tsp
extern fn example(v: valueof string): valueof string;

// typeof extracts the function type
alias Example = typeof example;

const f: fn(v: valueof string) => valueof string = example;
```

### Assignability rules
Function types use **contravariant** parameter checking (stricter than TypeScript):
- Required params must be satisfied by required params (not rest)
- Optional params may be satisfied by required, optional, or rest
- Rest params can satisfy optional params but NOT required params
- Return types are covariant (subtype OK)

| A | B | A assignable to B? | Why |
|---|---|---|---|
| `fn () => valueof string` | `fn () => valueof unknown` | Yes | string assignable to unknown |
| `fn (x: valueof unknown) => void` | `fn (x: valueof string) => void` | Yes | contravariance: B's string assignable to A's unknown |
| `fn (x: valueof string) => void` | `fn (x: valueof unknown) => void` | No | B could be called with non-string |
| `fn (x: valueof string) => void` | `fn (...args: valueof string[]) => void` | No | rest is effectively optional, can't satisfy required |
| `fn (...args: valueof string[]) => void` | `fn (x: valueof string) => void` | Yes | rest accepts the required string arg |

## Higher-order functions

Functions and decorators can accept other functions as arguments:

```tsp
// Decorator that accepts a function
extern dec apply(target: Reflection.Model, f: valueof fn(m: Reflection.Model) => void);

// Function that accepts a function (map pattern)
extern fn map(
  arr: valueof unknown[],
  f: valueof fn(item: valueof unknown) => valueof unknown
);

// Template with function-valued parameter and default
model MyTemplate<
  Props extends Reflection.Model,
  MakeId extends valueof fn(props: Reflection.Model) => valueof string = makeIdDefault
> {
  id: string = MakeId(Props);
  ...Props;
}

extern fn makeIdDefault(props: Reflection.Model): valueof string;
```

Note: `valueof` is required to accept a callable function value. Without it, the parameter accepts a function _type_ (not callable).

## JS implementation

### $functions export (not bare exports)
```typescript
// lib.ts
import { FunctionContext } from "@typespec/compiler";

export const $functions = {
  // Keys are namespace paths
  "MyOrg.MyLib": {
    concat,
    rename,
    join,
  },
};

function concat(context: FunctionContext, l: string, r: string): string {
  return l + r;
}

function rename(context: FunctionContext, model: Model, name?: string): Model {
  if (!name || model.name === name) return model;
  // create and return a new model with the given name
  // ...
}

function join(context: FunctionContext, sep: string, ...rest: string[]): string {
  return rest.join(sep);
}
```

### Binding to TypeSpec declarations
```tsp
// lib.tsp
import "./lib.js";

namespace MyOrg.MyLib;

extern fn concat(l: valueof string, r: valueof string): valueof string;
extern fn rename(m: Reflection.Model, name?: valueof string): Reflection.Model;
extern fn join(sep: valueof string, ...rest: valueof string[]): valueof string;
```

### FunctionContext
First argument to every JS function implementation. Provides:
- `functionCallTarget`: target node for reporting diagnostics on the call site
- `getArgumentTarget(index)`: target node for a specific argument

```typescript
function renamed(ctx: FunctionContext, model: Model, name: string): Model {
  // Report diagnostic on the function call itself
  reportDiagnostic({
    code: "my-diagnostic-code",
    target: ctx.functionCallTarget,
  });
  // Report on a specific argument
  reportDiagnostic({
    code: "my-other-code",
    target: ctx.getArgumentTarget(0),
  });
}
```

### Value marshalling (same as decorators)
| TypeSpec value type | JS type |
|---|---|
| `string` | `string` |
| `boolean` | `boolean` |
| `numeric` (int32, float32, etc.) | `number` |
| `numeric` (int64, uint64, decimal128, etc.) | `Numeric` |
| `null` | `null` |
| enum member | `EnumValue` |

Types are passed as-is (not marshalled).

### Void return handling
JS functions returning `undefined` are accepted for TypeSpec `void` return type. The call always evaluates to the `void` intrinsic type regardless.

## Functions vs decorators vs templates

| Aspect | Functions | Decorators | Templates |
|---|---|---|---|
| Keyword | `extern fn` | `extern dec` | (on model/op/etc) |
| Returns values | Yes | No (void only) | N/A |
| Modifies types | Creates new types | Attaches metadata | Creates new instances |
| Caching | Never cached | N/A | Always cached |
| JS binding | `$functions` export | `$decoratorName` export | N/A |
| First-class value | Yes (assignable to const) | No | No |

## Implementation notes
- Function results are never cached. Wrap in template aliases for caching.
- Functions may have side effects (no purity guarantee).
- Functions run in the compiler. Expensive logic impacts compilation and LSP performance.
- The type graph exposes functions as `functionDeclarations` on a Namespace.
- The semantic walker visits FunctionValue declarations.
- TSPD generates extern signatures for functions (like decorators).

## Example prompts
"Create a function that transforms a model based on visibility filters"
"Implement a type computation function with JS backend"
"Define a higher-order function that accepts a mapping function"
"Replace @withVisibilityFilter with a function-based approach"
"Create a function that computes default values for model fields"

## Verification
- Run `tsp compile` to verify function declarations resolve
- Check that `$functions` export binds correctly to `extern fn` declarations
- Verify function types assignability in template constraints
- Test value marshalling with different TypeSpec value types
- Confirm diagnostics target function call site vs argument positions
