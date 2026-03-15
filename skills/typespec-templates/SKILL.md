---
name: typespec-templates
description: TypeSpec template patterns — template declarations, generic instantiation, keyword args, template constraints, is/extends templates
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/language-basics/templates/
  depth: advanced
---
## What I do
- Define template declarations with type parameters
- Instantiate templates with concrete types
- Use keyword argument syntax for template args
- Apply template constraints with `where` clause
- Create `is` and `extends` template relationships
- Handle template mapper, instantiation, resolution
- Replicate legacy codegen patterns with generics

## When to use me
Use this when defining reusable type patterns, replicating custom codegen with template generics, or creating generic response/pagination models.

## Core patterns

### Template declaration
```tsp
model Response<T> {
  data: T;
  status: int32;
  message: string;
}

model PaginatedList<T> {
  items: T[];
  @nextLink
  nextLink?: string;
  @nextPageToken
  nextPageToken?: string;
}

model FilteredQuery<T, K extends string> {
  filter: K;
  results: T[];
}
```

### Template instantiation
```tsp
// Direct instantiation
op getUser(): Response<User>;
op listPets(): PaginatedList<Pet>;

// Keyword arg instantiation (legacy codegen pattern)
model UserResponse is Response<{ data: User }>;
model PetList is PaginatedList<{ items: Pet[] }>;

// Named template args
alias StringResponse = Response<string>;
alias NumberResponse = Response<int32>;
```

### Template constraints
```tsp
model ValidatedModel<T extends object> {
  data: T;
  validated: boolean;
}

model NumericResponse<T extends Numeric> {
  value: T;
  unit: string;
}

// where clause
template WhereClause<T where T extends string> {
  pattern: T;
}
```

### is/extends templates
```tsp
// is relationship (same shape)
model UserResponse is Response<User>;
model AdminResponse is Response<Admin>;

// extends relationship (inheritance)
model ErrorResponse<T> extends Response<T> {
  errorCode: string;
  errorDetails: Record<string>;
}

// Template extends
model PaginatedErrorResponse<T> extends ErrorResponse<PaginatedList<T>> {
  retryToken: string;
}
```

### Keyword arg template generic instantiation
```tsp
// Legacy codegen pattern: keyword args for template instantiation
model CustomResponse<
  TData extends object,
  TStatus extends int32,
  TMessage extends string
> {
  data: TData;
  status: TStatus;
  message: TMessage;
}

// Instantiate with keyword args
model UserResponse is CustomResponse<{
  data: User;
  status: 200;
  message: "Success";
}>;

// Replicate crazy legacy features
model LegacyResponse<
  TOutput extends object,
  TError extends Error,
  TMeta extends Record<unknown>
> {
  output: TOutput;
  error?: TError;
  meta: TMeta;
  @deprecated("Use new response pattern")
  legacyFlag: boolean;
}
```

### Template decorators
```tsp
@templateName("Response")
model Response<T> {
  data: T;
}

@templateConstraint("T extends object")
model Constrained<T> {
  value: T;
}

// Custom template decorator
extern dec templateParam(
  target: TemplateParameter,
  constraint: valueof string
);
```

### Template mapper access (JS API)
```typescript
import {
  isTemplateDeclaration,
  isTemplateInstance,
  getTemplateMapper,
} from "@typespec/compiler";

if (isTemplateInstance(type)) {
  const mapper = getTemplateMapper(type);
  const template = mapper.template;
  const args = mapper.args;
  
  // Access keyword args
  for (const arg of args) {
    const name = arg.name;
    const value = arg.value;
  }
}

if (isTemplateDeclaration(type)) {
  const params = type.templateMapper?.params;
}
```

### Nested templates
```tsp
model NestedResponse<T, U> {
  primary: Response<T>;
  secondary: Response<U>;
}

model MultiPaginated<T, K> {
  primary: PaginatedList<T>;
  secondary: PaginatedList<K>;
}

// Instantiate nested
op getCombined(): NestedResponse<User, Pet>;
```

### Template unions
```tsp
union TemplateUnion<T> {
  success: Response<T>;
  error: ErrorResponse<never>;
}

// Instantiate union
alias UserUnion = TemplateUnion<User>;
```

### Template interfaces
```tsp
interface Resource<T> {
  list(): PaginatedList<T>;
  read(id: string): Response<T>;
  create(body: T): Response<T>;
  delete(id: string): void;
}

// Instantiate interface
interface Users is Resource<User>;
interface Pets is Resource<Pet>;
```

## Example prompts
"Define Response template with data/status/message"
"Create PaginatedList template with nextLink/nextPageToken"
"Instantiate template with keyword args for legacy codegen"
"Add template constraint: T extends object"
"Create is/extends template relationships"
"Replicate crazy legacy template generic patterns"

## Expected output
- Template declarations with type parameters
- Template instantiation with concrete types
- Keyword arg syntax for complex instantiation
- Template constraints with extends/where
- is/extends template relationships
- Nested/multi-parameter templates

## Templates vs functions (1.10+)

Templates **cache** their instances: same args always return the same type. Functions **never cache** results: each call runs the JS implementation.

Use a template alias to wrap function calls when you want caching:
```tsp
extern fn applyVisibility(input: Model, visibility: valueof VisibilityFilter): Model;

const READ_FILTER: VisibilityFilter = #{ any: #[Public] };

// Template caches the result per unique M. Without this wrapper,
// every call to applyVisibility would re-run the JS function.
alias Read<M extends Model> = applyVisibility(M, READ_FILTER);
```

Template parameters can also accept function values:
```tsp
model MyTemplate<
  Props extends Reflection.Model,
  MakeId extends valueof fn(props: Reflection.Model) => valueof string = makeIdDefault
> {
  id: string = MakeId(Props);
  ...Props;
}
```

See **typespec-functions** skill for full function coverage.

## Verification
- Run `tsp compile` to verify template resolution
- Check template mapper in JS API
- Verify is/extends relationships compile correctly
- Test constraint violations produce diagnostics
