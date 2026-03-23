---
name: dioxus-browser-extensions
description: Building browser extensions (Chrome MV3, Firefox) with Dioxus and WASM -- workspace structure, manifest config, wasm-pack build, message passing into signals, content script injection, CSP, cross-browser differences. Trigger on dioxus extension, dioxus chrome extension, dioxus browser extension, rust wasm extension, dioxus popup, dioxus content script.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Using Dioxus to build browser extensions targeting Chrome Manifest V3 (and Firefox MV3 where supported). Each extension context (popup, background, content script, options, sidepanel) compiles as a separate WASM binary via `wasm-pack`, not the Dioxus CLI.

## Build Toolchain

**Do not use `dx serve` or the Dioxus CLI.** Extensions require `wasm-pack`:

```bash
# per-context build
cd popup && wasm-pack build --target web --out-dir ../dist/popup
cd background && wasm-pack build --target web --out-dir ../dist/background
```

Cargo.toml for each context crate:

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
dioxus = { version = "0.7", features = ["web"] }
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
web-extensions-sys = "0.4"   # chrome.* API bindings (Chrome-only)
```

Size optimization in workspace root:

```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

## Workspace Structure

Each extension context is a separate crate. Shared types live in a `common` crate.

```
extension/
  Cargo.toml          # workspace members
  common/             # shared message types, rlib only
  popup/              # full Dioxus UI -> popup.wasm
  background/         # service worker WASM -> background.wasm
  content/            # content script -> content.wasm
  options/            # options page Dioxus UI -> options.wasm
  dist/               # build output + manifest.json + HTML files
```

