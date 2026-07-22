---
name: graph-layout-engines
description: Graph layout algorithm libraries in systems languages (Rust, C, C++, Go, Zig) for computing node positions from edges -- force-directed, hierarchical/Sugiyama, compound (nodes inside nodes), constraint-based. Trigger on graph layout, force directed, sugiyama, compound graph, node positions, dependency graph layout, fdg, forceatlas2, ogdf, igraph layout, graphviz layout api.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

## What this covers

Libraries in Rust/C/C++/Go/Zig that compute 2D/3D positions for graph nodes. Layout math only, not rendering. Input: nodes + edges + constraints. Output: coordinates.

---

## Rust

### fdg -- Force Directed Graph

- **Repo**: github.com/grantshandy/fdg | **Stars**: ~220 | **Active**: Feb 2025
- **Algorithm**: Fruchterman-Reingold, N-dimensional
- **Status**: Active rewrite, planned ForceAtlas2 and Kamada-Kawai
- **API**: Generic over dimension count. Petgraph-compatible. Returns node positions.
- **Compound**: No. Single-level only.
- **Best for**: Organic clustering, moderate-sized graphs.

### forceatlas2

- **Repo**: framagit.org/ZettaScript/forceatlas2-rs | **Crate**: forceatlas2
- **Algorithm**: ForceAtlas2 with Barnes-Hut O(N log N) repulsion
- **Best for**: Large graphs (thousands of nodes). Gephi's algorithm, Rust implementation.
- **Compound**: No.

### Fjädra (Rerun)

- **Origin**: Rerun's internal force-based graph layout
- **Algorithm**: D3-force compatible physics simulation
- **Forces**: Centering, collision radius, many-body, link (spring), position (gravity)
- **Properties**: Pure Rust, no dependencies, compiles to WASM
- **Best for**: Time-varying graphs, interactive visualization backends
- **Compound**: No, but the force model is extensible.
- **Note**: May not be published as a standalone crate. Check Rerun's repo (github.com/rerun-io/rerun) for extraction.

### egui_graphs

- **Repo**: github.com/blitzarx1/egui_graphs | **Active**: 2024-2025
- **Algorithm**: Fruchterman-Reingold (naive O(n^2)) with adjustable step size, damping, center gravity
- **API**: egui widget, works with petgraph
- **Compound**: No.
- **Note**: Rendering-coupled (egui widget), but the layout code is separable in principle.

### dagre-rs

- **Repo**: github.com/TangleGuard/dagre-rs | **Stars**: ~9
- **Algorithm**: Sugiyama hierarchical (layered DAGs). Port of dagre.js.
- **Best for**: Dependency trees, pipeline visualizations.
- **Compound**: No. Low maintenance trajectory.

### layout (nadavrot)

- **Repo**: github.com/nadavrot/layout | **Stars**: 728 | **Active**: Mar 2022 (stale)
- **What**: Parses Graphviz DOT, computes 2D positions, edge crossing elimination.
- **Limitation**: Tied to DOT format input. Not a general graph layout API.

### ascii-dag

- **Crate**: ascii-dag | Zero dependencies
- **Algorithm**: Sugiyama layered layout optimized for terminal rendering.

### petgraph

- **Crate**: petgraph | Standard Rust graph data structure
- **No layout algorithms**, but the graph representation most layout crates accept.

---

## C / C++

### Graphviz (libcgraph + libgvc)

- **Docs**: graphviz.org/docs/library
- **Language**: C
- **Algorithms**: dot (hierarchical), neato (spring model), fdp (force-directed), sfdp (multilevel force-directed for large graphs), twopi (radial), circo (circular)
- **C API**: `gvLayout(gvc, g, "dot")` computes layout. Node coordinates in `ND_coord` as floats. Programmatic access without rendering.
- **Compound**: Limited clustering in dot mode. Not true compound layout.
- **Rust bindings**: graphviz-rust crate (thin FFI wrappers). Can also subprocess `dot -Tjson` for JSON position output.
- **Best for**: Battle-tested, handles edge cases, sfdp scales to large graphs.

### OGDF (Open Graph Drawing Framework)

- **Repo**: github.com/ogdf/ogdf | **Docs**: ogdf.github.io
- **Language**: C++
- **Algorithms**: Sugiyama (multiple layering + crossing minimization strategies), force-directed (FMMM, GEM, Davidson-Harel, stress majorization), orthogonal, planar
- **Compound**: ClusterGraph class supports clustered graphs, but edges cannot attach to cluster boundaries (planned for future). Partial compound support.
- **Rust bindings**: None. Requires FFI or subprocess.
- **Quality**: Academic, most comprehensive algorithm coverage of any library.

### igraph

- **Docs**: igraph.org/c/doc/igraph-Layout.html
- **Language**: C library with R/Python bindings
- **Algorithms**: Fruchterman-Reingold, DrL (Distributed Recursive Layout for large graphs), Kamada-Kawai, Sugiyama, spring models, circle, star, grid, tree
- **Compound**: No.
- **Rust bindings**: None published. C API is clean enough for FFI.
- **Best for**: Algorithmic variety, well-tested, large graph support via DrL.

