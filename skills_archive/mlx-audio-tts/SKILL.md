---
name: mlx-audio-tts
description: Load when running local text-to-speech on Apple Silicon via mlx-audio (Kokoro/Dia/CSM): setup, model choice, competent per-model params, and Dia artifact fixes.
---

# Local TTS on Apple Silicon: mlx-audio Competency Guide

## Setup

Create a project venv with `uv`:

```bash
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install mlx-audio "misaki[en]"
```

Key gotcha: `misaki[en]` (grapheme-to-phoneme) is required for Kokoro to handle text correctly. Without it, phoneme synthesis fails on certain words.

Audio playback on macOS: `afplay output.wav` (built-in utility).

---

## Model Roster

| Model | Repo ID | Size | RAM (M3, 16GB) | Speed (xRT) | Affect | Mode | Use Case |
|-------|---------|------|---|---|---|---|---|
| Kokoro-82M | `prince-canuma/Kokoro-82M` | 330 MB | 300-500 MB | 2.0x | Flat/neutral | Live streaming | Fast, any text, no filter. Live servers, real-time agents. Not expressive. |
| Dia-1.6B | `mlx-community/Dia-1.6B` | 3 GB | ~2 GB | 0.07x | Expressive | Batch/offline | Two-speaker dialogue, non-verbal cues, [S1]/[S2] syntax. ~12s audio in 3 min (3072 steps). |
| Dia-1.6B-4bit | `mlx-community/Dia-1.6B-4bit` | ~1.8 GB | ~1 GB | 0.12x | Degraded | Avoid | Over-quantized; produces garbled "demon chorus" tail. Skip. |
| CSM-1B | `mlx-community/csm-1b-8bit` | ~1.8 GB | 8.1 GB | Unverified | Expressive, conversational | Batch | Voice cloning via ref_audio. Sesame Conversational Speech Model. |

---

## Hot-Run Pattern (Load Once, Keep Hot)

Load the model once per process; reuse across many generations.

```python
from mlx_audio.tts.utils import load_model

# Load at startup, keep reference alive
model = load_model(repo_id="prince-canuma/Kokoro-82M")

# Generate many times, concatenate audio
audio_segments = []
for text_chunk in text_list:
    for seg in model.generate(
        text=text_chunk,
        voice="af_heart",
        speed=1.0,
        verbose=False
    ):
        audio_segments.append(seg.audio)  # mlx array, float32, mono
        sample_rate = seg.sample_rate  # 24000 Hz for Kokoro

# Concat (mlx.concatenate) and save
concatenated = mlx.concatenate(audio_segments, axis=0)
# Convert to numpy, then scipy.io.wavfile.write or similar
```

---

## Per-Model Parameters

### Kokoro-82M

**Voice selection:** Format is `{gender_region}_{name}`.

