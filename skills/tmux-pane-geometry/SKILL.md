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

Returns terminal dimensions in both characters and pixels. Can be called on any open tty fd, not just `STDOUT_FILENO`. This matters in tmux: get the pane's tty path via `#{pane_tty}`, open it, and ioctl that fd to get pixel metrics for that specific pane.

```rust
use libc::{ioctl, winsize, TIOCGWINSZ, STDOUT_FILENO};
use std::fs::File;
use std::os::unix::io::AsRawFd;

fn get_cell_metrics_for_tty(tty_path: &str) -> Option<(u32, u32)> {
    let file = File::open(tty_path).ok()?;
    let mut ws: winsize = unsafe { std::mem::zeroed() };
    let ret = unsafe { ioctl(file.as_raw_fd(), TIOCGWINSZ, &mut ws) };
    if ret != 0 || ws.ws_xpixel == 0 || ws.ws_ypixel == 0 {
        return None;
    }
    Some((
        ws.ws_xpixel as u32 / ws.ws_col as u32,  // cell width in pixels
        ws.ws_ypixel as u32 / ws.ws_row as u32,   // cell height in pixels
    ))
}

// For the active pane on stdout:
fn get_cell_metrics() -> Option<(u32, u32)> {
    get_cell_metrics_for_tty("/dev/tty")
        .or_else(|| {
            let mut ws: winsize = unsafe { std::mem::zeroed() };
            let ret = unsafe { ioctl(STDOUT_FILENO, TIOCGWINSZ, &mut ws) };
            if ret != 0 || ws.ws_xpixel == 0 { return None; }
            Some((ws.ws_xpixel as u32 / ws.ws_col as u32, ws.ws_ypixel as u32 / ws.ws_row as u32))
        })
}
```

tmux format `#{pane_tty}` gives the tty path (e.g. `/dev/ttys003`) for any pane. Use this to query cell metrics without needing the terminal to be focused.

**Reliability warning**: Many terminals return 0 for `ws_xpixel`/`ws_ypixel`. Known to work: xterm, foot, kitty, iTerm2. Known broken: some builds of gnome-terminal, older alacritty.

**Retina note**: iTerm2 on Retina returns physical pixels at 2x scale (e.g. 22x50 per cell). Heuristic: `cell_w > 14` indicates Retina (2x). Standard monospace at typical sizes yields 7-10px wide cells at 1x. For exact scale factor, query `NSScreen.backingScaleFactor` via objc2.

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

### Terminal inset correction

`tmux list-panes` cell dimensions describe only the character grid. Terminal emulators add internal content margins around the grid (iTerm2 defaults: ~4px left, ~4px right, ~2px top in logical points). These margins are NOT included in cell coordinates.

This matters for width alignment: the tmux status bar background fills the full terminal row including margins, so an overlay computed as `pane_width * cell_w` will be visibly narrower than the bar. The pane x position also begins at the cell grid edge (offset right by the left margin from the window content edge).

```rust
pub struct TerminalInsets {
    pub left: i32,
    pub right: i32,
    pub top: i32,
}

impl TerminalInsets {
    pub fn iterm2_default() -> Self {
        Self { left: 4, right: 4, top: 2 }
    }
}

// Corrected rect:
let pane_x = window_x + insets.left + (pane.cell_left * cell_w) as i32;
let pane_w = (pane.cell_width * cell_w) as i32 + insets.left + insets.right;
```

Without this correction, overlays that are meant to span the full terminal row will be offset and undersized by the margin amount on each side.

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

## bin/launch pattern for tmux overlay apps

Shell wrapper that creates a dedicated tmux session and starts an overlay binary inside it:

```bash
#!/usr/bin/env bash
NAME="cc-hud-$(date +%s)-$$"
tmux new-session -d -s "$NAME" -x "$(tput cols)" -y "$(tput lines)"
MAIN_PANE=$(tmux list-panes -t "$NAME" -F '#{pane_id}' | head -1)
# Split a 1-line pane for the daemon, pass the main pane's global ID
tmux split-window -t "$NAME" -v -l 1 "my-overlay-binary $MAIN_PANE"
tmux select-pane -t "$NAME:.0"
exec tmux attach -t "$NAME"
```

Key points:
- Generate a unique session name with `date +%s` + `$$` to avoid collisions.
- Capture the main pane ID (`#{pane_id}` global format, e.g. `%3`) before splitting.
- Pass the pane ID (not the session name) to the binary so it targets the correct pane unambiguously -- the daemon runs in a different pane of the same session.
- Size the session to the current terminal with `tput cols`/`tput lines`.

## Testing strategy

This layer is all pure functions. Test with:
- Known cell coordinates + cell metrics, assert pixel rects
- Captured `tmux list-panes` output in `tests/fixtures/`, assert parsed geometry
- Sequences of layout states, assert diff events
- Edge cases: single pane, pane at origin, pane with 0 width (minimized)
- Scale factors: 1.0, 2.0, 1.5 (fractional scaling)
