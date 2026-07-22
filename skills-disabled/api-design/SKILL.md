---
name: api-design
description: Design REST APIs with pagination, auth, rate limits, and versioning patterns
license: MIT
compatibility: opencode
metadata:
  audience: backend-engineers
  workflow: rest-api-design
---
## What I do
- Design REST API endpoints following industry patterns (GitHub, Stripe)
- Implement pagination (cursor-based, offset-based)
- Add authentication layers (API keys, OAuth, JWT)
- Handle rate limiting strategies
- Version APIs with backward compatibility
- Structure JSON responses consistently

## When to use me
Use this when designing new API endpoints or refactoring existing APIs.

## Core patterns

### Endpoint structure
```
GET /api/v1/resources
POST /api/v1/resources
GET /api/v1/resources/:id
PATCH /api/v1/resources/:id
DELETE /api/v1/resources/:id
```

### Pagination
- Cursor-based: `?cursor=abc123&limit=25`
- Offset-based: `?offset=0&limit=25`
- Return `has_more`, `next_cursor` in response

### Rate limiting
- Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- 429 status when exceeded
- Document limits per endpoint tier

### Versioning
- URL versioning: `/api/v1/`, `/api/v2/`
- Header versioning: `Accept-Version: 2022-11-28`
- Deprecation headers: `Deprecation: true`, `Sunset: <date>`

### Response structure
```json
{
  "data": [...],
  "has_more": false,
  "next_cursor": null
}
```

### Error codes
- 400: Bad request (validation)
- 401: Unauthorized (missing auth)
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 429: Rate limit exceeded
- 500: Internal server error

## Authentication patterns
- API key in header: `Authorization: Bearer sk_test_...`
- Fine-grained PATs for specific scopes
- OAuth 2.0 for user delegation
- Webhook signatures: `Stripe-Signature` or `X-Hub-Signature`

## Best practices
- Idempotency keys for POST operations
- Idempotent POST: `Idempotency-Key: <uuid>`
- Consistent naming: camelCase for JSON, snake_case for query params
- HATEOAS for discoverability (optional)
- OpenAPI/Swagger specs for documentation
- Request/response logging with correlation IDs
