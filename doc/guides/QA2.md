<flow name="QA2" category="DOC/GUIDE" spid="foam" description="How the foam.QA2 decision-matrix questionnaire engine works and where it surprises: inputs vs questions, AQL predicates and how bad ones fail, answered means stored, how the next question is chosen, how outcomes are chosen and applied, overriding engine methods, custom question views, the generated class, and translation limits." keywords="qa2,questionnaire,decision matrix,wizard,predicate,aql,QAWizardView,QuestionChoiceView,information gain,outcomes,applyOutcome,rankOutcomes,override,refines,i18n,translation,knowledge"/>

# QA2: the decision-matrix questionnaire engine

`foam.QA2({...})` turns a table of questions and outcomes into a FOAM class that can pick the next question to ask and narrow down which outcome applies. `foam.u2.qa.QAWizardView` drives it on screen. The engine is `src/foam/u2/qa/QA.js`; a runnable example is `src/foam/u2/qa/demo.md`.

A definition has three lists and a `methods:` array:

- `properties:` typed inputs the system already knows, and output fields.
- `questions:` prompts for the user. A question with no `choices` and no `class` gets Yes/No, stored as the strings `'TRUE'` and `'FALSE'` (`QA.js:161-172`).
- `outcomes:` rows, each with a `predicate` string.
- `methods:` your own helper methods. The key must be present, even as `[]`, or the definition throws (see [Overriding pieces of the engine](#overriding-pieces-of-the-engine)).

---

## Inputs or questions

**An input is something the program already knows; a question is something only the user can answer.** In the demo, `priceLimit` is an input: the app sets it when it creates the object. `cuisine` is a question: the wizard asks it. The engine only ever asks entries from `questions:` (`QA.js:399-406`), so a property is never shown as a question.

**Setting an input rules outcomes out before the first question.** Walk it with the demo:

1. The app creates `RestaurantPicker.create({ priceLimit: 15 })`. `priceLimit` now counts as answered.
2. Every outcome with a `priceLimit` term that 15 fails drops out at once (`QA.js:365-371`): Sushi Place, Thai Restaurant, Fine Italian, Steakhouse, Taco Truck and Upscale Mexican. 5 of 11 are left.
3. A question that no longer splits those 5 scores no gain and is never asked (`QA.js:436`, `:463`).

So set only the inputs you actually know. An input left unset rules nothing out, which is what lets the questions narrow things down. An input that nothing ever sets never rules anything out, so outcomes that differ only on it stay tied until the wizard picks one by itself (see [How outcomes are chosen and applied](#how-outcomes-are-chosen-and-applied)).

**A choice's first element is what gets stored; the second is only what is shown.** `choices: [['LOW', 'Under 20']]` stores `'LOW'`, shows "Under 20", and predicates compare `'LOW'` (`QA.js:486`). The demo's `cuisine` uses bare strings such as `'Asian'`, which are both at once (`src/foam/u2/view/ChoiceView.js:107-112`). Rename `'Asian'` to `'Asian food'` and the stored value changes too, so `cuisine = Asian` in three outcomes stops matching, with no error. Use pairs when the wording may change.

An input that might be unknown should be a `String`, not a `Boolean`; see ["Answered" means a value was stored](#answered-means-a-value-was-stored).

---

## Predicates are AQL, not MLang

Outcome and question `predicate` strings are compiled at runtime by `foam.parse.SimpleQueryParser` (`QA.js:277-292`), the same grammar as the search box. So the syntax is the search syntax:

- `field = value`, `!=`, `>`, `>=`, `<`, `<=`, `IN (...)`, `NOT IN (...)`, `CONTAINS`, `IS EMPTY`, `IS NOT EMPTY`, joined with `AND`, `OR`, `NOT` and parentheses.
- **A `Boolean` property accepts only `IS TRUE` and `IS FALSE`** (`src/foam/parse/SimpleQueryParser.js:214-215`, `:366`). `paid = TRUE` does not parse.
- A Yes/No **question** is a `String` holding `'TRUE'` or `'FALSE'`, so `spicy = TRUE` is an ordinary string comparison and is correct. Check the property's class before "fixing" one form into the other; the demo uses both (`allergicToSeafood IS FALSE AND ... spicy=FALSE`).
- There are no function calls. To compare "days since a date", add a derived property that computes the number and compare that property.

**A typo in a predicate never fails when the class is defined; it fails later, in one of two ways depending on where the typo is.** The predicate is read left to right by the search-box parser. That parser stops at the first thing it cannot read and returns what it had so far, because its check for "reached the end" is commented out (`src/foam/parse/SimpleQueryParser.js:92`, `src/foam/parse/parse.js:1633`). The engine compiles each predicate the first time it uses it (`QA.js:277-291`).

- **Typo in the first comparison: the whole questionnaire throws.** In `cusine = Asian AND spicy = TRUE`, the parser cannot read `cusine`, so it returns nothing (`undefined`). The class still defines. Then the first `getCandidates()` or `selectNextQuestion()` throws `Cannot read properties of undefined (reading 'arg1')` (`QA.js:288`). Every call looks at every outcome, so one bad outcome stops every path, not just its own.
- **Typo after the first comparison: the rest is dropped without a word.** In `cuisine = Asian AND spicey = TRUE`, the parser reads `cuisine = Asian`, stops at `spicey`, and returns that. The outcome now matches any Asian answer, spicy or not. A `==`, an `&&` in place of `AND`, or a missing `)` does the same (measured).

Walk every edited path in a test that asserts which outcome it lands on.

---

## "Answered" means a value was stored

A predicate term only rules an outcome out once the property it names is answered. Answered is decided by `isAnswered_(name)` (`QA.js:343-359`), and it means **a value was stored**, never "the value looks truthy". A Boolean answered `false`, an Int answered `0`, and a choice whose value is `'0'` all count.

Three storage shapes get three tests, all explained in the docstring above `isAnswered_`:

| Property shape | Answered when |
|---|---|
| plain value | `hasOwnProperty(name)` is true |
| `factory`-backed (arrays) | the value is non-empty; reading it runs the factory, so `hasOwnProperty` would lie |
| `expression`-backed | the computed value is not `undefined`, `null` or `''` |

**An input that can be "unknown" should be a `String` with `''`, not a `Boolean` expression returning `null`.** `foam.lang.Boolean`'s adapt is `!!v` (`src/foam/lang/Boolean.js:28`), so any write of `null` (`copyFrom({ flag: null })`, a JSON row with `"flag": null`, a journal replay) stores `false`, and "unknown" silently becomes "answered no". Only an unset default or an expression can stay `null`.

---

## How the next question is chosen

`selectNextQuestion()` (`QA.js:390-464`):

1. Stops when one candidate or none is left.
2. Skips answered questions, and questions whose own `predicate` is already contradicted by stored answers.
3. Scores the rest by information gain: how evenly each choice would split the remaining outcomes (`computeInfoGain`, `QA.js:475-547`).
4. Picks the lowest `priority` number first, then the highest gain, then fewer choices. The default is `100`, and because the engine reads `q.priority || 100` (`QA.js:414`), a priority of `0` also becomes `100`; start at `1`.
5. **Returns the property axiom**, not the question object, or `null` when the best gain is `0` (`QA.js:463`). The axiom has no `choices`; a test that needs the choice list reads the `QUESTIONS` constant by name.

**A question's `predicate` is "not ruled out", not "gate satisfied".** The filter that would require it to be true is commented out (`QA.js:436`, `/*q.enabled &&*/`). A question gated on `cuisine = Asian` can still be asked while `cuisine` is unanswered; it is only excluded once `cuisine` is answered with something else. When a gated question still has gain but its predicate is not yet true, the engine promotes the questions its predicate names: they take the higher gain and a priority one below it (`QA.js:423-434`), so they are asked first. Set a `priority` by hand only when the gate names an input property rather than a question, since an input is never asked.

**A question with a `class:` and no `choices` gets an estimated gain.** The engine cannot split outcomes per choice, so the score is `0.001` per remaining outcome that names the question (`QA.js:503`) plus a rough estimate from outcomes that do not name it. A question that scores `0` is never asked. Give such questions an explicit `priority`.

---

## Custom question views

The generated property for a question gets `foam.u2.qa.QuestionChoiceView` only when the question declares no `class:` (`QA.js:208-213`). So:

- **`class:` is the switch.** Declare `class: 'String'` (or another type) and a `view:` spec to render your own view.
- **Put choices in the `view:` spec, not beside `class:`.** A question with both `class` and `choices` logs `[QACompiler] ... choices are ignored` and renders without them (`QA.js:198-202`).
- **Extend `foam.u2.qa.QuestionChoiceView`**, not `foam.u2.View`. Its `data` postSet calls `wizard.next()` (`src/foam/u2/qa/QuestionChoiceView.js:22-27`); a plain view never advances the wizard. Override `render()` only, and end it with `this.initialized = true;`: the postSet ignores changes until that flag is set, and only the base `render()` sets it (`QuestionChoiceView.js:25`, `:54`).
- `foam.u2.view.RadioView` reads `c[0]` as the value and `c[1]` as the label (`src/foam/u2/view/RadioView.js:96-125`). A third element such as helper text is ignored, so a two-line choice needs its own row rendering.
- A question named the same as a declared property keeps the property and drops the question's view and choices, with a warning (`QA.js:215-218`).

---

## How outcomes are chosen and applied

Two words used below. A **term** is one part of a predicate between top-level `AND`s: `cuisine = Asian AND spicy = TRUE` has two. A **candidate** is an outcome not yet ruled out.

**An outcome stays a candidate until one of its terms is answered and false.** Walk Thai Restaurant, `cuisine = Asian AND spicy = TRUE AND priceLimit >= 20`:

1. The engine splits the predicate into its three terms and notes the property each one tests (`QA.js:282-289`).
2. Nothing is answered yet. A term on an unanswered property cannot rule anything out, so Thai Restaurant is a candidate (`QA.js:300-312`, `:365-372`).
3. The user answers `cuisine` with Italian. The first term is now answered and false, so Thai Restaurant is out.

An outcome with no predicate is never ruled out (`QA.js:308`).

**A term that ends up as an `OR` never rules anything out.** That is any `OR`, and a `NOT` over an `AND`, which the parser rewrites into an `OR`: it simplifies the whole predicate first (`src/foam/parse/SimpleQueryParser.js:481`). `cuisine = Asian OR cuisine = Italian` is one term that names no single property, so the engine never treats it as answered (`QA.js:344-345`), and the outcome survives even after the user picks Mexican (measured). A plain `NOT` over one comparison, or over an `OR`, becomes `!=` terms and rules out normally. Put an `OR` in a derived property, such as a Boolean `asianOrItalian` with an `expression`, and test that property.

After every answer, the wizard counts the candidates (`QAWizardView.advance_()`, `src/foam/u2/qa/QAWizardView.js:215-256`):

- **one left:** it applies that outcome and shows the result step;
- **none left:** the result step says "No candidates eligible..." (`QAWizardView.js:42`, `:294-298`);
- **several left, and a question still worth asking:** it asks that question;
- **several left, and no question worth asking:** it picks one itself.

**The wizard's own pick is never shown to the user.** It ranks the candidates and applies the top one; the step that would let the user choose is commented out (`QAWizardView.js:228`). The rank counts, per candidate, the answered terms that match, then scores matches ÷ all terms × 100 (`QA.js:574-609`), and sorts by matches, then score (`QAWizardView.js:231-234`). Example: two candidates each have 2 matching terms; one has 3 terms (score 67), the other 4 (score 50). The 3-term outcome wins. With a `qaOutcomeLogDAO` in context, the ranking is logged at `ERROR` when the top two tie and at `WARN` otherwise (`QAWizardView.js:236-246`).

**Applying an outcome copies its keys onto the questionnaire object.** `applyOutcome()` copies every key except `predicate` and `terms`, so Thai Restaurant's `name` lands in the `name` property; a key that fails to set is skipped (`QA.js:559-566`). The result step shows the output properties (`OUTPUT_NAMES`); an `outcomeView` replaces that step (`QAWizardView.js:153-160`, `:258-263`).

**A questionnaire can skip outcomes and build its result from the answers.** Use `outcomes: []` when the answers themselves are the result. Then `getCandidates()` returns nothing, and the wizard would stop on "No candidates eligible" at once. So such a questionnaire replaces three engine methods by refinement (next section):

- `getCandidates()` returns two placeholder objects while `selectNextQuestion()` still has a question, and one when it has none, so the wizard keeps asking and then stops;
- `selectNextQuestion()` is replaced too, with one that never calls `getCandidates()`, such as the declared-order walk in the next section. The engine's version calls `getCandidates()` on its first line (`QA.js:391`), so the two would call each other until `RangeError: Maximum call stack size exceeded`, and it cannot score placeholders anyway: they have no `terms` (`QA.js:496`);
- `getProgress()` is replaced too, because the default counts outcomes (`QA.js:382-384`).

Applying an empty placeholder copies nothing, so the questionnaire sets its own result property from the answers and supplies an `outcomeView`, since it has no output properties to show.

---

## Overriding pieces of the engine

**To change how the engine behaves, refine the generated class; `methods:` cannot do it.** The generated class lists methods in this order: `outcomeFormatter`, then your `methods:`, then the engine's own (`QA.js:265-270`, `:277-610`). When a name appears twice, the later one wins. So a `selectNextQuestion` in your `methods:` is replaced by the engine's, silently (measured). Only `outcomeFormatter` comes before yours, so it is the one engine method `methods:` can replace. Refinement adds to a class after it is defined, and a method given there replaces the existing one:

```js
foam.CLASS({
  package: 'com.example',
  name: 'RestaurantPicker',
  refines: 'com.example.RestaurantPicker',
  methods: [ function selectNextQuestion() { /* ... */ } ]
});
```

**A definition with no `methods:` key throws** `TypeError: model.methods is not iterable`. The three lists fall back to `[]` when missing (`QA.js:139-141`); `methods:` does not (`QA.js:270`). `src/foam/u2/qa/demo.md` declares none, so it crashes when run as written. Until that is fixed, write `methods: []`.

- **`outcomeFormatter(outcome)`** gives the name used for each outcome in the ranking (`QA.js:603`). The default returns `outcome.name` (`QA.js:266-267`).
- **Asking questions in the order they are declared.** A common replacement for `selectNextQuestion()` walks `QUESTIONS` top to bottom and returns the first unanswered question whose `predicate` holds right now. To do that it calls `ensureCompiled(q)`, tests `q.mlang.f(this)`, and returns `this.cls_.getAxiomByName(q.name)`. Two things change. The file order becomes the order the user sees, since the engine no longer picks the most useful question. And a question's `predicate` becomes a strict condition: a question gated on `cuisine = Asian` is asked only after the user picks Asian, where the default engine may ask it before `cuisine` is known. A question gated on a property nothing ever sets is never asked.

---

## The generated class

- **It has no shared base class.** `buildClass_` emits a plain class with no `extends` (`QA.js:240-243`). A property that must hold either of two questionnaires is `FObjectProperty` with `of: 'foam.lang.FObject'`; a narrower `of` makes the adapt rebuild the other class as the wrong type.
- **Every extra key on an outcome becomes a `String` property** (`QA.js:222-231`) and is copied onto the object by `applyOutcome`. Put a gating value, such as `priceBand: 'LOW'`, on each outcome as a plain field, and code can list "which outcomes exist for X" by filtering the `OUTCOMES` constant instead of parsing predicate strings.
- **`QUESTIONS`, `OUTCOMES`, `INPUT_NAMES` and `OUTPUT_NAMES` are JavaScript-only constants** (`flags: ['js']`, `QA.js:251-256`). Server code cannot read them.
- Like any model, the class must be registered in a `pom.js` with the `java` flag if a persisted object stores it in a property, or journal replay on the server cannot build it.

---

## Limitation: choices are not translatable

**Question text can be translated; choice labels cannot, today.**

- **Question text.** A question's `prompt` becomes its property's `label` (`QA.js:207`), and the wizard shows that label as the step heading (`QAWizardView.js:441`). A property label holds one text per language (`src/foam/lang/types.js:1432`), so `prompt: { en: 'Spicy?', fr: 'Épicé ?' }` shows "Épicé ?" to a French user (`src/foam/lang/types.js:47-58`, measured). A `Locale` row keyed `com.example.RestaurantPicker.SPICY.label` also replaces it at boot (`src/foam/core/controller/ApplicationController.js:587-609`).
- **Choice labels.** They are shown exactly as written. Up to 15 choices appear as radio buttons that print each label as given (`src/foam/u2/view/RadioView.js:125`), including the built-in English "Yes" and "No" (`QA.js:166-167`). Above 15, the wizard shows a dropdown (`src/foam/u2/qa/QuestionChoiceView.js:50`) that looks up a translation keyed by the label text itself (`<label>.name`, `src/foam/u2/tag/Select.js:145`). Every dropdown in the app that shows the same text shares that key, so it cannot be translated for one questionnaire. Per-questionnaire choice keys are an open TODO (`QA.js:92-94`).
