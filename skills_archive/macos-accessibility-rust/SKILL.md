---
name: macos-accessibility-rust
description: macOS Accessibility (AX) API from Rust -- AXUIElement tree walking, text extraction, position queries, permissions, crate landscape. Trigger on accessibility api, AXUIElement, ax tree, screen reader rust, macos text extraction, accessibility-sys.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Using the macOS Accessibility framework from Rust to read UI element trees, extract text content, and get screen-space bounding boxes. Core building block for tools that need to find and locate visible text across any application.

## Crate landscape

| Crate | Level | Coverage | Notes |
|---|---|---|---|
| `accessibility-sys` | Raw FFI | Complete (41 fns, 600+ constants) | All of AXUIElement.h |
| `accessibility` (eiz) | Safe wrapper | Partial ("spotty") | TreeWalker, ElementFinder, typed attributes |
| `macos-accessibility-client` | Minimal | `is_trusted()` only | Not useful for tree walking |
| `objc2-accessibility` | Auto-generated | AXUIElement NOT wrapped | C API, not ObjC -- objc2 can't auto-gen it |

```toml
[dependencies]
accessibility = "0.3"       # safe wrapper with TreeWalker
accessibility-sys = "0.2"   # raw FFI when wrapper is insufficient
```

## Permission model

Single permission gate: **System Settings > Privacy & Security > Accessibility**.

```rust
use accessibility_sys::{AXIsProcessTrusted, AXIsProcessTrustedWithOptions};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::string::CFString;

// Check silently
let trusted: bool = unsafe { AXIsProcessTrusted() };

// Check with system prompt dialog
let key = CFString::new("AXTrustedCheckOptionPrompt");
let opts = CFDictionary::from_CFType_pairs(&[(key, CFBoolean::true_value())]);
let trusted = unsafe { AXIsProcessTrustedWithOptions(opts.as_concrete_TypeRef()) };
```

Coverage:
- Accessibility permission covers both AXUIElement access AND CGEventTap (defaultTap placement)
- CGEventTap with listenOnly requires Input Monitoring instead (weaker)
- **Sandboxed apps cannot use AX at all** -- no Mac App Store without workarounds
- For CLI tools, the terminal emulator itself needs the permission

## System-wide vs PID-scoped queries

```rust
use accessibility_sys::*;

// System-wide: query focused element, element at position, across all apps
let system = unsafe { AXUIElementCreateSystemWide() };

// PID-scoped: faster, only walks one app's tree
let app = unsafe { AXUIElementCreateApplication(pid) };
// From here: kAXWindowsAttribute, kAXFocusedWindowAttribute, full element tree
```

Reverse lookup from any element to its PID:
```rust
let mut pid: pid_t = 0;
unsafe { AXUIElementGetPid(element, &mut pid) };
```

## Walking the AX tree

Using the `accessibility` crate's TreeWalker:

```rust
use accessibility::{AXUIElement, TreeWalker, TreeVisitor, TreeWalkerFlow};

struct TextCollector {
    results: Vec<(String, CGPoint, CGSize)>,
}

impl TreeVisitor for TextCollector {
    fn enter_element(&mut self, el: &AXUIElement) -> TreeWalkerFlow {
        if let Ok(role) = el.role() {
            if role == "AXStaticText" {
                if let Ok(value) = el.value::<String>() {
                    let pos = el.attribute::<CGPoint>("AXPosition").unwrap_or_default();
                    let size = el.attribute::<CGSize>("AXSize").unwrap_or_default();
                    self.results.push((value, pos, size));
                }
            }
        }
        TreeWalkerFlow::Continue
    }
    fn exit_element(&mut self, _el: &AXUIElement) {}
}

let app = AXUIElement::application(pid);
let walker = TreeWalker::new();
let mut collector = TextCollector { results: vec![] };
walker.walk(&[app], &mut collector);
```

TreeWalkerFlow options: `Continue`, `SkipSubtree`, `Exit`.

## Getting text position and bounds

Position/size are `AXValue` objects wrapping `CGPoint`/`CGSize`:

```rust
use accessibility_sys::*;
use core_foundation::base::TCFType;

unsafe fn get_element_bounds(el: AXUIElementRef) -> Option<(CGPoint, CGSize)> {
    let mut pos_value: CFTypeRef = std::ptr::null();
    let mut size_value: CFTypeRef = std::ptr::null();

    AXUIElementCopyAttributeValue(el, kAXPositionAttribute as _, &mut pos_value);
    AXUIElementCopyAttributeValue(el, kAXSizeAttribute as _, &mut size_value);

    let mut point = CGPoint { x: 0.0, y: 0.0 };
    let mut size = CGSize { width: 0.0, height: 0.0 };

    AXValueGetValue(pos_value as _, kAXValueCGPointType, &mut point as *mut _ as *mut _);
    AXValueGetValue(size_value as _, kAXValueCGSizeType, &mut size as *mut _ as *mut _);

    Some((point, size))
}
```