American English (19 voices):
- Female: `af_heart`, `af_alloy`, `af_aoede`, `af_bella`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky`
- Male: `am_adam`, `am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx`, `am_puck`

Other languages via `lang_code`:
- `'a'` = American English (default)
- `'b'` = British English (voices: `bf_*`, `bm_*`)
- `'e'` = Spanish
- `'f'` = French
- `'h'` = Hindi
- `'i'` = Italian
- `'j'` = Japanese
- `'p'` = Brazilian Portuguese
- `'z'` = Mandarin Chinese

**Recommended parameters:**

```python
model.generate(
    text="Your text here",
    voice="af_heart",           # any voice from list above
    speed=1.0,                  # range 0.5-2.0; 1.0 is normal
    lang_code="a",              # language code
    verbose=False               # suppress debug output
)
```

- `speed=1.0`: normal rate. `1.5` for faster, `0.7` for slower. Test in range [0.5, 2.0].
- `streaming=True` if API supports; yields chunks during generation.
- Sample rate: always 24000 Hz.

### Dia-1.6B

**Absolute rules:**

1. Always begin input with `[S1]`. Always alternate `[S1]` / `[S2]` for multi-speaker.
2. Place second-to-last speaker tag at audio end for quality (not all speakers need this).
3. Minimum meaningful input: avoid single-word turns. Use full sentences or short utterances (3+ words).
4. Voice conditioning (ref_audio): provide 5-10 seconds of clean audio + accurate transcript with speaker tags.

**Supported non-verbal tags (full list from README):**

Dia recognizes these tags; however, the README warns they may produce "unexpected output" and should be used sparingly:

- `(laughs)`, `(chuckle)`
- `(clears throat)`, `(coughs)`, `(sniffs)`
- `(sighs)`, `(gasps)`, `(inhales)`, `(exhales)`
- `(groans)`, `(screams)`, `(beep)` (singular)
- `(claps)`, `(applause)`, `(burps)`
- `(singing)`, `(sings)`, `(humming)`, `(whistles)`
- `(mumbles)`, `(sneezes)`

Empirical finding: unsupported tags (e.g., `(whispers)`, `(breathes)`) + fragmented one-word turns trigger demon-chorus tail. Tags on the above list produce variable results; test before production use. Short, clean text without any non-verbal tags is most reliable.

**Recommended generation parameters:**

```python
model.generate(
    text="[S1] Hello, how are you? [S2] I'm doing well.",
    cfg_scale=3.0,              # range 1.0-5.0, default 3.0
    temperature=1.3,            # range 0.1-1.5, default 1.3
    top_p=0.95,                 # range 0.1-1.0, default 0.95
    seed=42,                    # -1 for random; set for reproducibility
    steps=3072,                 # typical full generation (diffusion steps)
    verbose=False
)
```

**Parameter tuning:**
- Lower `cfg_scale` (e.g., 1.5-2.0): results closer to voice conditioning (ref_audio) if provided, less expressive.
- Higher `cfg_scale` (e.g., 4.0-5.0): more expressive but may drift from conditioning.
- Lower `temperature` (e.g., 0.5-0.8): more deterministic, sharper delivery.
- Higher `temperature` (e.g., 1.5+): more variation, noisier.
- `top_p=0.95`: default; lower (0.8) for tighter sampling, higher (0.99) for more variance.

**Voice conditioning (ref_audio):**

If ref_audio file is available, prepend its transcript to the generation text with correct speaker tag:

```python
ref_text = "[S1] This is my voice, clean and clear. [S2]"
gen_text = "[S2] And now I'm speaking this new text."
combined = ref_text + " " + gen_text

model.generate(
    text=combined,
    ref_audio="path/to/audio.wav",  # 5-10s of target voice
    cfg_scale=3.0,
    ...
)
```

Model was not fine-tuned on specific voices, so results vary without ref_audio or fixed seed.

**Failure diagnosis:**

- If output ends with garbled "demon chorus" tail: check for unsupported non-verbal tags or fragmented one-word turns. Retry with clean, full sentences only (no tags or only listed safe tags).
- If text is split into chunks: check `chunk_size` limit and whether random seed (-1) is enabled in chunking. Reroll seed for coherence.

### CSM (Sesame, csm-1b-8bit)

**Voice cloning modes:**

1. **Shallow clone** (speaker embedding only): Fast, consistent speaker identity without exact voice replica.
   - Provide 5-10s reference audio + transcript.

2. **Deep clone** (audio + transcript prefix): Slower but higher fidelity voice consistency.
   - Prepend reference audio and its full transcript to generation input.

**Recommended parameters (unverified, align with Dia patterns):**

```python
model.generate(
    text="[S1] New text here.",
    ref_audio="voice.wav",      # reference for speaker conditioning
    mode="shallow",              # or "deep"
    cfg_scale=2.5,              # estimate; test range 1.5-3.5
    temperature=0.9,            # estimate; test range 0.5-1.2
    verbose=False
)
```

**RAM requirement:** ~8.1 GB VRAM on MLX. On M3 16GB, feasible but monitor headroom.

---

## Failure Modes & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Garbled "demon chorus" tail after EOS | Unsupported non-verbal tags (`(whispers)`, `(breathes)`, etc.) OR fragmented one-word turns AND high step count (>3000) | Remove unsupported tags. Ensure full sentences (3+ words min). Reduce `steps` to 2000 or set `cfg_scale=2.0` to stabilize. |
| Audio cuts off early (EOS at step <500) | Text too short or seed instability | Extend text; reroll seed or set fixed seed. Check alternating [S1]/[S2] syntax. |
| Wrong voice (drifts mid-generation) | Seed -1 (random) + chunking enabled | Set fixed seed (e.g., 42) and disable random reroll in chunking. |
| Runs out of memory (OOM) | Model too large for available RAM OR concurrent loads | Use 4bit quantized version (Dia-1.6B-4bit) as fallback, but accept quality loss. Or wait between batches. For CSM on 16GB, serialize runs. |
| Robotic or flat delivery (Kokoro) | Kokoro has no affect control | Use Dia if expressiveness needed. Kokoro only supports `speed` adjustment. |
| Kokoro gibberish on certain words | Missing `misaki[en]` G2P library | Install: `uv pip install "misaki[en]"`. |

---

## Performance Expectations (M3, 16GB)

| Model | Task | Time | Notes |
|-------|------|------|-------|
| Kokoro-82M | 30 seconds audio | ~15 seconds wall-clock | 2x realtime. Streaming yields chunks during generation. |
| Kokoro-82M | Model load | ~2 seconds | Cached after first load. |
| Dia-1.6B | 12 seconds audio (clean text) | ~3 minutes wall-clock | 0.07x realtime; 3072 diffusion steps typical. First run slower due to compilation. |
| Dia-1.6B | With ref_audio (5-10s) | +30-60 seconds | Voice conditioning overhead. |
| CSM-1B | ~10s audio (unverified) | Unverified | ~8GB VRAM used; expect similar order as Dia but faster decoding. |
| Model load (Dia / CSM) | Initial load | ~10-15 seconds | Compilation + memory allocation. Cache file copies on re-run. |

**Memory usage during generation:**
- Kokoro: 300-500 MB (stable, low variance).
- Dia: ~2 GB (baseline) + generation overhead (up to 3 GB peak during diffusion).
- CSM: ~8 GB (baseline); monitor if running alongside other processes.

---

## CLI Usage (mlx-audio)

Command-line inference via `python -m mlx_audio.tts.generate`:

```bash
python -m mlx_audio.tts.generate \
  --model prince-canuma/Kokoro-82M \
  --text "Hello, world." \
  --voice af_heart \
  --file_prefix output \
  --audio_format wav
