<!--
report: llm-learning-tools
saved: 2026-06-07
seed: are there more tools like devenjarvis/lathe
note: plain research dump, not a skill (no frontmatter so it won't auto-register)
-->

# LLM Learning Tools — "teach me / let me do it" landscape

Trigger: looking at [devenjarvis/lathe](https://github.com/devenjarvis/lathe) and asking what else lives in that niche.

## What Lathe is (the reference point)

LLM-powered tutorial generator. Go (74%) + HTML/CSS frontend.

- Invoke `/lathe build X` as a skill in Claude Code / Cursor / Codex → generates a hands-on, multi-part technical tutorial.
- Purpose-built **local reading UI**: table of contents, side-notes, exercises.
- Tutorials stored in `~/.lathe/tutorials/` (search / filter / tag).
- Multi-part series support (extend with more chapters).
- Optional **verification**: tests each tutorial step in isolated temp dirs.
- Custom **voices** (plainspoken / companion) to control tone.
- **Provenance**: each tutorial records sources, model, generation voice.
- Thesis: "an experiment in using LLMs to **teach you, rather than think for you**." You write the code; it scaffolds.

## The distinctive combo

No tool found matches Lathe on every axis at once. The unique stack is:

```
(skill-invoked generation) + (local reading UI) + (step verification in temp dirs) + (provenance/voice)
```

Scoring axes used below:
- **G** = LLM-generates the content (vs pre-written)
- **L** = local-first / self-hosted
- **D** = you do the coding (scaffolds; won't autocomplete the answer)
- **UI** = dedicated reading/working UI
- **A** = invoked as a coding-agent skill

## Closest analogues

| Tool | G | L | D | UI | A | What it is / how it differs |
|---|:-:|:-:|:-:|:-:|:-:|---|
| [OpenTutor](https://github.com/zijinz456/OpenTutor) | ✓ | ✓ | ~ | ✓ | – | **Nearest overall.** Local block-based learning workspace, 10+ LLM providers. Upload material → AI notes/quizzes/flashcards + adaptive tutor. General-purpose, not code-first. |
| [PocketFlow Codebase-Knowledge Builder](https://medium.com/@zh2408/ai-codebase-knowledge-builder-full-dev-tutorial-3212bdf365a7) | ✓ | ✓ | – | – | – | **Nearest "tutorial from real code."** Turns any GitHub repo into a generated beginner tutorial. Explains; doesn't make you build. Repo: `The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge` (confirm name). |
| [CodeWithJV/ai-tutor](https://github.com/CodeWithJV/ai-tutor) | ✓ | ✓ | ~ | – | – | Prompt pack turning an LLM into a tutor for "anything." No UI, no step verification. |
| [Open-TutorAI CE](https://github.com/Open-TutorAi/open-tutor-ai-CE) | ✓ | ✓ | – | ✓ | – | Self-hosted educational AI platform. Heavier / server-oriented, classroom framing. |
| [opencode.school](https://github.com/opencodeschool/opencode.school) | – | ✓ | ✓ | ✓ | – | Self-paced learn-by-doing course for the OpenCode agent. Pre-written, not generated (opposite of Lathe on G). |
| [Skill Seekers](https://github.com/topics/llm-skill) | ✓ | ✓ | – | – | ✓ | Converts a docs site into a Claude skill. Adjacent: generates artifacts *for the agent*, not tutorials for you. |

## Philosophy match (scaffold-not-solve) — research / prompt, not a local tool

| Source | Note |
|---|---|
| [SocraticAI (arXiv 2512.03501)](https://arxiv.org/abs/2512.03501) | Constrains the LLM to scaffold CS learning: daily query limits, must state your reasoning + attempt before it responds, reflect after. The "teach, don't think for you" thesis formalized. Reported: students move from vague help-seeking to problem decomposition in 2-3 weeks. |
| [Tutorly (arXiv 2405.12946)](https://arxiv.org/pdf/2405.12946) | Turns programming videos into apprenticeship learning environments inside JupyterLab. |
| [ai-tutor topic](https://github.com/topics/ai-tutor) | LeetCode/DSA mentors: progressive hints + pattern recognition instead of pasting solutions. |

## Adjacent but not it

- [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) — chapters s01-s20 teaching how to build an agent harness. Pre-written course.
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills), [glebis/claude-skills](https://github.com/glebis/claude-skills), [Prat011/awesome-llm-skills](https://github.com/Prat011/awesome-llm-skills) — skill libraries, not learning tools.
- [GitLoop](https://www.gitloop.com/) — codebase Q&A/review, not learning.
- [Brilliant.org] — interactive learn-by-doing, phone-first, but not AI-generated (pre-authored).

## Gap / build idea

The empty cell is a Lathe-style tool that is **code-first AND makes you do the work AND runs as an agent skill AND has a local UI**. Lathe is the only one near all four. A "generate katas/exercises from *my own* codebase, verify my attempt in a temp dir" variant doesn't appear to exist yet (search: "no specialized tool ... generate personalized katas from a codebase yet").

## The half-remembered app: likely Sizzle AI

Identified as **Sizzle AI** ([web.szl.ai](https://web.szl.ai/)). Free AI tutor for Math / Physics / Chemistry / Biology. Type or photo-upload a problem → interactive **step-by-step walkthrough** with hints (you participate; it doesn't just dump the answer). Founded by ex-Meta/Google people, HN-popular 2023, phone app. This is the "learn and do" feel being chased.

## Open-source Sizzle alternatives

Match axes: **self-host**, **mobile**, and what each is closest to mechanically.

| Repo | Self-host | Mobile | Closest match | Notes |
|---|:-:|:-:|---|---|
| [CAHLR/OATutor](https://github.com/CAHLR/OATutor) | ✓ | ✓ web | **step-by-step hints on math** | Real Intelligent Tutoring System w/ Bayesian Knowledge Tracing, scaffolded hints per problem. React + Firebase. Mechanically nearest to Sizzle's hint-ladder. |
| [plastic-labs/tutor-gpt](https://github.com/plastic-labs/tutor-gpt) | ✓ | ✓ web | **Socratic dialogue** | Most-known OSS AI tutor. Theory-of-Mind reasoning to adapt to the learner. General subjects, chat-style. |
| [Open-TutorAi/open-tutor-ai-CE](https://github.com/Open-TutorAi/open-tutor-ai-CE) | ✓ | ✓ **PWA** | **phone-app feel** | Installable PWA, multi-agent step problem solving, teach-back eval, 12 languages. Closest to "used it on my phone." |
| [zijinz456/OpenTutor](https://github.com/zijinz456/OpenTutor) | ✓ local | ~ | **fully local/private** | Upload material → notes/quizzes/flashcards + adaptive tutor in ~30s, 10+ LLM providers. |
| [Llama Tutor](https://llamatutor.together.ai/) | ✓ | ✓ web | **tutor on any topic** | Nutlope project. Topic + education level → personalized lesson. Simple, hackable. |
| [098765d/AI_Tutor](https://github.com/098765d/AI_Tutor) | ✓ | – | course tutoring | LLM + RAG over course material. |
| [BlackyDrum/ai-tutor](https://github.com/BlackyDrum/ai-tutor) | ✓ | – | general | Smaller student-tutor app. |

Pick by what you want: **OATutor** = Sizzle's hint-ladder mechanics; **open-tutor-ai-CE** = phone-app feel (PWA); **OpenTutor** = fully local/private.

Research / not-a-tool: [SocratiQ](https://arxiv.org/html/2409.05511v1) (fine-tuned Llama2 Socratic tutor), [SocraticAI (2512.03501)](https://arxiv.org/abs/2512.03501).

## AI-native notebooks + interactive-docs (indie / personal)

Different niche from the tutors above: "almost-Jupyter notebook where AI is a thing, interactive sessions with docs." Weighted toward solo/indie attempts over polished products.

### Indie builders + blogs (personal experiments)

| Person | Where | What they build |
|---|---|---|
| Linus Lee (thesephist) | [thesephist.com](https://thesephist.com/) | 100+ side projects; AI interfaces beyond the prompt box (pinch/drag/zoom for models), interactive AI canvases, personal knowledge tools. Canonical indie AI-UX builder. |
| Geoffrey Litt | [geoffreylitt.com](https://www.geoffreylitt.com/) | Potluck (text notes → live interactive tools), ["Dynamic documents: LLMs + end-user programming"](https://www.geoffreylitt.com/2022/11/23/dynamic-documents), malleable/personal software. |
| Amelia Wattenberger | [wattenberger.com](https://wattenberger.com/) · [observable](https://observablehq.com/@wattenberger2) · [gh](https://github.com/wattenberger) | Code Atlas, Copilot for Docs, "painting code with AI" — interactive AI document UIs, many as live notebooks. |
| Tony Hirst | [ouseful.info post](https://blog.ouseful.info/2023/11/28/simple-jupyter-notebook-ipython-ai-magics-for-chatting-to-local-llms/) | Literal DIY: `%%llm` IPython magic to chat local LLMs inside plain Jupyter. Personal-blog weekend hack. |
| Steve Krouse | [val.town](https://www.val.town/) | Val Town — social runtime/notebook for JS with AI agent (Townie). Future-of-coding scene. |
| Ink & Switch | [inkandswitch.com](https://www.inkandswitch.com/) | Research lab (not solo) — Patchwork, malleable software, AI-in-documents. Intellectual home of the genre. |

(Also worth a look: Maggie Appleton — [maggieappleton.com](https://maggieappleton.com/) — "language model sketchbook" / tools-for-thought essays.)

### Open-source AI-native notebooks (closest to "Jupyter but AI")

| Repo | Lang | What |
|---|---|---|
| [marimo-team/marimo](https://github.com/marimo-team/marimo) | Python | Reactive notebook, stored as pure `.py`, AI-native: LLM sees *live runtime variables*, not just static code; SQL cells; `marimo pair` with Claude Code. Strongest match. |
| [srcbookdev/srcbook](https://github.com/srcbookdev/srcbook) | TS/JS | Local notebook + AI app builder, exports to `.src.md`. BYO API key (Claude recommended). Apache-2. |
| [jupyterlab/jupyter-ai](https://github.com/jupyterlab/jupyter-ai) | Python | Official: AI agents in JupyterLab — read/write files, run cells, built-in Jupyter MCP server. |

### Open-source "interactive sessions with docs" (NotebookLM-style)

| Repo | Note |
|---|---|
| [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) | Fullest OSS NotebookLM: context-aware chat over sources, citations, REST API, local DB. |
| [MrSibe/KnowNote](https://github.com/MrSibe/KnowNote) | Most indie: lightweight desktop app, no Docker/cloud, offline, bring your own local LLM. |
| [SurfSense](https://github.com/Decentralised-AI/SurfSense-Open-Source-Alternative-to-NotebookLM) | NotebookLM/Perplexity/Glean alt; connects Slack, Notion, YouTube, GitHub; Ollama local. (canonical: MODSetter/SurfSense) |
| [theaiautomators/insights-lm-public](https://github.com/theaiautomators/insights-lm-public) | Chat + audio summaries, Supabase + n8n + React. |

Read-one-end-to-end order: Tony Hirst's `%%llm` post (smallest, pure DIY) → marimo (serious AI-native notebook) → Linus Lee's work (interface-research angle).

## Notebooks vs dashboards

Not the same thing. A notebook is an **authoring** medium; a dashboard is a **publishing** medium. The overlap: you can render the first as the second.

| axis | notebook | dashboard |
|---|---|---|
| primary user | author / analyst | viewer / stakeholder |
| code | visible, editable | hidden |
| execution | live kernel / REPL, run cells, stateful session | inputs → outputs, viewer can't run arbitrary code |
| layout | linear narrative (cell sequence) | spatial grid (panels) |
| interaction | edit anything | bounded controls (filters, dropdowns) |
| artifact | the *process* (exploration + prose) | the *result* (monitoring view) |
| lifecycle | exploratory, often ephemeral | persistent, refreshed |
| classic failure | hidden state / out-of-order execution | stale data / wrong filter |

Lineage:

```
REPL  →  notebook  →  reactive notebook  →  app / dashboard
        (REPL +      (dataflow DAG,        (code hidden +
         narrative +  no hidden order:      inputs pinned +
         outputs)     marimo/Observable)    grid layout)
```

What converts a notebook *into* a dashboard is one operation: **hide the code, pin the inputs, lay out the outputs.** Voilà, Streamlit, `marimo run`, Observable, Jupyter Dashboards all just do that step.

Why the line is blurring: **reactive** notebooks (marimo, Observable, Pluto.jl) are already a dependency DAG — inputs drive dependent cells automatically, which is the exact execution model a dashboard needs. marimo makes it literal: one `.py` runs as a notebook in *edit mode* and as a deployed app/dashboard in *run mode*.

Where they stay distinct:
- notebook optimizes for **the author exploring** — max mutability, code-forward, classic Jupyter carries hidden mutable kernel state (run cells out of order).
- dashboard optimizes for **the viewer consuming** — zero mutability beyond controls, code hidden, trades exploration for reliability.

A dashboard is one *export target* of a notebook, not its identity. The thing a notebook is that a dashboard isn't: a re-runnable record of *how* the result was reached.

## Convergence: the empty cell is already being built (anim × sprefa/dl)

The whole report above was reconnaissance for a thing already under construction across two local repos. Specialized to **code intelligence**, not generic docs.

```
   AUTHORING (notebook)                 PUBLISHING (dashboard/deck)
   ┌──────────────────────────────────────────────────────────┐
   │  ~/projects/anim — markdown → animated explainer           │
   │  AGENTS.md = grammar an AI authors against (the "skill")   │
   │  npm run check = verify · code: from real files = sources  │
   │  panels: code-tween · d2 graph · fs-FLIP · ATLAS (live)    │
   └──────────────▲──────────────────────────┬─────────────────┘
       sql-graph / atlas read SQLite          │ frames = stepped,
       {nodes,links} JSON                      │ code-hidden deck
   ┌──────────────┴──────────────────────────▼─────────────────┐
   │  ~/projects/sprefa/v5 (dl) — REACTIVE KERNEL               │
   │  datalog over code → SQLite fixpoint                       │
   │  --watch (tick) · --query-json · --lsp · ref byte-span     │
   │  = marimo's "LLM sees live variables", vars = repo facts   │
   │    across (repo, path, rev)                                │
   └────────────────────────────────────────────────────────────┘
```

Seam is physical, not hypothetical:
- `anim` `sql-graph`/`atlas` panels read SQLite directly; `dl --db / --query-json` writes exactly that shape.
- `anim/examples/dl-engine/` is a 6-chapter deck *explaining dl*, shipping `data/callgraph.sqlite` + a `06-this-session.md` arc frame (`dl` = "the gravity well everything orbits").
- `sprefa/v5/plans/2026-06-06-graph-viz-atlas.md` — build plan for that layer; same word "atlas" as `anim/src/AtlasPanel.jsx`; its T2 export shape `{nodes:[{id,deg,…}], links:[…]}` is what the atlas panel eats. Wiring is mid-build (T1–T6 unchecked).

Maps onto the report's own axes:

| axis | generic tool | the two repos |
|---|---|---|
| G — AI generates | Lathe | `anim/AGENTS.md` grammar → AI authors decks |
| L — local | marimo | Rust bin + SQLite + Vite |
| reactive DAG | marimo edit/run | `dl --watch` tick |
| UI — dedicated | OpenTutor | anim React app + live cytoscape atlas |
| verify | Lathe temp-dir tests | `npm run check` + `dl --check`/`--lsp` |
| provenance | Lathe sources | `code:` real files + dl `ref(id,file,lo,hi)` |
| notebook→dashboard | `marimo run` | anim build: md → frames.json (hide code, lay out, step) |

Beats the field on code specifically:
- vs **PocketFlow** codebase-explainer: it emits a static tutorial; this is reactive, queryable, rev/time-aware, animated.
- vs **NotebookLM** docs-chat: RAG guesses; `dl` returns located facts from source — no compiler, no hallucination.
- vs **Lathe**: Lathe has skill+UI+verify but no ground-truth engine; `dl` is exactly that engine.

Status (2026-06-07): **observation only, not a roadmap.** No wiring. Let `anim` and
`sprefa/dl` evolve independently — the `sql-graph` seam exists if/when it's wanted, but
forcing convergence now would kill the vibe driving anim. Noted, parked.

## TODO / to investigate

- [x] Half-remembered app → likely **Sizzle AI** (see above).
- [ ] Pull full READMEs on OpenTutor + PocketFlow builder for a deeper feature diff vs Lathe.