For **selected text bounds** (finer granularity within text areas):

```rust
// 1. Get selected text range
// kAXSelectedTextRangeAttribute -> AXValue wrapping CFRange

// 2. Get bounds for that range (parameterized attribute)
// AXUIElementCopyParameterizedAttributeValue(
//     element,
//     kAXBoundsForRangeParameterizedAttribute,
//     range_value,
//     &mut rect_value
// )
// Returns AXValue wrapping CGRect
```

`kAXBoundsForRangeParameterizedAttribute` works on AXTextArea roles but may fail on AXStaticText.

## Point query (element under cursor)

```rust
let system = unsafe { AXUIElementCreateSystemWide() };
let mut element: AXUIElementRef = std::ptr::null();
let err = unsafe {
    AXUIElementCopyElementAtPosition(system, x as f32, y as f32, &mut element)
};
// Returns the deepest element at (x, y) screen coordinates
```

## AX Observer (change notifications)

```rust
use accessibility_sys::*;

// Create observer for a specific PID
let mut observer: AXObserverRef = std::ptr::null_mut();
AXObserverCreate(pid, callback_fn, &mut observer);

// Register for notifications
AXObserverAddNotification(observer, element, kAXValueChangedNotification, context);

// Add to CFRunLoop
let source = AXObserverGetRunLoopSource(observer);
CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopDefaultMode);
```

Notifications: `kAXValueChangedNotification`, `kAXUIElementDestroyedNotification` (unreliable per AeroSpace), `kAXFocusedUIElementChangedNotification`, `kAXWindowMovedNotification`.

## Performance characteristics

| Operation | Time | Notes |
|---|---|---|
| Full tree walk (Safari) | ~20 seconds | Thousands of elements, each an IPC round-trip |
| Full tree walk (simple app) | 1-5 seconds | |
| Depth-limited walk (depth=1) | <100ms | Direct children only |
| `AXUIElementCopyElementAtPosition` | <10ms | Single point query |
| Average macOS screen | ~192 elements | Tree depth ~7 |

Each `AXUIElementCopyAttributeValue` is an IPC round-trip to the target process. This is the bottleneck.

## App-specific behavior

- **Browsers (Chrome, Safari)**: Web content exposed via AXWebArea role. DOM elements map to AX roles including AXStaticText. Walking a complex page is slow (thousands of elements). Chrome AX can be disabled by the user.
- **Electron apps**: Work like browsers. Known bugs with text selection ranges when lines start with whitespace.
- **Terminal emulators**: Typically expose visible buffer as one/few large text elements, not individual words.
- **Games / custom renderers**: No AX tree at all. Fall back to OCR.
- **Firefox**: Some attributes report incorrect positions.

## Thread safety

`AXUIElement` is `!Send, !Sync` in the `accessibility` crate. All AX calls should happen on one thread, ideally the main thread with the run loop. Use `AXUIElementSetMessagingTimeout` to prevent blocking on hung apps (default timeout can cause your process to block indefinitely).

## CGEventTap + AX coexistence

They work fine in the same process. The `stephenc222/example-network-ui-event-tracking-macos` project demonstrates calling `AXUIElementCopyElementAtPosition` from a CGEventTap callback. Both can be added to the same CFRunLoop. Both require the same Accessibility permission.

## Reference projects

| Project | URL | What |
|---|---|---|
| glide-wm/glide | github.com/glide-wm/glide | Tiling WM, uses accessibility + accessibility-sys |
| karinushka/paneru | github.com/karinushka/paneru | Tiling WM, AX + SkyLight APIs |
| stephenc222/example-network-ui-event-tracking-macos | github.com/stephenc222/example-network-ui-event-tracking-macos | CGEventTap + AX in same process |
| AXorcist (Swift) | github.com/steipete/AXorcist | Breadth-first AX traversal, fuzzy text matching |
| AccessibilityNavigator (Swift) | github.com/impel-intelligence/AccessibilityNavigator | Swift AX wrapper |
| screenpipe | github.com/screenpipe/screenpipe | Hybrid AX + OCR, production Rust |
