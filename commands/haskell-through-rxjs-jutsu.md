# haskell-through-rxjs-jutsu

Learn Haskell's abstractions by mapping each onto TS/rxjs you already use.
Thesis: you already use typed effect wrappers (`Promise<T>`, `Observable<T>`,
`T | null`, `T[]`, `() => T`); Haskell just types them strictly and names the
operations. Learn the names, the operations are in your fingers.

## The wrapper-to-Haskell map

| TS / rxjs | Haskell | concept |
|---|---|---|
| `Promise.resolve(x)` / `of(x)` / `[x]` | `pure x` | lift into wrapper |
| `.then(f)`, `map(f)` with pure f | `fmap f` / `f <$> w` | Functor |
| `.then(f)` where f returns Promise, `switchMap(f)` | `w >>= f` (bind) | Monad |
| `Promise.all([a,b]).then(([f,x]) => f(x))` / `combineLatest` | `f <$> a <*> b` | Applicative |
| `async/await` | `do` notation | sugar over bind, for ANY wrapper |
| interface per wrapper | typeclass | one `fmap` dispatched on wrapper type |

## Functor

"This wrapper supports map." TS writes it four times (`[].map`, `obs.pipe(map)`,
`.then`, option map); Haskell declares it once per wrapper and `fmap` works on
all. Laws = the ones you already trust for arrays (identity, composition).

## Monad = auto-flatten

Mapping a function that returns the same wrapper nests
(`Observable<Observable<T>>`); `switchMap`/`mergeMap` flatten; Promises
auto-flatten in `.then`. That flatten IS the monad; Haskell calls it `>>=`.
`[1,2,3] >>= \x -> [x, x*10]` = flatMap; `Nothing >>= f` short-circuits like
`?.`. Monad = "wrapper with map AND flatMap." Payoff: `do` notation for free.

## async/await = do notation (the click)

```
foo = do            async function foo() {
  a <- getX           const a = await getX();
  b <- getY a         const b = await getY(a);
  return (a + b)      return a + b; }
```

Identical desugaring to `getX >>= \a -> getY a >>= \b -> pure (a+b)`. Haskell
gives the sugar to EVERY monad: `Maybe` (short-circuit), `[]` (branch per
element = Prolog nondet search), `IO`, `State`. TS only gives it to Promise.

## First three monads

| Haskell | TS analogue | bind does |
|---|---|---|
| `Maybe a` | `a \| null` with `?.` | short-circuit |
| `IO a` | `() => a` thunk only the runtime runs | chain effects; pure code can't call it |
| `[a]` | `a[]` | nondeterminism (Prolog search) |

`IO String` = "description of a side-effecting computation"; only `main` runs.
A function `Int -> Int` literally cannot read a file — that's sprefa's
"sync stays sync" law enforced by the compiler.

## Applicative

Wrapped function + wrapped argument, no sequencing: `Promise.all` /
`combineLatest` shaped. Composes independently/in parallel, which monadic
chaining can't express. Knowing applicative-vs-monadic is most of reactive
design (and the whole batching story — see /batching-jutsu).

## Typeclasses and ADTs

Typeclass = interface parameterized by the WRAPPER type, attachable after the
fact (Rust traits, basically). ADT = discriminated union where the constructor
name is the tag and match exhaustiveness is checked.

## Purity, and why sprefa cares

Effects live in types; pure code can't escape the wrapper. rxjs "no Subject
bridge" corollary = the Haskell purity rule applied to streams. The rulings
keep rediscovering names Haskell already has.

## Do this

1. GHCi; write 20 lines of `do` over `Maybe` and `[]` — it's async/await for
   different wrappers. No monad blogs.
2. Learn You a Haskell ch. 7-11 only (typeclasses through Monad). Two evenings.
3. Rewrite one rxjs pipeline as `do` over a hypothetical Stream monad:
   `switchMap` = `>>=`, `of` = `pure`, `combineLatest` = `<*>`.
4. The transfer target is vocabulary for sprefa's async/sync/Subject rulings,
   not "write Haskell."
