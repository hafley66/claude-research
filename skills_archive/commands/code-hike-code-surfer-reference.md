# Code Hike and Code Surfer Capability Reference

Research date: 2026-05-18  
Scope: Code Hike, Code Surfer, official docs, package metadata, source code, changelogs, GitHub issues, GitHub Discussions, and external tutorials or usage examples.

## Executive Map

Code Hike and Code Surfer come from the same author, Rodrigo Pombo, and occupy adjacent eras of animated code presentation.

| Project | Current role | Main package | Latest observed version | Primary medium | Status signal |
| --- | --- | --- | --- | --- | --- |
| Code Hike | React/MDX toolkit for rich technical content, docs, code walkthroughs, code videos, and structured Markdown | `codehike` | `1.1.0`, released 2026-03-17 | MDX plus React components | Active |
| Code Surfer | Animated code slides for MDX Deck | `code-surfer` | `3.1.1` in source package metadata | MDX Deck slides | Older, maintenance-light |

Short distinction:

- Code Surfer is the earlier slide tool. It gives MDX Deck code highlighting, zooming, scrolling, focus, morphing, columns, file import, themes, and diffs.
- Code Hike is the newer content toolkit. It turns Markdown and code into structured React data and headless components, so users can build scrollycoding, slideshow, spotlight, docs codeblocks, code videos, API references, and custom annotation UIs.

In a 2021 Code Surfer issue, the maintainer wrote that he had been focusing on Code Hike, which may replace Code Surfer at some point, and was open to adding Code Surfer maintainers.

## Repositories

| Repo | URL | Description | Default branch | Stars | Forks | Created | Updated | License |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| `code-hike/codehike` | https://github.com/code-hike/codehike | Build rich content websites with Markdown and React | `next` | 5356 | 166 | 2020-04-23 | 2026-05-18 | MIT |
| `pomber/code-surfer` | https://github.com/pomber/code-surfer | Rad code slides | `master` | 6373 | 174 | 2018-08-19 | 2026-05-11 | MIT |

## Which One To Reach For

| Need | Code Hike | Code Surfer |
| --- | --- | --- |
| Documentation site codeblocks | Strong fit | Poor fit unless docs are slides |
| Scrollytelling code walkthrough | Strong fit | No native page scrollytelling model |
| Slide deck with animated code | Possible through custom slideshow layout | Native purpose |
| MDX Deck compatibility | No | Native, tied to MDX Deck 3 peer dependency |
| MDX Deck 4 | No direct claim | Open issues show breakage |
| React Server Components | Recommended, supported by docs | Built for React 16 era |
| Headless codeblock UI | Native v1 design | Not headless in the same sense |
| Custom per-token React annotation components | Native | Limited to focus/step parser model |
| Code videos with Remotion | Official blog and example path | Possible by screen recording/rendering slides, not first-class |
| Content schemas and typed Markdown structure | Native with `parseRoot`, `Block`, Zod | No |
| Direct React use without MDX | Supported for highlighting and `<Pre />` according to discussion | `@code-surfer/standalone` exists but readme says internal use |

## Code Hike Architecture

Code Hike v1 has two main ideas:

1. Fine-grained Markdown  
   Decorated Markdown elements become structured objects that can be parsed and passed to React components.

2. Headless codeblocks  
   Code Hike supplies parsing, highlighting, annotation extraction, composable render primitives, and transition utilities. The user supplies the actual UI components.

The package exports these public surfaces:

```ts
import { parse } from "codehike"

import {
  remarkCodeHike,
  recmaCodeHike,
} from "codehike/mdx"

import {
  parseRoot,
  parseProps,
  Block,
  CodeBlock,
  HighlightedCodeBlock,
  ImageBlock,
} from "codehike/blocks"

import {
  highlight,
  Pre,
  Inline,
  InnerPre,
  InnerLine,
  InnerToken,
  getPreRef,
} from "codehike/code"

import {
  SelectionProvider,
  Selectable,
  Selection,
  useSelectedIndex,
} from "codehike/utils/selection"

import {
  getStartingSnapshot,
  calculateTransitions,
} from "codehike/utils/token-transitions"
```

Package exports in `codehike@1.1.0`:

- `.`
- `./mdx`
- `./blocks`
- `./code`
- `./utils/token-transitions`
- `./utils/static-fallback`
- `./utils/selection`

