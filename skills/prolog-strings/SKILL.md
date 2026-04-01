---
name: prolog-strings
description: Prolog string and text handling -- atoms vs strings vs char lists vs code lists, atom_chars, atom_string, format/2, string concatenation, the double_quotes flag, sub_atom. Trigger on prolog strings, prolog text, prolog atoms, atom_chars, prolog format, prolog string handling.
license: MIT
metadata:
  audience: developers
  workflow: word-linker
---

# Prolog Strings and Text Handling

Prolog text handling is genuinely confusing at first because Prolog lets you represent text in four completely different ways, and which one you get by default depends on a flag. This section breaks down what's happening and how to work with it.


## The Four Text Representations

Prolog doesn't have a single "string type" like JavaScript. Instead, you have four competing representations, each useful in different contexts. Understanding which is which will save you hours of debugging.


### Atoms

An atom is a symbolic constant. Think of it like a JavaScript Symbol or an interned string -- it's a single unique object in memory that represents itself. Atoms are written as lowercase identifiers or quoted strings.

```prolog
% These are all atoms
hello
'Hello World'
'foo@bar.com'
'123'  % Even though it looks like a number, quotes make it an atom
```

Atoms are the workhorse of Prolog. You'll use them for:
- Predicate names (`member`, `append`, `write`)
- Symbols and identifiers (`red`, `active`, `north`)
- Constants and tags (`error(type_error, Context)`)
- Atom operations like `atom_concat` or `atom_chars`

The key property: atoms don't change and are automatically unified. If you write `hello` twice, it's the same thing. They don't have an internal structure like lists do.


### Strings (SWI-Prolog)

SWI-Prolog has a dedicated string type using double quotes. Strings are efficient, modern, and recommended for text processing. They're similar to JavaScript strings in spirit, though they work differently under the hood.

```prolog
"hello"
"Hello World"
"Line 1\nLine 2"
```

A string is a distinct data type from an atom. They don't automatically unify (`"hello" \= hello`), and they have their own predicates (`string_concat`, `string_length`). Strings are great for:
- Processing text data (reading files, parsing input)
- Building formatted output
- Working with natural language or user input

Think of strings as the text-processing tool and atoms as the symbolic constant tool.


### Character Lists

When `double_quotes` is set to `chars`, the notation `"hello"` actually creates a list of single-character atoms:

```prolog
?- set_prolog_flag(double_quotes, chars).
?- X = "hello".
X = [h, e, l, l, o].
```

Each character becomes a separate atom in a list: `[h, e, l, l, o]`. This representation is useful for:
- DCG (Definite Clause Grammar) parsing, which naturally consumes lists
- Character-by-character text processing
- Interfacing with code that expects list-based text

Character lists are falling out of favor in modern Prolog, but you'll still see them in parsing code.


### Code Lists

When `double_quotes` is set to `codes` (the ISO Prolog standard), `"hello"` becomes a list of integer character codes:

```prolog
?- set_prolog_flag(double_quotes, codes).
?- X = "hello".
X = [104, 101, 108, 108, 111].
```

Each character is represented as its ASCII/Unicode code number. Code lists are:
- The ISO Prolog default (for portability)
- Useful when interfacing with C libraries or low-level I/O
- Less pleasant to work with than the other representations

SWI-Prolog doesn't recommend using code lists for new code, but you'll encounter them in legacy systems.


## The double_quotes Flag

The `double_quotes` flag controls what the literal `"text"` means in your source code. This is a global configuration that affects how Prolog parses double-quoted strings.

```prolog
% Set at the top of your file to control what "hello" means
:- set_prolog_flag(double_quotes, atom).   % "hello" = hello (atom)
:- set_prolog_flag(double_quotes, string). % "hello" = "hello" (string object)
:- set_prolog_flag(double_quotes, chars).  % "hello" = [h,e,l,l,o] (char list)
:- set_prolog_flag(double_quotes, codes).  % "hello" = [104,101,...] (code list, ISO)
```

SWI-Prolog's default is `string`. This is the recommended setting for new code because:
- Strings are efficient and modern
- They're easy to read and write
- String predicates are well-designed

The historical setting was `codes` (ISO default), which is why you see code lists in older code and many tutorials. Don't start a new project expecting code lists unless you have a specific reason.


## Working with Atoms

Atoms are the most common text representation you'll use. Most text operations in Prolog start with atom predicates.