```

Supported flags:
- `--model <repo-id>`: HuggingFace model ID.
- `--text <string>`: Text to synthesize.
- `--voice <name>`: Voice identifier (model-specific).
- `--file_prefix <prefix>`: Output filename prefix (no extension).
- `--audio_format wav|mp3`: Output format.
- `--cfg_scale <float>`: Classifier-free guidance (Dia).
- `--temperature <float>`: Sampling temperature (Dia).
- `--speed <float>`: Speech rate (Kokoro, range 0.5-2.0).
- `--stream`: Enable streaming output.
- `--ref_audio <path>`: Reference audio for voice conditioning.
- `--ref_text <text>`: Transcript of ref_audio.
- `--lang_code <code>`: Language code (Kokoro).

---

## Server (MLX-Audio + FastAPI)

Optional: run an OpenAI-compatible TTS server for production workloads.

```bash
uv pip install uvicorn fastapi  # extra dependencies
mlx_audio.tts.server --host 0.0.0.0 --port 8000
```

REST endpoint:

```bash
curl -X POST http://localhost:8000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "prince-canuma/Kokoro-82M",
    "input": "Hello, world!",
    "voice": "af_heart"
  }'
```

---

## Hardening Checklist for Production

- [ ] Load model once at startup, store in global or class-level cache.
- [ ] For Kokoro: always install `misaki[en]` (G2P library).
- [ ] For Dia: validate input text for unsupported non-verbal tags before passing to model.
- [ ] For Dia: enforce alternating [S1]/[S2] syntax via regex or parser.
- [ ] For Dia: test with fixed seed (e.g., `seed=42`) first; only randomize after stability confirmed.
- [ ] For Dia ref_audio: validate audio duration (5-10s) and transcript presence before conditioning.
- [ ] Monitor RAM during first batch run; profile peak usage per model.
- [ ] Set timeouts: Kokoro ~30s per 30s audio, Dia ~3 min per 12s audio (adjust for system speed).
- [ ] Validate output WAV file before sending to downstream consumer (check sample rate, duration, audio levels).

---

## Fast + expressive candidates (tested)

Goal was near-realtime AND expressive on M3 Pro 16GB. Kokoro (~2x realtime) is flat. Dia (~0.07x realtime) is expressive but unusable live. Tested three candidates against that gap.

**xRT convention below is `audio_duration_seconds / processing_time_seconds`** (speed multiple, higher = faster), matching the rest of this doc's Kokoro/Dia numbers. This matters because mlx-audio's own printed "Real-time factor" field is **inconsistent in direction across model backends**: Kokoro, Dia, and Chatterbox compute it as `processing_time / audio_duration` (academic RTF, lower = faster — so Chatterbox's own printed "0.61x" means 1.63x actual speed multiple), while the `llama` backend (Orpheus) computes `audio_duration / processing_time` (speed multiple, matches this table directly). Don't trust the printed number without checking which backend produced it — recompute from `Duration:` and `Processing time:` in `--verbose` output if unsure.

| Model | Verified repo id | Measured xRT (M3 Pro 16GB) | RAM (MLX peak) | Expressiveness control | Voice (default, female) | Verdict |
|---|---|---|---|---|---|---|
| Chatterbox-fp16 | `mlx-community/chatterbox-fp16` | 1.36x (shipped default: `cfg_weight=0.2`, cloned female ref) | 3.72 GB | `exaggeration` (0-2 range, 0.5 default/neutral), `cfg_weight` (0.2-1.0 range — **also the pacing lever**, see below) | Clones `ref-female_000.wav` (Kokoro `af_heart`, documented American Female) via `ref_audio`/`ref_text` | **Winner.** Only candidate that clears 1x realtime with both a real emotion knob and a real pacing knob. |
| Orpheus-3B-4bit | `mlx-community/orpheus-3b-0.1-ft-4bit` | 0.86x – 0.93x | 2.16 GB | Inline emotion tags in the text itself: `<laugh> <chuckle> <sigh> <cough> <sniffle> <groan> <yawn> <gasp>` | `tara` (voice flag) | Works, borderline live (just under 1x). Use for non-live/narration where inline tag control matters more than speed. |
| artifex-rp (`darthcrawl/artifex-rp-orpheus-llama-3.1-8b`) | not a TTS model | untested | n/a | n/a | n/a | **Wrong premise.** This is a `text-generation` (LlamaForCausalLM) prose/roleplay finetune of `meta-llama/Llama-3.1-8B-Instruct`, tagged `creative-writing`/`prose-style`/`roleplay`. It writes RP text, it does not speak. "Orpheus" in its name is unrelated to canopylabs' Orpheus-TTS. No `-mlx-4bit` TTS variant exists under this name (confirmed via HF API search on `author=darthcrawl`); the exact id given in the test brief (`...-mlx-4bit`) 404s. Not usable in mlx-audio at all. |

Both Chatterbox-fp16 and Orpheus-3B-4bit generated valid non-silent audio (checked via RMS/peak on raw PCM, not just file existence) for the neutral test sentence: *"Okay, I finally got this running on my own laptop, and honestly, I did not expect it to sound this good. Say something longer so I can hear the range."* Orpheus was also smoke-tested with an inline `<laugh>` tag — ran without error, produced 9.13s of audio from a 752-token prompt.

### Chatterbox-fp16 detail

- mlx-audio's `chatterbox.py generate()` signature: `exaggeration=0.1` default in the function signature itself, but the CLI (`mlx_audio.tts.generate`) always passes `--exaggeration` with its own default of `0.5`, so CLI runs are neutral by default, not the library's low-emotion 0.1 default. `prepare_conditionals()` (used when building `conds.safetensors` from a ref clip) defaults `exaggeration=0.5` too.
- `cfg_weight` (classifier-free guidance weight, upstream-documented range 0.2-1.0, mlx-audio function default 0.5) has **no CLI flag**. `--cfg_scale` is accepted by the CLI parser but is a different model's param name — for Chatterbox it lands in `**kwargs` and is silently ignored. To vary `cfg_weight` you must call `model.generate(cfg_weight=...)` directly via the Python API (`load_model` + `.generate()`); the CLI cannot reach it at all. This project's `chatterbox_gen.py` wraps that call so `just chatterbox cfg_weight=...` works.
- **`cfg_weight` is also the pacing/cadence lever, confirmed empirically, not just an upstream claim.** Same fixed test sentence, `exaggeration=0.5` held constant, only `cfg_weight` varied:

  | cfg_weight | audio duration | vs. cfg_weight=0.5 |
  |---|---|---|
  | 0.5 (mlx-audio CLI's only reachable value) | 5.56s | baseline — reads as rushed |
  | 0.3 | 6.36s | +14% slower |
  | 0.2 (documented floor) | 7.40s | +33% slower |
  | 0.3 with exaggeration also dropped to 0.3 | 8.16s | +47% slower |

  Lower `cfg_weight` → the model paces speech more deliberately (not a post-hoc time-stretch, the T3 autoregressive decoder actually emits more/longer speech tokens). This shipped as the fix for "wayyyy too fast" first-listen feedback: `chatterbox_gen.py` and the `just chatterbox` recipe now default `cfg_weight=0.2` instead of the CLI's only reachable value (0.5). An `ATEMPO` env/arg (ffmpeg, pitch-preserved, same lever already used for Dia) is also wired in as a second-pass knob if 0.2 still isn't slow enough for a given voice/text.
- Upstream guidance (resemble-ai): for more expressive/dramatic delivery, raise `exaggeration` to ~0.7+ and lower `cfg_weight` to ~0.3 to compensate for the faster pacing higher exaggeration induces. Neutral: both at 0.5.
- Resemble AI's own model card documents `exaggeration` range as roughly 0.25-2.0.
- Requires `conds.safetensors` (bundled with the `mlx-community/chatterbox-fp16` repo) or a `ref_audio`/`ref_text` pair; without either, `generate()` raises `ValueError`.
- **Voice/gender**: Chatterbox has no named-voice list — output timbre comes entirely from whichever reference clip conditions it. The repo's bundled `conds.safetensors` has an undocumented, unverified speaker (could be either gender — not checked by ear). Rather than gamble on it, `chatterbox_gen.py` defaults `ref_audio`/`ref_text` to `ref-female_000.wav`, a clip built in this project from Kokoro's `af_heart` voice (documented American Female in this doc's own voice list above). Build it once with `just kokoro-ref` before the first `just chatterbox` run; if the file is missing, `chatterbox_gen.py` prints a warning and falls back to the unverified bundled voice instead of failing.

### Orpheus-3B-4bit detail

- Emotion tags are not special tokens intercepted by mlx-audio — they're literal substrings (`<laugh>`, etc.) fed straight into the prompt; the LLM backbone was trained to associate them with the SNAC audio codes it emits. mlx-audio's `llama.py` has no tag validation, so an unsupported tag would just be tokenized as ordinary (garbage) text — stick to the eight canonical tags.
- Canonical tag list per canopyai/Orpheus-TTS README: `<laugh> <chuckle> <sigh> <cough> <sniffle> <groan> <yawn> <gasp>`.
- Voices (English): `tara leah jess mia zoe` = female, `leo dan zac` = male. Default in this project's recipe is `tara` (female).
- Upstream canopylabs claims ~200ms streaming latency on GPU (reducible to ~100ms with input streaming) — that figure is CUDA/vLLM-serving, not comparable to this M3 CLI batch measurement.
- `--temperature 0.6` used in testing (mlx-community model card's own example invocation).
- No native pacing lever found in mlx-audio's `llama.py` wrapper for Orpheus (no `speed`/`cfg`-style param that reliably changes cadence); if Orpheus reads too fast/slow, the `ATEMPO` pattern from `read_text.py` is the only known lever.

### A note on this doc's own test process

Early passes of this section auto-played every render through `afplay` during testing and used whichever model/CLI default voice happened to be first in the docs (Chatterbox's unverified bundled ref, Orpheus defaults). That surfaced two problems the numbers above didn't catch on their own: default pacing at `cfg_weight=0.5` reads as rushed, and an unverified-gender reference voice is a real risk for a project where the default output matters. Neither is visible from xRT/RAM numbers alone — dial in pacing and voice gender explicitly, don't assume the library's defaults are tuned for this use case. The recipes as shipped do **not** auto-play (`afplay` removed); run `afplay out-chatterbox.wav` / `afplay out-orpheus_000.wav` manually to listen.

### artifex-rp: what it actually is

`darthcrawl/artifex-rp-orpheus-llama-3.1-8b` is a QLoRA-style finetune of `meta-llama/Llama-3.1-8B-Instruct` for prose/roleplay text generation (tags: `creative-writing`, `prose-style`, `roleplay`, `register:restrained-lyrical`). It is a chat/story-writing model, loadable with `transformers`/`mlx-lm` as a text LLM, not with `mlx_audio.tts.generate`. If the goal is ever "write the scene," not "voice the scene," this is the right kind of tool — it's simply not a TTS candidate and doesn't belong in this doc's model roster. No RAM/speed numbers gathered since it was never a TTS test target.

### Sources

- [resemble-ai/chatterbox GitHub](https://github.com/resemble-ai/chatterbox) — exaggeration/cfg_weight defaults and guidance
- [ResembleAI/chatterbox HF model card](https://huggingface.co/ResembleAI/chatterbox) — default settings `exaggeration=0.5, cfg=0.5`, tuning guidance
- [resemble-ai/chatterbox#355](https://github.com/resemble-ai/chatterbox/issues/355) — exaggeration has minimal effect on multilingual variant (not relevant to fp16 English)
- [canopyai/Orpheus-TTS README](https://github.com/canopyai/Orpheus-TTS/blob/main/README.md) — canonical emotive tag list, voice list, latency claim
- [mlx-community/orpheus-3b-0.1-ft-4bit HF model card](https://huggingface.co/mlx-community/orpheus-3b-0.1-ft-4bit) — CLI invocation example, 0.5B... (card states model derived from Llama 3.2 3B Instruct, Apache 2.0)
- [darthcrawl/artifex-rp-orpheus-llama-3.1-8b HF](https://huggingface.co/darthcrawl/artifex-rp-orpheus-llama-3.1-8b) — actual repo id and model type (text-generation, not TTS)
- Local source read: `mlx_audio/tts/models/chatterbox/chatterbox.py`, `mlx_audio/tts/models/llama/llama.py`, `mlx_audio/tts/models/kokoro/kokoro.py`, `mlx_audio/tts/generate.py` in this project's `.venv` (mlx-audio 0.4.5) — for exact default values and the RTF-direction inconsistency.

## VibeVoice feasibility (tested/researched)

**Verdict: the VibeVoice mlx-audio actually runs is not the model Reddit means.** mlx-audio 0.4.5 (this project's installed version) ships a `vibevoice` backend, but source inspection shows it implements `microsoft/VibeVoice-Realtime-0.5B` (config `model_type: "vibevoice_streaming"`, Qwen2.5-0.5B backbone: `hidden_size=896, num_hidden_layers=24`) — a single-speaker, low-latency streaming model, officially documented as such. The 4-speaker, 90-minute, "assign each speaker a reference clip" model the NSFW community actually wants is `microsoft/VibeVoice-1.5B` (`model_type: "vibevoice"`, `VibeVoiceForConditionalGeneration`, `hidden_size=1536, num_hidden_layers=28`, plus a separate semantic tokenizer mlx-audio's `ModelConfig` has no field for) or `vibevoice/VibeVoice-7B`. **Neither 1.5B nor 7B is supported by mlx-audio** — confirmed by reading `mlx_audio/tts/models/vibevoice/config.py` / `vibevoice.py` and `mlx_audio/tts/utils.py`'s `MODEL_REMAPPING` (only `"vibevoice_streaming": "vibevoice"` is mapped; `"vibevoice"` the real 1.5B/7B `model_type` isn't remapped and would hit the same folder by name coincidence but load a config the Model class only partially understands and drop unrecognized weight keys like the semantic tokenizer during `sanitize()`). No mlx-community MLX port of 1.5B or 7B exists either — the `mlx-community/vibevoice` HF collection contains only `VibeVoice-Realtime-0.5B-{4bit,5bit,6bit,8bit,fp16}` and `VibeVoice-ASR-*` (a Whisper-style STT model, unrelated to TTS). This was not run to failure on purpose (would require a 5.4GB/18.7GB download to prove a structural mismatch already evident from config diffing); confidence is source-verified, not empirically tested, for the "1.5B/7B won't load" claim specifically.

**Multi-speaker API, as actually implemented**: `Model.generate(text, voice, ...)` takes `voice` as either one name/path, or (for multi-speaker) a `List[Tuple[str, str]]`-shaped dialogue built from parallel `text: List[str]` + `voice: List[str]` lists — see `mlx_audio/tts/models/vibevoice/vibevoice.py:406-466`. Internally `_generate_multi_speaker()` just loops the list and calls the single-speaker path per segment, swapping `load_voice()` between turns and concatenating results — turn-taking by sequential re-synthesis, not the original VibeVoice's joint interleaved multi-speaker decoding. `voice` values are **not raw reference clips** — `load_voice(name)` (`vibevoice.py:134`) reads a prebuilt `voices/{name}.safetensors` KV-cache bundle from the model repo; there is no method anywhere in `vibevoice.py` to build a voice cache from an arbitrary wav at runtime. `mlx-community/VibeVoice-Realtime-0.5B-4bit`'s `voices/` dir ships exactly 25 canned voices (e.g. `en-Emma_woman`, `en-Carter_man`, plus de/fr/it/jp/kr/nl/pl/pt/sp pairs) — no custom-voice/reference-clip cloning path. The top-level `generate_audio()` wrapper does accept a general `ref_audio` param, but `Model.generate()`'s signature never reads `ref_audio` from `**kwargs`, so passing it for vibevoice is a silent no-op (confirmed by reading `mlx_audio/tts/generate.py:151-330`, no `vibevoice`-specific branch exists there). **Net: this backend cannot do "assign each of 4 speakers a user-supplied reference clip" at all** — only pick 2 of 25 preset voices and alternate turns.

**Measured, this box (M3, 16GB), `mlx-community/VibeVoice-Realtime-0.5B-4bit`, mlx-audio 0.4.5, cold+warm run via `mlx_audio.tts.utils.load_model` + `model.generate()`**:

| run | load time | peak RSS (`ru_maxrss`) | gen time | audio produced | xRT |
|---|---|---|---|---|---|
| cold (downloads 633MB model.safetensors + 25 voice caches, 29 files) | 13.04s | 1054.1 MB | 0.895s | 3.333s | 3.73x |
| warm (HF cache hit) | 2.17s | 1035.5 MB | 0.839s | 4.933s | 5.88x |

So the Realtime-0.5B-4bit variant that mlx-audio *does* run: ~1.0-1.05GB peak RSS, 3.7-5.9x realtime on a single short sentence (`"The quick brown fox jumps over the lazy dog near the riverbank."` / a second longer sentence for the warm run), comfortably inside 16GB and faster than every other engine in this doc (Kokoro ~2x, Chatterbox 1.36x, Orpheus ~0.9x, Dia ~0.07x). fp16 (unquantized, 1B-param count per its own card) is 2.14GB on disk and wasn't separately timed.

**Fit if 1.5B/7B were portable at all (not tested — no MLX port exists)**: 1.5B weights are 5.41GB across 3 safetensors files (bf16, per its HF `config.json` and file listing); a 4-bit MLX quant of that would land roughly 1.4-1.7GB, plausible for 16GB unified memory. 7B weights are ~18.7GB bf16 (10-part safetensors, 1.68-1.97GB/part); even a 4-bit quant (~4.5-5GB) would likely fit alongside macOS on 16GB, but there is no such quant published and no code path in mlx-audio to load it if there were. The one first-hand Apple Silicon report found for the real 1.5B (HF discussion, M4 Max 128GB, PyTorch MPS backend, not mlx-audio) was ~1.38 it/s with heavy CPU/GPU swapping and ~16 minutes for one generation segment — anecdotal, not comparable hardware, and not MLX.

**Licensing/gotchas**: `microsoft/VibeVoice-1.5B` embeds an audible disclaimer plus an inaudible watermark into every output by design (per its own HF model card) — not configurable off, a real problem for any use case wanting clean output. Microsoft pulled the original `microsoft/VibeVoice` GitHub repo's code in Sept 2025 over misuse concerns and restored it without code/with a responsible-use statement; weights stayed on HF throughout and a community fork (`vibevoice-community/VibeVoice`, MIT, 8k+ stars) preserves the original code. The Realtime-0.5B model (the one that actually runs here) is English-primary with partial multilingual support and, per its own model card, explicitly single-speaker: "For multi-speaker conversational speech generation, please use other VibeVoice models" — i.e. even upstream Microsoft doesn't claim Realtime-0.5B does what the NSFW multi-speaker use case needs; mlx-audio's dialogue-loop is a workaround bolted on top, not something Microsoft designed the model for.

**Recommendation basis for this project**: for the stated NSFW multi-speaker-with-custom-reference-clips use case, VibeVoice-via-mlx-audio does not deliver it — the only backend that loads is the wrong (single-speaker, canned-voice) model. Chatterbox (already integrated, 1.36x realtime, 3.72GB RAM, real `ref_audio`/`ref_text` cloning per `chatterbox_gen.py`) remains the closest fit already in this project for arbitrary reference-clip voice cloning. VibeVoice-Realtime-0.5B-4bit is worth having only as a fast, low-RAM, English, canned-voice or single-clone-adjacent option if a use case narrower than "4 arbitrary reference clips" shows up — not as a drop-in for the Reddit NSFW workflow.

### VibeVoice sources

- Local source read: `mlx_audio/tts/models/vibevoice/{vibevoice.py,config.py,__init__.py}`, `mlx_audio/tts/utils.py` (`MODEL_REMAPPING`), `mlx_audio/tts/generate.py` — in this project's `.venv` (mlx-audio 0.4.5, pip-installed, `Blaizzy/mlx-audio` upstream)
- [microsoft/VibeVoice-1.5B HF model card](https://huggingface.co/microsoft/VibeVoice-1.5B) — 5.41GB, disclaimer+watermark behavior, English/Chinese only
- [microsoft/VibeVoice-1.5B config.json](https://huggingface.co/microsoft/VibeVoice-1.5B/raw/main/config.json) — `model_type: vibevoice`, `hidden_size=1536`, `num_hidden_layers=28`
- [microsoft/VibeVoice-1.5B tree/main](https://huggingface.co/microsoft/VibeVoice-1.5B/tree/main) — 3-part safetensors, 1.98+1.98+1.45GB
- [microsoft/VibeVoice-Realtime-0.5B HF model card](https://huggingface.co/microsoft/VibeVoice-Realtime-0.5B) — single-speaker-only statement, Qwen2.5-0.5B backbone, ~300ms first-audio latency claim
- [mlx-community/VibeVoice-Realtime-0.5B-4bit](https://huggingface.co/mlx-community/VibeVoice-Realtime-0.5B-4bit) — 633MB `model.safetensors`, 25-file `voices/` dir, converted with mlx-audio 0.2.6
- [mlx-community VibeVoice collection](https://huggingface.co/collections/mlx-community/vibevoice) — confirms only Realtime-0.5B (4/5/6/8bit/fp16) TTS variants + ASR variants exist as MLX ports, no 1.5B/7B
- [vibevoice/VibeVoice-7B](https://huggingface.co/vibevoice/VibeVoice-7B) — ~18.7GB, 10-part bf16 safetensors, 9B param count on card
- [microsoft/VibeVoice GitHub README](https://raw.githubusercontent.com/microsoft/VibeVoice/main/README.md) — 4-speaker claim for the TTS (1.5B) variant, repo id table
- [microsoft/VibeVoice-1.5B discussion #30 "The github repo is deleted"](https://huggingface.co/microsoft/VibeVoice-1.5B/discussions/30) and [Hacker News: Microsoft pulls VibeVoice repo after misuse](https://news.ycombinator.com/item?id=45148114) — takedown/restoration history
- [vibevoice-community/VibeVoice GitHub fork](https://github.com/vibevoice-community/VibeVoice) — MIT-licensed community fork preserving original code
- [microsoft/VibeVoice-1.5B discussion #17 "Script for Apple Silicon"](https://huggingface.co/microsoft/VibeVoice-1.5B/discussions/17) — anecdotal PyTorch-MPS report on M4 Max 128GB, ~1.38 it/s, ~16min/segment, not MLX
- Measured directly: `HF_HOME=/Users/chrishafley/projects/tts-air/.hf-cache /Users/chrishafley/projects/tts-air/.venv/bin/python` running `mlx_audio.tts.utils.load_model("mlx-community/VibeVoice-Realtime-0.5B-4bit")` + `model.generate(text=..., voice="en-Emma_woman")`, wrapped with `time.time()` and `resource.getrusage(...).ru_maxrss`, on this M3/16GB box, 2026-07-20 — see table above

---

## Sources

- [Nari Labs Dia GitHub Repository](https://github.com/nari-labs/dia)
- [Nari Labs Dia2 GitHub Repository (streaming)](https://github.com/nari-labs/dia2)
- [Dia-1.6B Hugging Face Model Card](https://huggingface.co/nari-labs/Dia-1.6B)
- [Dia-TTS-Server Documentation](https://github.com/devnen/Dia-TTS-Server/blob/main/documentation.md)
- [Blaizzy mlx-audio GitHub Repository](https://github.com/Blaizzy/mlx-audio)
- [Kokoro-82M GitHub Repository](https://github.com/hexgrad/kokoro)
- [Kokoro-82M Hugging Face Model Card](https://huggingface.co/hexgrad/Kokoro-82M)
- [Kokoro Voices List](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
- [CSM (Sesame) GitHub](https://github.com/isa/sesame-csm)
- [CSM MLX Implementation](https://github.com/senstella/csm-mlx)
- [Misaki G2P Library](https://github.com/tatum/misaki)