Dependencies in `codehike@1.1.0`:

- `@code-hike/lighter`
- `diff`
- `estree-util-visit`
- `mdast-util-mdx-jsx`
- `unist-util-visit`

Dev stack includes MDX 3, React 18 canary metadata, TypeScript 5, Vitest, Zod, and unified.

## Code Hike MDX Pipeline

A typical manual integration uses both remark and recma:

```js
import { remarkCodeHike, recmaCodeHike } from "codehike/mdx"

const chConfig = {
  components: { code: "MyCode", inlineCode: "MyInlineCode" },
  ignoreCode: (codeblock) => codeblock.lang === "mermaid",
  syntaxHighlighting: { theme: "github-dark" },
}

const mdxOptions = {
  remarkPlugins: [[remarkCodeHike, chConfig]],
  recmaPlugins: [[recmaCodeHike, chConfig]],
}
```

`remarkCodeHike` transforms codeblocks and inline code into configured components.  
`recmaCodeHike` parses Code Hike block props after MDX compilation.

Code Hike docs recommend Next.js plus Fumadocs for documentation sites because React Server Components allow async highlighting to run outside the browser. RSC is recommended but not required. Without RSC, configure `syntaxHighlighting` to run highlighting at compile time and pass `HighlightedCode` into the code component.

## Code Hike Blocks and Grouping

Blocks are the grouping system.

Decorating a heading with `!name` makes the content under that heading become a named object:

````md
## !intro Hello

Intro content.
````

Decorating repeated sections with `!!name` makes an array:

````md
## !!steps One

First step.

## !!steps Two

Second step.
````

Decorations work on:

- Headings
- Paragraphs
- Images
- Codeblocks

Example shapes:

````md
!author Tolkien

![!cover Gandalf](/gandalf.jpg "a wizard")

```js !riddle mellon.js
speak("friend")
```
````

Becomes props in this general shape:

```ts
{
  author: "Tolkien",
  cover: {
    alt: "Gandalf",
    url: "/gandalf.jpg",
    title: "a wizard",
  },
  riddle: {
    lang: "js",
    meta: "mellon.js",
    value: "speak(\"friend\")",
  },
}
```

Schemas can validate content:

```ts
import { parseRoot, Block, ImageBlock } from "codehike/blocks"
import { z } from "zod"

const Schema = Block.extend({
  intro: Block,
  steps: z.array(Block.extend({ cover: ImageBlock })),
})

const data = parseRoot(Content, Schema)
```

This is the main mechanism behind scrollycoding, spotlight layouts, slideshows, Remotion videos, and docs clones. Markdown authors keep content in Markdown. React components receive typed objects.

## Code Hike Codeblocks

The custom codeblock path:

```tsx
import type { RawCode } from "codehike/code"

function MyCode({ codeblock }: { codeblock: RawCode }) {
  return <pre>{codeblock.value}</pre>
}
```

With highlighting:

```tsx
import { Pre, highlight, type RawCode } from "codehike/code"

export async function MyCode({ codeblock }: { codeblock: RawCode }) {
  const highlighted = await highlight(codeblock, "github-dark")
  return <Pre code={highlighted} />
}
```

Compile-time highlighting:

```tsx
import { Pre, type HighlightedCode } from "codehike/code"

function MyCode({ codeblock }: { codeblock: HighlightedCode }) {
  return <Pre code={codeblock} />
}
```

The `highlight` result and `<Pre />` are optional. Their main advantage is annotation handler support.

### Code Hike Themes

Built-in themes include:

- `dark-plus`
- `dracula-soft`
- `dracula`
- `github-dark`
- `github-dark-dimmed`
- `github-light`
- `light-plus`
- `material-darker`
- `material-default`
- `material-lighter`
- `material-ocean`
- `material-palenight`
- `min-dark`
- `min-light`
- `monokai`
- `nord`
- `one-dark-pro`
- `poimandres`
- `slack-dark`
- `slack-ochin`
- `solarized-dark`
- `solarized-light`

CSS light/dark themes:

- `github-from-css`
- `material-from-css`

The docs point to `themes.codehike.org` for theme editing and VS Code marketplace theme conversion.

### Code Hike Languages

