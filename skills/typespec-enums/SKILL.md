---
name: typespec-enums
description: TypeSpec enum patterns — enum declarations, members, values, flags, union conversion, legacy codegen enum replication
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/language-basics/enums/
  depth: intermediate
---
## What I do
- Define enum declarations with members and values
- Handle enum member value assignment (auto, explicit, string, numeric)
- Convert enums to unions for type safety
- Apply decorators: @doc, @summary, @fixed, @flags
- Replicate legacy codegen enum patterns
- Emit enums to multiple target languages (C#, Java, TS, Go, Rust)
- Handle enum member ordering, naming conventions

## When to use me
Use this when defining enum types, replicating legacy codegen with crazy enum features, or converting enums to unions for stricter type checking.

## Core patterns

### Enum declaration
```tsp
enum HttpMethod {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
}

enum Status {
  Active: "active",
  Inactive: "inactive",
  Pending: "pending",
}

enum Priority {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
}
```

### Enum with explicit values
```tsp
enum ErrorCode {
  NotFound: 404,
  Unauthorized: 401,
  Forbidden: 403,
  InternalError: 500,
}

enum Color {
  Red: "#FF0000",
  Green: "#00FF00",
  Blue: "#0000FF",
}
```

### Enum decorators
```tsp
@doc("HTTP request methods")
@summary("Standard HTTP verbs")
enum HttpMethod {
  GET,
  POST,
  PUT,
  DELETE,
}

@fixed
enum FixedStatus {
  // Cannot be extended by other enums
  Active,
  Inactive,
}

@flags
enum PermissionFlags {
  Read: 1,
  Write: 2,
  Delete: 4,
  Admin: 8,
}
```

### Enum to union conversion
```tsp
// Enum as union type
union HttpMethodUnion {
  "GET",
  "POST",
  "PUT",
  "DELETE",
}

// Use enum members as union
alias HttpMethodValues = HttpMethod.GET | HttpMethod.POST | HttpMethod.PUT;

// String enum union
alias StatusValues = "active" | "inactive" | "pending";
```

### Legacy codegen enum patterns
```tsp
// Replicate crazy legacy features
enum LegacyEnum {
  @deprecated("Use NewEnum")
  OldValue: 0,
  
  @encodedName("json", "new_value")
  NewValue: 1,
  
  @doc("This is a complex legacy enum")
  ComplexValue: 2,
}

// Enum with extension
enum ExtensibleEnum {
  Base: 0,
}

// Extend enum (if not @fixed)
enum ExtendedEnum extends ExtensibleEnum {
  Added: 1,
}
```

### Enum member iteration (JS API)
```typescript
import { Enum, EnumMember } from "@typespec/compiler";

function processEnum(enum: Enum) {
  for (const [name, member] of enum.members) {
    const memberName = member.name;
    const memberValue = member.value; // string | number | undefined
    
    // Generate target language enum
    generateCSharpEnum(enum.name, memberName, memberValue);
    generateJavaEnum(enum.name, memberName, memberValue);
    generateTsEnum(enum.name, memberName, memberValue);
  }
}
```

### Enum emission patterns
```typescript
// C# enum
function emitCSharpEnum(enum: Enum, outputDir: string) {
  const members = Array.from(enum.members.entries()).map(([name, m]) => {
    const value = m.value ?? 0;
    return `  ${name} = ${value},`;
  });
  
  const csharp = `
    public enum ${enum.name} {
      ${members.join("\n")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${enum.name}.cs"),
    csharp
  );
}

// Java enum
function emitJavaEnum(enum: Enum, outputDir: string) {
  const members = Array.from(enum.members.entries()).map(([name, m]) => {
    if (typeof m.value === "string") {
      return `  ${name}("${m.value}")`;
    }
    return `  ${name}(${m.value ?? 0})`;
  });
  
  const java = `
    public enum ${enum.name} {
      ${members.join(",\n")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${enum.name}.java"),
    java
  );
}

// TypeScript enum
function emitTsEnum(enum: Enum, outputDir: string) {
  const members = Array.from(enum.members.entries()).map(([name, m]) => {
    if (m.value === undefined) {
      return `  ${name}`;
    }
    return `  ${name} = ${typeof m.value === "string" ? `"${m.value}"` : m.value}`;
  });
  
  const ts = `
    export enum ${enum.name} {
      ${members.join(",\n")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${enum.name}.ts"),
    ts
  );
}
```

### Enum with template
```tsp
enum Status<T extends string> {
  Active: T;
  Inactive: "inactive";
}

// Instantiate
enum UserStatus is Status<"user_active">;
```

### Enum ordering and naming
```tsp
// Explicit ordering
enum OrderedEnum {
  First: 0,
  Second: 1,
  Third: 2,
}

// Naming conventions
enum SnakeCaseEnum {
  snake_case: 0,
  camel_case: 1,
  pascal_case: 2,
}

// Prefix/suffix patterns
enum PrefixedEnum {
  @encodedName("json", "E_GET")
  GET: 0,
  @encodedName("json", "E_POST")
  POST: 1,
}
```

### Flags enum (bitwise)
```tsp
@flags
enum BitFlags {
  None: 0,
  Read: 1,
  Write: 2,
  Execute: 4,
  All: 7,
}

// Combine flags
alias ReadWrite = BitFlags.Read | BitFlags.Write;
```

## Example prompts
"Define enum with string values for status codes"
"Create numeric enum for priority levels 0-3"
"Replicate legacy enum with deprecated members"
"Convert enum to union for stricter type checking"
"Emit enum to C#/Java/TypeScript/Go/Rust"
"Create flags enum with bitwise values"

## Expected output
- Enum declarations with members and values
- Decorators: @doc, @summary, @fixed, @flags
- Enum to union conversions
- Multi-language enum emission
- Legacy enum pattern replication

## Verification
- Run `tsp compile` to verify enum syntax
- Check enum members compile to correct values
- Verify @fixed enums cannot be extended
- Test flags enum bitwise operations
- Confirm emitted enums match target language syntax