## Manifest V3

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0",
  "permissions": ["activeTab", "storage", "scripting", "tabs"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content_bootstrap.js"],
    "run_at": "document_idle"
  }],
  "web_accessible_resources": [{
    "resources": ["*.js", "*.wasm", "*.css", "snippets/**/*"],
    "matches": ["<all_urls>"]
  }],
  "background": {
    "service_worker": "background_bootstrap.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

`'wasm-unsafe-eval'` is mandatory in `extension_pages` CSP for WASM to load.

## WASM Bootstrap

Each HTML page needs a JS bootstrap that loads the WASM module using `chrome.runtime.getURL`:

**popup.html:**

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><div id="main"></div>
<script src="popup_bootstrap.js"></script>
</body></html>
```

**popup_bootstrap.js:**

```js
(async () => {
  const src = chrome.runtime.getURL("popup.js");
  const wasmPath = chrome.runtime.getURL("popup_bg.wasm");
  const mod = await import(src);
  await mod.default({ module_or_path: wasmPath });
  mod.main();
})();
```

**Background service worker** uses `importScripts`:

```js
importScripts(chrome.runtime.getURL("background.js"));
const wasmPath = chrome.runtime.getURL("background_bg.wasm");
wasm_bindgen(wasmPath).then(() => wasm_bindgen.main());
```

## Dioxus Entry Points

Popup and options pages render full Dioxus UI:

```rust
use dioxus::prelude::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn main() {
    dioxus::logger::initialize_default();
    dioxus::launch(App);
}

fn App() -> Element {
    let mut count = use_signal(|| 0);
    rsx! {
        button { onclick: move |_| count += 1, "Clicked {count} times" }
    }
}
```

Content scripts typically run headless (no Dioxus rendering). If UI injection is needed, create a shadow DOM container and mount Dioxus into it:

```rust
use web_sys::{window, Document};

fn inject_ui(document: &Document) {
    let host = document.create_element("div").unwrap();
    host.set_id("my-ext-root");
    document.body().unwrap().append_child(&host).unwrap();
    let shadow = host.attach_shadow(&web_sys::ShadowRootInit::new(web_sys::ShadowRootMode::Closed)).unwrap();
    // Mount Dioxus into shadow root container
}
```

## Message Passing with Signals

Define shared message types in the `common` crate:

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ExtMessage {
    GetPageContent,
    PageContent(String),
    SummarizeRequest,
    SummarizeResponse(String),
    Error(String),
}
```

**Sending from popup:**

```rust
use web_extensions_sys::chrome;
use serde_wasm_bindgen;

async fn send_message(msg: &ExtMessage) -> Result<JsValue, JsValue> {
    let js_msg = serde_wasm_bindgen::to_value(msg).unwrap();
    chrome().runtime().send_message(None, &js_msg, None).await
}
```

**Receiving into a Dioxus signal (popup side):**

```rust
use wasm_bindgen::prelude::*;
use wasm_bindgen::closure::Closure;
use web_extensions_sys::chrome;

fn setup_message_listener(mut state: Signal<Option<String>>) {
    let listener = Closure::wrap(Box::new(move |message: JsValue, _sender: JsValue, _respond: JsValue| {
        if let Ok(msg) = serde_wasm_bindgen::from_value::<ExtMessage>(message) {
            match msg {
                ExtMessage::SummarizeResponse(s) => state.set(Some(s)),
                ExtMessage::Error(e) => { /* handle */ }
                _ => {}
            }
        }
    }) as Box<dyn FnMut(JsValue, JsValue, JsValue)>);

    chrome().runtime().on_message().add_listener(listener.as_ref().unchecked_ref());
    listener.forget(); // prevent GC -- intentional leak
}
```

Wire it up in a component:

```rust
fn App() -> Element {
    let result = use_signal(|| None::<String>);

    use_effect(move || {
        setup_message_listener(result);
    });

    rsx! {
        match result() {
            Some(text) => rsx! { p { "{text}" } },
            None => rsx! { p { "Waiting..." } },
        }
    }
}
```

## Existing Templates

| Project | Status | Notes |
|---------|--------|-------|
| Summit-Sailors/dioxus-browser-extension-builder | Active (2026-03) | Most complete. CLI tool `dx-ext`, workspace template, all 4 contexts. Published on crates.io. |
| ealmloff/dioxus-extension | Stale (2025-06) | Minimal popup-only, Dioxus 0.3.x. By Dioxus core team member. |
| JRMurr/DioxusBrowserExtension | Stale (2023) | Nix-based, custom `browser_apis` crate. |

Summit-Sailors is the recommended starting point.

## Gotchas

**Bundle size:** Each context produces a separate .wasm binary. Expect 400-800 KB per context with `opt-level = "z"` + `lto`. A 4-context extension totals 2-4 MB. WASM does not benefit from transport compression in local `.crx` packaging.

**wasm-opt breakage:** As of Rust 1.90+ / nightly, `wasm-opt` is broken due to bulk memory operations (rust-lang/rust#137315). Workaround: set `wasm-opt = false` in wasm-pack config, accepting larger binaries.

**wasm-bindgen version pinning:** Dioxus expects a specific `wasm-bindgen` version. Mismatches with `wasm-pack`'s bundled version cause build failures. Pin explicitly in `Cargo.lock`.

**`Closure::forget()` leaks:** Every `chrome.runtime.onMessage` listener requires `Closure::forget()` to prevent the Rust closure from being dropped. Intentional memory leak, acceptable for long-lived extension contexts.

**Content script CSP:** Content scripts run under the host page's CSP, not the extension's. In the isolated world (default), `'wasm-unsafe-eval'` is granted automatically. Main world injection may be blocked by strict page CSP.

**`web_accessible_resources` fingerprinting:** Listing `.wasm` files as web-accessible exposes them to any page or extension that knows the URL pattern. This is a fingerprinting surface.

**No Dioxus.toml:** The Dioxus CLI config file is irrelevant for extension builds. All config goes in Cargo.toml, manifest.json, and build scripts.

## Cross-Browser: Chrome vs Firefox MV3

| Aspect | Chrome | Firefox |
|--------|--------|---------|
| Background | Service workers only | Event pages via `"scripts"`. Firefox 121+ also supports `service_worker`. |
| WASM background loading | `importScripts()` in service worker | Standard `<script>` in event pages, `importScripts` unavailable |
| `web-extensions-sys` | Fully compatible | Chrome-only as of 0.4.x. Firefox needs `browser.*` namespace via raw `wasm-bindgen` |
| API namespace | `chrome.*` | `browser.*` preferred (Promise-based). `chrome.*` supported for compat. |

Firefox support requires either contributing Firefox bindings to `web-extensions-sys` or writing raw `wasm-bindgen` bindings to the `browser.*` namespace. The background script architecture also needs platform-specific JS bootstrap files.