The docs list 211 supported languages for syntax highlighting. The list includes common languages and formats such as JavaScript, TypeScript, JSX, TSX, Python, Rust, Go, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, SQL, GraphQL, Markdown, MDX, HTML, CSS, SCSS, Sass, JSON, YAML, TOML, Bash, Shell, Dockerfile, terminal, Mermaid, Svelte, Vue, Astro, Solidity, WGSL, and many more.

### Importing Code

Use `!from` inside a codeblock:

````md
```js
!from ./assets/index.js
```
````

The path is relative to the Markdown file. Version `1.0.6` made `!from` more flexible.

### Ignoring Codeblocks

Example:

```js
const chConfig = {
  components: { code: "MyCode" },
  ignoreCode: (codeblock) => codeblock.lang === "mermaid",
}
```

### Inline Code

Normal Markdown inline code remains ordinary inline code. Code Hike inline handling uses `_` syntax:

```md
This is handled by Code Hike: _`var x = 10`_

With language and meta: _py lorem ipsum`print(5)`_
```

The second example produces:

```ts
{
  lang: "py",
  meta: "lorem ipsum",
  value: "print(5)",
}
```

## Code Hike Annotations

Annotations are comments inside codeblocks that Code Hike extracts and passes to React handlers.

Language-specific comments are used:

```js
// !mark
let x = 1
```

```py
# !mark
x = 1
```

Annotation types:

| Type | Shape | Purpose |
| --- | --- | --- |
| Line annotation | `!name` near a line | Attach handler behavior to a line |
| Block range | `!name(1:5)` | Target relative line ranges |
| Inline token range | `!name[3:8]` | Target columns/tokens |
| Query text | `!name query text` | Pass extra data to handler |
| Regex range | `!name[/pattern/flags]` | Target regex matches |
| Regex group | capture groups | Target subranges |
| Start/end range | `!name(start)` and `!name(end)` | Mark multi-line ranges with paired comments |

Version `1.1.0` added `!name(start)` and `!name(end)` markers, released from issue #530 and PR #532.

Handlers can implement:

- `Line`
- `Token`
- `Pre`
- `PreWithRef`
- `AnnotatedLine`
- `AnnotatedToken`
- `Inline`
- `transform`

Composable primitives:

- `InnerLine`
- `InnerToken`
- `InnerPre`
- `getPreRef`

The docs emphasize composition because multiple handlers can target the same line or token. `InnerLine` and `InnerToken` merge props from multiple handlers.

## Code Hike Animation Model

Code Hike animation is mostly userland React plus utilities, rather than a fixed animation runtime.

Core pieces:

- `SelectionProvider`, `Selectable`, `Selection`, and `useSelectedIndex` drive which step, tab, or content segment is active.
- `getStartingSnapshot` takes a DOM snapshot of a `<pre>` before code changes.
- `calculateTransitions` calculates element-level keyframes after code changes.
- User code applies `element.animate(...)`, React state transitions, CSS transitions, Framer Motion, Remotion frame interpolation, or any other React-compatible animation layer.

Token transition sequence:

```ts
const preElement = document.querySelector("pre")
const startingSnapshot = getStartingSnapshot(preElement)

// change rendered code

const transitions = calculateTransitions(preElement, startingSnapshot)

transitions.forEach(({ element, keyframes, options }) => {
  element.animate(keyframes, options)
})
```

This supports animated code changes in:

- Side-by-side examples
- Scrollycoding
- Spotlight interactions
- Slideshows
- Remotion videos
- Diffs
- Code mutation walkthroughs

## Code Hike Layouts

### Scrollycoding

Official docs define it as a layout combining a scrollytelling effect with code blocks. It is intended for step-by-step code walkthroughs.

Typical build ingredients:

- Markdown headings become `steps`.
- A codeblock becomes a highlighted code object.
- `SelectionProvider` tracks the active step.
- Scroll, hover, or click can select a step.
- `<Selection />` renders the matching code/content side.
- `token-transitions` animates code changes.

### Spotlight

Spotlight is a feature/tab-like layout for showing a list of concepts, features, or steps alongside related code/content. It uses the same selection primitives as scrollycoding.

### Slideshow

Slideshow displays content in slides. It uses selection state and controls such as previous/next. It is the closest Code Hike v1 equivalent to the Code Surfer domain, but implemented as a userland layout instead of a fixed package API.

### Remotion Video

The Code Hike Remotion blog shows this process:

