---
name: typespec-input-output
description: Input/output type separation: form types, HTTP method semantics, create/update/read differentiation, validation layers
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/language-basics/visibility/
  depth: advanced
---
## What I do
- Separate input vs output types per operation
- Define form input types with validation constraints
- Handle HTTP method semantics (GET/POST/PATCH/DELETE)
- Create create vs update vs read type variants
- Mark fields as input-only, output-only, or both
- Handle read-only fields (server-generated)
- Apply validation decorators for input types

## When to use me
Use this when designing form inputs, API endpoints, or any flow requiring input/output type separation with validation layers.

## Core patterns

### Input/output separation
```tsp
// Input: client sends this
model UserInput {
  name: string;
  email: string;
  age: int32;
}

// Output: server returns this
model UserOutput {
  id: uuid;          // Server-generated
  name: string;
  email: string;
  age: int32;
  createdAt: utcDateTime;  // Server-generated
  updatedAt: utcDateTime;  // Server-generated
}
```

### Visibility-based separation
```tsp
model User {
  // Input fields (create/update)
  @visibility("create", "update")
  name: string;
  
  @visibility("create", "update")
  email: string;
  
  @visibility("create")
  password: string;  // Only on create
  
  // Output fields (read)
  @visibility("read")
  id: uuid;
  
  @visibility("read")
  createdAt: utcDateTime;
  
  // Both input and output
  @visibility("create", "update", "read")
  age: int32;
}
```

### HTTP method type mapping
```tsp
@route("/users")
interface Users {
  // GET: returns output type
  @get list(): UserOutput[];
  
  @get read(@path id: uuid): UserOutput;
  
  // POST: accepts create input type
  @post create(@body user: UserCreateInput): UserOutput;
  
  // PATCH: accepts update input type (partial)
  @patch update(@path id: uuid, @body user: UserUpdateInput): UserOutput;
  
  // DELETE: no body
  @delete delete(@path id: uuid): void;
}
```

### Create vs update input separation
```tsp
// Create: all required fields
model UserCreateInput {
  name: string;
  email: string;
  password: string;
  age: int32;
}

// Update: partial, some fields optional
model UserUpdateInput {
  name?: string;
  email?: string;
  age?: int32;
}
```

### Form input types with validation
```tsp
model UserFormInput {
  @minLength(3)
  @maxLength(50)
  name: string;
  
  @pattern("^.+@.+\\..+")
  @format("email")
  email: string;
  
  @minValue(0)
  @maxValue(120)
  age: int32;
  
  @minLength(8)
  password: string;
}
```

### Read-only fields (server-generated)
```tsp
model User {
  // Client cannot set these
  @visibility("read")
  id: uuid;
  
  @visibility("read")
  createdAt: utcDateTime;
  
  @visibility("read")
  updatedAt: utcDateTime;
  
  @visibility("read")
  version: int32;  // Optimistic locking
}
```

### Shared base with input/output extension
```tsp
// Base: common fields
model UserBase {
  name: string;
  email: string;
  age: int32;
}

// Input: extends base with validation
model UserInput is UserBase {
  @pattern("^.+@.+\\..+")
  email: string;
  
  @minValue(0)
  age: int32;
}

// Output: extends base with server fields
model UserOutput is UserBase {
  id: uuid;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}
```

### Template for input/output generation
```tsp
model ResourceInputOutput<T extends object> {
  input: T;
  output: T & {
    id: uuid;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  };
}

// Instantiate
alias UserIO = ResourceInputOutput<UserBase>;
```

### Validation layer decorators
```tsp
model UserInput {
  @doc("User display name")
  @summary("Name field")
  @minLength(3)
  @maxLength(50)
  name: string;
  
  @doc("User email address")
  @pattern("^.+@.+\\..+")
  @format("email")
  email: string;
  
  @doc("User age in years")
  @minValue(0)
  @maxValue(120)
  age: int32;
}
```

### Form submission types
```tsp
// Form state (client-side)
model UserFormState {
  name: string;
  email: string;
  age: int32;
  isSubmitting: boolean;
  errors: Record<string>;
}

// Form submission (API payload)
model UserFormSubmit {
  name: string;
  email: string;
  age: int32;
}

// Form response (API response)
model UserFormResponse {
  success: boolean;
  user?: UserOutput;
  errors?: Record<string>;
}
```

### Patch semantics (partial update)
```tsp
model UserPatch {
  // All fields optional
  name?: string;
  email?: string;
  age?: int32;
  
  // Explicit null handling
  @nullable
  name?: string | null;  // May be null or omitted
}
```

### Emitter logic for input/output separation
```typescript
function emitInputOutput(model: Model, outputDir: string) {
  const inputFields = Array.from(model.properties.entries())
    .filter(([name, prop]) => hasVisibility(prop, "create", "update"))
    .map(([name, prop]) => emitField(name, prop));
  
  const outputFields = Array.from(model.properties.entries())
    .filter(([name, prop]) => hasVisibility(prop, "read"))
    .map(([name, prop]) => emitField(name, prop));
  
  const inputType = `
    export interface ${model.name}Input {
      ${inputFields.join(";")}
    }
  `;
  
  const outputType = `
    export interface ${model.name}Output {
      ${outputFields.join(";")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${model.name}.input.ts"),
    inputType
  );
  
  await program.host.writeFile(
    resolvePath(outputDir, `${model.name}.output.ts"),
    outputType
  );
}
```

## Example prompts
"Define UserInput and UserOutput types with separation"
"Create form input type with validation decorators"
"Separate create vs update input types"
"Mark fields as read-only (server-generated)"
"Handle patch semantics with optional + nullable"
"Generate input/output types from visibility decorators"

## Expected output
- Input vs output type separation
- Create vs update input differentiation
- Form input types with validation
- Read-only field markers
- HTTP method type mapping
- Patch semantics (optional + nullable)

## Functions replacing mutative decorators (1.10+)

As of TypeSpec 1.10, mutative decorators like `@withVisibilityFilter` and `@applyMergePatch` are deprecated in favor of function-based transforms. Functions create new type instances without mutating existing ones and preserve decorator metadata that mutative decorators could not.

```tsp
// Old (deprecated): mutative decorator
@withVisibilityFilter(#{ any: #[Lifecycle.Read] })
model UserRead { ... }

// New: function-based transform via FilterVisibility template
alias UserRead = FilterVisibility<User, #{ any: #[Lifecycle.Read] }>;
```

The `FilterVisibility` template wraps an internal function and caches results per unique input. See **typespec-functions** skill for creating custom function-based transforms.

## Verification
- Run `tsp compile` to verify visibility decorators
- Check input types exclude read-only fields
- Check output types include server-generated fields
- Verify validation decorators compile correctly
- Test patch semantics: optional fields, null handling
