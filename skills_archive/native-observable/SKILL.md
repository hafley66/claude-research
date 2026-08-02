---
name: native-observable
description: Native browser Observable API (WICG/DOM Observables) — constructor + subscriber model, AbortSignal-as-unsubscribe, chainable operators, Promise-returning terminators, EventTarget.when(). Differences and migration from RxJS. Load before using or polyfilling native Observables.
metadata:
  type: reference
---

# Native Observable API (WICG/DOM Observables)

This is the platform `Observable` that shipped in Chromium, plus
`EventTarget.prototype.when()`. It is NOT RxJS and NOT the abandoned TC39
`proposal-observable`. Read this before reaching for RxJS or before polyfilling.

Every non-obvious claim is tagged:

- (Spec) : WICG spec / explainer (wicg.github.io/observable, WICG/observable README).
- (MDN)  : MDN Web Docs.
- (Impl) : Chromium / chromestatus / Intent-to-Ship / caniuse.
- (Obs)  : credible article, GitHub issue, or standards-position thread.
- (Open) : not pinned to a primary source here; verify before relying.

Inline links are the citations. See the "Conflicts / staleness" ledger at the end.

---

## 1. Status & support

| Fact | Value | Source |
|------|-------|--------|
| Spec home | WICG/Observable, living spec | (Spec) https://wicg.github.io/observable/ |
| Explainer | WICG/observable README | (Spec) https://github.com/WICG/observable |
| DOM integration | `Subscriber`/`SubscribeOptions` depend on `AbortSignal`; `EventTarget.when()` added as partial interface | (Spec) https://wicg.github.io/observable/ |
| Chrome desktop | **135**, enabled by default | (Impl) Intent to Ship https://groups.google.com/a/chromium.org/g/blink-dev/c/stxSgTgMHog |
| Edge | 135 | (Impl) https://caniuse.com/mdn-api_observable |
| Chrome for Android | **135** (same as desktop/WebView) | (Impl) chromestatus milestone fields desktop_first/android_first/webview_first = 135, https://chromestatus.com/feature/5154593776599040 |
| Dev flag (pre-ship) | was behind `--enable-blink-features=ObservableAPI` / `chrome://flags` "Observable API"; not needed at/after 135 | (Impl) https://groups.google.com/a/chromium.org/g/blink-dev/c/stxSgTgMHog |
| chromestatus entry | feature 5154593776599040 (SPA, JS-rendered) | (Impl) https://chromestatus.com/feature/5154593776599040 |
| Firefox | NOT supported; Mozilla standards-position **negative** (concerns: API design, complexity, venue) | (Obs) https://github.com/mozilla/standards-positions/issues/945 ; meta bug https://bugzilla.mozilla.org/show_bug.cgi?id=1871732 |
| Safari / WebKit | NOT supported; WebKit standards-position **support** (positive) | (Obs) https://github.com/WebKit/standards-positions/issues/292 |
| Baseline | NOT Baseline (single-engine: Chromium only). caniuse shows no Baseline badge | (Impl) https://caniuse.com/mdn-api_observable |
| TAG review | w3ctag/design-reviews#902 | (Obs) https://github.com/w3ctag/design-reviews/issues/902 |

One-engine feature. Cross-browser code needs the polyfill (§10). Mozilla negative +
WebKit positive but unimplemented = do not assume convergence soon (Open).

---

## 2. Constructor + subscriber model (lazy / cold)

(Spec) The constructor takes a `SubscribeCallback` run **synchronously on every
`subscribe()`**. Observables are **lazy/cold**: nothing emits, and nothing is
queued, before subscription. Each `subscribe()` re-runs the callback = a fresh
producer per subscriber (no built-in multicast; see §8).

> "Observables are 'lazy' in that they do not start emitting data until they are
> subscribed to, nor do they queue any data before subscription." (Spec, explainer)

```js
const obs = new Observable((subscriber) => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.addTeardown(() => console.log("cleanup"));
  if (subscriber.active) subscriber.complete();   // active === !signal.aborted
  // subscriber.error(e)  // alternative terminal
});
```

