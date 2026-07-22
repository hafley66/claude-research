---
name: macos-screen-text
description: Finding and locating text on macOS screen -- AX tree walking vs Vision OCR vs Chrome DevTools Protocol vs terminal APIs. Hybrid approach, accuracy/performance tradeoffs, Rust crates. Trigger on screen text extraction, find text on screen, OCR macos rust, text position screen, word detection macos, screenpipe.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

All approaches to finding visible text on macOS with pixel-coordinate bounding boxes. The core problem: given a word, find every visible instance on screen and get its (x, y, width, height).

## Approach comparison

| Approach | Accuracy | Speed | Coverage | Coordinates |
|---|---|---|---|---|
| AX tree walk (targeted) | Element-level bbox | <500ms | Native apps, browsers (slow), Electron | Screen pixels directly |
| AX tree walk (full) | Same | 5-20s | Same | Same |
| Vision OCR (.fast) | Word-level bbox, ~pixel | 130-500ms | Everything visible on screen | Normalized, needs conversion |
| Vision OCR (.accurate) | Better for small text | 200-800ms | Same | Same |
| Chrome DevTools Protocol | Sub-pixel DOM rects | <50ms | Chrome/Chromium only | Viewport coords + window offset |
| iTerm2 Python API | Cell-level precision | <50ms | iTerm2 only | Grid coords + font metrics |

## Recommended architecture (what screenpipe does)

1. Determine frontmost app type
2. **Primary**: AX tree walk for structured text (faster, more accurate for native apps)
3. **Fallback**: Vision OCR when AX is unavailable (games, remote desktop, canvas, custom renderers)
4. Both fire on same timestamp for consistency

## Approach 1: Accessibility tree (targeted)

```rust
// Get frontmost app PID
let frontmost_pid = get_frontmost_pid(); // via NSWorkspace

// Create app-scoped element (faster than system-wide)
let app = AXUIElementCreateApplication(frontmost_pid);

// Walk only visible elements, filter by role
// Look for: AXStaticText, AXTextField, AXTextArea, AXButton (title text)
// Check AXValue for content, AXPosition/AXSize for bounds
```

Key attributes:
- `kAXValueAttribute` -- text content
- `kAXPositionAttribute` -- top-left corner (screen coords), wrapped in AXValue/CGPoint
- `kAXSizeAttribute` -- dimensions, wrapped in AXValue/CGSize
- `kAXBoundsForRangeParameterizedAttribute` -- bounds for a character range within a text area (finer granularity)

Performance optimization: use `AXUIElementCopyElementAtPosition` for point queries instead of full tree walks. Depth-limit walks to avoid 20-second Safari traversals.

## Approach 2: Vision framework OCR

Pipeline:
1. Capture screen via ScreenCaptureKit (macOS 12.3+)
2. Feed CGImage to VNImageRequestHandler
3. Run VNRecognizeTextRequest
4. Get VNRecognizedTextObservation results with bounding boxes

```rust
// Rust via objc2-vision + screencapturekit crates
// Or shell out to a Swift helper that returns JSON

// Coordinate conversion (Vision uses bottom-left origin):
// pixel_x = observation.bounding_box.origin.x * image_width
// pixel_y = (1.0 - observation.bounding_box.origin.y - observation.bounding_box.height) * image_height
```

Word-level bounds: `VNRecognizedText.boundingBox(for: range)` returns rect for a substring range.

Quirk: per-character rects return the whole word's bounding box, not individual characters.

**Rust crates:**
- `objc2-vision` -- auto-generated Vision framework bindings
- `screencapturekit` -- ScreenCaptureKit bindings (replaces deprecated CGWindowListCreateImage)

**Performance tuning:**
- `.fast` recognition level for real-time (~131ms)
- `minimumTextHeight` parameter to skip small text
- Capture a sub-region instead of full screen when possible

## Approach 3: Chrome DevTools Protocol

For Chrome/Chromium browsers, the most accurate approach:

```rust
// Using chromiumoxide crate
// Connect to Chrome running with --remote-debugging-port=9222

// Find text nodes
// DOM.performSearch(query: "target word")
// DOM.getSearchResults(searchId, fromIndex, toIndex)

// Get precise position for each match
// DOM.getContentQuads(nodeId) -> quads (4-point polygons)
// DOM.getBoxModel(nodeId) -> content/padding/border/margin boxes

// Convert to screen coords:
// screen_x = browser_window_x + viewport_offset_x + quad.x
// screen_y = browser_window_y + viewport_offset_y + quad.y
```

Window position via `Browser.getWindowBounds()` or AX API. Viewport offset via `Page.getLayoutMetrics()`.

Crate: `chromiumoxide` -- full CDP client, async.

## Approach 4: Terminal-specific

**iTerm2**: Python API via websocket
- `Session.async_get_screen_contents()` -- visible text
- Cell position x font metrics + window offset = pixel coords
- Requires iTerm2 with Python API enabled

**Terminal.app**: Standard AX support. Exposes buffer as large text elements.

**General terminal approach**: Terminals render on a grid. If you know font metrics (cell width/height) and window position, compute exact pixel positions for any cell coordinate.

## App detection for hybrid routing

```rust
use cocoa::appkit::NSWorkspace;

// Get frontmost app bundle ID
let workspace = unsafe { NSWorkspace::sharedWorkspace(nil) };
let front_app = unsafe { workspace.frontmostApplication() };
let bundle_id = unsafe { front_app.bundleIdentifier() };
// "com.google.Chrome" -> use CDP
// "com.googlecode.iterm2" -> use iTerm2 API
// "com.apple.Terminal" -> use AX
// anything else -> AX first, OCR fallback
```

## Key Rust crates

| Crate | Purpose |
|---|---|
| `accessibility` / `accessibility-sys` | AX tree walking |
| `objc2-vision` | Vision framework OCR |
| `screencapturekit` | Screen capture (replaces CGWindowListCreateImage) |
| `chromiumoxide` | Chrome DevTools Protocol |
| `uni-ocr` | Unified OCR API (Vision on macOS, WinRT on Windows, Tesseract on Linux) |
| `ocrs` | Pure Rust OCR, no system deps, ONNX models |
| `arboard` | Clipboard read/write |
| `get-selected-text` | Cross-platform selected text (AX first, Cmd+C fallback) |

## Reference implementations

| Project | URL | What |
|---|---|---|
| screenpipe | github.com/screenpipe/screenpipe | Production hybrid AX + OCR, Rust, 16.7k stars |
| TRex (Swift) | github.com/amebalabs/TRex | Vision framework OCR tool |
| macOCR (Swift) | github.com/schappim/macOCR | Screen capture + Vision OCR CLI |
| AXorcist (Swift) | github.com/steipete/AXorcist | Advanced AX tree querying |
| ocrs | github.com/robertknight/ocrs | Pure Rust OCR engine |

## CGWindowListCreateImage status

**Deprecated** in Sonoma, **removed** in macOS 15. Use ScreenCaptureKit instead. Requires Screen Recording permission.
