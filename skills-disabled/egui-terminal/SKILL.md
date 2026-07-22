---
name: egui-terminal
description: Embedding terminal emulators in egui -- egui_term widget, alacritty_terminal backend, PTY management, multi-tab terminals, rendering pipeline, input handling, theming
license: MIT
compatibility: opencode
metadata:
  source: https://github.com/Harzu/egui_term
  crate: egui_term (git, 0.1.0 on crates.io)
  egui: 0.33
  depth: intermediate
---

## What this covers

Embedding live terminal sessions inside egui apps using `egui_term`. Architecture, setup, multi-instance patterns, and the underlying alacritty_terminal + PTY stack.

Trigger on: egui terminal, egui_term, terminal in egui, pty egui, embed terminal rust gui, alacritty egui, terminal widget egui.

## Crate landscape

| Crate | What | Use? |
|---|---|---|
| `egui_term` | Full terminal widget (PTY + alacritty_terminal + egui rendering) | **Yes** |
| `alacritty_terminal` 0.25.x | Terminal emulation engine (VTE parser, grid state, PTY) | Used internally by egui_term |
| `vte` 0.15 | Low-level ANSI escape sequence parser | Used internally by alacritty_terminal |
| `portable-pty` 0.9 | Cross-platform PTY abstraction (from wezterm) | Alternative to alacritty's PTY if rolling your own |
| `terminput-egui` | Converts egui input events to terminal escape sequences | Input adapter only, not a terminal |
| `par-term` | Standalone terminal app built on egui | Not a library, can't embed |
| `egui-terminal` | Dead (egui 0.22, no repo) | No |

## Setup

```toml
# crates.io is behind, use git
[dependencies]
egui_term = { git = "https://github.com/Harzu/egui_term" }
eframe = "0.33"
```

## Architecture

```
egui_term
├── TerminalBackend
│   ├── alacritty_terminal::Term (grid state, VTE processing)
│   ├── PTY (alacritty's pty module, not portable-pty)
│   ├── Event loop thread (PTY I/O)
│   └── Event subscription thread (forwards events, calls request_repaint)
└── TerminalView (egui widget)
    ├── Iterates term.content.grid.display_iter()
    ├── Builds Vec<Shape>: Rect (cell bg) + text (glyphs) + LineSegment (underlines)
    └── Submits via painter.extend(shapes)
```

Thread model: two background threads per terminal instance. One runs alacritty's event loop for PTY I/O. The other subscribes to terminal events and triggers `ctx.request_repaint()` so egui redraws when output arrives.

State is held in `Arc<FairMutex<Term<EventProxy>>>` for thread-safe access between the render thread and the PTY I/O thread.

## Basic usage

```rust
use egui_term::{TerminalBackend, TerminalView};

struct App {
    backend: TerminalBackend,
}

impl App {
    fn new(ctx: &egui::Context) -> Self {
        let backend = TerminalBackend::new(
            ctx,
            TerminalBackend::default_config(), // shell, env, working dir
        );
        Self { backend }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            let view = TerminalView::new(&mut self.backend);
            ui.add(view);
        });
    }
}
```

## Multi-tab terminals

Run multiple backends, switch which view renders:

```rust
struct App {
    terminals: Vec<TerminalBackend>,
    active_tab: usize,
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            // Tab bar
            ui.horizontal(|ui| {
                for (i, _) in self.terminals.iter().enumerate() {
                    if ui.selectable_label(self.active_tab == i, format!("Term {}", i + 1)).clicked() {
                        self.active_tab = i;
                    }
                }
                if ui.button("+").clicked() {
                    self.terminals.push(TerminalBackend::new(ctx, TerminalBackend::default_config()));
                }
            });
            ui.separator();

            // Active terminal
            if let Some(backend) = self.terminals.get_mut(self.active_tab) {
                ui.add(TerminalView::new(backend));
            }
        });
    }
}
```

## Split pane terminals (tmux-style)

Tile multiple TerminalView widgets in your layout:

```rust
// Vertical split
ui.columns(2, |cols| {
    cols[0].add(TerminalView::new(&mut self.terminals[0]));
    cols[1].add(TerminalView::new(&mut self.terminals[1]));
});

// Or with egui_flex for proportional splits
Flex::horizontal().show(ui, |flex| {
    flex.add(FlexItem::new().grow(1.0), |ui| {
        ui.add(TerminalView::new(&mut self.terminals[0]));
    });
    flex.add(FlexItem::new().grow(1.0), |ui| {
        ui.add(TerminalView::new(&mut self.terminals[1]));
    });
});
```

Each backend runs its own PTY + threads. Independent resize, scroll, input.

## Features

- Keyboard + mouse input with custom bindings
- Terminal resize (responds to egui widget size changes)
- Scrollback buffer
- Text selection
- Hyperlink detection
- Configurable fonts and color themes
- Multiple independent instances

## Rendering pipeline detail

Per frame, for each visible terminal:

1. Lock `Arc<FairMutex<Term>>`
2. Call `term.renderable_content()` to get current grid snapshot
3. Iterate `content.display_iter()` -- yields `(Point, Cell)` pairs for visible cells
4. For each cell:
   - `Shape::Rect` with cell background color
   - `Shape::text()` with the glyph character, font, foreground color
   - `Shape::LineSegment` if underlined/strikethrough
5. Collect into `Vec<Shape>`, call `painter.extend(shapes)`

All pure egui Painter API. No custom shaders, no texture atlases, no wgpu paint callbacks. This means it works on any egui backend (glow, wgpu, web).

## Performance considerations

- Each terminal instance = 2 background threads + ~1 lock acquisition per frame
- Rendering cost scales with visible cell count (typically 80x24 = 1920 cells, trivial)
- High-throughput output (e.g. `cat large_file`) can cause rapid repaints -- alacritty_terminal batches internally but egui still redraws each time the event thread signals
- For very high output, consider throttling `request_repaint()` to a max frame rate

## Building from scratch (without egui_term)

If egui_term doesn't fit (custom PTY lifecycle, custom rendering, etc.):

```rust
// 1. PTY
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
let pty_system = native_pty_system();
let pair = pty_system.openpty(PtySize { rows: 24, cols: 80, .. })?;
let mut cmd = CommandBuilder::new("bash");
let child = pair.slave.spawn_command(cmd)?;
let reader = pair.master.try_clone_reader()?;
let writer = pair.master.take_writer()?;

// 2. Terminal state
use alacritty_terminal::term::Term;
use alacritty_terminal::term::Config as TermConfig;
let term = Term::new(TermConfig::default(), &PtySize { rows: 24, cols: 80 }, ..);

// 3. Background thread: read PTY -> feed to term
std::thread::spawn(move || {
    let mut buf = [0u8; 4096];
    loop {
        let n = reader.read(&mut buf)?;
        // lock term, call term.advance(bytes)
        ctx.request_repaint();
    }
});

// 4. Render: iterate grid, build shapes (same as egui_term does)
// 5. Input: convert egui key events to ANSI, write to PTY writer
```

This is exactly what egui_term does. Use it unless you need custom control over the PTY lifecycle or rendering.