1. Use Code Hike to pass annotated Markdown content and codeblocks to components.
2. Use Code Hike and Remotion to animate annotations and transitions.
3. Use Remotion to render React components into video.

This makes Markdown the source of truth for a code video timeline. Blocks become steps. Code annotations become visual instructions. Remotion controls frames.

## Code Hike Examples and Components

Official docs and demos include:

- API Reference
- Autolink
- Callout
- ClassName
- Code Mentions
- Collapse
- Copy Button
- Diff
- File name
- Focus
- Fold
- Footnotes
- Language Switcher
- Line Numbers
- Link
- Mark
- Occurrences
- Tabs
- Token Transitions
- Tooltip
- Transpile
- Twoslash
- TypeScript
- Word Wrap
- Scrollycoding
- Slideshow
- Spotlight

Full templates:

- Next.js plus Fumadocs
- Docusaurus
- Remotion
- Nextra

Clones:

- Shopify API Reference
- SwiftUI Tutorials

Third-party or community usage found during research:

- Ionic Enterprise Tutorials has a Code Hike samples page covering basic formatting, filenames, annotations, and old `<CH.Code>`-style components.
- `xyd.dev` discussion says Code Hike is in its core docs toolset, with planned deeper integrations such as Twoslash in interactive demos.
- A community discussion links a separate `codehike-editor` project for experimenting with Code Hike content visually.
- Old v0 Code Hike had scrollycoding packages, mini-editor, mini-browser, preview presets, multiple files, mobile/print slots, and focus buttons. v1 moved toward headless React primitives.

## Code Hike Recent Releases and Changelog

| Version | Date or release signal | Change |
| --- | --- | --- |
| `1.1.0` | 2026-03-17 | Added `!name(start)` and `!name(end)` comment markers for multi-line annotation ranges |
| `1.0.7` | 2025-05-13 | Better regex parsing in annotation range |
| `1.0.6` | 2025-05-01 | Better Turbopack support and more flexible `!from` directive |
| `1.0.5` | 2025-03-05 | Parse two values separated by a Markdown break |
| `1.0.4` | 2024-10-17 | Add `color-scheme` to `highlight` result |
| `1.0.3` | 2024-10-15 | Avoid failure with `undefined` children in remark plugin |
| `1.0.2` | 2024-10-03 | Fix color measurement in token transitions |
| `1.0.1` | 2024-08-30 | Better `jsxDEV`; TypeScript `moduleResolution: node` compatibility |
| `1.0.0` | 2024-08-26 | Fine-grained Markdown and headless codeblocks |

Important v0 history:

- `0.9.0`: theme refactor, `from` annotation with line range, dimensions fix for initially hidden code.
- `0.8.3`: trigger position config, autolink option, copy button to multiline mark.
- `0.8.0`: moved to `@code-hike/lighter`.
- `0.7.4`: `rows` prop with two panels, focus height on transitions.
- `0.7.3`: slideshow autoplay, autoplay loop, `onChange`, `initialSlideIndex`, controls autofocus.
- `0.7.0`: static scrollycoding and previews in steps.
- `0.6.2`: `from` annotation, `skipLanguages`, styling props.
- `0.6.0`: multiline mark annotation.

## Code Hike Current Issues

Open issue list observed:

| Issue | Topic | Status signal |
| --- | --- | --- |
| #535 | Migrate npm release workflow to trusted publishing | Release infrastructure |
| #526 | Build-time prop validation for Code Hike | Open feedback request |
| #525 | Broken build with Next 16 | Open, users report Turbopack build failure |
| #519 | Synchronize wrapped lines across side-by-side codeblocks | Maintainer says this belongs in userland if primitives allow it |
| #518 | Dynamic code mention | Open |
| #505 | Inner content editing via raw Markdown | Open |
| #486 | Better error when annotation is out of range | Open |
| #479 | v1 playground | Open |
| #458 | `LinkBlock` similar to `ImageBlock` | Open |
| #456 | Better `parseProps` error | Open |
| #434 | Pass regex match as prop to annotations | Open |
| #432 | Usage with `mdx-bundler` | Open |
| #297 | Pass custom grammars | Open |
| #255 | Astro support | Open |
| #206 | Better support for terminal | Open |

High-signal issue details:

