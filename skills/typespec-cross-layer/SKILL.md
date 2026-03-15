---
name: typespec-cross-layer
description: Cross-layer type mapping with default inference, override decorators, patch semantics, HTTP method behavior
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/extending-typespec/basics/
  depth: advanced
---
## What I do
- Define default type mappings (TypeSpec → Postgres/Kotlin/TS/bespoke)
- Create override decorators for non-default mappings
- Handle patch semantics: optional fields, null vs unset
- Separate input/output types per HTTP method
- Infer target types from TypeSpec base types
- Emit to Postgres DDL, Kotlin data classes, TS types, bespoke systems
- Handle session context injection markers

## When to use me
Use this when you need cross-layer type consistency with default inference, patch semantics, and input/output separation across 6 targets.

## Core patterns

### Default type mapping (no decorator needed)
```tsp
// TypeSpec → Postgres → Kotlin → TS defaults
model User {
  id: uuid;           // uuid → uuid → UUID → string
  createdAt: utcDateTime; // timestamp → Instant → Date
  name: string;       // text → String → string
  age: int32;         // integer → Int → number
  balance: decimal128; // decimal → Decimal → number
}
```

### Override decorators (change from default)
```tsp
import "@cross-layer-lib";

model User {
  @sql("bigint")  // Override: uuid → bigint (for sharding)
  id: uuid;
  
  @kotlin("Long") // Override: int32 → Long
  shardId: int32;
  
  @ts("string")   // Override: decimal128 → string (precision)
  balance: decimal128;
}
```

### Patch semantics (optional/null handling)
```tsp
// PATCH input: field is keyless if unset, null if set to null
model UserPatchInput {
  id?: uuid;       // Optional: may be omitted
  name?: string | null; // Nullable: may be null or omitted
  age?: int32 | null;
}

// POST input: all required fields
model UserCreateInput {
  id: uuid;
  name: string;
  age: int32;
}

// GET output: all fields present
model UserOutput {
  id: uuid;
  name: string;
  age: int32;
  createdAt: utcDateTime;
}
```

### HTTP method type separation
```tsp
@route("/users")
interface Users {
  // GET: output type
  @get list(): UserOutput[];
  
  // POST: create input type
  @post create(@body user: UserCreateInput): UserOutput;
  
  // PATCH: patch input type (optional + nullable)
  @patch update(@path id: uuid, @body user: UserPatchInput): UserOutput;
  
  // DELETE: no body
  @delete delete(@path id: uuid): void;
}
```

### Session context injection
```tsp
model CreateRequest {
  // Normal field: persisted to DB
  name: string;
  
  // Session-injected: runtime only, not persisted
  @session("user_id")
  userId: uuid;
  
  @session("tenant_id")
  tenantId: uuid;
}
```

### Visibility decorators
```tsp
// Field visible in output, not in input
model User {
  @visibility("read")
  id: uuid;

  @visibility("create", "update")
  name: string;

  @visibility("read", "create")
  email: string;
}
```

### Function-based type transforms (1.10+, preferred over mutative decorators)
```tsp
// Functions create new types without mutation, preserving decorator metadata
extern fn applyVisibility(input: Model, filter: valueof VisibilityFilter): Model;

const READ_FILTER: VisibilityFilter = #{ any: #[Public] };

// Template wrapper for caching (functions never cache)
alias ReadView<M extends Model> = applyVisibility(M, READ_FILTER);

alias UserRead = ReadView<User>;
alias UserCreate = FilterVisibility<User, #{ any: #[Lifecycle.Create] }>;
```

See **typespec-functions** skill for implementing custom transform functions with JS backends.

