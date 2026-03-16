# /forbidden-jutsu

The user has an idea that is bigger than the language they wrote it in. Help them compress upward.

## Arguments
- (none): analyze what's in context and propose the higher language
- `expand`: take the compressed form and unroll it back into real code
- `refine`: tighten an existing compressed form

## Instructions

The user is doing something that most people would call "writing code" but what they're actually doing is notating a pattern that repeats, varies, or composes in ways the host language forces them to spell out longhand. They want to stop spelling it out. They want to write in the language the idea lives in, then let that language lower itself into the implementation.

This is the act of discovering a DSL inside existing code. Not designing one from scratch -- finding the one that's already there, hiding behind the boilerplate.

### What this looks like

1. **Recognize the compression target.** Read the code. Find the parts that are saying the same thing with different nouns. Find the structural repetition that copy-paste propagates. Find the config that's pretending to be code. Find the code that's pretending to be data.

2. **Propose the higher notation.** Show the user what their code would look like if it were written in a language that doesn't exist yet -- one where the repeated structure is a primitive, not a pattern. This notation doesn't need to be executable. It needs to be *legible*. The user should read it and immediately know what it means without explanation.

3. **Draw the lowering.** Show how the compressed form maps back to the real code. Not every line -- the structural correspondence. "This token becomes this block. This row becomes this impl. This comma-separated list becomes these N match arms."

### On `expand`

The user already has the compressed form. They hand it over. The job is to lower it faithfully into real, working code in the target language. Preserve the structure of the compression -- if the notation groups things, the output should group things the same way. Don't "improve" the expansion beyond what the notation specifies.

### Tone

This is a collaborative act of language design, not a refactoring suggestion. The user is not being told their code is bad. Their code captured something real -- the jutsu is about capturing it at a higher altitude so it's easier to see, change, and extend.

No judgment about whether the compression is "worth it." If the user wants to write five lines that expand to fifty, that's the game. If they want to write fifty lines that expand to five hundred, same game, higher stakes.

### Constraints

- The compressed form must be unambiguous. If two people would expand it differently, it's not done yet.
- Prefer notation that looks like the domain, not like the implementation language. If the domain is state machines, the notation should read like states and transitions, not like macro syntax.
- When proposing notation, show it *populated* with the user's actual data, not with placeholder examples.

### Purpose

The user is fighting the verbosity floor of their language. They have a design in their head that is small and clear, but the only way to make it run is to scatter it across hundreds of lines of ceremony. This command exists to help them hold the whole idea in one place, then let the explosion happen mechanically. After a /forbidden-jutsu they should think "that's the real program -- the rest is just what the compiler needs to hear."
