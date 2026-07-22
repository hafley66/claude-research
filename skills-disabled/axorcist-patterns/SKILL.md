---
name: axorcist-patterns
description: AXorcist's accessibility tree traversal patterns -- visitor-based tree walking, container role pruning, timeout policies, path-based navigation, fuzzy matching, batch attributes. Swift patterns transferable to Rust. Trigger on axorcist, ax tree traversal, accessibility performance, ax search patterns, ax visitor.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Design patterns from AXorcist (Swift) for performant accessibility tree traversal. These patterns translate directly to Rust via `accessibility-sys`.

## Architecture overview

AXorcist is a command-driven AX query tool. Key abstractions:

| Concept | Purpose |
|---|---|
| `Element` | Wrapper around `AXUIElement` with typed attribute access |
| `Locator` | Combines search criteria with optional path hints |
| `SearchVisitor` / `CollectAllVisitor` | Visitor pattern for tree traversal |
| `PathStep` / `PathNavigator` | Path-based navigation to narrow search scope |
| `Criterion` | Single match condition (attribute + value + matchType) |
| `AXTimeoutPolicy` | Per-element and global timeout configuration |

## Visitor-based tree traversal

Core traversal uses visitor pattern with three flow controls:

```swift
public enum TreeVisitorResult {
    case `continue`     // keep going
    case skipChildren   // prune this subtree
    case stop           // abort entire traversal
}

protocol ElementVisitor {
    func visit(element: Element, depth: Int) -> TreeVisitorResult
}
```

The `traverseAndSearch` function walks the tree:

```swift
func traverseAndSearch(element, visitor, currentDepth, maxDepth) {
    guard currentDepth <= maxDepth else { return }
    traversalNodeCounter += 1

    switch visitor.visit(element, currentDepth) {
    case .stop: return
    case .skipChildren: return
    case .continue: break
    }

    // Cycle detection via CFHash
    let hashVal = CFHash(element.underlyingElement)
    guard visited.insert(hashVal).inserted else { return }

    // Container role pruning (critical optimization)
    guard axorcScanAll || containerRoles.contains(element.role()) else { return }

    // Global timeout check
    guard Date() < traversalDeadline else { return }

    for child in element.children() {
        traverseAndSearch(child, visitor, currentDepth + 1, maxDepth)
        // Early exit on first match (SearchVisitor)
        if searchVisitor.stopAtFirstMatch && searchVisitor.foundElement != nil { return }
    }
}
```

## Container role pruning (the key optimization)

Only descend into elements whose role is in the container set. Non-container elements are treated as leaves even if they have children. This prevents descending into things like scroll bars, images, and splitters.

```swift
private let containerRoles: Set<String> = [
    "AXApplication", "AXWindow", "AXGroup", "AXScrollArea",
    "AXSplitGroup", "AXLayoutArea", "AXLayoutItem", "AXWebArea",
    "AXList", "AXOutline", "AXUnknown",
    "AXGeneric", "AXSection", "AXArticle", "AXSplitter",
    "AXScrollBar", "AXPane",
]
```

When `--scan-all` flag is set, this pruning is disabled and every element's children are visited.

## Timeout policy (three layers)

### 1. Per-element messaging timeout
```swift
element.setMessagingTimeout(2.0) // seconds
// Reset after operation:
element.setMessagingTimeout(0)   // 0 = system default
```
Prevents hung apps from blocking the entire walk. Maps to `AXUIElementSetMessagingTimeout` in C.

### 2. Global traversal deadline
```swift
traversalDeadline = Date().addingTimeInterval(axorcTraversalTimeout) // default 30s
// Checked before visiting each child
guard Date() < traversalDeadline else { return }
```

### 3. Async operation timeout (for external callers)
```swift
static func withTimeout<T>(seconds: TimeInterval, operation: () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            throw AXTimeoutError.operationTimedOut(duration: seconds)
        }
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}
```

### Retry wrapper
```swift
struct AXTimeoutWrapper {
    let maxRetries: Int       // default 3
    let retryDelay: TimeInterval  // default 0.5s

    func execute<T>(_ operation: () throws -> T?) async throws -> T? {
        for attempt in 0..<maxRetries {
            if let result = try operation() { return result }
            try await Task.sleep(/* retryDelay */)
        }
        return nil
    }
}
```

## Path-based navigation (narrowing search scope)

Instead of walking the entire tree, navigate a known path first:

```swift
// Locator has two parts:
struct Locator {
    let rootElementPathHint: [PathHintComponent]?  // navigate first
    let criteria: [Criterion]                       // then search from there
}

// Path hint: "Window -> Group -> ScrollArea -> WebArea"
// Navigate down the path to get close, then search from that subtree
```

Each `PathStep` has its own criteria and `maxDepthForStep`. If path navigation fails, it falls back to searching from the app root.

## Search criteria and matching

```swift
struct Criterion {
    let attribute: String        // "AXRole", "AXValue", "AXTitle", etc.
    let value: String            // match target
    let matchType: MatchType?    // exact, contains, startsWith, endsWith, regex, fuzzy
}
```

Match types: `exact`, `contains`, `startsWith`, `endsWith`, `regex`, `fuzzy`.

Criteria can be combined with `matchAll` (AND) or `matchAny` (OR).

## Batch attribute fetching

Rather than N round-trips for N attributes, specify attributes to fetch upfront:

```swift
let attributesToFetch = command.attributesToReturn ?? defaultAttributesToFetch
// defaultAttributesToFetch = ["AXRole", "AXTitle", "AXValue", "AXDescription", ...]

// Single pass: fetch all requested attributes in one method
func fetchInstanceElementAttributes(element, attributeNames) -> [String: AXValueWrapper] {
    var dict = [:]
    for name in attributeNames {
        dict[name] = element.attribute(Attribute<Any>(name))
    }
    return dict
}
```

This is still N IPC calls under the hood (macOS AX doesn't support multi-attribute fetch), but the code structure avoids redundant walks.

## Text extraction from elements

```swift
// extractTextFromElement(element, maxDepth: 3)
// Walks subtree to maxDepth=3, collecting text from:
// - AXStaticText: value attribute
// - AXTextField/AXTextArea: value attribute
// - Fallback: title, then description
```

## Cycle detection

Uses `CFHash` of `AXUIElement` to detect cycles (parent-child loops in broken AX trees):

```swift
let hashVal: UInt = CFHash(child.underlyingElement)
guard visited.insert(hashVal).inserted else { continue }
```

In Rust via `accessibility-sys`: `CFHash(element as CFTypeRef)`.

## Patterns to port to Rust

1. **Visitor trait** with Continue/SkipChildren/Stop -- maps to `accessibility` crate's `TreeWalkerFlow`
2. **Container role set** -- prune non-container children to avoid N^2 walks
3. **Per-element timeout** -- `AXUIElementSetMessagingTimeout(el, 0.2)` via `accessibility-sys`
4. **Global deadline** -- `Instant::now() + Duration::from_millis(250)`, check before each child
5. **Node count limit** -- `AtomicU32` counter, stop at 5000
6. **CFHash cycle detection** -- prevent infinite loops in broken trees
7. **Path navigation** -- narrow scope before brute-force search
8. **Chromium force-enable** -- set `AXEnhancedUserInterface = true` on app element
