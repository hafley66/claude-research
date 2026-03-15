---
name: typespec-core
description: TypeSpec language basics — syntax, types, decorators, namespaces, templates, and standard library
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs
  depth: intermediate
---
## What I do
- Define TypeSpec models, scalars, enums, unions, interfaces, operations
- Use decorators (@doc, @summary, @pattern, @minValue, @maxValue, @key, @secret)
- Organize code with namespaces and imports
- Create reusable templates with type parameters
- Declare functions with `extern fn` for type transforms and value computation (1.10+)
- Apply visibility modifiers (read, update, create, delete)
- Use standard library types (string, int32, int64, float64, boolean, utcDateTime, uuid)

## When to use me
Use this when setting up a new TypeSpec project or defining core type structures.

## Core syntax patterns

### Models
```tsp
model User {
  @key
  id: uuid;
  name: string;
  @doc("User email address")
  @pattern("^.+@.+\\..+")
  email: string;
  createdAt: utcDateTime;
}
```

### Scalars with constraints
```tsp
@pattern("^\\d{3}-\\d{2}-\\d{4}$")
scalar ssn extends string;

@minValue(0)
@maxValue(100)
scalar percentage extends float64;
```

### Enums and unions
```tsp
enum Currency {
  USD,
  EUR,
  GBP,
}

union Response<T> {
  success: T;
  error: Error;
}
```

### Interfaces and operations
```tsp
@route("/users")
interface Users {
  list(@query filter?: string): User[];
  create(@body user: User): User;
  read(@path id: uuid): User | NotFound;
  delete(@path id: uuid): void;
}
```

### Templates
```tsp
model PaginatedResponse<T> {
  items: T[];
  nextLink?: string;
}

op listPets(): PaginatedResponse<Pet>;
```

### Functions (1.10+, experimental)
```tsp
// Functions compute and return types or values (unlike decorators which only attach metadata)
extern fn transformModel(input: Model): Model;
extern fn computeDefault(fieldType: string): valueof unknown;

// Call in aliases or default values
alias Transformed = transformModel(MyModel);
model Config {
  timeout: int32 = computeDefault("timeout");
}
```
See **typespec-functions** skill for full coverage of function declarations, JS implementation, function types, and higher-order patterns.

### Decorators
```tsp
@doc("Creates a new pet")
@summary("Pet creation endpoint")
@tag("pets")
op createPet(@body pet: Pet): Pet;
```

### Visibility
```tsp
model User {
  @visibility("read", "create")
  id: uuid;
  
  @visibility("create", "update")
  name: string;
  
  @visibility("read")
  createdAt: utcDateTime;
}
```

## Example prompts
"Define a User model with uuid id, email validation, and createdAt timestamp"
"Create a paginated response template for list operations"
"Add @pattern decorator to validate phone number format"

## Expected output
- Valid TypeSpec syntax with proper imports
- Decorators applied to correct targets
- Namespace organization for large projects
- Template reuse for common patterns

## Verification
- Run `tsp compile` to verify no errors
- Check decorator application with `tsp show`
- Verify imports resolve correctly