- #525: Next 16 build breaks after upgrade from Next 15. Error involves invalid `experimental.turbo` config and a Turbopack internal error. Comments ask whether a fix exists.
- #526: Proposal for build-time prop validation via `recma-static-refiner`, avoiding Zod validation code in the client bundle.
- #519: Side-by-side word-wrapped code alignment for literate programming and diff-like UIs. Maintainer response says Code Hike should be flexible enough for userland implementations.
- #255: Astro support remains unresolved. Comments identify blockers around Astro's MDX flavor, client directives, children converted to static HTML, and Code Hike needing React MDX.
- #530: Multi-line start/end annotation comments closed and released in `codehike@1.1.0`.

## Code Hike Discussions

GitHub Discussions observed: 49 total.

Recent/high-signal discussions:

| Discussion | Topic | Signal |
| --- | --- | --- |
| #527 | Code Hike Editor | Community editor project for experimenting with Code Hike |
| #523 | Code Hike plus xyd.dev | Docs framework usage, planned Twoslash integration |
| #498 | Direct React use without MDX | Maintainer says `highlight` and `<Pre />` should work without MDX |
| #497 | Annotation for whole code block | Annotation edge case |
| #496 | Copy button with Docusaurus | Integration question |
| #473 | Fumadocs table of contents and Code Hike headings | Integration question |
| #438 | Tooltips with only `HighlightedCode` | Maintainer says use `HighlightedCodeBlock` schema and skip calling `highlight` again |
| #413 | Code Hike v1.0 | Ideas and feedback |
| #152 | Use outside MDX for fetching code | Direct usage question |

Code Surfer GitHub Discussions observed: 0 total.

## Code Surfer Architecture

Code Surfer is built for MDX Deck slides. The readme says it adds:

- Code highlighting
- Code zooming
- Code scrolling
- Code focusing
- Code morphing
- MDX Deck slide integration

Main packages:

| Package | Purpose | Version in source |
| --- | --- | --- |
| `code-surfer` | Public MDX Deck component package | `3.1.1` |
| `@code-surfer/standalone` | Standalone renderer package, documented as internal | `3.1.1` |
| `@code-surfer/step-parser` | Parses focus, steps, diffs, and code changes, documented as internal | `3.1.1` |
| `@code-surfer/themes` | Theme package | Source package |

`code-surfer` peer dependencies:

```json
{
  "mdx-deck": "3.0.10",
  "react": "^16.8.0"
}
```

Primary runtime dependencies:

- `@code-surfer/standalone`
- `diff`
- `prismjs`
- `rebound`
- `shell-quote`
- `use-spring`

## Code Surfer Usage

Basic MDX Deck usage:

````mdx
import { CodeSurfer } from "code-surfer"

---

<CodeSurfer>

```js
console.log(1)
console.log(2)
console.log(3)
```

</CodeSurfer>
````

The readme notes that empty lines before and after the codeblock are required.

## Code Surfer Focus Syntax

Focus string comes after the language:

````md
```js 1:2,3[8:10]
console.log(1)
console.log(2)
console.log(3)
```
````

Examples:

| Syntax | Meaning |
| --- | --- |
| `5:10` | Focus lines 5 through 10 |
| `1,3:5,7` | Focus lines 1, 3 through 5, and 7 |
| `2[5]` | Focus column 5 on line 2 |
| `2[5:8]` | Focus columns 5 through 8 on line 2 |
| `1,2[1,3:5,7],3` | Focus line 1, selected columns on line 2, and line 3 |

Code Surfer fades unfocused code and zooms or scrolls to keep focused code visible.

## Code Surfer Steps

Multiple codeblocks inside one `<CodeSurfer>` create steps:

````mdx
<CodeSurfer>

```js
console.log(1)
console.log(2)
console.log(3)
```

```js 2
console.log(1)
console.log(2)
console.log(3)
```

```js
console.log(1)
console.log(2)
console.log(3)
console.log(4)
```

</CodeSurfer>
````

Each step can change:

- Focus
- Code text
- Title
- Subtitle
- Imported file
- Diff

Transitions include:

- Zooming
- Scrolling
- Fading in
- Fading out
- Adding lines
- Removing lines
- Morphing between code versions

## Code Surfer Titles, Subtitles, and Metadata

Use metastring fields:

````md
```js 1 title="Title" subtitle="Look at the first line"
console.log(1)
console.log(2)
```
````

