# Context & Dynamic Scoping

*FOAM Foundations, Article 01*

> **In one sentence:** FOAM's *context* (`X`) is **dynamic scoping made into a first-class
> object** — a runtime environment that resolves names by *who created you*, not by *where
> your code was written*. Once you see that, `imports` and `exports` stop being framework
> ceremony and become a sixty-year-old idea you already half-knew.

---

## 1. The feature, from the outside

In FOAM, every object carries a **context**, conventionally called `X` and reachable as
`this.__context__`. A class declares what it pulls out of that context and what it puts in:

```javascript
foam.CLASS({
  name: 'RecipeListView',
  imports: [ 'recipeDAO', 'currentUser' ],   // "someone above me provides these"
  // ...
});

foam.CLASS({
  name: 'AppController',
  exports: [ 'selectedRecipe' ],             // "my descendants may read this"
  // ...
});
```

Nobody passes `recipeDAO` into `RecipeListView`'s constructor. It isn't a global, either —
two different parts of the app can run with two different `recipeDAO`s in scope at the same
time. The value is simply *in the air* around the object, put there by some ancestor, and
`imports` reaches up and grabs it.

That "in the air, provided by an ancestor, resolved at runtime" behavior has a precise name
in programming-language theory. It is **dynamic scoping**, and it has a wonderful history.

---

## 2. Two kinds of scope

Every language has to answer one question millions of times per second: *when I mention the
name `x`, which `x` do you mean?* There are two classic answers.

**Lexical (a.k.a. static) scope** answers with the **text** of the program. To find `x`, you
look outward through the curly braces / indentation that *textually* enclose the reference —
the structure you can see on the page. This is what closures, `let`, and `const` give you.
It's decided when the code is *written*, and it never changes at runtime.

```javascript
const greeting = 'hello';
function outer() {
  function inner() { return greeting; } // resolved by where inner is *written*
  return inner();
}
// `greeting` is found by walking the source-code nesting, not the call stack.
```

**Dynamic scope** answers with the **runtime history** instead. To find `x`, you look
outward through the chain of *who called (or created) you* — a structure that only exists
while the program runs, and that can be different on every invocation.

Here is the classic thought experiment. Imagine a language where scope is dynamic:

```
(define (emphasis) (string-append style "!!!"))   ; `style` is free — where's it bound?

(define (loud)  (let ((style "LOUD"))  (emphasis)))
(define (quiet) (let ((style "quiet")) (emphasis)))

(loud)   ; => "LOUD!!!"
(quiet)  ; => "quiet!!!"
```

The *same* `emphasis` function returns different results depending on **who called it**.
`style` isn't bound where `emphasis` was written; it's bound by whoever was on the call
chain when it ran. That is dynamic scope in its purest form — and it is *exactly* what
`imports: ['style']` would do in FOAM, with "who created me" standing in for "who called me."

The slogan worth memorizing:

> **Lexical scope: "where was I written?" Dynamic scope: "who invoked me?"**

FOAM's context is dynamic scope keyed on the object-**creation** tree rather than the
call stack — but it is the same idea. `exports` establishes a binding for a whole subtree of
descendants; `imports` resolves a name by walking up that subtree until it finds who
provided it.

---

## 3. A love letter detour: dynamic scope was (sort of) an accident

Here is the part that makes this worth writing a whole article about.

When John McCarthy created Lisp around 1958–1960, he did *not* set out to design dynamic
scope. He was after something close to a practical realization of Alonzo Church's **lambda
calculus** — functions as first-class values, `lambda` and all. Church's lambda calculus is
*lexically* scoped; that's the mathematically correct behavior of a bound variable.

But the early Lisp *interpreter* took a shortcut. It represented the environment as a simple
**association list** — an "a-list" — of name→value pairs, and when it evaluated a free
variable it just searched that list, which at runtime happened to hold the bindings of
whoever was currently executing. The implementation was easy and natural... and it
accidentally produced dynamic scope. The theory said one thing; the interpreter did another.

