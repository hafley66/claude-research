---
name: screenpipe-architecture
description: Screenpipe's production architecture for hybrid AX + OCR text extraction, event-driven capture, SimHash dedup, SQLite FTS5 storage. Reference implementation for screen text tools in Rust. Trigger on screenpipe, screen text pipeline, hybrid ocr accessibility, event driven capture, text extraction architecture.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Production patterns from screenpipe (16.7k stars) for capturing, extracting, and indexing on-screen text. This is the reference implementation for "find text on screen with positions" in Rust on macOS.

## Crate map

| Crate | Role |
|---|---|
| `screenpipe-a11y` | AX tree walking, CGEventTap UI event capture |
| `screenpipe-screen` | Screen capture, Apple Vision OCR |
| `screenpipe-engine` | Orchestration: event-driven capture loop, paired capture |
| `screenpipe-db` | SQLite + FTS5 storage |

Key files:
- `crates/screenpipe-a11y/src/tree/macos.rs` -- AX tree walker
- `crates/screenpipe-a11y/src/tree/cache.rs` -- SimHash dedup
- `crates/screenpipe-a11y/src/platform/macos.rs` -- CGEventTap
- `crates/screenpipe-screen/src/apple.rs` -- Apple Vision OCR
- `crates/screenpipe-engine/src/paired_capture.rs` -- AX vs OCR routing
- `crates/screenpipe-engine/src/event_driven_capture.rs` -- capture loop

## AX tree walking strategy

**Focused window only, not system-wide.** Query system-wide element to get focused app, then focused window, then walk that window's tree.

```rust
let sys = ax::UiElement::sys_wide();
let focused_app = sys.focused_app()?;
// walk focused_app's focused window
```

### Performance controls

| Parameter | Default | Purpose |
|---|---|---|
| `walk_interval` | 3s | How often to walk |
| `max_depth` | 30 | Max recursion depth |
| `max_nodes` | 5000 | Max elements per walk |
| `walk_timeout` | 250ms | Wall-clock timeout for entire walk |
| `element_timeout_secs` | 0.2s | Per-element AX IPC timeout |
| `max_text_length` | 50,000 chars | Text buffer cap |

**Per-element timeout is the key.** `AXUIElementSetMessagingTimeout(element, 0.2)` prevents any single IPC call from blocking more than 200ms. The 250ms wall-clock deadline truncates the walk early rather than waiting for all elements.

### Chromium/Electron trick

Set `AXEnhancedUserInterface = true` on the app element to force Chromium to materialize its full AX tree (normally lazy until screen reader detected).

### Roles skipped

`AXScrollBar`, `AXImage`, `AXSplitter`, `AXGrowArea`, `AXMenuBar`, `AXMenu`, `AXToolbar`, `AXSecureTextField`

### Text extraction priority

For `AXStaticText`: value first. For text fields: value first. Fallback chain: title, then description. Text roles: `AXStaticText`, `AXTextField`, `AXTextArea`, `AXButton`, `AXMenuItem`, `AXCell`, `AXHeading`, `AXLink`.

### Bounding boxes

Each text node gets normalized 0-1 coordinates relative to the monitor. Reads `AXPosition` + `AXSize`, normalizes against monitor dimensions.

### Autorelease pool

Entire walk wrapped in `cidre::objc::ar_pool()` to prevent ObjC memory leaks on reused tokio blocking thread.

## OCR pipeline (Apple Vision)

In `screenpipe-screen/src/apple.rs`:

1. Convert `DynamicImage` to grayscale luma8
2. Create `CVPixelBuffer` (ONE_COMPONENT_8 format)
3. Create `VNImageRequestHandler` from pixel buffer
4. Run `VNRecognizeTextRequest` with language correction disabled
5. Iterate `topCandidates(1)` for each observation
6. Get **line-level** bounding boxes via `bounding_box_for_range(0..text.len())`
7. Convert Vision bottom-left origin to top-left: `top = 1.0 - y_vision - height`
8. Output: normalized 0-1 coords `{text, left, top, width, height, conf}`

**Line-level, not word-level.** Bounding boxes are per-recognition-result (text lines).

## Hybrid routing (AX vs OCR)

Decision logic in `paired_capture.rs`:

1. **AX-first**: Walk focused window. If non-empty text, use it and **skip OCR entirely**
2. **Terminal emulators always OCR**: wezterm, iterm, terminal, alacritty, kitty, hyper, warp, ghostty. AX tree only returns window chrome, not buffer content
3. **"Thin" a11y detection**: If AX returned text but it's mostly UI chrome:
   - Known canvas apps by window title/URL: Google Docs, Sheets, Slides, Figma, Excalidraw, Miro, Canva, tldraw
   - Content density heuristic: if < 30% of text characters come from content roles (vs chrome roles like AXButton/AXMenuItem), it's "thin"
   - When thin: `text_source = "hybrid"`, both AX and OCR stored
4. **OCR fallback**: If AX returned nothing (games, bad a11y apps)

Text source tracked as: `"accessibility"`, `"ocr"`, or `"hybrid"`.

## Content dedup (two layers)

### Exact hash
Content hash of AX text compared to previous capture. Same hash = skip DB write.

### SimHash (fuzzy)
64-bit locality-sensitive hash using word-level 3-shingles. Hamming distance <= 10 means "similar enough to skip" (accounts for minor scroll changes). Cache keyed on `(app_name, window_name)` with 60s TTL.

### Time-based floor
Even if hash matches, force a write every 30s so the timeline never goes empty.

### Frame comparison
Downscaled histogram comparison (1920 -> 480px) with hash-based early exit for identical frames.

## Event-driven capture

Not fixed FPS. Captures on triggers:

| Trigger | Debounce |
|---|---|
| App switch | 200ms min interval |
| Window focus | 200ms |
| Click | 200ms |
| Typing pause | 500ms after last keystroke |
| Scroll stop | 300ms after last scroll |
| Clipboard change | immediate |
| Visual change (5% frame diff) | every 3s |
| Idle fallback | 30s |

### Activity-adaptive FPS

| State | FPS |
|---|---|
| Keyboard burst | 5 |
| Active typing | 7 |
| General activity | 5 |
| Cooling down | 2 |
| Idle | 1 |
| Deep idle | 0.5 |

## Threading model

```
CGEventTap thread (OS thread) -> crossbeam channel -> dispatch thread (OS thread)
                                                          |
                                                    broadcast channel
                                                    ActivityFeed (atomics)
                                                          |
capture loop (tokio async) <- broadcast rx <--------------+
     |
     +-- spawn_blocking: AX tree walk (200ms/element, 250ms total)
     +-- spawn_blocking: OCR (Semaphore::new(1), one concurrent)
     +-- async: write JPEG to disk
     +-- async: insert frame + FTS in SQLite
```

Two OS threads for CGEventTap (needs its own CFRunLoop) and event dispatch. Tokio tasks for capture, AX walk (blocking), and OCR (blocking, semaphore-limited to 1 concurrent).

## Storage (SQLite + FTS5)

`frames` table: `accessibility_text`, `accessibility_tree_json` (array of `{role, text, depth, bounds}`), `content_hash`, `simhash`, `text_source`, `capture_trigger`.

`ocr_text` table: `text`, `text_json` (bounding box data), `ocr_engine`.

FTS5 indexes on `app_name`, `window_name`, `accessibility_text`, `browser_url`. Unicode61 tokenizer. Auto-sync triggers on INSERT/UPDATE/DELETE.