The parser uses shell-like metastring parsing, so quoted values matter.

## Code Surfer Themes and Styling

Themes come from `@code-surfer/themes` or custom Theme UI objects.

Theme areas include:

- `styles.CodeSurfer.pre`
- `styles.CodeSurfer.code`
- `styles.CodeSurfer.tokens`
- `styles.CodeSurfer.title`
- `styles.CodeSurfer.subtitle`
- `styles.CodeSurfer.unfocused`

The readme states that only the opacity of unfocused code can be changed through the `unfocused` style.

## Code Surfer Languages

Code Surfer uses Prism. Common languages are included by default. Other Prism languages can be imported manually:

```mdx
import "prismjs/components/prism-smalltalk"
```

## Code Surfer Columns

Use `CodeSurferColumns` and `Step`:

````mdx
import { CodeSurferColumns, Step } from "code-surfer"

<CodeSurferColumns sizes={[1, 3]}>

<Step subtitle="First Step">

```js
console.log(1)
```

```js
console.log("a")
```

</Step>

</CodeSurferColumns>
````

Columns can:

- Render multiple code panels at once.
- Use per-column themes with `themes`.
- Use relative widths with `sizes`.
- Mix code with Markdown or custom React components.

## Code Surfer Import Code

````mdx
<CodeSurfer>

```js 5:10 file=./my-code.js
```

</CodeSurfer>
````

Open issue #111 shows `file=...` import failing with `mdx-deck@4`; comments point back to the peer dependency on `mdx-deck@3.0.10`.

## Code Surfer Diffs

Codeblocks can use `diff` language:

````mdx
<CodeSurfer>

```js
console.log(1)
console.log(2)
console.log(3)
```

```diff 1 subtitle="log 1"

```

</CodeSurfer>
````

Empty diffs can represent unchanged code while moving focus and subtitles. Internally, the step parser applies patches and calculates stable line identities.

## Code Surfer Current Issues

Open issue list observed:

| Issue | Topic | Status signal |
| --- | --- | --- |
| #120 | Focus lines without shifting code block | Open, 2024 |
| #118 | New maintainers | Maintainer says focus moved to Code Hike |
| #117 | Set visual line-height on `pre` or `code` | Open |
| #116 | `code-surfer-types` missing | Open |
| #112 | Firefox slide switching unreliable | Open |
| #111 | File import fails with MDX Deck 4 | Open |
| #110 | Web component | Open |
| #99 | Per-step zoom level | Open |
| #98 | `prism-diff` highlighting | Open |
| #97 | Equal font size in columns | Open |
| #96 | Negative line indices | Open |
| #95 | Markup in title/subtitle | Open |
| #94 | Disable scroll animation | Open |
| #92 | Configurable line animations | Open |
| #90 | Usage in Next.js without MDX Deck | Open |
| #88 | Animations that update a line | Open |
| #84 | Markdown lists in steps | Open |
| #83 | MDX Deck 4 unexpected token | Open |
| #81 | Update line numbers earlier in transition | Open |
| #79 | Choosing output path for build | Open |
| #74 | iOS 13 WebKit perspective issue | Open |
| #73 | Other presentation tools | Open |
| #55 | Print-friendly output | Open |

High-signal issue details:

- #118: Maintainer says Code Hike may replace Code Surfer and asks for new maintainers if someone wants to take care of the project.
- #120: User wants focus without layout shift. Current workaround adds empty lines and disables format-on-save.
- #111: `file=./file.js` shows blank screen under MDX Deck 4. Comment notes `code-surfer` peer dependency is MDX Deck 3.
- #92: Request for configurable line animations, including fade-in, movement directions, and type-like animation.

## Code Surfer External Tutorials and Usage

Official readme examples:

- Formidable's GraphQL Workshop by Phil Pluckthun.
- React Conf 2018 Hooks Demo.

External tutorials and references found:

- Egghead lesson by Elijah Manor: uses Code Surfer to scroll, zoom, highlight, focus lines, focus tokens, load snippets from disk, show notes/title, and auto-scroll large code snippets.
- Mario Yepes MDX Deck developer presentations article: covers Code Surfer install, themes, code parameters, line focus, diffs, and columns.
- CodeSandbox package examples for `mdx-deck-code-surfer`: examples include hooks presentations, state machine decks, GraphQL talk material, TypeScript talks, and React Native EU talk references.
- Daily.dev mirrors the Code Surfer page and summarizes the same feature set.