`Subscriber` IDL (Spec, https://wicg.github.io/observable/):

```webidl
[Exposed=*]
interface Subscriber {
  undefined next(any value);
  undefined error(any error);
  undefined complete();
  undefined addTeardown(VoidFunction teardown);
  readonly attribute boolean active;       // false once aborted/errored/completed
  readonly attribute AbortSignal signal;   // the subscription's signal
};
callback SubscribeCallback = undefined (Subscriber subscriber);
```

- `subscriber.signal` — the AbortSignal for THIS subscription. Forward it into
  `fetch`, `addEventListener`, timers, etc., so they tear down together. (Spec)
- `subscriber.active` — `true` until terminated (complete/error) or the signal
  aborts. Guard long-running producers on it. (Spec)
- `addTeardown(fn)` — cleanup hook. If the subscription is already inactive when
  you call it, `fn` runs **immediately**, synchronously, inside `addTeardown()`.
  (Spec)

---

## 3. Subscription model — there is NO `unsubscribe()`

THE key difference from RxJS. `subscribe()` returns **`undefined`**. There is no
`Subscription` object and no `.unsubscribe()` method. You cancel by aborting an
`AbortSignal` you passed in. (Spec)

```webidl
undefined subscribe(optional ObserverUnion observer = {},
                    optional SubscribeOptions options = {});
dictionary SubscribeOptions { AbortSignal signal; };
typedef (ObservableSubscriptionCallback or SubscriptionObserver) ObserverUnion;
dictionary SubscriptionObserver {
  ObservableSubscriptionCallback next;
  ObservableSubscriptionCallback error;
  VoidFunction complete;
};
```
(Spec, https://wicg.github.io/observable/)

```js
const ac = new AbortController();
obs.subscribe({ next: v => {}, error: e => {}, complete: () => {} },
              { signal: ac.signal });
ac.abort();   // <-- this is "unsubscribe". Runs teardowns in order.
```

Teardown ordering (Spec):

1. On `complete()`: the observer's `complete` handler runs, THEN teardowns.
2. On `error()`: the observer's `error` handler runs, THEN teardowns.
3. On external `signal.abort()`: teardowns run (subscription becomes inactive).
4. Teardowns registered while already inactive run synchronously at registration.

Composition: because cancellation is just an `AbortSignal`, it threads through
every other signal-aware platform API. Pass `subscriber.signal` to `fetch(url,
{signal})`, `el.addEventListener(t, h, {signal})`, `AbortSignal.timeout(ms)`,
`AbortSignal.any([...])`. Aborting the subscription cancels all of them; you do
not wire up N separate teardown calls. (Spec)

RxJS contrast:

| RxJS | Native |
|------|--------|
| `const s = obs.subscribe(...)` returns a `Subscription` | `obs.subscribe(...)` returns `undefined` |
| `s.unsubscribe()` | `controller.abort()` |
| `s.add(child)` / `s.closed` | compose `AbortSignal`s; `subscriber.active` |
| teardown = function returned from the subscribe callback | `subscriber.addTeardown(fn)` |

---

## 4. Operators — chainable methods, NOT `pipe()`

(Spec) Operators are **instance methods on `Observable`**, chained directly. There
is **no `pipe()`** and there are no free/standalone operator functions. The set is
deliberately small and modeled on TC39 iterator-helpers precedent; "niche"
operators are left to userland. (Spec, explainer)

Observable-returning operators (Spec IDL):

| Method | Signature | Note |
|--------|-----------|------|
| `map` | `map(Mapper)` | `(value, index) => any` |
| `filter` | `filter(Predicate)` | `(value, index) => boolean` |
| `take` | `take(unsigned long long)` | first N |
| `drop` | `drop(unsigned long long)` | skip N |
| `takeUntil` | `takeUntil(any)` | `any` is coerced via `Observable.from`; completes on its first emission |
| `flatMap` | `flatMap(Mapper)` | **this is RxJS `mergeMap`**, not RxJS `flatMap`-the-alias; merges inner observables |
| `switchMap` | `switchMap(Mapper)` | cancels previous inner on new outer value |
| `inspect` | `inspect(ObservableInspectorUnion = {})` | tap/do equivalent; gets next/error/complete + `subscribe`/`abort` hooks |
| `catch` | `catch(CatchCallback)` | `(error) => any`; coerced via `from`; RxJS `catchError` |
| `finally` | `finally(VoidFunction)` | runs on any termination; like `Promise.finally` |

CALL OUTS:
- It is **`flatMap`**, not `mergeMap`. (Spec)
- It is **method chaining**, not FP `pipe`. `obs.map(f).filter(g).take(3)`. (Spec)
- `inspect` is the side-effect ("tap"/"do") operator; there is no `tap`. (Spec)
- No `concatMap`, `exhaustMap`, `scan`, `debounceTime`, `throttle`, `distinct*`,
  `withLatestFrom`, `combineLatest`, `merge`, `zip`, `startWith`, `delay`,
  `retry`, `buffer*`, `window*`, `pairwise` in the shipped set. (Spec; absence)

Tree-shaking: RxJS sells `pipe(map, filter)` of free functions so bundlers drop
unused operators. Native operators are prototype methods on a built-in =
**zero bundle cost**, and tree-shaking is moot. The explainer frames method
choice via setlike/maplike + iterator-helpers precedent, not via tree-shaking.
(Spec; the "tree-shaking is moot because it's a builtin" point is (Obs)/editorial.)

---

## 5. Promise-returning terminators (the ergonomic half)

(Spec) Each subscribes, consumes, and resolves/rejects a `Promise`. **Every one
takes an optional `SubscribeOptions { signal }`**, so they cancel via AbortSignal
just like `subscribe`. IDL:

```webidl
Promise<sequence<any>> toArray(optional SubscribeOptions options = {});
Promise<undefined>     forEach(Visitor callback, optional SubscribeOptions = {});
Promise<boolean>       every(Predicate, optional SubscribeOptions = {});
Promise<boolean>       some(Predicate,  optional SubscribeOptions = {});
Promise<any>           find(Predicate,  optional SubscribeOptions = {});
Promise<any>           first(optional SubscribeOptions = {});
Promise<any>           last(optional SubscribeOptions = {});
Promise<any>           reduce(Reducer, optional any initialValue,
                              optional SubscribeOptions = {});
```
(Spec, https://wicg.github.io/observable/)

Semantics: `first` resolves with the first value then unsubscribes; `last`
resolves with the final value at completion; `find` resolves first match;
`every`/`some` short-circuit; `reduce` like array reduce; `toArray` collects all;
`forEach` resolves `undefined` at completion. (Spec)

Caveat (Spec): terminators that resolve a Promise hand control to a microtask, so
inside `EventTarget.when(...)` you **cannot `preventDefault()`** from the
`.then()` (the default action already fired). Call `preventDefault()` synchronously
in a `map`/`inspect` instead: `el.when("submit").map(e => (e.preventDefault(), e))`.

---

## 6. `Observable.from()` and `EventTarget.when()`

### `Observable.from(value)` (Spec)

Checks in THIS order, throws `TypeError` if none match:

1. already an `Observable` → returned as-is
2. async iterable (`Symbol.asyncIterator`)
3. iterable (`Symbol.iterator`)
4. `Promise` / thenable

**No `Symbol.observable` / "observable protocol" check.** This diverges from RxJS
and from the old TC39 proposal, both of which honor `[Symbol.observable]()`.
Interop objects exposing only `Symbol.observable` are NOT recognized by native
`from()`. (Spec, https://wicg.github.io/observable/#observable-from)

### `EventTarget.prototype.when(type, options)` (Spec)

```webidl
partial interface EventTarget {
  Observable when(DOMString type, optional ObservableEventListenerOptions options = {});
};
dictionary ObservableEventListenerOptions {
  boolean capture = false;
  boolean passive;          // tri-state; no signal/once member
};
```
(Spec, spec.bs partial interface)

- Returns a **cold** Observable. `addEventListener(type, ..., {capture,passive})`
  is added **lazily on each `subscribe()`** and removed on teardown/abort. (Spec)
- Cancellation is via the **subscribe-time** `AbortSignal` (`SubscribeOptions`),
  NOT a `signal` on `when()`'s options — note `ObservableEventListenerOptions`
  has no `signal` or `once` member (unlike `AddEventListenerOptions`). (Spec)
- `el.when("click")` replaces `el.addEventListener("click", h)` and composes:
  `el.when("click").map(...).takeUntil(el.when("mouseup")).subscribe(...)`. (Spec)

---

## 7. Design rationale

(Spec) AbortSignal instead of a Subscription object:

> "By using `AbortController`, you can unsubscribe from an Observable even as it
> synchronously emits data during subscription."

The explainer's framing: Observables "integrate frictionlessly with the main
event-emitting interface (`EventTarget`) and cancellation primitive
(`AbortController`) that live in the Web platform." Reusing the platform's one
cancellation primitive avoids a parallel `Subscription` lifetime type and makes
teardown compose with `fetch`/`addEventListener`/timeouts for free. (Spec)

(Spec) Methods instead of `pipe()`:

> restrict operators "to those that follow the precedent ... similar to how web
> platform APIs that are declared Setlike and Maplike have native properties
> inspired by TC39's Map and Set objects."

Drawn from TC39 iterator-helpers (also method-chained). The explainer does NOT
argue tree-shaking; as built-in methods there is nothing to shake. (Spec)
Verified (2026-06): the explainer documents only the synchronous-emission benefit
quoted above as the rationale — there is no separate "we rejected a Subscription
object because…" paragraph. Platform-primitive reuse is the rest of the case. (Spec)

---

## 8. Gaps vs RxJS — what you still reach for RxJS / polyfill for

(Spec; gaps inferred from absence in shipped IDL)

| Missing | Detail |
|---------|--------|
| `Subject` / multicasting | No `Subject`, `BehaviorSubject`, `ReplaySubject`. Each `subscribe` is a fresh cold producer. No primitive to share/fan-out one source. |
| `connect` / `share` / `shareReplay` / `publish` | Absent. No ref-counted multicast. |
| Schedulers | No `observeOn`/`subscribeOn`/`asyncScheduler`. Timing is whatever the producer does. |
| `pipe()` | Absent (by design, §4). |
| Big operator set | Only the ~10 in §4. No `scan`, `debounceTime`, `throttleTime`, `combineLatest`, `merge`, `zip`, `concat`, `withLatestFrom`, `distinctUntilChanged`, `retry`, `delay`, `buffer*`, `pairwise`, `startWith`, etc. |
| Hot observables | Everything is cold. `when()` adds a listener per subscribe; there is no hot/shared event stream built in. |
| `Symbol.observable` interop | `from()` ignores it (§6). |

Reach for RxJS (or build on the polyfill) when you need multicast/Subjects,
backpressure-ish scheduling, debounce/throttle/combineLatest, or replay. Native
covers: event piping, simple map/filter/take, AbortSignal-native teardown, and
Promise terminators.

---

## 9. RxJS → native equivalence table

| RxJS | Native | Note |
|------|--------|------|
| `new Observable(sub => {...})` | `new Observable(subscriber => {...})` | `subscriber.signal`/`active`/`addTeardown` |
| return teardown fn from subscribe cb | `subscriber.addTeardown(fn)` | |
| `obs.pipe(map(f), filter(g))` | `obs.map(f).filter(g)` | chain, no pipe |
| `mergeMap` | `flatMap` | name change |
| `switchMap` | `switchMap` | same |
| `concatMap` / `exhaustMap` | (none) | userland/RxJS |
| `tap` / `do` | `inspect` | name change |
| `catchError` | `catch` | |
| `finalize` | `finally` | |
| `takeUntil` | `takeUntil` | arg coerced via `from` |
| `take(n)` / `skip(n)` | `take(n)` / `drop(n)` | skip→drop |
| `scan` / `debounceTime` / `combineLatest` / `merge` / `zip` | (none) | RxJS/polyfill |
| `fromEvent(el, "click")` | `el.when("click")` or `Observable.from(...)` | when() is the idiom |
| `from(promise/iterable/asyncIterable)` | `Observable.from(...)` | NO `Symbol.observable` |
| `s = obs.subscribe(...)` | `obs.subscribe(...)` (returns `undefined`) | |
| `s.unsubscribe()` | `controller.abort()` | pass `{signal}` to subscribe |
| `firstValueFrom(obs)` | `obs.first()` | returns Promise, takes `{signal}` |
| `lastValueFrom(obs)` | `obs.last()` | |
| `toArray()` (operator) | `obs.toArray()` (terminator → Promise) | |
| `reduce` / `find` / `every` / `some` / `forEach` | same names, Promise-returning | take `{signal}` |
| `Subject` / `BehaviorSubject` / `ReplaySubject` | (no equivalent) | RxJS/polyfill |
| `share` / `shareReplay` / `connect` | (no equivalent) | RxJS/polyfill |
| `observeOn` / schedulers | (no equivalent) | |

---

## 10. Polyfill

(Obs) Reference polyfill: **`keithamus/observable-polyfill`**, npm
**`observable-polyfill`**, MIT, maintained by Keith Cirkel (a WICG spec editor).
Implements the `Observable` class AND `EventTarget.prototype.when`, plus the
operators/terminators.

- https://github.com/keithamus/observable-polyfill
- `npm install observable-polyfill`
- `import "observable-polyfill";` auto-applies if unsupported; or use
  `isSupported()` / `apply()` to gate manually.

Not labeled "official WICG" in-repo, but it is the de-facto polyfill linked from
the proposal ecosystem and authored by a spec editor. Spec-version tracking /
completeness gaps are not documented in-repo — verify against current spec for
newer operators. (Obs/Open) https://github.com/WICG/observable/issues/107

---

## 11. Snippets

### (a) construct, subscribe, abort to unsubscribe

```js
const ticks = new Observable((subscriber) => {
  let n = 0;
  const id = setInterval(() => subscriber.next(n++), 1000);
  subscriber.addTeardown(() => clearInterval(id));   // runs on abort/complete/error
});

const ac = new AbortController();
ticks.subscribe({ next: (v) => console.log(v) }, { signal: ac.signal });
// later:
ac.abort();   // clearInterval runs; no Subscription object involved
```

### (b) EventTarget.when + operators (clicks → map → takeUntil)

```js
const button = document.querySelector("#go");
const stop   = document.querySelector("#stop");

button
  .when("click")
  .map((e) => ({ x: e.clientX, y: e.clientY }))
  .takeUntil(stop.when("click"))        // completes on first stop-click
  .subscribe({ next: (p) => console.log(p) });
// the click listener is added lazily on subscribe, removed on teardown
```

### (c) Promise terminator with AbortSignal.timeout

```js
const el = document.querySelector("#field");
try {
  // resolve with the first "input" event, but give up after 5s
  const first = await el.when("input").first({ signal: AbortSignal.timeout(5000) });
  console.log("got", first);
} catch (e) {
  // AbortSignal.timeout rejects the terminator's Promise with a TimeoutError
  console.log("no input within 5s", e.name);
}
```

---

## 12. Conflicts / staleness ledger

Verification ledger (RESOLVED items checked 2026-06; OPEN items still need a primary source):

1. **Chrome for Android = 135** (RESOLVED 2026-06). chromestatus 5154593776599040
   milestone fields desktop_first / android_first / webview_first all = 135. The
   earlier "Android 137" was wrong. Desktop 135 also confirmed by Intent to Ship.
2. **"Why AbortSignal not Subscription"** (RESOLVED 2026-06). The explainer states
   only the synchronous-emission benefit (§7 quote); there is no fuller "rejected
   Subscription because…" paragraph. Nothing more to find.
3. **`ObservableEventListenerOptions` members** (RESOLVED 2026-06). spec.bs IDL:
   `dictionary ObservableEventListenerOptions { boolean capture = false; boolean passive; };`
   `passive` has NO default (tri-state); no `signal`/`once` member. when():
   `Observable when(DOMString type, optional ObservableEventListenerOptions options = {});`
   `SubscribeOptions { AbortSignal signal; }` also reconfirmed. `from()` confirmed to
   ignore `Symbol.observable` (order: Observable → asyncIterable → iterable → Promise).
4. **WebKit "support" vs later walk-back.** Intent-to-Ship notes WebKit positive
   was "walked back pending formal TC39 presentation"; the standards-positions
   issue label read "support". Treat WebKit as positive-but-unshipped. (Obs)
5. **Tree-shaking framing in §4** is editorial synthesis (Obs), not a spec quote;
   the spec justifies methods via setlike/maplike + iterator-helpers precedent.
6. **`take(0)` / edge completion semantics, `inspect` exact hook firing order,
   `reduce` no-initial-value-on-empty behavior** not individually verified here.
   (Open) — read https://wicg.github.io/observable/ when these matter.
