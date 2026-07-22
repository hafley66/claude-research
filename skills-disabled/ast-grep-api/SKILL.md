---
name: ast-grep-api
description: ast-grep programmatic APIs — Rust crates (primary), Node.js NAPI, and Python bindings for parsing, searching, and rewriting code
license: MIT
compatibility: opencode
metadata:
  source: https://ast-grep.github.io/reference/api.html
  depth: intermediate
---

## What I do
- Parse source code into AST using the Rust crates, Node.js NAPI, or Python bindings
- Search for structural patterns with metavariable capture
- Extract matched node text and byte offsets
- Apply code rewrites
- Load and run YAML rule configs programmatically

## Crate versions (0.42)

```toml
ast-grep-core = "0.42"
ast-grep-language = "0.42"
ast-grep-config = "0.42"   # only if you need YAML rule loading
```

---

## Rust API

### Key types — ast-grep-core

```rust
// Root<D> -- owns the parsed tree (AstGrep<D> is a type alias)
pub type AstGrep<D> = Root<D>;

// Node<'r, D> -- a node in the tree
// NodeMatch<'t, D> -- a matched node with its MetaVarEnv
// Position -- zero-based { line, byte_column, byte_offset }

impl Node {
    pub fn range(&self) -> std::ops::Range<usize>; // byte offsets into source
    pub fn start_pos(&self) -> Position;
    pub fn end_pos(&self) -> Position;
    pub fn text(&self) -> Cow<str>;
    pub fn find<M: Matcher>(&self, pat: M) -> Option<NodeMatch>;
    pub fn find_all<M: Matcher>(&self, pat: M) -> impl Iterator<Item = NodeMatch>;
}

// MetaVarEnv -- dictionary of captures from a NodeMatch
impl MetaVarEnv {
    pub fn get_match(&self, var: &str) -> Option<&Node>;        // $VAR  -> node
    pub fn get_multiple_matches(&self, var: &str) -> Vec<Node>; // $$$VAR -> nodes
}
// Access via: match_node.get_env()
// Strip leading $ when passing to get_match: "NAME" not "$NAME"
```

### Key types — ast-grep-language

```rust
pub enum SupportLang {
    Bash, C, Cpp, CSharp, Css, Elixir, Go, Haskell, Hcl, Html,
    Java, JavaScript, Json, Kotlin, Lua, Nix, Php, Python,
    Ruby, Rust, Scala, Solidity, Swift, Tsx, TypeScript, Yaml,
}

impl SupportLang {
    pub fn from_path<P: AsRef<Path>>(path: P) -> Option<Self>;
}
impl FromStr for SupportLang { ... }  // parses "rs", "typescript", "py", etc.

// LanguageExt trait (re-exported from ast-grep-core::tree_sitter)
pub trait LanguageExt: Language {
    fn ast_grep<S: AsRef<str>>(&self, source: S) -> AstGrep<StrDoc<Self>>;
    fn get_ts_language(&self) -> TSLanguage;
}
// SupportLang implements LanguageExt
```

### Key types — ast-grep-config

```rust
// SerializableRuleCore -- rule + constraints + utils + transform + fix
pub struct SerializableRuleCore {
    pub rule: SerializableRule,
    pub constraints: Option<HashMap<String, SerializableRule>>,
    pub utils: Option<HashMap<String, SerializableRule>>,
    pub transform: Option<HashMap<String, Transformation>>,
    pub fix: Option<SerializableFixer>,
}

// SerializableRuleConfig<L> -- full YAML rule file
pub struct SerializableRuleConfig<L: Language> {
    #[serde(flatten)]
    pub core: SerializableRuleCore,
    pub id: String,
    pub language: L,
    pub rewriters: Option<Vec<SerializableRewriter>>,
    // + message, severity, note, ...
}
```

### Minimal pattern match

```rust
use ast_grep_language::{Language, LanguageExt, SupportLang};
use std::path::Path;

fn match_pattern(
    source: &[u8],
    path: &str,
    pattern: &str,
    lang_override: Option<&str>,
) -> Option<Vec<(String, usize, usize)>> {
    let src = std::str::from_utf8(source).ok()?;

    let lang = lang_override
        .and_then(|s| s.parse::<SupportLang>().ok())
        .or_else(|| SupportLang::from_path(Path::new(path)))?;

    let root = lang.ast_grep(src);
    let node = root.root();

    Some(
        node.find_all(pattern)
            .map(|m| {
                let range = m.range();
                (m.text().into_owned(), range.start, range.end)
            })
            .collect(),
    )
}
```

### Metavariable capture

```rust
// Pattern: "import $NAME from $PATH"
node.find_all("import $NAME from $PATH")
    .filter_map(|m| {
        let env = m.get_env();
        // Strip leading $ for env lookup
        let name_node = env.get_match("NAME")?;
        let path_node = env.get_match("PATH")?;
        Some((
            name_node.text().into_owned(),
            name_node.range(),
            path_node.text().into_owned(),
            path_node.range(),
        ))
    })
```

