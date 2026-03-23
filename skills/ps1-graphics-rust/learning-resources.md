# PS1/Retro 3D Graphics -- Learning Resources

## Recommended Learning Path

1. **Copetti's PS1 Architecture** -- hardware mental model first
2. **David Colson's PS1 renderer post** + **Pikuma's PS1 artifacts article** -- what makes PS1 distinct
3. **ssloy's Tiny Renderer** or **Gambetta's Computer Graphics from Scratch** -- build a software rasterizer
4. **psx-spx** -- hardware-level detail as needed
5. **Learn Wgpu** -- GPU-accelerated rendering in Rust
6. **Fabien Sanglard's Game Engine Black Books** -- historical engine analysis

---

## PS1 Hardware Documentation

### psx-spx (nocash PSX Specifications)
- https://psx-spx.consoledev.net/
- Original: https://problemkaputt.de/psx-spx.htm
- Complete PS1 hardware docs: GPU, GTE, MDEC, SPU, memory map, I/O, DMA, CD subsystem. Register-level detail.
- **The** single most important PS1 technical reference. What emulator authors and homebrew devs actually use.
- Actively maintained community edition.

### Rodrigo Copetti - Architecture of Consoles: PlayStation
- https://www.copetti.org/writings/consoles/playstation/
- PS2: https://www.copetti.org/writings/consoles/playstation-2/
- High-level architectural walkthrough. CPU, GPU pipeline, GTE, rendering model. Diagram-heavy.
- Best "first read" before diving into psx-spx. The whole console series (NES through PS3) is a masterclass.

### Psy-Q SDK Hardware Reference (PDF)
- https://psx.arthus.net/sdk/Psy-Q/DOCS/Devrefs/Hardware.pdf
- Original Sony developer documentation. GPU command formats, VRAM layout, drawing primitives, display modes.
- Primary source. Dense but authoritative.

---

## Software Renderers from Scratch

### Tiny Renderer (ssloy/tinyrenderer)
- https://github.com/ssloy/tinyrenderer/wiki
- ~500 lines of C++, no dependencies. Line drawing, triangle rasterization, z-buffer, texture mapping, Gouraud/Phong shading, normal mapping, shadow mapping.
- Most widely recommended "build a renderer from scratch" tutorial. 10-20 hours to a working renderer.

### Scratchapixel
- https://www.scratchapixel.com/
- Comprehensive coverage: ray tracing, rasterization, geometry, transformations, cameras, shading, global illumination.
- Functions as a free online textbook. Structured from fundamentals upward.

### Computer Graphics from Scratch (Gabriel Gambetta)
- Free: https://gabrielgambetta.com/computer-graphics-from-scratch/
- Book: https://nostarch.com/computer-graphics-scratch (No Starch Press, 2021)
- Two complete renderers: raytracer and rasterizer. Perspective projection, clipping, hidden surface removal, shading, textures. High-school math level.
- Best "first book" for someone who has never written a renderer.

### Lisyarus - Implementing a Tiny CPU Rasterizer
- https://lisyarus.github.io/blog/posts/implementing-a-tiny-cpu-rasterizer-part-1.html
- Multi-part blog series. Screen clearing, line drawing, triangle filling, depth buffering, perspective correction.
- More recent than tinyrenderer (2023-2024). Good complement.

---

## PS1-Style Rendering Specifically

### David Colson - Building a PS1 Style Retro 3D Renderer
- https://www.david-colson.com/2021/11/30/ps1-style-renderer.html
- Source (Polybox): https://github.com/DavidColson/Polybox
- Affine texture mapping, vertex snapping, limited color depth, no perspective correction, draw-order issues.
- Single best technical post on replicating PS1 artifacts intentionally.

### Pikuma - How PlayStation Graphics & Visual Artefacts Work
- https://pikuma.com/blog/how-to-make-ps1-graphics
- Affine mapping, vertex wobble, sub-pixel precision, color banding, VRAM limits, GTE fixed-point math.
- Explains the "why" behind each artifact from a hardware perspective.

---

## Courses (Paid)

### Pikuma - PlayStation Programming with MIPS Assembly and C
- https://pikuma.com/courses/ps1-programming-mips-assembly-language
- Actual PS1 homebrew: MIPS assembly, C with PSn00bSDK, GTE programming, GPU command lists.
- Only structured course dedicated to PS1 programming. Deep hardware focus.

### Pikuma - Learn 3D Computer Graphics Programming from Scratch
- https://pikuma.com/courses/learn-3d-computer-graphics-programming
- Complete software rasterizer in C. 45 hours, 33 chapters. Projection, clipping, z-buffer, Gouraud/textured rendering.
- Most thorough video-based course for building a software renderer.

---

## Graphics Programming Blogs

### Fabien Sanglard (fabiensanglard.net)
- https://fabiensanglard.net/
- Books (free PDFs): Game Engine Black Book: Wolfenstein 3D, Game Engine Black Book: DOOM
- Deep technical dissections of Doom, Quake, Wolf3D, Another World. Hardware architecture analysis.
- Gold standard for retro engine analysis.

### Xplain - Basic 2D Rasterization
- https://magcius.github.io/xplain/article/rast1.html
- Interactive browser demos: graphics buffers, sampling theory, color blending, anti-aliasing, compositing.
- The 2D foundation that 3D rasterization builds on.

---

## wgpu / Modern GPU in Rust

### Learn Wgpu (Ben Hansen)
- https://sotrh.github.io/learn-wgpu/
- Device setup, render pipelines, WGSL shaders, textures, uniforms, depth buffering, instancing, lighting.
- Officially recommended starting point from the wgpu project. Actively maintained.

### wgpu-step-by-step (Jack1232)
- https://github.com/jack1232/wgpu-step-by-step
- Progressive examples with companion YouTube videos. Primitives, 3D transforms, lighting, colormaps.

### Learning Modern 3D Graphics Programming (Jason L. McKesson)
- https://paroj.github.io/gltut/
- OpenGL-based but teaches pipeline concepts, not just API calls. Free online.

---

## YouTube

### javidx9 (OneLoneCoder)
- https://www.youtube.com/javidx9
- https://github.com/OneLoneCoder/Javidx9
- "Code It Yourself" series: 3D engine from scratch in C++. Also NES emulator, raycasting.
- Explains every line. Console-based rendering strips away API complexity.

### thebennybox (BennyQBD)
- https://github.com/BennyQBD/3DSoftwareRenderer
- Complete 3D software renderer series in Java. Pixel-level operations up to textured rendering with perspective correction.
- Older (2014-2016) but timeless. Pipeline concepts haven't changed.

### jdh
- https://www.youtube.com/@jdh
- Game engines, raycasters, Minecraft clones, voxel renderers from scratch in C.
- High production quality, dense, minimal padding.

---

## PS1 Homebrew Tools

### PSn00bSDK
- https://github.com/Lameguy64/PSn00bSDK
- Open source PS1 SDK: C/C++ toolchain, GPU/GTE/SPU/CD libraries, CMake build.
- Most capable open-source PS1 SDK for writing actual PS1 programs.

### ps1-links (consoledev.net)
- https://ps1.consoledev.net/
- Curated index of PS1 dev resources: SDKs, emulators, source, docs, tools.
- Meta-resource linking to everything else.
