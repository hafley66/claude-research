# WASM: capabilities + security notes

## Two rendering models for wasm UI
| Model | How | a11y/SEO | Bundle | Examples |
|---|---|---|---|---|
| DOM-driving | wasm diffs vDOM, JS mutates real DOM | native | small | Leptos, Yew, Dioxus(web), Blazor |
| Canvas/GPU (immediate-mode) | wasm paints to `<canvas>` via WebGL/WebGPU | DIY | large | egui, Flutter, Makepad, Bevy, **Godot**, Unity |

wasm can't touch the DOM directly. DOM frameworks route mutations through JS glue; canvas frameworks own one `<canvas>`.

## Impressively done with wasm
Running things that shouldn't run in a tab:
- **Runtimes/languages**: Pyodide (CPython+NumPy/Pandas), PGlite (real Postgres), DuckDB-Wasm, SQLite (wa-sqlite), ruby.wasm, CheerpJ (the JVM), WebR.
- **Whole machines**: v86 (boots Linux/Win95), WebVM (Debian via CheerpX x86→wasm JIT + Tailscale), JSLinux.
- **Heavy media/ML**: FFmpeg.wasm, Ruffle (Flash in Rust), whisper.cpp, WebLLM / transformers.js (LLMs local via wasm+WebGPU), ONNX Runtime Web.
- **Shipped products**: Figma, Google Earth, AutoCAD Web, Photoshop/Lightroom Web, Photopea, Zoom Web, 1Password, Unity/Godot/Unreal web exports.
- **Beyond browser**: Cloudflare Workers, Fastly Compute, Fermyon Spin, proxy-wasm (Envoy/Istio), Extism plugins, CosmWasm/ink!/Arbitrum Stylus.

## Has it been hacked? Four distinct things.
1. **Sandbox boundary** — mostly intact. Escapes are compiler-bug-driven, not design flaws. Ex: CVE-2026-34971 (Wasmtime/Cranelift aarch64 miscompile → guest passes bounds check, loads different addr → arbitrary host R/W; patched; Spectre mitigations were a workaround). Also CVE-2021-32629.
2. **In-module memory safety is WORSE than native.** Paper: "Everything Old is New Again: Binary Security of WebAssembly" (Lehmann/Kinder/Pradel, USENIX Security 2020). No ASLR in linear memory, no stack canaries, no guard pages, data ptrs = i32 offsets. Classic overflows that are dead natively become exploitable in wasm — overwrite "constant" data, smash stack into heap, redirect call_indirect within a type sig. Corrupts the app's own logic, does NOT escape host.
3. **Side channels** — wasm threads = precise timers = Spectre. Why SharedArrayBuffer is locked behind cross-origin isolation (COOP+COEP).
4. **Abuse as a tool** (most common in the wild) — cryptojacking (binary = scanner-evading, in-memory = EDR-evading; 207-site Sucuri campaign), Magecart skimmers, obfuscated wasm. Plus engine 0-days shared with JS: CVE-2025-10585 (V8 JS+wasm type confusion, exploited in wild, patched Sept 2025).

### Net
- Outer sandbox: strong, well-maintained, escapes are rare patched-fast JIT bugs.
- Inner memory safety: no better than native, measurably worse.
- Real-world: attackers exploit wasm's speed + opacity far more than its bugs.

## Sources
- https://www.usenix.org/conference/usenixsecurity20/presentation/lehmann
- https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-jhxm-h53p-jm7w
- https://thehackernews.com/2025/09/google-patches-chrome-zero-day-cve-2025.html
- https://blog.sucuri.net/2022/07/cryptominers-webassembly-in-website-malware.html
- https://arxiv.org/html/2403.15197v1
