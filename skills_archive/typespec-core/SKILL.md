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

## Common gotchas

- **Single extends only**: `model Foo extends A & B {}` does NOT compile. TypeSpec has no intersection in `extends`. Only one base model is allowed.
- **`is` is structural spread, not intersection**: `model Foo is Bar` copies Bar's shape into Foo; it does not create a type-level intersection. You cannot use `is` to compose multiple marker types.
- **`Record<K, V>` signature unclear**: TypeSpec exposes `Record<string>` (value type only), not the two-argument `Record<K, V>` form. Treat the key type as fixed to string unless you verify the current stdlib signature.
- **`is` is a reserved keyword**: cannot be used as a property name. Use backtick escaping: `` `is`?: string ``. Without it, the compiler emits cascading parse errors (`'}' expected`, `Statement expected`) and the model body silently compiles to 0 properties.
- **No inline anonymous model types**: `exchange?: { name?: string; type?: string; }` inside a model definition is a parse error. All nested object types must be declared as named models and referenced by name: `exchange?: AmqpExchangeBindings`. This differs from TypeScript.

- **`op is` across namespaces works**: `op myOp is OtherNamespace.someOp` copies the signature (params and return type) from the referenced operation.
- **Property access is single-level only**: `A.b` resolves to the type of property `b`. `A.b.c` fails with `"cannot resolve 'c' in ModelProperty"` — chained dot access does not work.
- **Function results require alias indirection**: `model C is myFn(A)` and `...myFn(A)` both fail. Go through an alias: `alias X = myFn(A); model C is X;`
- **`op` is a reserved keyword**: cannot be used as a parameter name in `extern fn` declarations. TypeSpec surfaces this as a parse error; rename the parameter (e.g. `target`).

## Verification
- Run `tsp compile` to verify no errors
- Check decorator application with `tsp show`
- Verify imports resolve correctly