### Boost Graph Library (BGL)

- **Docs**: boost.org/doc/libs/graph
- **Language**: C++ header-only
- **Algorithms**: Fruchterman-Reingold, Kamada-Kawai, Gursoy-Atun
- **Force strategies**: `all_force_pairs` (O(n^2)), `grid_force_pairs` (spatial grid for larger graphs)
- **Compound**: No.
- **Note**: Part of Boost, so it's always available in C++ projects. Minimal but correct.

### Tulip

- **Repo**: github.com/Tulip-Dev/tulip
- **Language**: C++
- **Algorithms**: GEM, LGL, GRIP, FM^3 (force-directed variants). Bridge to OGDF included.
- **Extensible**: C++ plugin system for custom layouts.
- **Compound**: No native support.

### drag (header-only)

- **Repo**: github.com/bigno78/drag
- **Language**: C++ header-only
- **What**: Directed graph layout. Outputs vertex positions + edge routing points.
- **Best for**: Simple backend computation, no rendering dependency.

---

## Go

### gonum/graph/layout

- **Pkg**: gonum.org/v1/gonum/graph/layout
- **Algorithm**: EadesR2 (force-directed with Barnes-Hut approximation)
- **Config**: Repulsion, Rate, Updates, Theta parameters
- **Best for**: Large graphs with efficient repulsion.

### go-graph-layout (gverger)

- **Repo**: github.com/gverger/go-graph-layout
- **Algorithms**: Gravity force, spring force, Sugiyama, magnetic force, metro-style edges, ports, spline edges, collision avoidance
- **Layering**: Brandes-Kopf, Graphviz dot algorithms
- **Most comprehensive Go option.**

### go-graph-layout (nikolaydubina)

- **Repo**: github.com/nikolaydubina/go-graph-layout | **Stars**: ~96 | **Active**: Mar 2025
- **Algorithms**: Sugiyama with Median Heuristic/Barycenter, Eades, Isomap, gravity/spring

---

## Zig

### zigraph

- **Community**: ziggit.dev (Jan 2026 discussion)
- **Origin**: Started as ascii-dag port, evolved independently
- **Algorithms**: Sugiyama with Median Heuristic, Barycenter, Brandes-Kopf positioning
- **Output**: Internal IR, terminal, SVG, JSON
- **Design**: BYOA (Bring Your Own Algorithm) -- modular components

### zig-graph (mitchellh)

- **Repo**: github.com/mitchellh/zig-graph | **Stars**: ~119
- **What**: Graph data structure (DFS, cycle detection, SCC). No layout.

---

## Animation / Tweening / Spring Physics (Rust)

### keyframe

- **Repo**: github.com/HannesMann/keyframe | **Stars**: ~139
- Easing functions, Bezier curves (CSS cubic-bezier compatible), keyframe sequences
- Pure math. mint vector integration for 2D/3D/4D.
- Best for: Transitions between layout states.

### spanda

- Spring physics with damped harmonic oscillators
- Presets: stiff, bouncy, wobbly
- Multi-dimensional springs (2D, 3D, 4D vectors)
- Zero dependencies, no_std

### charmed-harmonica

- Physics-based animation: spring oscillator, projectile motion

### rapier (2D/3D)

- Full rigid body physics engine. Overkill for layout animation but available.
- rapier.rs

---

## The Compound Layout Gap

**No production-ready compound/nested graph layout exists in any systems language.**

Compound layout = nodes contain sub-graphs. A "repo" node contains "file" nodes. Children stay inside parents, parent size adapts, edges cross containment boundaries.

### What exists

- **OGDF ClusterGraph**: Partial. Edges can't attach to cluster boundaries.
- **Graphviz dot clusters**: Visual grouping only, not true compound layout with containment forces.

### Workaround: two-level layout

1. Run force-directed per container (position files within a repo group)
2. Run force-directed on the containers (position repo groups relative to each other)
3. Animate transitions between states with spring physics

### What would need to be built

A Rust implementation of one of:
- **CoSE** (Compound Spring Embedder) -- modified force-directed with intra-cluster forces keeping children inside parents, inter-cluster forces positioning parents. Paper is public (Dogrusoz et al., 2009).
- **ELK's layered compound** algorithm -- Sugiyama extended with containment. Papers from Kiel University.
- **fCoSE** -- Fast CoSE. 2x faster variant. Paper: Bahadir et al.

The core modification to standard force-directed: add a containment force that pushes children toward parent center + a boundary force that prevents children from escaping parent bounds. Parent size = bounding box of children + padding.

---

## Incremental Layout

No true incremental layout engine exists in any language. All approaches:

1. **Hot-start**: Full re-layout initialized from previous positions. Converges fast if few nodes changed.
2. **Continuous simulation**: Force sim runs perpetually, adding/removing nodes perturbs it.
3. **Partial subgraph re-layout**: Re-layout only the changed region, stitch back. No library does this.

For blast-radius-scoped graphs (tens to low hundreds of nodes), hot-start is fast enough. The bottleneck is the data query, not layout computation.
