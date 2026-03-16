# /emotion-radar

Psychoacoustic readout of the conversation's emotional topology. The reader should walk away feeling seen in a way that is slightly unsettling and mostly funny.

## Arguments
- (none): full radar sweep of the session so far
- `turn <N>`: zoom into turn N specifically
- `delta`: show only what changed since the last emotional inflection point

## Instructions

Read the conversation. Not the code, not the files -- the *humans in the wire*. What is the user feeling? What did the conversation feel like at each turn? Where did the energy spike, where did it flatten, where did someone get annoyed and not say so?

This is not sentiment analysis. This is emotional sonar.

### Visual vocabulary

Build the output from these components. Use as many or as few as the session warrants. Do not use all of them every time -- that's a dashboard, not a reading.

**Thought waves** -- sinusoidal ASCII showing cognitive frequency. Tight waves = focused grinding. Long lazy waves = exploratory drift. Interference patterns where two threads collide.

```
~∿~~∿∿~∿~~∿∿∿~∿~    focused
∿      ∿      ∿      drifting
~∿∿∿≋≋≋∿∿∿~∿≋≋∿∿    interference
```

**Conic emotional sections** -- cross-sections through the emotional cone. The cone narrows when the user is zeroing in on something. It widens during exploration or frustration. Render as nested contours.

```
          ·
        (   )        narrowing -- locking on
      (       )
    (           )

    (           )
      (       )      widening -- losing grip or expanding scope
        ( · )
          ·
```

**Emotion partitions** -- vertical columns dividing the screen into co-present emotional states. The conversation can hold multiple feelings at once. Label them. Let them crowd each other.

```
│ curiosity  │ mild annoyance │ flow state     │
│            │ ░░░░░░░░░░░░░░ │ ████████████░░ │
│ ▓▓▓▓▓░░░░ │ ░░░░░░░░░░░░░░ │ ████████████░░ │
```

**Turn-by-turn emotion graph** -- left axis is turns, right side is the read. Use block characters, braille dots, or whatever renders the shape best. This one is mandatory -- always include it.

```
 T1  ▕██████░░░░░░▏  curious, warm start
 T2  ▕████████░░░░▏  engaged, building
 T3  ▕██░░░░░░░░░░▏  flat -- waiting
 T4  ▕░░░░████████▏  spike -- found it
 T5  ▕████████████▏  locked in
 T6  ▕██████▓▓░░░░▏  satisfied but fading
```

**Thought partitions** -- horizontal bands showing what the user's mind is sliced between. Not what they said -- what they're *probably thinking about* based on question patterns, hesitations, and pivots.

```
╔══════════════════════════════════════╗
║ 40%  the actual task                 ║
║ 25%  whether this approach is right  ║
║ 20%  something they haven't said yet ║
║ 15%  vibes                           ║
╚══════════════════════════════════════╝
```

**Emotional sonar ping** -- a radial sweep. Place emotions at compass points. Use distance from center to show intensity. This is the signature piece when the mood is complex.

```
                 frustration
                     ·
                   · · ·
         doubt · · · · · · · excitement
               · · ◉ · · ·
         calm    · · · ·    focus
                   · ·
                    ·
                 wonder
```

### Rendering rules

- The output should look like it was intercepted from a satellite that reads feelings. NERV-tier emotional telemetry. A psychic's oscilloscope.
- Asymmetry is good. The layout should feel like it was composed, not templated.
- Label sections with terse, lowercase, slightly-too-specific emotional reads. Not "happy" -- "the particular satisfaction of watching a plan come together." Not "frustrated" -- "the quiet heat of having explained this before."
- One screen max. Dense is fine. Cluttered is not.
- If the conversation has been short or emotionally monotone, say so in the readout. A flat line is a valid reading. Don't hallucinate drama.
- The turn-by-turn graph is always present. Everything else is selected to fit the actual shape of the session.
- Do not use emoji. This is instruments, not decoration.

### Purpose

The user is a human in a text stream. They know what they think but not always what they feel. This command exists to reflect the emotional shape of the conversation back at them in a way that is half diagnostic, half art piece. After reading an /emotion-radar they should think "...yeah, that's about right" and maybe laugh once.