## Cool Usage Patterns

### Code Hike

| Pattern | Mechanism |
| --- | --- |
| Stripe/Shopify-style API reference | Blocks for structured sections, custom codeblocks, tabs, annotations, copy buttons |
| SwiftUI tutorial clone | Blocks for lessons/steps/images/code, custom React layout |
| Scrollycoding article | `!!steps`, sticky code panel, scroll selection, token transitions |
| Spotlight feature explorer | Selection primitives plus blocks for feature text and code |
| Animated code video | `parseRoot` steps, `HighlightedCodeBlock`, Remotion `Sequence`, token transitions |
| Interactive docs framework integration | Fumadocs, Docusaurus, Nextra, xyd.dev |
| Code editor experiment | Community `codehike-editor` discussion |
| Rich code annotations | Tooltips, callouts, links, marks, folded regions, footnotes, and regex-targeted tokens |
| Teaching code mutation | Token transition snapshots across code versions |
| Multi-format content reuse | Same Markdown content feeding docs, slides, screenshots, or videos |

### Code Surfer

| Pattern | Mechanism |
| --- | --- |
| Conference code-heavy slide deck | MDX Deck plus `<CodeSurfer>` |
| React Hooks teaching deck | Focus strings and code morphing |
| GraphQL workshop | Step-by-step animated code slides |
| Large code snippet guided tour | Zoom out, focus target, scroll into view |
| Token-level lecture | Column focus like `2[5:8]` |
| Side-by-side comparison | `CodeSurferColumns` |
| Incremental patch explanation | Empty `diff` steps and focus changes |

## Practical Limits

### Code Hike

- Astro support is unresolved because Astro MDX is not React MDX in the way Code Hike needs.
- Next 16/Turbopack has an open build issue.
- `mdx-bundler` usage has an open issue.
- Custom grammars are requested but open.
- Terminal support has an open issue.
- Better annotation range errors and `parseProps` errors are requested.
- Complex side-by-side wrapped alignment is expected to be userland.

### Code Surfer

- Package is built around MDX Deck 3 and React 16 peer dependencies.
- MDX Deck 4 issues are open.
- Maintainer focus has moved toward Code Hike.
- Several animation and layout controls are requested but open.
- No GitHub Discussions were observed.
- No releases were observed via `gh release list`.

## LLM Usage Notes

When asking an LLM to use Code Hike:

- Specify whether the target is Code Hike v1. Many online examples use older `CH.*` APIs from v0.
- Ask for `codehike`, `codehike/mdx`, `codehike/blocks`, and `codehike/code` imports.
- Ask for React component boundaries: Markdown schema, parse site, render component, annotation handlers.
- Ask whether highlighting should run in RSC, compile time, or client side.
- Ask for annotation handler composition with `InnerLine`, `InnerToken`, or `InnerPre`.
- Ask for `SelectionProvider` when implementing scrollycoding, spotlight, tabs, or slideshow behavior.
- Ask for `token-transitions` when animating code changes.
- For non-MDX direct usage, use `highlight({ value, lang, meta }, theme)` and `<Pre />`.

When asking an LLM to use Code Surfer:

- Pin expectations to MDX Deck 3 unless current compatibility is verified.
- Use focus strings for line and token selection.
- Use multiple codeblocks for steps.
- Use `diff` codeblocks for patch-based progression.
- Use `CodeSurferColumns` for side-by-side slides.
- Avoid assuming MDX Deck 4 works with file imports.

## Minimal Prompts

### Code Hike Scrollycoding

