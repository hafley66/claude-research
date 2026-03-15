---
name: typespec-custom-emitters
description: Build custom TypeSpec emitters for any output format — tables, codegen, IDL, config files, multi-format emission
license: MIT
compatibility: opencode
metadata:
  source: https://typespec.io/docs/extending-typespec/basics/
  depth: advanced
---
## Related skills
- **typespec-emitter-framework**: The newer Alloy/JSX-based approach (declarative, composable)
- **typespec-functions**: Functions (1.10+) use `$functions` export (not `$onEmit`); see that skill for implementing function backends
- **alloy-core**: Underlying code generation framework
- **alloy-languages**: Language-specific Alloy components

## What I do (imperative/legacy approach)
- Create custom emitters in TypeScript for any output format
- Access TypeSpec program, types, models, enums via JS API
- Emit to tables, CSV, JSON, YAML, code files, IDL, config
- Traverse program with navigateProgram/navigateType
- Resolve types, serialize values, handle diagnostics
- Configure emitter options in tspconfig.yaml
- Support multi-emitter projects

## When to use me
Use this when you need custom output formats beyond OpenAPI/JSON Schema/Protobuf, or replicating legacy codegen with enums and template generics.

## Core patterns

### Emitter structure
```typescript
import {
  EmitContext,
  Program,
  Model,
  Enum,
  Operation,
  Interface,
  Namespace,
  Type,
  resolvePath,
  createTypeSpecLibrary,
  DiagnosticCollector,
} from "@typespec/compiler";

export async function $onEmit(context: EmitContext) {
  const program = context.program;
  const emitterOutputDir = context.emitterOutputDir;
  
  // Navigate all types in program
  navigateProgram(program, {
    model: (model) => emitModel(model, emitterOutputDir),
    enum: (enum) => emitEnum(enum, emitterOutputDir),
    operation: (op) => emitOperation(op, emitterOutputDir),
  });
  
  // Write output file
  const outputFile = resolvePath(emitterOutputDir, "output.txt");
  await program.host.writeFile(outputFile, generateOutput());
}
```

### Library definition
```typescript
import { TypeSpecLibrary, JSONSchemaType } from "@typespec/compiler";

export const libDef: TypeSpecLibraryDef = {
  name: "my-emitter",
  diagnostics: {
    "invalid-format": {
      severity: "error",
      messages: {
        default: "Invalid output format: {format}",
      },
    },
  },
  emitterOutputDir: {
    description: "Output directory for emitted files",
    default: "{output-dir}",
  },
};

export const $lib = createTypeSpecLibrary(libDef);
```

