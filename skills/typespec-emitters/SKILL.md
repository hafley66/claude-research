---
name: typespec-emitters
description: Emit TypeSpec to OpenAPI 3.0, JSON Schema 2020-12, Protobuf, and custom formats via emitters
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/openapi https://typespec.io/data-validation
  depth: intermediate
---
## What I do
- Configure OpenAPI 3.0 emitter with options (output-file, versions)
- Emit JSON Schema for data validation
- Generate Protobuf definitions with @field decorators
- Write custom emitters in TypeScript
- Handle multi-protocol projects (REST + Protobuf + JSON Schema)
- Configure emitter output directories

## When to use me
Use this when generating API specs, validating data, or integrating with protocol ecosystems.

## Core patterns

### OpenAPI emitter
```tsp
import "@typespec/http";
import "@typespec/openapi3";

using Http;

@service({
  title: "Pet Store API",
})
@openapi3
namespace Api;

// Compile with: tsp compile --emit @typespec/openapi3
// Output: openapi.yaml
```

### Emitter options (tspconfig.yaml)
```yaml
emit:
  - "@typespec/openapi3"
options:
  "@typespec/openapi3":
    output-file: "openapi.yaml"
    versions: ["1.0", "2.0"]
```

### JSON Schema emitter
```tsp
import "@typespec/json-schema";
using JsonSchema;

@jsonSchema
namespace Schemas;

model Person {
  name: string;
  @uniqueItems
  nickNames?: string[];
}

// Compile with: tsp compile --emit @typespec/json-schema
// Output: schema.yaml
```

### Protobuf emitter
```tsp
import "@typespec/protobuf";
using Protobuf;

@package({ name: "addressbook" })
namespace AddressBook;

enum PhoneType {
  MOBILE: 0,
  HOME: 1,
  WORK: 2,
}

model PhoneNumber {
  @field(1) number: string;
  @field(2) type: PhoneType;
}

model Person {
  @field(1) name: string;
  @field(2) id: int32;
  @field(3) email: string;
  @field(4) phones: PhoneNumber[];
}

// Compile with: tsp compile --emit @typespec/protobuf
// Output: addressbook.proto
```

### Custom emitter
```typescript
import { EmitContext, resolvePath } from "@typespec/compiler";

export async function $onEmit(context: EmitContext) {
  const outputDir = resolvePath(context.emitterOutputDir, "custom.txt");
  await context.program.host.writeFile(outputDir, "custom output");
}
```

### Multi-emitter project
```yaml
emit:
  - "@typespec/openapi3"
  - "@typespec/json-schema"
  - "@typespec/protobuf"
options:
  "@typespec/openapi3":
    output-file: "api/openapi.yaml"
  "@typespec/json-schema":
    output-file: "schemas/schema.yaml"
  "@typespec/protobuf":
    output-file: "proto/addressbook.proto"
```

## Example prompts
"Configure OpenAPI emitter with versioned output"
"Generate JSON Schema for data validation types"
"Create Protobuf definitions with field numbers"
"Write a custom emitter to output custom metadata"

## Expected output
- tspconfig.yaml with emitter configuration
- Generated files in specified output directories
- Valid protocol definitions (OpenAPI/JSON Schema/Protobuf)

## Verification
- Run `tsp compile` and check output files exist
- Validate OpenAPI with swagger-cli or openapi-validator
- Verify Protobuf compiles with `protoc --encode`
- Test JSON Schema with json-schema-validator
