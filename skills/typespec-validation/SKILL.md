---
name: typespec-validation
description: Data validation with TypeSpec — constraints, patterns, formats, JSON Schema validation, error types
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/data-validation https://typespec.io/docs/standard-library/built-in-decorators
  depth: intermediate
---
## What I do
- Apply validation decorators (@pattern, @minValue, @maxValue, @minLength, @maxLength)
- Define format constraints (@format for uuid, email, uri, date-time)
- Create custom error types extending Error<T>
- Use JSON Schema emitter for runtime validation
- Define unique constraints (@uniqueItems for arrays)
- Apply secret marking for sensitive fields (@secret)

## When to use me
Use this when defining data constraints or implementing runtime validation.

## Core patterns

### Pattern validation
```tsp
@pattern("^.+@.+\\..+")
scalar email extends string;

@pattern("^\\d{3}-\\d{2}-\\d{4}$")
scalar ssn extends string;

@pattern("^https://")
scalar url extends string;
```

### Numeric constraints
```tsp
@minValue(0)
@maxValue(100)
scalar percentage extends float64;

@minValue(1900)
@maxValue(2147483647)
scalar year extends int32;

@minLength(1)
@maxLength(256)
scalar username extends string;
```

### Format decorators
```tsp
@format("uuid")
scalar uuid extends string;

@format("email")
scalar emailAddress extends string;

@format("uri")
scalar resourceUrl extends string;

@format("date-time")
scalar timestamp extends string;
```

### Array constraints
```tsp
model UserList {
  @minItems(1)
  @maxItems(100)
  users: User[];
  
  @uniqueItems
  tags: string[];
}
```

### Error types
```tsp
model Error<T extends string> {
  code: T;
  message: string;
  details?: Record<string>;
  timestamp: utcDateTime;
}

model AccountError is Error<"duplicate-account" | "invalid-account">;

op createAccount(account: Account): Account | AccountError;
```

### Secret fields
```tsp
model Credentials {
  @secret
  password: string;
  
  @secret
  apiKey: string;
}
```

### JSON Schema validation
```tsp
import "@typespec/json-schema";
using JsonSchema;

@jsonSchema
namespace Validation;

model ValidatedUser {
  @minLength(3)
  @maxLength(50)
  name: string;
  
  @minValue(18)
  @maxValue(120)
  age: int32;
}

// Runtime validation via JSON Schema validator
```

## Example prompts
"Add email pattern validation to the email field"
"Create error type with code union for account operations"
"Mark password field as @secret for security"
"Set min/max constraints on age field (18-120)"

## Expected output
- Decorators applied to scalars or model properties
- Error types extending Error<T> with code union
- JSON Schema output for runtime validation
- Secret fields marked for log filtering

## Verification
- Compile with `tsp compile` and check diagnostics
- Emit JSON Schema and validate with json-schema-validator
- Test pattern regex matches expected inputs
- Verify @secret fields are filtered in logs
