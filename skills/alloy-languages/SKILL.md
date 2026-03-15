---
name: alloy-languages
description: Alloy language packages - TypeScript, C#, Java, Python, Go components, and creating custom language targets for code generation
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/alloy-framework/alloy
  depth: advanced
---
## What I do
- Use language-specific components for TypeScript, C#, Java, Python, Go
- Understand language package structure for creating custom targets
- Map language constructs to Alloy components (declarations, types, imports)
- Apply language-specific naming conventions and formatting
- Create new language packages following Alloy's architecture

## When to use me
Use when working with specific Alloy language packages, creating language-specific code generation, or building a new language target (e.g., Rust). Trigger on: "alloy typescript", "alloy csharp", "alloy python", "alloy go", "alloy java", "alloy language package", "alloy rust target", "custom alloy language".

## Available language packages

| Package | Import | Status |
|---------|--------|--------|
| @alloy-js/typescript | `import * as ts from "@alloy-js/typescript"` | Stable-ish |
| @alloy-js/csharp | `import * as cs from "@alloy-js/csharp"` | Stable-ish |
| @alloy-js/java | `import * as java from "@alloy-js/java"` | Stable-ish |
| @alloy-js/python | `import * as py from "@alloy-js/python"` | v0.3.0 |
| @alloy-js/go | `import * as go from "@alloy-js/go"` | v0.1.0 |
| @alloy-js/json | `import * as json from "@alloy-js/json"` | Available |
| @alloy-js/markdown | `import * as md from "@alloy-js/markdown"` | Available |

## TypeScript components
```tsx
import * as ts from "@alloy-js/typescript";

<ts.SourceFile path="models.ts">
  <ts.InterfaceDeclaration export name="User">
    name: string;
    email: string;
  </ts.InterfaceDeclaration>

  <ts.VarDeclaration export name="defaultUser" type={userRef}>
    {"{ name: 'anon', email: '' }"}
  </ts.VarDeclaration>

  <ts.FunctionDeclaration export name="createUser" params="name: string">
    return {"{ name, email: '' }"};
  </ts.FunctionDeclaration>
</ts.SourceFile>
```

## C# components
```tsx
import * as cs from "@alloy-js/csharp";

<cs.SourceFile path="Models.cs">
  <cs.ClassDeclaration export name="User" accessModifier="public">
    <cs.Field name="Name" type="string" accessModifier="public" />
    <cs.Field name="Email" type="string" accessModifier="public" />
    <cs.Constructor params="string name, string email">
      Name = name;
      Email = email;
    </cs.Constructor>
    <cs.Method name="ToString" returnType="string" accessModifier="public">
      return $"User(Name, Email)";
    </cs.Method>
  </cs.ClassDeclaration>
</cs.SourceFile>
```

Note: v0.19.0 renamed ClassMember to Field, ClassConstructor to Constructor, ClassMethod to Method (for struct support).

## Python components
```tsx
import * as py from "@alloy-js/python";

<py.SourceFile path="models.py">
  <py.ClassDeclaration name="User">
    name: str
    email: str
  </py.ClassDeclaration>

  {/* v0.3.0: Dataclass component */}
  <py.Dataclass name="Config">
    host: str = "localhost"
    port: int = 8080
  </py.Dataclass>

  <py.FunctionDeclaration name="create_user" params="name: str">
    return User(name=name, email="")
  </py.FunctionDeclaration>

  <py.EnumDeclaration name="Status">
    ACTIVE = "active"
    INACTIVE = "inactive"
  </py.EnumDeclaration>
</py.SourceFile>
```

## Go components
```tsx
import * as go from "@alloy-js/go";

// Go supports type parameters, function symbols, receivers
<go.SourceFile path="models.go" package="models">
  <go.TypeDeclaration name="User" kind="struct">
    Name string
    Email string
  </go.TypeDeclaration>

  <go.FunctionDeclaration name="NewUser" params="name string" returnType="*User">
    {"return &User{Name: name}"}
  </go.FunctionDeclaration>
</go.SourceFile>
```

## Language package anatomy (for creating custom targets)

Each language package follows this structure:
```
packages/<lang>/
  src/
    index.ts           # Package exports
    name-policy.ts     # Naming conventions (camelCase, PascalCase, snake_case)
    create-module.ts   # Module/package creation logic
    builtins/          # Built-in type mappings (string -> String, etc.)
    components/        # Language-specific JSX components
    context/           # Generation context (current file, scope, etc.)
    scopes/            # Scope rules (block, function, module, namespace)
    symbols/           # Symbol table implementation (declarations, references)
  package.json
  tsconfig.json
  vitest.config.ts
```

### Creating a Rust language package

To create `@alloy-js/rust`, you would need:

**name-policy.ts** - Rust naming conventions:
- Types/Traits: PascalCase
- Functions/variables: snake_case
- Constants: SCREAMING_SNAKE_CASE
- Modules: snake_case

**builtins/** - Map base types:
- string -> String / &str
- int32 -> i32
- float64 -> f64
- boolean -> bool
- bytes -> Vec<u8>

**components/** - Rust-specific components:
- StructDeclaration, EnumDeclaration, TraitDeclaration
- ImplBlock, FunctionDeclaration
- UseStatement (imports)
- ModDeclaration
- MatchExpression, ResultType, OptionType

**scopes/** - Rust scope rules:
- Module scope (mod)
- Impl block scope
- Function scope
- Block scope ({})

**symbols/** - Rust symbol handling:
- Crate-level visibility (pub, pub(crate), pub(super))
- Use paths (crate::, super::, self::)
- Trait implementations

### Key integration points
- Symbols and scopes are classes (as of v0.19.0) - language packages subclass these
- `createPackage` supports defining instance and static members
- Binder APIs operate as methods on scope/symbol instances

## Example prompts
"Generate TypeScript interfaces using Alloy components"
"Create a C# class with methods using Alloy"
"Show me the structure of an Alloy language package"
"What would a Rust language package for Alloy look like?"

## Verification
- Language-specific components render valid syntax for target language
- Naming conventions match language idioms
- Cross-file imports resolve correctly per language rules
- Built-in type mappings are complete for common types