### Core Atom Predicates

Here's how to work with atoms. Each example shows the Prolog operation and what it does.

```prolog
% Get the length of an atom
?- atom_length(hello, N).
N = 5.

% Concatenate atoms together (like JavaScript string + concatenation)
?- atom_concat(hello, ' world', Result).
Result = 'hello world'.

% Split an atom into a list of character atoms
?- atom_chars(hello, Chars).
Chars = [h, e, l, l, o].

% Get character codes instead (less useful, but exists)
?- atom_codes(hello, Codes).
Codes = [104, 101, 108, 108, 111].

% Extract a substring: the three numbers are Start, Length, After
?- sub_atom(hello, 1, 3, _, Sub).
Sub = ell.

% Convert between atoms and strings
?- atom_string(hello, S).
S = "hello".
```

Each of these has a direct JavaScript equivalent. `atom_concat` is like `+` or template literals. `atom_chars` is like `split('')`. `sub_atom` is like `slice(start, start + length)`. The main difference is that Prolog uses the same predicates in all directions (they're reversible), whereas JavaScript string methods are typically one-way.


### Reversible Predicates

Many atom predicates work in multiple directions. You can query them backwards.

```prolog
% Forward: given "hello", find its length
?- atom_length(hello, N).
N = 5.

% Backward: given that we want length 5, generate atoms (less useful, but possible)
?- atom_length(Atom, 5).
Atom = _G123.  % Generates a variable (infinite solutions)
```

More usefully:

```prolog
% Forward: concatenate hello + world
?- atom_concat(hello, world, Result).
Result = helloworld.

% Backward: find what concatenates with "world" to make "helloworld"
?- atom_concat(X, world, helloworld).
X = hello.

% Double backward: split "helloworld" into two parts
?- atom_concat(X, Y, helloworld).
X = '', Y = helloworld;
X = h, Y = elloworld;
X = he, Y = lloworld;
% ... and so on (generates all possible splits)
```

This reversibility is powerful but can surprise you if you're used to JavaScript where string methods only work one way.


### Character Classification

Check properties of individual characters:

```prolog
% Is 'a' alphabetic?
?- char_type(a, alpha).
true.

% Is '5' a digit?
?- char_type('5', digit).
true.

% What properties does 'A' have?
?- char_type('A', Type).
Type = upper;
Type = alpha;
Type = alnum;
% ... more types
```

Use this in text parsing to classify and filter characters.


### Case Conversion

Convert between uppercase and lowercase:

```prolog
% Convert to uppercase
?- upcase_atom(hello, U).
U = 'HELLO'.

% Convert to lowercase
?- downcase_atom('HELLO', D).
D = hello.
```

These work with atoms and produce atoms as results.


## Working with Strings (SWI-Prolog)

Strings are the modern way to handle text in SWI-Prolog. Use these when processing natural language, reading files, or building formatted output.


### Core String Predicates

```prolog
% Concatenate strings (like JavaScript + or template literals)
?- string_concat("hello", " world", R).
R = "hello world".

% Get string length
?- string_length("hello", N).
N = 5.

% Get the character code at a position (1-indexed)
?- string_code(1, "hello", C).
C = 104.  % ASCII code for 'h'

% Convert between strings and atoms
?- string_to_atom("hello", A).
A = hello.

?- atom_to_string(hello, S).
S = "hello".
```

Strings have many of the same operations as atoms, but they work on strings instead of atoms.


### split_string/4 -- The Workhorse

Splitting strings is a common task. `split_string/4` is powerful but has a confusing signature.

```prolog
% Split a CSV line: separate by commas, trim whitespace
?- split_string("alice, bob, charlie", ",", " ", Parts).
Parts = ["alice", "bob", "charlie"].
```

The four arguments to `split_string/4` are:

1. **Input string** -- the string you want to split
2. **Separator characters** -- any of these characters act as delimiters (e.g., `","` or `", "`). If a character appears in this string, it causes a split.
3. **Padding characters to remove** -- after splitting, remove any leading/trailing characters from these (e.g., `" "` removes whitespace). Set to `""` if you don't want to trim.
4. **Result** -- the list of substrings

Compare to JavaScript's `split()`:

```javascript
// JavaScript: "a,b,c".split(",") produces ["a", "b", "c"]
// But split_string has more control

// Prolog version with trimming:
split_string("a, b, c", ",", " ", Parts).
% Parts = ["a", "b", "c"]  (whitespace trimmed)
```

`split_string` is more flexible than JavaScript's `split` because you can specify which characters to strip after splitting.


## format/2 and format/3 -- Formatted Output

`format` is Prolog's printf. It lets you build formatted strings with placeholders.

```prolog
% Basic example: write to output
?- format("Hello ~w!~n", [world]).
Hello world!
true.

% Formatting numbers
?- format("~d items, ~2f dollars~n", [3, 4.5]).
3 items, 4.50 dollars
true.

% Build a string instead of printing it
?- format(atom(Result), "~w + ~w", [1, 2]).
Result = '1 + 2'.
```

The key format codes:
- **~w** -- write (print any term)
- **~a** -- atom (print as an atom)
- **~d** -- decimal integer
- **~f** -- floating-point number
- **~2f** -- float with 2 decimal places
- **~n** -- newline
- **~i** -- ignore the next argument (skip it)
- **~s** -- string (expects a code list)

The first argument to `format` can be:
- Empty (prints to output): `format("...", [Args])`
- `atom(Variable)` -- builds an atom: `format(atom(X), "...", [Args])`
- `string(Variable)` -- builds a string: `format(string(X), "...", [Args])`

Think of `format` as a templating system. It's like JavaScript template literals, but with explicit placeholders instead of `${}` syntax.


## String Building Patterns

When you need to build complex strings in Prolog, you have several strategies.


### Atomic List Concatenation

Join a list of values (atoms, numbers, strings) into a single atom:

```prolog
% Join with no separator
?- atomic_list_concat([hello, ' ', world], Result).
Result = 'hello world'.

% Join with a separator
?- atomic_list_concat([alice, bob, charlie], ', ', Result).
Result = 'alice, bob, charlie'.
```

This is like JavaScript's `Array.join()`. It's simple and fast for building atoms from a list of pieces.


### Output to String

For more complex string building, capture output to a string:

```prolog
% Build a string by running code that prints to output
?- with_output_to(atom(Result), (
     write('Item 1'), nl,
     write('Item 2'), nl
   )).
Result = 'Item 1\nItem 2\n'.
```

`with_output_to` is like a context manager. Any output generated inside the goal gets captured to the specified destination instead of printing to the console.


### Serializing Terms

Convert complex Prolog terms to their string representation:

```prolog
% Convert a term to an atom
?- term_to_atom(foo(bar, 123), A).
A = 'foo(bar, 123)'.

% Or to a string
?- term_string(foo(bar, 123), S).
S = "foo(bar, 123)".
```

This is useful when you need to store or transmit Prolog terms as text.


## Practical Advice: What to Actually Use

In SWI-Prolog, here's the guideline for day-to-day work:

**Use atoms for:**
- Identifiers and symbols (`red`, `user_123`, `active`)
- Predicate and functor names
- Constants and tags in your data structures
- Code that needs to be backward-compatible or portable

**Use strings for:**
- Processing text data (reading files, parsing input)
- Building formatted output
- Natural language or user-facing text
- Code where you want modern, efficient string handling

**Use character lists for:**
- DCG parsing (they're naturally suited to list-based parsing)
- Legacy code or DCG-based text processing
- Rare cases where you specifically need character-by-character access

**Use code lists for:**
- ISO Prolog compatibility (if you must)
- Low-level I/O or interfacing with C libraries
- Almost never in new SWI-Prolog code

Set `double_quotes` to `string` and stick with it unless you have a specific reason not to.


## Common Gotcha: Type Mismatch

This bites everyone at least once:

```prolog
% Assuming double_quotes is set to string (SWI default)
?- X = "hello".
X = "hello".  % This is a string

?- X = "hello", atom(X).
false.  % "hello" is NOT an atom, it's a string!

?- X = "hello", string(X).
true.  % It's a string

?- "hello" = hello.
false.  % They don't unify; they're different types
```

When you get unexpected `false` results, check whether you're mixing atoms and strings. They look similar but are different types.

Convert explicitly when needed:

```prolog
% If you have a string but need an atom:
?- atom_string(Atom, "hello").
Atom = hello.

% If you have an atom but need a string:
?- atom_string(hello, String).
String = "hello".
```

Always be clear about which representation you're working with. Set `double_quotes` to `string` at the top of your file to avoid confusion.
