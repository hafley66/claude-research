---
name: unify
description: Infer and render the structure behind what the user is circling toward -- idea crystallization or conversation replay as proof search. Prolog analogy for pattern recognition.
license: MIT
compatibility: opencode
metadata:
  workflow: thinking
  depth: meta
---

## What I do

Take the current conversational trajectory and crystallize the pattern the user is reaching for. The name is a Prolog analogy: the user has a partially-bound term, and this skill grounds the free variables into something concrete and visible.

## When to use me

Trigger on:
- "/unify" or "unify this"
- User is circling an idea without landing on a concrete form
- User wants the conversation itself replayed as a structured proof trace

## Modes

### Default: idea unification

The user is teetering on an idea. Infer the structure and render it concretely -- code, pseudocode, a type signature, a diagram. Match the domain's notation (TS types if we're in TS, Prolog if we're in Prolog, boxes if it's architecture). Don't give Prolog unless we're literally discussing Prolog.

### With argument referencing "this conversation" / "the whole chat" / similar: conversation replay as proof search

Replay the conversation turn by turn, casting each turn as a Prolog-style query or binding event. For each turn, show:

- **The goal**: what the turn was asking (as a `?-` query)
- **Bindings**: what new information it grounded
- **Open variables**: what remains unresolved
- **Surprise**: where something unified that wasn't expected (unexpected success or failure)

End with the single live unresolved goal the conversation is sitting on -- the decision or question that hasn't been made yet.

Use Prolog comment syntax (`%% ...`) with invented predicates that read naturally. The predicates don't need to be runnable -- they're notation for the shape of the conversation. But if we're in a Prolog project, make them closer to real.

## Examples

**Idea unification** (default):
- User describes a state machine but hasn't named it -> render states and transitions
- User keeps saying "and then it checks..." -> render guard conditions as a decision tree
- User waves at a data flow -> render the pipeline with types at each stage

**Conversation replay**:
- Each turn becomes a `?-` query with bindings shown
- Track which variables got grounded, which forked, which failed
- The final open goal is the decision the user hasn't made yet

```prolog
%% Turn 1: user loads context
%% ?- consult(session_log).
%% Binds the knowledge base. No computation yet.

%% Turn 3: user surprised by unexpected output
%% ?- emits(system, bash).  -> true.  %% unexpected unification
%% The surprise IS a unification event -- something succeeded
%% that the user didn't have a binding for.

%% Final: the open goal
%% ?- value_over_existing_approach(Delta).
%% Delta partially bound. The conversation is a choice point.
```