### Emit enums (legacy codegen replication)
```typescript
function emitEnum(enum: Enum, outputDir: string) {
  const enumName = enum.name;
  const members = enum.members.map(m => `${m.name} = ${m.value ?? 0}`);
  
  // Generate C# enum
  const csharp = `
    public enum ${enumName} {
      ${members.join(",\n")}
    }
  `;
  
  // Generate Java enum
  const java = `
    public enum ${enumName} {
      ${members.join(",\n")}
    }
  `;
  
  // Generate TypeScript enum
  const ts = `
    export enum ${enumName} {
      ${members.join(",\n")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${enumName}.cs"),
    csharp
  );
}
```

### Emit models as tables
```typescript
function emitModel(model: Model, outputDir: string) {
  const properties = Array.from(model.properties.entries()).map(([name, prop]) => {
    const type = getTypeName(prop.type);
    const optional = prop.optional ? "?" : "";
    return `${name}${optional}: ${type}`;
  });
  
  // CSV output
  const csv = properties.map(p => p.split(": ")[0]).join(",");
  
  // Markdown table
  const table = `
    | Property | Type | Optional |
    |----------|------|----------|
    ${properties.map(p => `| ${p.split("?")[0]} | ${p.split(": ")[1]} | ${p.includes("?")} |`).join("\n")}
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${model.name}.md"),
    table
  );
}
```

### Template generic instantiation
```typescript
function emitTemplateInstance(
  template: Model,
  args: Type[],
  outputDir: string
) {
  // Replicate keyword arg template generic instantiation
  const instantiated = {
    name: `${template.name}_${args.map(a => getTypeName(a)).join("_")}`,
    properties: template.properties,
  };
  
  // Generate code with keyword args
  const code = `
    ${instantiated.name}<${args.map((_, i) => `T${i}`).join(", ")}> {
      ${Array.from(instantiated.properties.entries()).map(([name, p]) => 
        `${name}: ${getTypeName(p.type)}`
      ).join(";")}
    }
  `;
  
  await program.host.writeFile(
    resolvePath(outputDir, `${instantiated.name}.tsp"),
    code
  );
}
```

### Multi-format emission
```typescript
async function emitAllFormats(program: Program, outputDir: string) {
  const formats = ["csharp", "java", "typescript", "go", "rust"];
  
  for (const format of formats) {
    const formatOutputDir = resolvePath(outputDir, format);
    
    navigateProgram(program, {
      model: (m) => emitModelToFormat(m, format, formatOutputDir),
      enum: (e) => emitEnumToFormat(e, format, formatOutputDir),
      interface: (i) => emitInterfaceToFormat(i, format, formatOutputDir),
    });
  }
}
```

### Emitter options (tspconfig.yaml)
```yaml
emit:
  - "./my-emitter"

options:
  "./my-emitter":
    output-file: "codegen/{name}.{ext}"
    formats: ["csharp", "java", "typescript"]
    enum-prefix: "E_"
    model-prefix: "M_"
    table-format: "markdown"
```

### Visiting function declarations (1.10+)
```typescript
// Functions appear as functionDeclarations on a Namespace
navigateProgram(program, {
  model: (model) => emitModel(model, emitterOutputDir),
  enum: (e) => emitEnum(e, emitterOutputDir),
  // The semantic walker visits FunctionValue declarations
  functionDeclaration: (fn) => emitFunctionDeclaration(fn, emitterOutputDir),
});
```

Note: emitter `$onEmit` and function `$functions` are separate exports. Emitters produce output files; functions compute types/values at check-time. See **typespec-functions** skill for the `$functions` implementation pattern.

### Type traversal utilities
```typescript
import {
  navigateTypesInNamespace,
  listOperationsIn,
  listServices,
  getEffectiveModelType,
  isTemplateInstance,
  isTemplateDeclaration,
} from "@typespec/compiler";

// Navigate specific namespace
navigateTypesInNamespace(program, namespace, {
  model: (m) => processModel(m),
  enum: (e) => processEnum(e),
});

// List all operations
const operations = listOperationsIn(program, namespace);

// Check template
if (isTemplateInstance(type)) {
  const template = type.templateMapper?.template;
  const args = type.templateMapper?.args;
}
```

### Diagnostic handling
```typescript
const diagnostics = createDiagnosticCollector(libDef.diagnostics);

diagnostics.add({
  code: "invalid-format",
  target: model,
  format: { format: "unknown" },
});

if (diagnostics.getErrors().length > 0) {
  logDiagnostics(diagnostics.getErrors());
  return;
}
```

## Example prompts
"Create custom emitter to output enums as C#/Java/TypeScript"
"Generate markdown tables from model properties"
"Replicate legacy codegen with keyword arg template generics"
" Emit to multiple formats: Go, Rust, C#, Java"
"Configure emitter options in tspconfig.yaml"

## Expected output
- TypeScript emitter with $onEmit function
- navigateProgram callbacks for models/enums/operations
- Output files in specified formats
- tspconfig.yaml with emitter options
- Diagnostic handling for errors

## Verification
- Run `tsp compile --emit ./my-emitter`
- Check output files exist in emitterOutputDir
- Verify diagnostics are logged correctly
- Test multi-format emission with options