### Custom emitter logic (patch semantics)
```typescript
function emitPatchInput(model: Model, outputDir: string) {
  const patchFields = Array.from(model.properties.entries()).map(([name, prop]) => {
    // Patch: optional + nullable
    const type = getTypeName(prop.type);
    const optional = prop.optional ? "?" : "";
    const nullable = prop.nullable ? " | null" : "";
    return `${name}${optional}: ${type}${nullable}`;
  });
  
  const ts = `
    export interface ${model.name}Patch {
      ${patchFields.join(";")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${model.name}.patch.ts"),
    ts
  );
}
```

### Kotlin data class with nullability
```typescript
function emitKotlinDataClass(model: Model, outputDir: string) {
  const fields = Array.from(model.properties.entries()).map(([name, prop]) => {
    const kotlinType = getKotlinType(prop.type);
    val nullable = prop.nullable ? "?" : "";
    val optional = prop.optional ? "?" : "";
    return `  val ${name}: ${kotlinType}${nullable}${optional}`;
  });
  
  const kotlin = `
    data class ${model.name}(
      ${fields.join(",\n")}
    )
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${model.name}.kt"),
    kotlin
  );
}
```

### Postgres DDL with type mapping
```typescript
function emitPostgresTable(model: Model, outputDir: string) {
  const columns = Array.from(model.properties.entries()).map(([name, prop]) => {
    const sqlType = getSqlType(prop.type);
    const notNull = prop.optional ? "" : " NOT NULL";
    return `  ${name} ${sqlType}${notNull}`;
  });
  
  const sql = `
    CREATE TABLE ${model.name.toLowerCase()} (
      ${columns.join(",\n")}
    );
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${model.name.toLowerCase()}.sql"),
    sql
  );
}
```

### Decorator library definition
```typescript
import { createTypeSpecLibrary, TypeSpecLibraryDef } from "@typespec/compiler";

export const libDef: TypeSpecLibraryDef = {
  name: "cross-layer-lib",
  diagnostics: {
    "invalid-sql-type": {
      severity: "error",
      messages: { default: "Invalid Postgres type: {type}" }
    }
  },
  decorators: {
    "sql": { description: "Override default Postgres type mapping" },
    "kotlin": { description: "Override default Kotlin type mapping" },
    "ts": { description: "Override default TypeScript type mapping" },
    "session": { description: "Mark field as injected from session context" },
    "patch": { description: "Mark field as patchable (optional + nullable)" },
    "input": { description: "Mark field as input-only" },
    "output": { description: "Mark field as output-only" },
  }
};

export const $lib = createTypeSpecLibrary(libDef);
```

### Default type mapping table
```typescript
const DEFAULT_TYPE_MAP = {
  uuid: { sql: "uuid", kotlin: "UUID", ts: "string" },
  string: { sql: "text", kotlin: "String", ts: "string" },
  int32: { sql: "integer", kotlin: "Int", ts: "number" },
  int64: { sql: "bigint", kotlin: "Long", ts: "number" },
  decimal128: { sql: "decimal", kotlin: "Decimal", ts: "number" },
  utcDateTime: { sql: "timestamp", kotlin: "Instant", ts: "Date" },
  boolean: { sql: "boolean", kotlin: "Boolean", ts: "boolean" },
};

function getSqlType(type: Type): string {
  const typeName = getTypeName(type);
  const override = getSqlDecorator(type);
  return override ?? DEFAULT_TYPE_MAP[typeName]?.sql ?? "text";
}
```

## Example prompts
"Define User model with uuid id, string name, int32 age"
"Create patch input type with optional + nullable fields"
"Separate create input vs output types for User"
"Override uuid to bigint for sharding via @sql decorator"
"Mark userId as session-injected via @session decorator"
"Generate Postgres DDL, Kotlin data class, TS types from single model"

## Expected output
- Default type mapping inference (uuid → uuid/UUID/string)
- Override decorators for non-default mappings
- Patch input types (optional + nullable)
- Create input vs output type separation
- Session context injection markers
- Multi-target emission (Postgres/Kotlin/TS/bespoke)

## Verification
- Run `tsp compile --emit ./postgres-emitter` → check DDL
- Run `tsp compile --emit ./kotlin-emitter` → check data classes
- Run `tsp compile --emit ./ts-emitter` → check types
- Verify patch semantics: optional fields, null handling
- Confirm session fields marked correctly
