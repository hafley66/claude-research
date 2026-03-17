---
name: tmux-pane-geometry
description: tmux pane layout querying, cell-to-pixel coordinate conversion, TIOCGWINSZ ioctl, pane diff events. Trigger on tmux pane coordinates, cell pixel size, pane geometry, overlay positioning, terminal cell metrics.
license: MIT
metadata:
  audience: developers
  workflow: tmux-overlay
---

## What this covers

Querying tmux pane layout, converting cell coordinates to screen pixels, and detecting layout changes over time.

## Querying pane geometry

```bash
# Cell coordinates for all panes in current window
tmux list-panes -F '#{pane_id}:#{pane_top}:#{pane_left}:#{pane_width}:#{pane_height}'

# Output: %0:0:0:80:24\n%1:0:80:40:24\n%2:24:0:120:10
```

Rust crate `tmux_interface` wraps this, but raw CLI is simpler and avoids a dep for one command.

### Parsing

```rust
struct PaneGeometry {
    id: String,
    cell_top: u32,
    cell_left: u32,
    cell_width: u32,
    cell_height: u32,
}

fn parse_pane_geometry(stdout: &str) -> Vec<PaneGeometry> {
    stdout.lines().filter_map(|line| {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() != 5 { return None; }
        Some(PaneGeometry {
            id: parts[0].to_string(),
            cell_top: parts[1].parse().ok()?,
            cell_left: parts[2].parse().ok()?,
            cell_width: parts[3].parse().ok()?,
            cell_height: parts[4].parse().ok()?,
        })
    }).collect()
}
```

## Cell-to-pixel conversion

### TIOCGWINSZ ioctl

Returns terminal dimensions in both characters and pixels:

```rust
use libc::{ioctl, winsize, TIOCGWINSZ, STDOUT_FILENO};

fn get_cell_metrics() -> Option<(u32, u32)> {
    let mut ws: winsize = unsafe { std::mem::zeroed() };
    let ret = unsafe { ioctl(STDOUT_FILENO, TIOCGWINSZ, &mut ws) };
    if ret != 0 || ws.ws_xpixel == 0 || ws.ws_ypixel == 0 {
        return None; // many terminals return 0 for pixel fields
    }
    Some((
        ws.ws_xpixel as u32 / ws.ws_col as u32,  // cell width in pixels
        ws.ws_ypixel as u32 / ws.ws_row as u32,   // cell height in pixels
    ))
}
```

**Reliability warning**: Many terminals return 0 for `ws_xpixel`/`ws_ypixel`. Known to work: xterm, foot, kitty. Known broken: some builds of gnome-terminal, older alacritty.

### Fallback: CSI 16 t

```bash
# Request cell size in pixels
printf '\e[16t'
# Terminal responds: ESC [ 6 ; cell_height ; cell_width t
```

Requires parsing terminal response from stdin. Works in xterm, kitty, WezTerm.

### Fallback: font metrics heuristic

If neither works, assume common monospace font metrics. 8x16 is a reasonable default for most terminal configurations. Not accurate but prevents total failure.

### Pixel rect formula

```rust
fn pane_pixel_rect(
    pane: &PaneGeometry,
    cell_w: u32, cell_h: u32,
    window_x: i32, window_y: i32,
    scale_factor: f64,
) -> PixelRect {
    PixelRect {
        x: window_x + (pane.cell_left * cell_w) as i32 * scale_factor as i32,
        y: window_y + (pane.cell_top * cell_h) as i32 * scale_factor as i32,
        w: (pane.cell_width * cell_w) as f64 * scale_factor,
        h: (pane.cell_height * cell_h) as f64 * scale_factor,
    }
}
```

Scale factor matters on Retina/HiDPI displays (2.0 on macOS Retina).

## Pane diff events

Track layout changes by diffing previous and current state:

```rust
enum PaneEvent {
    Added   { id: String, rect: PixelRect },
    Moved   { id: String, rect: PixelRect },
    Resized { id: String, rect: PixelRect },
    Removed { id: String },
}

fn diff_panes(
    prev: &HashMap<String, PixelRect>,
    curr: &HashMap<String, PixelRect>,
) -> Vec<PaneEvent> {
    let mut events = Vec::new();
    for (id, rect) in curr {
        match prev.get(id) {
            None => events.push(PaneEvent::Added { id: id.clone(), rect: *rect }),
            Some(prev_rect) if prev_rect.size() != rect.size() =>
                events.push(PaneEvent::Resized { id: id.clone(), rect: *rect }),
            Some(prev_rect) if prev_rect.position() != rect.position() =>
                events.push(PaneEvent::Moved { id: id.clone(), rect: *rect }),
            _ => {} // unchanged
        }
    }
    for id in prev.keys() {
        if !curr.contains_key(id) {
            events.push(PaneEvent::Removed { id: id.clone() });
        }
    }
    events
}
```

## tmux hooks for push-based updates

```bash
tmux set-hook -g after-resize-pane    'run-shell "hud-sync resize"'
tmux set-hook -g after-split-window   'run-shell "hud-sync split"'
tmux set-hook -g after-select-layout  'run-shell "hud-sync layout"'
tmux set-hook -g session-window-changed 'run-shell "hud-sync window-change"'
```

**Hooks carry no payload.** The hook fires but the `run-shell` command receives no geometry data. You must call `tmux list-panes` yourself inside the hook handler to get current state. This is by design -- treat hooks as an invalidation signal only.

Available hooks relevant to overlay positioning: `after-resize-pane`, `after-split-window`, `after-select-layout`, `session-window-changed`.

These invoke a command that signals the overlay daemon via unix socket. Faster than polling but polling is the reliable fallback.

### tmux control mode (-CC)

`tmux -CC` provides structured event streaming with `%`-prefixed events (e.g. `%layout-change`). Events are richer than hooks but control mode takes over the terminal session and is heavier than needed for overlay positioning. Use hooks + list-panes instead unless you need full session control.

### Pixel dimensions are not in tmux's scope

tmux only knows character grid dimensions (`pane_width`, `pane_height` in cells). Pixel conversion always requires a terminal-side query: TIOCGWINSZ ioctl or CSI 16t. There is no tmux format variable for pixel sizes.

No established pattern exists for tmux + graphical overlay positioning -- this is greenfield territory.

## Testing strategy

This layer is all pure functions. Test with:
- Known cell coordinates + cell metrics, assert pixel rects
- Captured `tmux list-panes` output in `tests/fixtures/`, assert parsed geometry
- Sequences of layout states, assert diff events
- Edge cases: single pane, pane at origin, pane with 0 width (minimized)
- Scale factors: 1.0, 2.0, 1.5 (fractional scaling)