### Loading a YAML rule file

```rust
use ast_grep_config::SerializableRuleConfig;
use ast_grep_language::SupportLang;

let yaml_str = std::fs::read_to_string("my-rule.yml")?;
let config: SerializableRuleConfig<SupportLang> = serde_yaml::from_str(&yaml_str)?;
// config.id, config.language, config.core.rule, config.core.constraints, ...
```

The high-level "build rule into matcher and run" path inside ast-grep-config is not stable/public API. For production use, the pattern-based API (`find` / `find_all` with a pattern string) is the stable path.

### schemars version conflict

ast-grep-config pulls in schemars v1.x. Most crates in the ecosystem use schemars 0.8. Both resolve fine in Cargo (different crate IDs). If you expose `SerializableRuleConfig` across a crate boundary, use `serde_json::Value` at the interface to avoid trait conflicts.

---

## Language string aliases (FromStr)

| Input strings | SupportLang |
|---|---|
| `bash` | Bash |
| `c` | C |
| `cc`, `c++`, `cpp`, `cxx` | Cpp |
| `cs`, `csharp` | CSharp |
| `css` | Css |
| `ex`, `elixir` | Elixir |
| `go`, `golang` | Go |
| `hs`, `haskell` | Haskell |
| `hcl` | Hcl |
| `html` | Html |
| `java` | Java |
| `javascript`, `js`, `jsx` | JavaScript |
| `json` | Json |
| `kotlin`, `kt` | Kotlin |
| `lua` | Lua |
| `nix` | Nix |
| `php` | Php |
| `py`, `python` | Python |
| `rb`, `ruby` | Ruby |
| `rs`, `rust` | Rust |
| `scala` | Scala |
| `sol`, `solidity` | Solidity |
| `swift` | Swift |
| `ts`, `typescript` | TypeScript |
| `tsx` | Tsx |
| `yaml`, `yml` | Yaml |

## File extension → language (from_path)

| SupportLang | Extensions |
|---|---|
| Bash | bash, bats, cgi, command, env, fcgi, ksh, sh, tmux, tool, zsh |
| C | c, h |
| Cpp | cc, hpp, cpp, c++, hh, cxx, cu, ino |
| CSharp | cs |
| Css | css, scss |
| Go | go |
| Haskell | hs |
| Hcl | hcl, nomad, tf, tfvars, workflow |
| Html | html, htm, xhtml |
| Java | java |
| JavaScript | cjs, js, mjs, jsx |
| Json | json |
| Kotlin | kt, ktm, kts |
| Lua | lua |
| Nix | nix |
| Php | php |
| Python | py, py3, pyi, bzl |
| Ruby | rb, rbw, gemspec |
| Rust | rs |
| Scala | scala, sc, sbt |
| Solidity | sol |
| Swift | swift |
| TypeScript | ts, cts, mts |
| Tsx | tsx |
| Yaml | yaml, yml |

---

## Node.js (NAPI) API

```javascript
import { parse, Lang } from '@ast-grep/napi'

const root = parse(Lang.JavaScript, `console.log("hello")`)
const node = root.root()

node.find('console.log($ARG)')           // -> SgNode | null
node.findAll('console.log($$$ARGS)')     // -> SgNode[]
node.matches('console.$METHOD($$$)')     // -> boolean

match.getMatch('ARG')                    // -> SgNode (strip $ for key)
match.getMultipleMatches('ARGS')         // -> SgNode[]

node.kind()     // tree-sitter node type string
node.text()     // source text
node.range()    // { start: {line, column}, end: {line, column} }
node.parent()
node.children()
node.field('body')
node.ancestors()
node.next(); node.prev()

// Rewriting
const edits = node.findAll('var $X = $Y').map(n => n.replace('const $X = $Y'))
const newSource = node.commitEdits(edits)

// Rule config
node.find({
  rule: { all: [{ pattern: '$OBJ.$METHOD($$$)' }, { inside: { kind: 'function_declaration' } }] },
  constraints: { METHOD: { regex: '^(log|warn|error)$' } }
})
```

---

## Python API

```python
from ast_grep_py import SgRoot

root = SgRoot("console.log('hello')", "javascript")
node = root.root()

node.find(pattern="console.log($ARG)")
node.find_all(pattern="console.log($$$ARGS)")
node.matches(pattern="console.$METHOD($$$)")

match.get_match("ARG")              # -> SgNode
match.get_multiple_matches("ARGS")  # -> list[SgNode]

node.kind(); node.text(); node.range()
node.is_leaf(); node.is_named()
node.parent(); node.children(); node.field("body")
node.ancestors(); node.next(); node.prev()
node.inside(pattern="..."); node.has(kind="identifier")

# Rewriting
edits = [m.replace("new($X)") for m in node.find_all(pattern="old($X)")]
new_source = node.commit_edits(edits)

# Rule kwargs
node.find_all(
    rule={"all": [{"pattern": "$X + $Y"}, {"not": {"regex": "^0"}}]},
    constraints={"X": {"kind": "identifier"}}
)
```
