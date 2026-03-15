---
name: typespec-rest
description: Design REST APIs with TypeSpec HTTP library — routes, operations, responses, authentication, versioning
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/getting-started/getting-started-rest
  depth: intermediate
---
## What I do
- Define REST endpoints with @route, @get, @post, @patch, @delete
- Handle request bodies with @body
- Path/query/header parameters with @path, @query, @header
- Authentication with @auth, OAuth2, API key schemes
- API versioning with @versioned
- Error responses with union types and status codes
- Custom response models and pagination

## When to use me
Use this when designing REST API endpoints or migrating OpenAPI to TypeSpec.

## Core patterns

### Route definitions
```tsp
import "@typespec/http";
using Http;

@route("/pets")
interface Pets {
  @get list(@query filter?: string): Pet[];
  @post create(@body pet: Pet): Pet;
  @get read(@path id: string): Pet | NotFound;
  @patch update(@path id: string, @body pet: Pet): Pet;
  @delete delete(@path id: string): void;
}
```

### Authentication
```tsp
@useAuth(
  ApiKeyAuth<{ name: "Authorization", in: "header" }>,
  OAuth2Auth<{
    authorizationUrl: "https://auth.example.com/oauth2/authorize",
    scopes: ["read", "write"]
  }>
)
namespace Api;
```

### Versioning
```tsp
@versioned(Versions)
namespace Api;

enum Versions {
  v1: "1.0",
  v2: "2.0",
}

@added(Versions.v2)
op newEndpoint(): void;

@removed(Versions.v2)
op oldEndpoint(): void;
```

### Error handling
```tsp
model Error {
  code: string;
  message: string;
  details?: Record<string>;
}

union ErrorResponse<T> {
  200: T;
  400: Error;
  404: Error;
  500: Error;
}

op getResource(id: string): ErrorResponse<Resource>;
```

### Pagination
```tsp
model ListResponse<T> {
  items: T[];
  @nextLink
  nextLink?: string;
  @nextPageToken
  nextPageToken?: string;
}

@pagedResult
op list(): ListResponse<Pet>;
```

### Request/response headers
```tsp
@header("X-RateLimit-Limit")
rateLimit: int32;

@header("ETag")
etag: string;
```

## Example prompts
"Create a REST API for a pet store with CRUD operations"
"Add OAuth2 authentication to the API namespace"
"Implement versioning for v1 and v2 API endpoints"
"Handle 400/404/500 error responses with Error model"

## Expected output
- Complete interface with all CRUD operations
- Authentication decorators on namespace
- Versioning enum with @added/@removed decorators
- Error unions with status codes

## Verification
- Emit OpenAPI: `tsp compile --emit @typespec/openapi3`
- Verify routes in generated openapi.yaml
- Test authentication flow in playground
