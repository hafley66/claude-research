# oxc 0.122 -- ModuleRecord and AST for import/export extraction

Covers the module_record and AST APIs used to extract import/export bindings from JS/TS source files.

## ModuleRecord fields (`oxc_syntax::module_record`)

```rust
pub struct ModuleRecord<'a> {
    pub requested_modules: HashMap<Atom, Vec<RequestedModule>>, // ALL specifiers (static + dynamic + re-exports, NOT require())
    pub import_entries: Vec<ImportEntry>,        // named import bindings
    pub local_export_entries: Vec<ExportEntry>,  // direct exports (no module_request)
    pub indirect_export_entries: Vec<ExportEntry>, // re-exports with rename (export { x } from '...')
    pub star_export_entries: Vec<ExportEntry>,   // export * from ...
    pub dynamic_imports: Vec<DynamicImport>,     // import() expressions (spans only)
}
```

`requested_modules` does NOT include `require()` calls -- those need an AST walk.

## ImportEntry

```rust
pub struct ImportEntry<'a> {
    pub statement_span: Span,          // full import statement
    pub module_request: NameSpan<'a>,  // the specifier string
    pub import_name: ImportImportName<'a>,
    pub local_name: NameSpan<'a>,
    pub is_type: bool,
}

pub enum ImportImportName<'a> {
    Name(NameSpan<'a>),   // import { Foo [as bar] } -- Name is the exported name from source
    NamespaceObject,       // import * as ns
    Default(Span),         // import React from 'react' -- span is the statement span, not the word "default"
}
```

Examples:
- `import { Foo as bar }`: `import_name = Name("Foo")`, `local_name = "bar"`
- `import React from 'react'`: `import_name = Default(span)`, `local_name = "React"`
- `import * as ns`: `import_name = NamespaceObject`, `local_name = "ns"`

For `Default` imports, "default" is not written in the source -- use `entry.statement_span.start`
as a proxy span for any ref you emit for the "default" slot (for uniqueness in DB constraints).

## ExportEntry (local_export_entries)

```rust
pub struct ExportEntry<'a> {
    pub export_name: ExportExportName<'a>,
    pub local_name: ExportLocalName<'a>,
    pub module_request: Option<NameSpan>, // None for local exports, Some for re-exports
}

pub enum ExportExportName<'a> {
    Name(NameSpan<'a>),
    Default(Span),
    Null,
}

pub enum ExportLocalName<'a> {
    Name(NameSpan<'a>),
    Default(NameSpan<'a>),
    Null,
}
```

- `export { foo as Bar }`: `export_name = Name("Bar")`, `local_name = Name("foo")`
- `export { foo }`: both `Name("foo")`
- `export default fn()`: `export_name = Default(span)`, `local_name = Default(ns)`

To detect aliases: compare `local_name.name != export_name.name`.

## NameSpan

```rust
pub struct NameSpan<'a> {
    pub name: Atom<'a>,  // has .as_str() -- also supports == &str directly
    pub span: Span,      // start/end are u32 byte offsets
}
```

## AST types for require() walking (`oxc_ast::ast`)

```rust
// Key Expression variants:
Expression::Identifier(Box<IdentifierReference>)   // id.name == "require" works
Expression::CallExpression(Box<CallExpression>)    // call.callee, call.arguments
Expression::AssignmentExpression(Box<...>)         // .right for rhs

pub struct CallExpression<'a> {
    pub callee: Expression<'a>,
    pub arguments: Vec<Argument<'a>>,
}

// Argument uses @inherit Expression -- match variants directly:
Argument::StringLiteral(Box<StringLiteral>)        // valid variant
// Do NOT look for Argument::Expression(e) -- that wrapper doesn't exist

pub struct StringLiteral<'a> {
    pub span: Span,       // includes quotes -- use start+1..end-1 to strip them
    pub value: Atom<'a>,  // unescaped string content
}

// Statement variants (Statement @inherit Declaration, @inherit ModuleDeclaration):
Statement::VariableDeclaration(Box<VariableDeclaration>)  // directly accessible
Statement::ExpressionStatement(Box<ExpressionStatement>)
```

## IdentifierReference.name type

`IdentifierReference.name` is `Ident<'a>` from `oxc_span` (re-exported from `oxc_str`).
- `id.name == "require"` -- direct string comparison works
- `id.name.as_str()` -- works
- `id.name.to_string()` -- works

## ParserReturn structure

```rust
let ret = Parser::new(&allocator, source_text, source_type).parse();
let mr = &ret.module_record;  // &ModuleRecord<'a>
let body = &ret.program.body; // &Vec<Statement<'a>>
```

## Pattern: require() extraction (top-level only)

```rust
fn collect_require_calls<'a>(stmts: &'a [Statement<'a>], refs: &mut Vec<RawRef>) {
    for stmt in stmts {
        match stmt {
            Statement::VariableDeclaration(decl) => {
                for d in &decl.declarations {
                    if let Some(init) = &d.init {
                        collect_require_expr(init, refs);
                    }
                }
            }
            Statement::ExpressionStatement(s) => collect_require_expr(&s.expression, refs),
            _ => {}
        }
    }
}

fn collect_require_expr<'a>(expr: &'a Expression<'a>, refs: &mut Vec<RawRef>) {
    match expr {
        Expression::CallExpression(call) => {
            if let Expression::Identifier(id) = &call.callee {
                if id.name == "require" {
                    if let Some(Argument::StringLiteral(s)) = call.arguments.first() {
                        // s.value.to_string() = specifier
                        // s.span.start + 1 / s.span.end - 1 = byte span without quotes
                    }
                }
            }
        }
        Expression::AssignmentExpression(assign) => collect_require_expr(&assign.right, refs),
        _ => {}
    }
}
```

Limitation: only finds require() in top-level variable initializers and expression statements.
Nested require() in callbacks/closures is not captured by this simple walk.

## @inherit Expression gotcha

Several enums use the `inherit_variants!` macro which injects `Expression` variants directly.
`Argument` is one of them. Match `Argument::StringLiteral(s)` directly -- there is no
`Argument::Expression(e)` wrapper variant. Same applies to `JSXExpression`.

## Source type selection

```rust
fn source_type_for(path: &str) -> SourceType {
    match ext {
        "ts" | "mts" | "cts" => SourceType::ts(),
        "tsx" => SourceType::tsx(),
        "jsx" => SourceType::jsx(),
        "mjs" | "cjs" | "js" => SourceType::mjs(),
        _ => SourceType::tsx(),  // superset fallback
    }
}
```

`.mts` and `.cts` both use `SourceType::ts()` -- CJS-TS distinction doesn't matter for extraction.

## Crate exploration tip

When searching `~/.cargo/registry/src` for crate source, use the `Grep` tool (not bash `find`/`grep`).
Example: `Grep pattern="pub struct CallExpression" path="~/.cargo/registry/src/.../oxc_ast-0.122.0/src"`.