```text
Build a Code Hike v1 scrollycoding layout in React/MDX.
Use `parseRoot` with a Zod schema where Markdown has `## !!steps`.
Each step has prose and a `HighlightedCodeBlock`.
Use `SelectionProvider`, `Selectable`, and `Selection` for scroll/click selection.
Use `<Pre />` for code rendering.
Use `getStartingSnapshot` and `calculateTransitions` for animated code changes.
Keep annotation handlers composable with `InnerLine`/`InnerToken`.
```

### Code Hike Docs Codeblock System

```text
Implement a Code Hike v1 docs codeblock component.
Use `remarkCodeHike` and `recmaCodeHike` with `components.code = "Code"`.
If the environment supports RSC, call `highlight(codeblock, "github-dark")` in the async component.
If the environment does not support RSC, configure `syntaxHighlighting` and accept `HighlightedCode`.
Add annotation handlers for line numbers, copy button, filename, mark, diff, fold, callout, tooltip, and link.
Use `InnerPre`, `InnerLine`, and `InnerToken` so handlers compose.
```

### Code Hike Remotion Video

```text
Create a Code Hike plus Remotion code walkthrough.
Markdown contains `## !!steps` sections with codeblocks decorated as `!`.
Use `parseRoot` and a schema with `steps: z.array(Block.extend({ code: HighlightedCodeBlock }))`.
Render each step inside a Remotion `Sequence`.
Render code with `<Pre />`.
Use annotation handlers to animate marks/callouts by frame.
Use token transition utilities for code changes between steps.
```

### Code Surfer MDX Deck

```text
Create an MDX Deck 3 presentation using `code-surfer`.
Import `{ CodeSurfer, CodeSurferColumns, Step }` from `code-surfer`.
Use focus strings like `5:10` and `2[5:8]`.
Use multiple codeblocks inside `<CodeSurfer>` for steps.
Use `title` and `subtitle` metastrings.
Use `diff` codeblocks for incremental changes.
Use `CodeSurferColumns` for side-by-side code and prose.
Do not assume MDX Deck 4 compatibility unless verified.
```

## Source Links

Official and primary:

- Code Hike site: https://codehike.org/
- Code Hike docs: https://codehike.org/docs
- Code Hike blocks docs: https://codehike.org/docs/concepts/blocks
- Code Hike codeblocks docs: https://codehike.org/docs/concepts/code
- Code Hike annotations docs: https://codehike.org/docs/concepts/annotations
- Code Hike utils docs: https://codehike.org/docs/concepts/utils
- Code Hike scrollycoding docs: https://codehike.org/docs/layouts/scrollycoding
- Code Hike slideshow docs: https://codehike.org/docs/layouts/slideshow
- Code Hike examples docs: https://codehike.org/docs/examples
- Code Hike 1.0 blog: https://codehike.org/blog/v1
- Fine-grained Markdown blog: https://codehike.org/blog/fine-grained-markdown
- Code Hike Remotion blog: https://codehike.org/blog/remotion
- Code Hike repo: https://github.com/code-hike/codehike
- Code Surfer site: https://codesurfer.pomb.us/
- Code Surfer repo: https://github.com/pomber/code-surfer
- Code Surfer npm: https://www.npmjs.com/package/code-surfer

Issues and discussions:

- Code Hike issue #525: https://github.com/code-hike/codehike/issues/525
- Code Hike issue #526: https://github.com/code-hike/codehike/issues/526
- Code Hike issue #519: https://github.com/code-hike/codehike/issues/519
- Code Hike issue #255: https://github.com/code-hike/codehike/issues/255
- Code Hike issue #530: https://github.com/code-hike/codehike/issues/530
- Code Hike discussion #527: https://github.com/code-hike/codehike/discussions/527
- Code Hike discussion #523: https://github.com/code-hike/codehike/discussions/523
- Code Hike discussion #498: https://github.com/code-hike/codehike/discussions/498
- Code Hike discussion #438: https://github.com/code-hike/codehike/discussions/438
- Code Surfer issue #118: https://github.com/pomber/code-surfer/issues/118
- Code Surfer issue #120: https://github.com/pomber/code-surfer/issues/120
- Code Surfer issue #111: https://github.com/pomber/code-surfer/issues/111
- Code Surfer issue #92: https://github.com/pomber/code-surfer/issues/92

External:

- Ionic Code Hike samples: https://ionic.io/docs/tutorials/templates/samples
- Egghead Code Surfer lesson: https://egghead.io/lessons/react-scroll-zoom-and-highlight-code-in-a-mdx-deck-slide-presentation-with-code-surfer
- Mario Yepes MDX Deck and Code Surfer article: https://marioyepes.com/blog/mdx-deck-developer-presentations-part-2/
- CodeSandbox `mdx-deck-code-surfer` examples: https://codesandbox.io/examples/package/mdx-deck-code-surfer
- CodeSandbox `@code-hike/scrollycoding` examples: https://codesandbox.io/examples/package/%40code-hike/scrollycoding
