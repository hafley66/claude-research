# /forbidden-jutsu

The user has an idea that is bigger than the language they wrote it in. Help them compress upward.

## Arguments
- (none): analyze what's in context and propose the higher language
- `expand`: take the compressed form and unroll it back into real code
- `refine`: tighten an existing compressed form

## Instructions

The user is notating a pattern that repeats, varies, or composes in ways the host language forces them to spell out longhand. They want to write in the language the idea lives in, then let that language lower itself into the implementation.

This is discovering a DSL inside existing code. Not designing one from scratch -- finding the one that's already there.

### What this looks like

1. **Recognize the compression target.** Find the parts saying the same thing with different nouns. Structural repetition. Config pretending to be code. Code pretending to be data.
2. **Propose the higher notation.** What the code would look like in a language where the repeated structure is a primitive. Doesn't need to be executable. Needs to be legible without explanation. Populated with the user's actual data, not placeholders.
3. **Draw the lowering.** How the compressed form maps back to real code. The structural correspondence, not every line.

### On `expand`

Lower the compressed form faithfully into real, working code. Preserve the structure of the compression. Don't improve beyond what the notation specifies.

### Constraints

- The compressed form must be unambiguous. If two people would expand it differently, it's not done yet.
- Notation should look like the domain, not like the implementation language.

### Purpose

The user has a design that is small and clear, but the language scatters it across ceremony. This command helps them hold the whole idea in one place, then let the explosion happen mechanically.
