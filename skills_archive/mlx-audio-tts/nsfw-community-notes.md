# Community notes: expressive/NSFW local TTS technique

Scope: engineering technique only (params, tags, workflow, model IDs). No explicit sample
text reproduced. Gathered 2026-07-20. Reddit (r/SillyTavernAI, r/LocalLLaMA, r/JanitorAI,
r/Oobabooga) is unreachable to this fetcher/search — Anthropic's crawler is blocked from
reddit.com and site:reddit.com queries return zero results. Every Reddit-sourced claim
below is absent; sources are GitHub READMEs/issues/discussions, HuggingFace model
cards/discussions, official SillyTavern docs, and TTS-server project docs (devnen/*,
erew123/*, petermg/*). Labeled anecdote vs consensus per claim where the source lets me
judge; single-issue GitHub reports are anecdote by default.

## TL;DR: techniques worth trying on this stack (Kokoro / Dia / Chatterbox / Orpheus)

- **Chatterbox exaggeration/cfg_weight**: for more dramatic/expressive delivery, try
  `cfg_weight≈0.3` + `exaggeration≈0.7+` (default is 0.5/0.5). Higher exaggeration speeds
  up speech; lowering cfg_weight compensates with slower, more deliberate pacing.
  [resemble-ai/chatterbox README](https://github.com/resemble-ai/chatterbox),
  cross-confirmed in [devnen/Chatterbox-TTS-Server#100](https://github.com/devnen/Chatterbox-TTS-Server/issues/100).
  Caveat: this applies to the **classic English-only** Chatterbox checkpoint. On the
  multilingual/v2 checkpoint the exaggeration parameter is reported nearly inert even at
  1000x documented values, root-caused to `emotion_adv_fc` layer scale + RMSNorm
  normalizing the emotion embedding away — [resemble-ai/chatterbox#355](https://github.com/resemble-ai/chatterbox/issues/355).
  Turbo checkpoint: `cfg_weight`/`min_p`/`exaggeration` are **ignored outright**
  (dropped for 2x speed) — same issue thread. If mlx-audio's Chatterbox port is
  multilingual/turbo under the hood, the exaggeration dial may not do what the docs imply.
- **Dia `speed_factor` is post-hoc resampling, not a generation-time control.** Community
  ports (devnen/Dia-TTS-Server) apply it *after* synthesis; the underlying "too fast"
  complaint is instead fixed by keeping input chunks in a sane length band and lowering
  `temperature`/`cfg_scale`. See Pacing section below — this maps directly onto the "too
  fast" problem already hit on this project.
- **Dia chunking**: split long text respecting sentence boundaries and `[S1]`/`[S2]`
  speaker-turn boundaries, chunk_size ~120 chars (range 50-400) as a secondary length
  governor, not the primary split rule —
  [devnen/Dia-TTS-Server documentation.md](https://github.com/devnen/Dia-TTS-Server/blob/main/documentation.md).
  Community consensus (multiple maintainers across issues) is that Dia degrades badly
  outside a ~5-20s audio window per chunk: too short is unnatural, over ~20s of audio
  content makes speech unnaturally fast and prone to truncation —
  [nari-labs/dia#149](https://github.com/nari-labs/dia/issues/149),
  [nari-labs/dia#148](https://github.com/nari-labs/dia/issues/148),
  [nari-labs/dia#35](https://github.com/nari-labs/dia/issues/35).
- **Dia nonverbal cue tokens** (parenthetical, trained-in): `(laughs)`, `(clears throat)`,
  `(sighs)`, `(gasps)`, `(coughs)`, `(singing)`, `(sings)`, `(mumbles)`, `(beep)`,
  `(groans)`, `(sniffs)`, `(claps)`, `(screams)`, `(inhales)`, `(exhales)`, `(applause)`,
  `(burps)`, `(humming)`, `(sneezes)`, `(chuckle)`, `(whistles)` — official list, use
  sparingly, docs warn some "will be recognized but might result in unexpected output."
  [nari-labs/dia README](https://github.com/nari-labs/dia/blob/main/README.md).
- **Orpheus inline emotion tags**, confirmed set from the official README (finetune-prod
  models only): `<laugh>`, `<chuckle>`, `<sigh>`, `<cough>`, `<sniffle>`, `<groan>`,
  `<yawn>`, `<gasp>`. `<giggle>` and `<moan>` are **not** in the supported set —
  [canopyai/Orpheus-TTS README](https://github.com/canopyai/Orpheus-TTS/blob/main/README.md).
  A user asked about longer/harder emotions (happy, disgust, whisper, longer) and reported
  only the short tags (laugh/sigh-class) actually trigger reliably; no maintainer
  confirmation posted — anecdote,
  [canopyai/Orpheus-TTS#66](https://github.com/canopyai/Orpheus-TTS/issues/66).
- **Orpheus pacing knob**: `repetition_penalty` (must be ≥1.1 for stable generations) and
  `temperature` — raising either makes the model speak *faster*, per official README. If
  Orpheus output feels rushed on this stack, lower these before reaching for post-hoc
  ffmpeg atempo. [canopyai/Orpheus-TTS README](https://github.com/canopyai/Orpheus-TTS/blob/main/README.md).
- **Kokoro is confirmed-flat in community writeups** — good prosody/pauses/narration but
  not built for character/roleplay voicing, no emotion control surface; Chatterbox's
  exaggeration dial is the nearest thing to a roleplay knob among the compared models
  (aggregator synthesis, not primary community discussion — treat as directional, not
  verified consensus). [Local AI Master: Kokoro vs XTTS vs Chatterbox](https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox).
- **RVC as a post-TTS pass is an officially supported SillyTavern workflow**, not just a
  fringe hack: ST ships a first-class RVC extension that explicitly chains after any TTS
  backend (TTS → RVC voice conversion, two-pass). Explicit constraint: **streaming TTS
  will wait for full audio completion before RVC runs** (kills streaming latency), and
  system/OS TTS engines can't feed it at all. Backend: `rvc-python` (recommended,
  optional CUDA) or the deprecated SillyTavern-Extras path. Model format is `.pth` +
  optional `.index`, sourced from community sites like voice-models.com (RMVPE format
  recommended). [docs.sillytavern.app/extensions/rvc/](https://docs.sillytavern.app/extensions/rvc/).
- **XTTS/Coqui: avoid ellipses for prosody control, hand-split instead.** Official Coqui
  guidance is to *not* rely on `...` for pacing/pauses and instead pre-split text yourself
  at 15-25 words or at punctuation boundaries, because internal tokenizer-driven splitting
  is inconsistent. SSML is not supported at all in XTTS v2 (confirmed dead feature
  request, no workaround landed as of the discussion thread).
  [docs.coqui.ai XTTS docs](https://docs.coqui.ai/en/dev/models/xtts.html),
  [coqui/XTTS-v2#23 (pause request, unresolved)](https://huggingface.co/coqui/XTTS-v2/discussions/23).
- **Voice-cloning reference clip consensus across Chatterbox/XTTS docs**: clean single-speaker
  audio, no background noise, no heavy processing, 24kHz+ WAV/FLAC preferred, roughly
  5-20s (10s+ commonly cited as the sweet spot; XTTS explicitly works from 6s). The
  **speaking style of the reference should match the target output style** (e.g. use a
  breathy/quiet reference if you want breathy/quiet output) — official guidance
  explicitly says to avoid whispered/shouted/heavily processed reference clips as
  general-purpose input, not to seek them out for effect.
  [resemble.ai Chatterbox docs](https://www.resemble.ai/learn/models/chatterbox),
  [Coqui XTTS-v1 technical notes](https://erogol.substack.com/p/xtts-v1-technical-notes).

## 1. Local TTS backends people pair with SillyTavern for NSFW/RP, and why

- SillyTavern's own TTS extension enumerates 16+ providers. Local/free options listed in
  official docs: **AllTalk, Coqui-TTS, Edge, Google Translate, Kokoro, Silero, System,
  XTTS**. [docs.sillytavern.app/extensions/tts/](https://docs.sillytavern.app/extensions/tts/).
- **AllTalk** (Coqui XTTS-based) is the most fully-featured local option per its own
  README: settings page, low-VRAM support, DeepSpeed (2-3x speedup claimed by the
  maintainer), narrator voice switching, model finetuning, custom models, wav
  maintenance, and a documented SillyTavern extension.
  [erew123/alltalk_tts](https://github.com/erew123/alltalk_tts),
  [SillyTavern Extension wiki](https://github.com/erew123/alltalk_tts/wiki/SillyTavern-Extension).
  AllTalk v2 is maintainer-recommended over v1 for new setups ("stable build... where
  update and development work is focused") —
  [AllTalk V2 QuickStart](https://github.com/erew123/alltalk_tts/wiki/AllTalk-V2-QuickStart-Guide).
- **GPT-SoVITS** positions itself specifically on few-shot cloning quality: "1 min voice
  data can also be used to train a good TTS model," down to ~5s zero-shot. Splits content
  generation (GPT model, semantic+prosody) from timbre (SoVITS/VITS-derived acoustic
  model) — architecturally different from XTTS's single-pass approach.
  [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS).
- No primary-source (GitHub/HF discussion) head-to-head "why X over Y for NSFW RP"
  writeup was found — this specific comparison axis lives on Reddit, which is
  unreachable here. Treat the aggregator claims in the leaderboard section (§7) as
  directional only.

## 2. Voice-cloning reference clip guidance

Consensus across Chatterbox and XTTS/Coqui official docs (not community anecdote — these
are the model authors' own guidance):

- Length: XTTS works from as little as 6s, ~10s commonly cited as reliable; Chatterbox
  official guidance says 10s+ ("at least 10 seconds... ideally WAV, 24kHz+"), 5s minimum
  works but degrades quality.
  [erogol.substack.com XTTS v1 notes](https://erogol.substack.com/p/xtts-v1-technical-notes),
  [resemble.ai Chatterbox](https://www.resemble.ai/learn/models/chatterbox).
- Dia (from official README, applies to its own voice-clone path): 5-10s optimal; input
  under 5s sounds unnatural, over 20s causes unnaturally fast speech in the *cloned
  output*, not just the reference. Devnen's Dia-TTS-Server hard-truncates reference
  audio at ~20s. [nari-labs/dia README](https://github.com/nari-labs/dia/blob/main/README.md),
  [devnen/Dia-TTS-Server docs](https://github.com/devnen/Dia-TTS-Server/blob/main/documentation.md).
- Clean vs breathy source: every official source says avoid heavily processed, whispered,
  or shouted reference audio, and match the reference's speaking style to the desired
  output style — i.e. it is not "always use a clean, flat reference," it's "reference
  style ≈ target style," but avoid noise/processing artifacts regardless of style.
  [resemble.ai](https://www.resemble.ai/learn/models/chatterbox).
- Sample rate: 24kHz+ WAV/FLAC preferred by Chatterbox docs; XTTS docs don't specify a
  hard floor beyond "clean, single-speaker."
- No big silences at the start/end of the reference clip — trim before feeding it in
  (general XTTS community guidance surfaced via search snippet, not traced to a specific
  primary thread — weak source, treat as anecdote).

## 3. Non-verbal / paralinguistic control, per model

- **Dia**: `(laughs)`, `(clears throat)`, `(sighs)`, `(gasps)`, `(coughs)`, `(singing)`,
  `(sings)`, `(mumbles)`, `(beep)`, `(groans)`, `(sniffs)`, `(claps)`, `(screams)`,
  `(inhales)`, `(exhales)`, `(applause)`, `(burps)`, `(humming)`, `(sneezes)`,
  `(chuckle)`, `(whistles)` — official, trained-in.
  [nari-labs/dia README](https://github.com/nari-labs/dia/blob/main/README.md). A user
  asked about custom nonverbal cues (e.g. `(typing)` for keyboard sounds) with no
  maintainer answer on record — unsupported outside the fixed list, anecdote/open
  question. [nari-labs/dia#24](https://github.com/nari-labs/dia/issues/24).
- **Orpheus**: `<laugh>`, `<chuckle>`, `<sigh>`, `<cough>`, `<sniffle>`, `<groan>`,
  `<yawn>`, `<gasp>` — official, finetune-prod models only, not the base pretrained
  model. [canopyai/Orpheus-TTS README](https://github.com/canopyai/Orpheus-TTS/blob/main/README.md).
  Reported reliability gap: short/discrete tags (laugh, sigh-class) trigger consistently;
  longer mood descriptors (happy, disgust, whisper) do not, per one open unanswered issue
  — anecdote. [canopyai/Orpheus-TTS#66](https://github.com/canopyai/Orpheus-TTS/issues/66).
- **Chatterbox**: no inline tag vocabulary — control is exclusively through the
  `exaggeration` (0-1+, emotion intensity) and `cfg_weight` (pacing/adherence) sliders
  described in §TL;DR, not text markup.
  [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox).
- **XTTS/AllTalk pausing**: no SSML support in XTTS v2 (confirmed unresolved feature
  request spanning Apr 2024-Feb 2025 with no maintainer fix landed). One user reports
  using a literal period ("dot") as a pause workaround, self-described as imperfect —
  anecdote, weak. [coqui/XTTS-v2#23](https://huggingface.co/coqui/XTTS-v2/discussions/23).
  Coqui's own docs recommend avoiding ellipses for consistent prosody and instead
  presplitting text at 15-25 words / punctuation boundaries.
  [docs.coqui.ai](https://docs.coqui.ai/en/dev/models/xtts.html).
- **Punctuation/caps/ellipsis tricks (general TTS prompting guidance, not model-specific
  primary source — treat as industry-consensus-shaped but sourced from
  vendor-docs/aggregators, not this project's actual models)**: periods = full pause,
  commas = short pause, ellipsis = trailing-off/hesitation beat, short sentences =
  urgency, longer sentences = calm/measured delivery, vowel elongation ("sooooo") and
  hyphenation ("ab-so-lutely") reported as informal emphasis hacks in some TTS UIs; ALL
  CAPS is explicitly discouraged by at least one vendor's best-practices doc as an
  emphasis method (unpredictable/inconsistent). None of this is confirmed against Dia,
  Chatterbox, Orpheus, or Kokoro specifically. [Inworld TTS prompting docs](https://docs.inworld.ai/tts/best-practices/prompting-for-tts).

## 4. RVC as a post-TTS step

- This is a **built-in, documented SillyTavern workflow**, not just a community hack:
  ST's RVC extension explicitly requires an upstream TTS extension enabled first ("RVC
  depends on TTS"), performs a second speech-to-speech pass, and is billed for reshaping
  a TTS voice into a cloned target timbre.
  [docs.sillytavern.app/extensions/rvc/](https://docs.sillytavern.app/extensions/rvc/).
- Cost: **streaming is defeated** — RVC waits for the complete TTS output before
  converting, so any latency win from streaming TTS backends (e.g. XTTS's own streaming
  mode) is lost once RVC is in the chain. System/OS-native TTS voices can't be converted
  at all (no raw audio access). Same source.
- Setup cost: needs ffmpeg installed, plus either the `rvc-python` backend (optional CUDA
  acceleration) or the now-deprecated SillyTavern-Extras RVC module. Models are `.pth`
  weights + optional `.index` file, commonly sourced from community model-sharing sites
  like voice-models.com, RMVPE format recommended by the docs. Same source.
- VRAM note from the same doc: one measured case showed 3.4GB VRAM at 50 tokens scaling
  to 7.6GB at 200 tokens under CUDA-accelerated RVC — concrete but single data point,
  anecdote-grade, no GPU/model specified.
- No primary source found quantifying "how common is this in the ST community" — that
  prevalence claim would need Reddit/Discord, both unreachable here.

## 5. Pacing/cadence fixes ("too fast" delivery)

This is the exact failure mode already hit on this project. Findings by model:

- **Dia**: this is a well-documented, repeatedly-filed complaint, not a one-off. Multiple
  separate issues describe the same failure — long inputs (>~20s of audio content) render
  unnaturally fast and get truncated; the model's own `speed_factor` control (0.8-1.0
  range in the original demo) was reported by one user as insufficient ("even for 0.8,
  the voice is still too fast"), no maintainer fix confirmed in that thread.
  [nari-labs/dia#149](https://github.com/nari-labs/dia/issues/149),
  [nari-labs/dia#148](https://github.com/nari-labs/dia/issues/148),
  [nari-labs/dia#139](https://github.com/nari-labs/dia/issues/139),
  [nari-labs/dia#24](https://github.com/nari-labs/dia/issues/24).
  The community server wrapper devnen/Dia-TTS-Server treats `speed_factor` (0.5-2.0) as
  strictly **post-generation resampling**, and separately recommends lowering
  `temperature` (0.1-1.5, default 1.3) and `cfg_scale` (1.0-5.0, default 3.0) to fix
  pacing at generation time, plus keeping chunks in the sane length band via its chunking
  feature (chunk_size default 120 chars, sentence/speaker-tag aware).
  [devnen/Dia-TTS-Server documentation.md](https://github.com/devnen/Dia-TTS-Server/blob/main/documentation.md).
- **Chatterbox**: pacing is coupled to the exaggeration/cfg_weight pair, not a separate
  speed control — see §TL;DR. Higher exaggeration → faster speech; compensate by lowering
  cfg_weight. [resemble-ai/chatterbox README](https://github.com/resemble-ai/chatterbox).
- **Orpheus**: `repetition_penalty` and `temperature` both push speech faster when raised;
  lower them to slow delivery. `repetition_penalty` has a hard floor of 1.1 for stability
  (can't drop below it to slow things further via that knob).
  [canopyai/Orpheus-TTS README](https://github.com/canopyai/Orpheus-TTS/blob/main/README.md).
- **ffmpeg atempo as a universal fallback**: no primary community thread found describing
  this specifically for TTS pacing (the searches that would surface it are Reddit-shaped
  and blocked). It remains the generic, model-agnostic postprocess option but is
  uncorroborated here as a "commonly used" technique — do not present it as consensus.
- **Sentence chunking as a pacing lever, general pattern**: devnen/Dia-TTS-Server and
  petermg/Chatterbox-TTS-Extended both independently converged on "split at sentence
  boundaries, respect speaker tags, target a moderate chunk length (Dia: ~120 chars
  default; Chatterbox-Extended: ~300 chars default), and stitch." This is a two-source
  convergence, stronger than a single anecdote but still narrow (two hobbyist server
  wrappers, not the model authors).
  [devnen/Dia-TTS-Server](https://github.com/devnen/Dia-TTS-Server/blob/main/documentation.md),
  [petermg/Chatterbox-TTS-Extended](https://github.com/petermg/Chatterbox-TTS-Extended).

## 6. SillyTavern TTS extension specifics

- **Providers**: 16+, spanning free/local (AllTalk, Coqui-TTS, Edge, Google Translate,
  Kokoro, Silero, System, XTTS), paid (Azure, ElevenLabs, NovelAI, OpenAI), and
  hybrid/API (Electron Hub, Google Gemini TTS, MiniMax, Pollinations).
  [docs.sillytavern.app/extensions/tts/](https://docs.sillytavern.app/extensions/tts/).
- **Narrator vs character voice**: yes, ST supports this natively via a **voice map**,
  configured per character and per user persona from a dropdown populated by the active
  provider. Text-routing rules (from the AllTalk-side integration, which is the
  most-documented narrator implementation): text wrapped in `*asterisks*` → narrator,
  text in `"double quotes"` → character dialogue, anything else → configurable
  ("Character" / "*Narrator*" / "Silent"). ST's own TTS extension additionally exposes
  quotation-only mode (only speak quoted text) and asterisk-exclusion (never speak
  asterisk-wrapped text, even if quoted) as independent toggles, plus a
  translation-only-narration mode and a regex pre-filter.
  [docs.sillytavern.app/extensions/tts/](https://docs.sillytavern.app/extensions/tts/),
  [erew123/alltalk_tts Narrator Function wiki](https://github.com/erew123/alltalk_tts/wiki/Narrator-Function).
- **Multi-character voice maps**: confirmed — voice assignment is per-character, stored
  in ST's settings, not a single global voice. Same source.
- **Streaming vs batch / chunk length**: only documented for the XTTS provider
  specifically. Enable "Streaming" in the XTTS extension settings, tune "chunk size"
  (reference example: chunk size 200 gave uninterrupted audio on an RTX 3090, at the
  cost of slightly higher latency). HTTP streaming is available with recent XTTS server
  versions to receive audio chunks as they're generated.
  [docs.sillytavern.app/extensions/xtts/](https://docs.sillytavern.app/extensions/xtts/).
  This setting is **not documented for other providers** (Kokoro, AllTalk, Chatterbox) in
  the official ST docs — absence of documentation, not confirmed absence of the feature.
- **Kokoro-in-ST specifics**: OpenAI-compatible endpoint
  (`http://localhost:8880/v1/audio/speech`), model name `kokoro`, no API key needed,
  voice map syntax like `"CharName:alloy,Assistant:echo,..."`. No documented
  speed/expressiveness tuning surface in this integration guide.
  [remsky/Kokoro-FastAPI wiki: SillyTavern integration](https://github.com/remsky/Kokoro-FastAPI/wiki/Integrations-SillyTavern).

## 7. "Local smut TTS leaderboard" / comparison threads

No primary community thread (Reddit, Discord-mirrored, or GitHub Discussions) doing a
direct NSFW/RP shootout was found — this is the one research target most starved by the
Reddit block. What surfaced instead is SEO/aggregator blog content, which I flag as such
rather than presenting as consensus:

- Aggregator claim: Chatterbox preferred over ElevenLabs 65.3% to 24.5% in an unspecified
  "blind study" (no methodology/link to the actual study given in the aggregator post) —
  weak, unverifiable as stated. [findskill.ai](https://findskill.ai/blog/best-open-source-tts-2026/).
- Aggregator claim: open-source ceiling (cited: "Sesame CSM," 4.7 MOS) is within 0.1-0.3
  MOS of ElevenLabs Turbo v2.5 (4.8 MOS) — same caveat, no primary benchmark link
  surfaced. [localclaw.io](https://localclaw.io/blog/local-tts-guide-2026).
- Aggregator claim, directional only: among Piper/Kokoro/Chatterbox, Piper is
  fast-but-robotic ("sounds like a 2015 GPS" on prosody-heavy text), Kokoro reads as
  natural narration but isn't built for character/roleplay voicing, Chatterbox's
  exaggeration dial is the closest thing to a roleplay control among the three.
  [localaimaster.com](https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox).
- TTS Arena-style Elo leaderboards exist (Voxtral, Maya1, Fish Audio S2 Pro cited as
  recent leaders) but none of the cited leaders are in this project's actual local
  Apple-Silicon/mlx-audio stack (Kokoro, Dia, Chatterbox, Orpheus, CSM). Treat as
  general TTS-quality context, not a decision input for this stack.
  [offlinetts.com TTS Arena Leaderboard 2026](https://offlinetts.com/blog/tts-arena-leaderboard-2026/).

## Gaps / what Reddit would have answered but couldn't be checked here

- Direct "what do people actually run for NSFW ST narration and why" recommendation
  threads (r/SillyTavernAI, r/JanitorAI) — blocked, zero access.
- Prevalence of the RVC-after-TTS workflow in practice (is it common or rare among ST
  users) — only the fact that ST ships first-class support for it is confirmed; adoption
  rate is unknown.
- Community-reported ffmpeg atempo usage for TTS pacing specifically — not found outside
  general knowledge, no primary source.
- Any NSFW-specific Orpheus or Chatterbox finetunes beyond the general-purpose
  `unsloth/orpheus-3b-0.1-ft` and `MrDragonFox/morpheus-uncensored-tts` HF Space (found
  in search results but the Space's README/details did not load — content unverified,
  do not cite specifics from it).

---

## Reddit anecdata (via Brave Search API, 2026-07-20)

Reddit is blocked to WebSearch/WebFetch in Claude Code, but reachable via the Brave Search API
(key in ~/.claude/settings.json). These are community claims with thread URLs.

### Moaning / sex sounds: no base model does it from a tag
- Consensus route 1 - RVC voice conversion: take a REAL moan audio clip, convert its timbre to
  your target voice. "Feed it an audio file of some moans (easy to find online) and the sample
  audio you want to change it into." https://www.reddit.com/r/StableDiffusion/comments/1ov4slo/
- Consensus route 2 - VibeVoice multi-speaker: assign reference clips that CONTAIN sexy vocals;
  4-speaker setup, each clip a different style. Top NSFW pick, 275-vote thread.
  https://www.reddit.com/r/LocalLLaMA/comments/1n7mien/best_current_nsfw_tts_model/
- Tool bundling both + 10 paralinguistic effects (laughter, breathing, sigh, gasp, crying, sniff,
  cough, yawn, scream, MOAN), engine-agnostic, ComfyUI: diodiogod/TTS-Audio-Suite (formerly
  ChatterBox SRT Voice). https://github.com/diodiogod/TTS-Audio-Suite
- Confirms this project's "hounds of hell" was a known Chatterbox artifact, not user error:
  "it sounds like the infernal moans of the trapped souls they use to power the model."
  https://www.reddit.com/r/Oobabooga/comments/1l64dm3/

### Chatterbox tuning consensus
- exaggeration <= 0.70; "past 0.70 sounds gradually more hysterical"
- cfg_weight 0.3 = dramatic/slow pacing, 0.5 = neutral. Dramatic preset: cfg_weight=0.3, exaggeration=0.8
- chunk input to <= 40-50 words / 250 chars per generation (matches this project's MAXCHARS chunking)
- temp / top_p / repetition_penalty: "treat like an LLM"; min_p 0.02-0.1 handles higher temp; top_p=1.0 disables
- BIGGEST LEVER: reference clip should be recorded in the emotional STYLE wanted out (breathy ref -> breathy out),
  not neutral. Source: https://www.reddit.com/r/LocalLLaMA/comments/1llf7pj/chatterbox_tts_tips_or_advice/

### NSFW model landscape (community)
- VibeVoice = favorite for NSFW multi-speaker, but VRAM-hungry (7B). Check MLX feasibility on 16GB before adopting.
- Kokoro nicole = "whispery and asmr'ish, passably decent" cheap option (already this project's breathy ref)
- Chatterbox + RVC = solid local middle ground
- Recent blind comparison: VoxCPM #1, IndexTTS2 #2, Chatterbox/XTTS-v2 tied 3rd
  https://www.reddit.com/r/LocalLLaMA/comments/ (Which TTS model are you using right now)