This wasn't a harmless quirk. It caused a famous, genuinely confusing bug class known as the
**funarg problem** (short for "functional argument"). The moment you tried to pass a function
around as a value — return it, store it, hand it to another function — dynamic scope made its
free variables resolve against the *wrong* environment, the one active at the call site
rather than the one where the function was defined. Higher-order functions, the very thing
lambda calculus is *about*, didn't quite work.

It took until **1975** for Gerald Sussman and Guy Steele to design **Scheme**, the first
Lisp to get this right by using **closures** and proper lexical scope — closing each function
over the environment where it was *defined*, exactly as Church intended. This is one of the
most important corrections in the history of programming languages, and it's why essentially
every language you use today (including JavaScript's `let`/`const` and closures) is lexically
scoped by default.

So why does dynamic scope still exist? Because it turned out to be **the right tool for a
specific job** — and that job is precisely the one FOAM's context is built for.

---

## 4. Dynamic scope, rehabilitated: when "ambient" is exactly what you want

Lexical scope is correct for ordinary variables. But some values are genuinely *ambient* —
they belong to a whole region of a running program, not to one function's text:

- the current database handle / DAO,
- the logged-in user,
- the active transaction,
- the current locale, theme, or request.

Threading these through **every** function signature as explicit parameters is miserable and
noisy (this is sometimes called "parameter tramp" or "the tramp data" problem). Making them
true globals is worse — you can only ever have one, and everything becomes entangled. What
you want is a value that is *scoped to a dynamic extent*: in effect for me and everyone I
call, overridable locally, and gone when we return. That is dynamic scope, and mature
languages deliberately keep a form of it for exactly these cases:

- **Common Lisp** kept dynamic variables on purpose, declared "special" with `defvar` and
  conventionally named with "earmuffs," e.g. `*standard-output*`. You bind them dynamically,
  and every callee sees your binding.
- **Emacs Lisp** was dynamically scoped by default for most of its life (lexical binding
  became an opt-in only in 2012) — which is *why* Emacs is so radically customizable: you can
  rebind almost any behavior for the dynamic extent of your command.
- **Clojure** has `binding` and dynamic `^:dynamic` vars for the same purpose.
- **React's Context** (`<Provider value={…}>` + `useContext`) is dynamic scope over the
  component render tree. Same idea, different tree.
- **FOAM's context** is dynamic scope over the object-creation tree, reified as a
  first-class `X` you can hold, pass, and extend.

The through-line: dynamic scope isn't a mistake to be avoided. It's the precise, correct
answer to "how do I make a value ambient over a runtime region without it being global?"

---

## 5. The formal model: environments as chains of frames

If you want the textbook picture, it comes from *Structure and Interpretation of Computer
Programs* (Abelson & Sussman), the **environment model of evaluation**.

An **environment is a chain of frames.** Each frame is a table of name→value bindings plus a
pointer to an enclosing frame. To look up a name, you search the current frame; if it's not
there, you follow the pointer to the enclosing frame, and so on outward until you find it (or
run out of frames). To *shadow* a name, you add a binding in an inner frame; the outer one is
still there, just hidden.

FOAM's `X` **is** an environment in exactly this sense:

| Environment model (SICP) | FOAM context |
|---|---|
| A frame | One context level |
| The enclosing-frame pointer | The link to the parent context |
| Looking up a name | `X.recipeDAO` / an `imports` resolution |
| Adding a frame | `X.createSubContext({ recipeDAO: … })` |
| Shadowing a binding | A child exporting a name its parent also had |

The difference between lexical and dynamic scope, in this model, is *which chain of frames
you extend*: lexical scope extends the frame where a function was **defined**; dynamic scope
extends the frame of whoever is **running** it. FOAM extends the frame of whoever **created**
the object. Same machinery, different link.

And here's the elegant twist FOAM adds: the environment is a **first-class value.** In a
plain interpreter, the environment is a hidden internal structure you can't touch. FOAM hands
it to you as an object — you can capture it, pass it to another thread, extend it with
`createSubContext`, and inspect it. That capability has its own lineage (first-class
environments in reflective Lisps like 3-Lisp), and it's what makes FOAM's context usable as a
general dependency-injection and service-locator mechanism, not just a scoping rule.

---

## 6. The functional-programming view: the Reader monad

There's one more lens, for the functionally inclined, and it's beautiful because it turns
"ambient value" into pure, ordinary data flow.

In pure functional programming you can't have hidden ambient state — everything is an
explicit argument. So how do you model "a computation that can read a shared environment"
without threading it by hand? You use the **Reader monad**: a value of type `Reader r a` is
really just a function `r -> a`, "give me the environment `r` and I'll produce an `a`." The
monad's job is to thread that `r` through a whole chain of computations automatically, so you
never write it explicitly. Its two signature operations map straight onto FOAM:

| Reader monad | FOAM |
|---|---|
| `ask` — read the whole environment | using `this.__context__` |
| `asks (\r -> r.field)` — read one thing out of it | `imports: ['recipeDAO']` |
| `local (\r -> r') m` — run `m` in a modified environment | `X.createSubContext({…})` |

So `imports` is `ask`; sub-contexts are `local`. FOAM's context is, in effect, **the Reader
monad made imperative and first-class** — dependency injection and the Reader monad are the
same idea wearing different clothes. (Typed languages expose this directly, too: Scala's
`given`/`using` clauses and Haskell's implicit parameters `?x` are both "arguments resolved
from the surrounding scope rather than passed explicitly" — statically-checked cousins of
`imports`.)

---

## 7. At the engineering level: two named patterns

Theory aside, two everyday design-pattern names describe the *mechanism*:

- Because `X` is a **registry keyed by name** that you query at runtime (`X.get('recipeDAO')`),
  the lookup itself is a **Service Locator**. The `imports`/`exports` sugar gives it the
  *feel* of Dependency Injection — you declare your needs and something supplies them — but the
  plumbing underneath is a locator, not constructor injection.
- The inherit-then-override chain is **delegation** — structurally the same move as a
  prototype chain in prototypal inheritance. An unresolved lookup in a child context is
  delegated to its parent, exactly as a missing property is delegated to an object's
  prototype.

Neither is deep theory, but naming them helps: when you wonder "what happens if two ancestors
both export `recipeDAO`?", the delegation model answers instantly — the nearest one wins,
because lookup stops at the first frame that has it.

---

## 8. Bringing it home

Put the layers together and the whole feature collapses into one clean idea:

> **Context is dynamic scoping, reified.** It resolves names by creation lineage instead of
> lexical nesting (dynamic scope); it's structured as a chain of frames you extend
> (the environment model); it threads an ambient environment through your computations
> (the Reader monad); it's a name-keyed runtime registry (Service Locator) with
> nearest-wins lookup (delegation).

Now re-read the FOAM you started with:

```javascript
imports: [ 'recipeDAO', 'currentUser' ],   // ask the ambient environment
exports: [ 'selectedRecipe' ],             // bind a name for my dynamic extent
```

That isn't boilerplate to memorize. It's a sixty-year-old idea — one that started as an
accident in McCarthy's interpreter, got corrected out of the *default* by Scheme in 1975, and
was then deliberately kept for exactly the ambient-value problem FOAM uses it for. When you
write `imports`, you're reaching up an environment chain. When you write `exports`, you're
establishing a dynamic binding. You're speaking Lisp, and you're in very good company.

That's the whole point of this series: the framework is not magic. It's computer science you
can see all the way down — and seeing it makes you better at using it.

---

### Further reading

- Abelson & Sussman, *Structure and Interpretation of Computer Programs*, §3.2 — the
  environment model of evaluation.
- Sussman & Steele, *Scheme: An Interpreter for Extended Lambda Calculus* (1975) — the
  arrival of lexical scope and closures.
- Joel Moses, *The Function of FUNCTION in LISP* (1970) — the original write-up of the
  funarg problem.
- The Reader monad — any Haskell monad tutorial; look for `Reader`, `ask`, `local`.
- React Context and Scala `given`/`using` — the same idea in two very different modern
  languages.

---

*Next in the series: reactivity and slots — FOAM's `this.name$`, and its roots in dataflow
programming and the humble spreadsheet.*
